import { Inject, Injectable } from '@nestjs/common'
import {
  INTAKE_BATCH_MESSAGES,
  INTAKE_FILE_MESSAGES,
  INTAKE_MAX_RETRIES,
  INTAKE_MIN_ADMIN_YEAR,
  INTAKE_RETRYABLE_PAGE_CODES,
  type IntakeBatchCreate,
  type IntakeBatchDetail,
  type IntakeBatchListQuery,
  type IntakeBatchSummary,
  type IntakeFileProgress,
  type IntakePageList,
  type IntakeRetryResult,
} from '@pp/contract'

import { AUDIT_ACTIONS } from '../../../common/audit'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import type { AuthContext } from '../../../common/scope/auth-context'
import type { TxClient } from '../../../db/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FilesService } from '../../files'
import { JobsService } from '../../jobs'
import { WORKFLOW_JOB_ENTITY, WORKFLOW_JOB_TYPE } from '../workflow/workflow.constants'
import { INTAKE_JOB_ENTITY, INTAKE_JOB_TYPES, IntakeFilesConfig } from './intake-files.config'
import { isAdmin, parseId, visibleBatches } from './intake-access'
import {
  bboxFromJson,
  blocksFromJson,
  errorCodeOrNull,
  RIGHTS_TO_DB,
  toBatchSummary,
  type BatchItemCounts,
  toFileSummary,
  type BatchRow,
} from './intake-mappers'
import { attachmentDisposition } from './intake-names'

export interface CallerInfo {
  ip: string | null
  requestId: string | null
}

export interface ServedBytes {
  bytes: Buffer
  mime: string
  /** Set for the original download only. */
  disposition?: string
}

const BATCH_INCLUDE = {
  owner: { select: { id: true, name: true } },
  files: { select: { pageCount: true }, orderBy: { id: 'asc' as const } },
} as const

/** Batches (the question-paper submission), page lists, cancel and authenticated reads of images and originals. */
@Injectable()
export class IntakeFilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(IntakeFilesConfig) private readonly config: IntakeFilesConfig,
  ) {}

  // ---- batches ---------------------------------------------------------------------------------

  /**
   * S1-T03 (DM-09, DM-85): the declared header of a batch. An Admin Pusat batch must name the level (U-02) and a year between 2015 and
   * this year (D11); a paper code, when typed, must end in the Kertas digit (D10b); a blank paper code, exam board or set is stored as null (D10a).
   */
  private async checkedHeader(auth: AuthContext, body: IntakeBatchCreate): Promise<{ educationLevelId: bigint | null; paperCode: string | null; examBoard: string | null; setLabel: string | null }> {
    const fields: Record<string, string> = {}
    if (isAdmin(auth) && (body.year < INTAKE_MIN_ADMIN_YEAR || body.year > new Date().getFullYear())) fields.year = INTAKE_BATCH_MESSAGES.yearRequired
    let educationLevelId: bigint | null = null
    if (body.educationLevelId === undefined) {
      if (isAdmin(auth)) fields.educationLevelId = INTAKE_BATCH_MESSAGES.levelRequired
    } else {
      const key = parseId(body.educationLevelId)
      const level = key === null ? null : await this.prisma.client.educationLevel.findUnique({ where: { id: key }, select: { id: true, stage: true } })
      if (!level || level.stage === 'primary') fields.educationLevelId = INTAKE_BATCH_MESSAGES.levelRequired
      else educationLevelId = level.id
    }
    const paperCode = body.paperCode === undefined || body.paperCode === '' ? null : body.paperCode
    if (paperCode !== null && Number(paperCode.slice(-1)) !== body.kertas) fields.paperCode = INTAKE_BATCH_MESSAGES.paperCodeKertas(body.kertas)
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
    return {
      educationLevelId,
      paperCode,
      examBoard: body.examBoard === undefined || body.examBoard === '' ? null : body.examBoard,
      setLabel: body.setLabel === undefined || body.setLabel === '' ? null : body.setLabel,
    }
  }

  async createBatch(auth: AuthContext, body: IntakeBatchCreate, who: CallerInfo): Promise<IntakeBatchSummary> {
    const ownerId = idFromString(auth.userId)
    const header = await this.checkedHeader(auth, body)
    const row = await this.prisma.transaction(async (tx) => {
      if (!isAdmin(auth)) {
        // One create at a time per user, so two parallel requests cannot both pass the count.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:user:${auth.userId}`}, 0))`
        const open = await tx.intakeBatch.count({ where: { ownerUserId: ownerId, status: { in: ['submitted', 'processing'] } } })
        if (open >= this.config.maxActiveBatches) {
          throw ApiError.of('RATE_LIMITED', { message: INTAKE_FILE_MESSAGES.quota, retryAfter: 3600 })
        }
      }
      const created = await tx.intakeBatch.create({
        data: {
          ownerUserId: ownerId,
          status: 'submitted',
          paperType: body.paperType,
          subject: body.subject,
          kertas: body.kertas,
          year: body.year,
          ...header,
          sourceText: body.source,
          rightsStatus: RIGHTS_TO_DB[body.copyright],
          note: body.notes ?? null,
          isTest: auth.mode !== null,
        },
        include: BATCH_INCLUDE,
      })
      await this.record(AUDIT_ACTIONS.INTAKE_BATCH_CREATED, auth, created.id, who, { paperType: body.paperType, subject: body.subject }, tx)
      return created
    })
    return toBatchSummary(row as BatchRow)
  }

  /**
   * S1-T08 (DM-72): creates the batch of a teacher's paper submission (`source = 'guru'`: free-text subject, no kertas, a
   * guru paper type slug, rights `own`). Used only by the guru paper intake adapter. More than `maxActiveBatches` open batches
   * is 409 (ERR-QUOTA-04), unlike the admin route's 429.
   */
  async createGuruBatch(
    auth: AuthContext,
    input: { paperType: string; subject: string; year: number | null; sourceText: string; note: string | null },
    who: CallerInfo,
  ): Promise<bigint> {
    const ownerId = idFromString(auth.userId)
    return this.prisma.transaction(async (tx) => {
      if (!isAdmin(auth)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:user:${auth.userId}`}, 0))`
        // Active = still being processed, or finished (`ready_for_review` or `selesai_dengan_ralat`) but not yet handled by the admin: an office-only batch is never
        // processed, so it would otherwise bypass the limit. Handled = it has items and every one is accepted or rejected.
        const open = await tx.intakeBatch.count({
          where: {
            ownerUserId: ownerId,
            source: 'guru',
            OR: [
              { status: { in: ['submitted', 'processing'] } },
              { status: { in: ['ready_for_review', 'selesai_dengan_ralat'] }, OR: [{ items: { none: {} } }, { items: { some: { reviewState: { notIn: ['accepted', 'rejected'] } } } }] },
            ],
          },
        })
        if (open >= this.config.maxActiveBatches) {
          throw ApiError.of('CONFLICT', { message: INTAKE_FILE_MESSAGES.activeLimit(this.config.maxActiveBatches) })
        }
      }
      const created = await tx.intakeBatch.create({
        data: {
          ownerUserId: ownerId,
          source: 'guru',
          status: 'submitted',
          paperType: input.paperType,
          subject: input.subject,
          kertas: null,
          year: input.year,
          sourceText: input.sourceText,
          rightsStatus: 'own',
          note: input.note,
          isTest: auth.mode !== null,
        },
        select: { id: true },
      })
      await this.record(AUDIT_ACTIONS.INTAKE_BATCH_CREATED, auth, created.id, who, { paperType: input.paperType, source: 'guru' }, tx)
      return created.id
    })
  }

  /** Removes a just-created, still empty guru batch (the adapter's undo when its upload was refused). Never throws. */
  async discardEmptyBatch(batchId: bigint): Promise<void> {
    try {
      await this.prisma.transaction(async (tx) => {
        const files = await tx.intakeFile.count({ where: { batchId } })
        if (files === 0) await tx.intakeBatch.deleteMany({ where: { id: batchId, source: 'guru', status: 'submitted' } })
      })
    } catch {
      /* best effort: an orphan empty batch is harmless and visible to the admin */
    }
  }

  async listBatches(auth: AuthContext, query: IntakeBatchListQuery): Promise<{ data: IntakeBatchSummary[]; meta: ReturnType<typeof listMeta> }> {
    const where = { ...visibleBatches(auth), ...(query.status ? { status: query.status } : {}), ...(query.source ? { source: query.source } : {}) }
    const [total, rows] = await Promise.all([
      this.prisma.client.intakeBatch.count({ where }),
      this.prisma.client.intakeBatch.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: BATCH_INCLUDE,
      }),
    ])
    // One aggregate for the whole page (no query per row).
    const counts = await this.itemCountsOf(rows.map((r) => r.id))
    return { data: rows.map((r) => toBatchSummary(r as BatchRow, counts.get(r.id))), meta: listMeta(query.page, query.pageSize, total) }
  }

  async getBatch(auth: AuthContext, idText: string): Promise<IntakeBatchDetail> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    return this.detail(auth, id)
  }

  /** Loads a batch the caller may see (404 otherwise) with its files and per-file progress. */
  async detail(auth: AuthContext, id: bigint): Promise<IntakeBatchDetail> {
    const row = await this.prisma.client.intakeBatch.findFirst({
      where: { id, ...visibleBatches(auth) },
      include: { owner: { select: { id: true, name: true } }, files: { orderBy: { id: 'asc' } } },
    })
    if (!row) throw ApiError.of('NOT_FOUND')
    const progress = await this.progressOf(row.files.map((f) => f.id))
    return {
      ...toBatchSummary(row as BatchRow, (await this.itemCountsOf([row.id])).get(row.id)),
      files: row.files.map((f) => toFileSummary(f, progress.get(f.id) ?? { total: f.pageCount ?? 0, done: 0, failed: 0 })),
    }
  }

  /**
   * Per batch: the items and the items with no unconfirmed low-confidence field (`low_fields` minus `confirmed_fields` is empty), in
   * one grouped statement for all the given batches (REQ-C-009). A batch without items is absent (the caller falls back to zeros).
   */
  async itemCountsOf(batchIds: bigint[]): Promise<Map<bigint, BatchItemCounts>> {
    const out = new Map<bigint, BatchItemCounts>()
    if (batchIds.length === 0) return out
    const rows = await this.prisma.client.$queryRaw<{ batch_id: bigint; n: number; reviewed: number }[]>`
      SELECT batch_id, count(*)::int AS n,
             (count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM unnest(low_fields) AS f WHERE f <> ALL(confirmed_fields))))::int AS reviewed
        FROM intake_items
       WHERE batch_id = ANY(${batchIds}::bigint[])
       GROUP BY batch_id`
    for (const r of rows) out.set(r.batch_id, { itemCount: r.n, reviewedCount: r.reviewed })
    return out
  }

  /** Per-file page counts: total, finished (done or not needed) and failed. */
  async progressOf(fileIds: bigint[]): Promise<Map<bigint, IntakeFileProgress>> {
    const out = new Map<bigint, IntakeFileProgress>()
    if (fileIds.length === 0) return out
    const groups = await this.prisma.client.intakePage.groupBy({
      by: ['intakeFileId', 'ocrStatus'],
      where: { intakeFileId: { in: fileIds } },
      _count: { _all: true },
    })
    for (const g of groups) {
      const p = out.get(g.intakeFileId) ?? { total: 0, done: 0, failed: 0 }
      p.total += g._count._all
      if (g.ocrStatus === 'failed') p.failed += g._count._all
      else if (g.ocrStatus === 'done' || g.ocrStatus === 'not_needed') p.done += g._count._all
      out.set(g.intakeFileId, p)
    }
    return out
  }

  // ---- cancel ----------------------------------------------------------------------------------

  async cancelBatch(auth: AuthContext, idText: string, who: CallerInfo): Promise<IntakeBatchDetail> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const visible = await this.prisma.client.intakeBatch.findFirst({ where: { id, ...visibleBatches(auth) }, select: { id: true } })
    if (!visible) throw ApiError.of('NOT_FOUND')

    await this.prisma.transaction(async (tx) => {
      // The batch row lock orders cancel against uploads and against the processing hand-over.
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM intake_batches WHERE id = ${id} FOR UPDATE`
      const status = locked[0]?.status
      if (status === undefined) throw ApiError.of('NOT_FOUND')
      if (status === 'cancelled') return // idempotent
      if (status !== 'submitted' && status !== 'processing') throw ApiError.of('CONFLICT')

      const files = await tx.intakeFile.findMany({ where: { batchId: id }, select: { id: true, status: true } })
      const open = files.filter((f) => f.status === 'uploaded' || f.status === 'processing').map((f) => f.id)
      if (open.length > 0) {
        await tx.intakeFile.updateMany({ where: { id: { in: open } }, data: { status: 'cancelled', errorCode: 'CANCELLED' } })
        await tx.intakePage.updateMany({
          where: { intakeFileId: { in: open }, ocrStatus: 'pending' },
          data: { ocrStatus: 'failed', errorCode: 'CANCELLED' },
        })
      }
      await tx.intakeBatch.update({ where: { id }, data: { status: 'cancelled', statusReason: null } })
      // Every file id (not only the open ones): a job of a finished file has nothing left to cancel, and the call is cheap.
      await this.jobs.cancelFor(INTAKE_JOB_ENTITY, files.map((f) => idToString(f.id)), tx)
      await this.record(AUDIT_ACTIONS.INTAKE_BATCH_CANCELLED, auth, id, who, { files: files.length }, tx)
    })
    return this.detail(auth, id)
  }

  // ---- retry (S1-T04, API-Q-26) ------------------------------------------------------------------

  /** POST /intake/files/{id}/retry: runs the failed pages of one file again (+1 `retry_count`). */
  async retryFile(auth: AuthContext, idText: string): Promise<IntakeRetryResult> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const file = await this.prisma.client.intakeFile.findFirst({ where: { id, batch: visibleBatches(auth) }, select: { batchId: true } })
    if (!file) throw ApiError.of('NOT_FOUND')
    const { attempt, retriesLeft } = await this.prisma.transaction((tx) => this.retryInBatch(tx, auth, file.batchId, new Map([[id, 'all']]), false))
    return { attempt, retriesLeft }
  }

  /** POST /intake/batches/{id}/retry: runs the failed pages of every file that has some (+1 `retry_count` on each). */
  async retryBatch(auth: AuthContext, idText: string): Promise<IntakeRetryResult> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const batch = await this.prisma.client.intakeBatch.findFirst({ where: { id, ...visibleBatches(auth) }, select: { id: true } })
    if (!batch) throw ApiError.of('NOT_FOUND')
    const { attempt, retriesLeft } = await this.prisma.transaction((tx) => this.retryInBatch(tx, auth, id, 'every-file', false))
    return { attempt, retriesLeft }
  }

  /**
   * The one retry path (file route, batch route and `extract` with `pages[]`). Under the batch row lock: the batch must be finished
   * (`ready_for_review`, `selesai_dengan_ralat` or `failed`; a cancelled one is final, 409) and no file may still be processing (409). Every
   * file to re-run must have a retry left, else the whole call is refused with ERR-INT-11 and nothing changes. The failed pages that a retry
   * can fix (`INTAKE_RETRYABLE_PAGE_CODES`) go back to `pending`, the file back to `processing` with `retry_count` + 1 (the breaker starts again),
   * the page jobs are queued under a key that carries the retry count, and the batch goes back to `processing`. When the batch already
   * has extracted items (or `withRun`), a pages run is queued too, so the re-read pages are extracted when OCR has finished.
   */
  async retryInBatch(
    tx: TxClient,
    auth: AuthContext,
    batchId: bigint,
    wanted: Map<bigint, number[] | 'all'> | 'every-file',
    withRun: boolean,
  ): Promise<IntakeRetryResult & { pages: Array<{ fileId: bigint; pageNo: number }>; runId: bigint | null }> {
    const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
    const status = locked[0]?.status
    if (status === undefined) throw ApiError.of('NOT_FOUND')
    if (status !== 'ready_for_review' && status !== 'selesai_dengan_ralat' && status !== 'failed') throw ApiError.of('CONFLICT')

    const files = await tx.intakeFile.findMany({
      where: { batchId },
      orderBy: { id: 'asc' },
      select: { id: true, status: true, sha256: true, retryCount: true, pageCount: true },
    })
    if (files.some((f) => f.status === 'uploaded' || f.status === 'processing')) throw ApiError.of('CONFLICT')

    const retryable: string[] = [...INTAKE_RETRYABLE_PAGE_CODES]
    const plan: Array<{ file: (typeof files)[number]; pageNos: number[] }> = []
    for (const file of files) {
      const want = wanted === 'every-file' ? 'all' : wanted.get(file.id)
      if (want === undefined) continue
      const failed = await tx.intakePage.findMany({
        where: { intakeFileId: file.id, ocrStatus: 'failed', errorCode: { in: retryable }, ...(want === 'all' ? {} : { pageNo: { in: want } }) },
        orderBy: { pageNo: 'asc' },
        select: { pageNo: true },
      })
      if (failed.length > 0) plan.push({ file, pageNos: failed.map((p) => p.pageNo) })
    }
    if (plan.length === 0) throw ApiError.of('CONFLICT') // nothing a retry can fix
    // The limit is checked for every file before any is changed: one exhausted file refuses the whole call (ERR-INT-11).
    if (plan.some((p) => p.file.retryCount >= INTAKE_MAX_RETRIES)) {
      throw ApiError.of('CONFLICT', { message: INTAKE_FILE_MESSAGES.retryExhausted })
    }

    const pages: Array<{ fileId: bigint; pageNo: number }> = []
    let attempt = 0
    for (const { file, pageNos } of plan) {
      const next = file.retryCount + 1
      attempt = Math.max(attempt, next)
      await tx.intakePage.updateMany({
        where: { intakeFileId: file.id, pageNo: { in: pageNos }, ocrStatus: 'failed' },
        data: { ocrStatus: 'pending', errorCode: null },
      })
      await tx.intakeFile.update({ where: { id: file.id }, data: { status: 'processing', errorCode: null, retryCount: next } })
      for (const pageNo of pageNos) {
        pages.push({ fileId: file.id, pageNo })
        await this.jobs.enqueue(
          {
            type: INTAKE_JOB_TYPES.page,
            idempotencyKey: `${INTAKE_JOB_TYPES.page}:${file.sha256}:${idToString(file.id)}:${pageNo}:r${next}`,
            entityType: INTAKE_JOB_ENTITY,
            entityId: idToString(file.id),
            payload: { intakeFileId: idToString(file.id), pageNo },
          },
          tx,
        )
      }
    }

    // A batch that already has items gets its re-read pages extracted too (`selesai_dengan_ralat` is decided when that run ends).
    const hadItems = withRun || (await tx.intakeExtractionRun.count({ where: { batchId, state: 'succeeded', itemCount: { gt: 0 } } })) > 0
    let runId: bigint | null = null
    if (hadItems) {
      const run = await tx.intakeExtractionRun.create({ data: { batchId, requestedById: idFromString(auth.userId) } })
      const job = await this.jobs.enqueue(
        {
          type: WORKFLOW_JOB_TYPE,
          idempotencyKey: `${WORKFLOW_JOB_TYPE}:${run.id}`,
          entityType: WORKFLOW_JOB_ENTITY,
          entityId: idToString(batchId),
          payload: { runId: idToString(run.id), wait: 0, pages: pages.map((p) => ({ fileId: idToString(p.fileId), pageNo: p.pageNo })) },
        },
        tx,
      )
      await tx.intakeExtractionRun.update({ where: { id: run.id }, data: { jobId: idFromString(job.id) } })
      runId = run.id
    }
    await tx.intakeBatch.update({ where: { id: batchId }, data: { status: 'processing', statusReason: null } })
    return { attempt, retriesLeft: INTAKE_MAX_RETRIES - attempt, pages, runId }
  }

  // ---- pages -----------------------------------------------------------------------------------

  async listPages(auth: AuthContext, fileIdText: string): Promise<IntakePageList> {
    const fileId = parseId(fileIdText)
    if (fileId === null) throw ApiError.of('NOT_FOUND')
    const file = await this.prisma.client.intakeFile.findFirst({
      where: { id: fileId, batch: visibleBatches(auth) },
      select: {
        id: true,
        pages: {
          orderBy: { pageNo: 'asc' },
          include: { figures: { orderBy: { id: 'asc' } } },
        },
      },
    })
    if (!file) throw ApiError.of('NOT_FOUND')
    return {
      fileId: idToString(file.id),
      pages: file.pages.map((p) => ({
        pageNo: p.pageNo,
        width: p.width,
        height: p.height,
        textSource: p.textSource === 'ocr' ? 'ocr' : p.textSource === 'text_layer' ? 'text-layer' : null,
        text: p.text,
        ocrConfidence: p.ocrConfidence === null ? null : Number(p.ocrConfidence),
        ocrStatus: p.ocrStatus as 'pending' | 'not_needed' | 'done' | 'failed',
        errorCode: errorCodeOrNull(p.errorCode),
        hasImage: p.imageFileId !== null,
        blocks: blocksFromJson(p.ocrBlocks),
        figures: p.figures
          .filter((f) => f.cropFileId !== null)
          .map((f) => ({ id: idToString(f.id), bbox: bboxFromJson(f.bbox), altTextSuggestion: f.altTextSuggestion })),
      })),
    }
  }

  // ---- serving ---------------------------------------------------------------------------------

  /** Page image or thumbnail. Unknown, out of scope and "no image yet" are all 404. */
  async pageImage(auth: AuthContext, fileIdText: string, n: number, kind: 'image' | 'thumb'): Promise<ServedBytes> {
    const fileId = parseId(fileIdText)
    if (fileId === null || !Number.isInteger(n) || n < 1) throw ApiError.of('NOT_FOUND')
    const page = await this.prisma.client.intakePage.findFirst({
      where: { intakeFileId: fileId, pageNo: n, intakeFile: { batch: visibleBatches(auth) } },
      select: { imageFileId: true, thumbFileId: true },
    })
    const stored = kind === 'image' ? page?.imageFileId : page?.thumbFileId
    return this.read(stored ?? null)
  }

  async figureImage(auth: AuthContext, figureIdText: string): Promise<ServedBytes> {
    const id = parseId(figureIdText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const figure = await this.prisma.client.intakeFigure.findFirst({
      where: { id, intakePage: { intakeFile: { batch: visibleBatches(auth) } } },
      select: { cropFileId: true },
    })
    return this.read(figure?.cropFileId ?? null)
  }

  async original(auth: AuthContext, fileIdText: string): Promise<ServedBytes> {
    const id = parseId(fileIdText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const file = await this.prisma.client.intakeFile.findFirst({
      where: { id, batch: visibleBatches(auth) },
      select: { fileId: true, originalName: true },
    })
    const served = await this.read(file?.fileId ?? null)
    return { ...served, disposition: attachmentDisposition(file?.originalName ?? '') }
  }

  /** Reads the stored bytes AFTER the scope check on the intake row; a missing row or object is 404. */
  private async read(storedId: bigint | null): Promise<ServedBytes> {
    if (storedId === null) throw ApiError.of('NOT_FOUND')
    const content = await this.files.readStored(idToString(storedId))
    if (!content) throw ApiError.of('NOT_FOUND')
    return { bytes: content.bytes, mime: content.mime }
  }

  // ---- audit -----------------------------------------------------------------------------------

  private async record(
    action: string,
    auth: AuthContext,
    batchId: bigint,
    who: CallerInfo,
    details: Record<string, unknown>,
    tx: TxClient,
  ): Promise<void> {
    await this.audit.record({
      action,
      actorUserId: auth.userId,
      actorRole: auth.active.role,
      scopeLevel: auth.active.scope.level,
      schoolId: auth.active.scope.schoolId ?? null,
      targetType: 'intake_batch',
      targetId: idToString(batchId),
      requestId: who.requestId,
      ip: who.ip,
      isTest: auth.mode !== null,
      details,
      tx,
    })
  }
}
