import { createHash } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { INTAKE_FILE_MESSAGES, type IntakeUploadResult } from '@pp/contract'

import { AUDIT_ACTIONS } from '../../../common/audit'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import type { TxClient } from '../../../db/client'
import { CLOCK, type Clock, startOfMytDay } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FILE_STORAGE, type FileStorage } from '../../files'
import { inspectUpload } from '../../files/content-inspect'
import { FilesConfig } from '../../files/files.config'
import { FilesService, type StoredFile } from '../../files'
import { JobsService } from '../../jobs'
import { OcrConfig, OcrError, PDF_ENGINE, type PdfEngine } from '../../ocr'
import { Semaphore } from '../../ocr/semaphore'
import { isAdmin, parseId, visibleBatches } from './intake-access'
import { INTAKE_JOB_ENTITY, INTAKE_JOB_TYPES, IntakeFilesConfig } from './intake-files.config'
import { type CallerInfo, IntakeFilesService } from './intake-files.service'
import { decodeUploadName, sanitizeOriginalName } from './intake-names'
import { discardStored } from './intake-storage'

export interface UploadedPart {
  buffer: Buffer
  originalname?: string
}

interface Checked {
  part: UploadedPart
  bytes: Buffer
  name: string
  sha256: string
  pages: number
}

const OPEN = ['submitted', 'processing']

function invalid(message: string): ApiError {
  return ApiError.of('VALIDATION_ERROR', { fields: { files: message } })
}

/**
 * The upload pipeline (BE-37, DESIGN.md). Runs in the request, before any job, and is ALL-OR-NOTHING: if one
 * file is refused nothing is stored. Order per request: batch (404/409), file count, then per file magic bytes
 * (PDF only), size, `pdfEngine.inspect` (encrypted, corrupt, bomb), page limit, hash duplicates, and the daily
 * page quota. The checks are repeated under a row lock just before the rows are written, so two parallel
 * uploads cannot both pass.
 */
@Injectable()
export class IntakeUploadService {
  /** Uploads being checked, stored and written at the same time in this process (the rest wait, F3). */
  private readonly slots: Semaphore

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(FilesConfig) private readonly filesConfig: FilesConfig,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(IntakeFilesConfig) private readonly config: IntakeFilesConfig,
    @Inject(OcrConfig) private readonly ocr: OcrConfig,
    @Inject(PDF_ENGINE) private readonly pdf: PdfEngine,
    @Inject(IntakeFilesService) private readonly batches: IntakeFilesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.slots = new Semaphore(config.uploadConcurrency)
  }

  /** Cheap pre-flight (route guard): 404 for an unknown or out-of-scope batch, 409 for one that no longer takes files. Reads no body. */
  async assertOpen(auth: AuthContext, idText: string): Promise<void> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const batch = await this.prisma.client.intakeBatch.findFirst({ where: { id, ...visibleBatches(auth) }, select: { status: true } })
    if (!batch) throw ApiError.of('NOT_FOUND')
    if (!OPEN.includes(batch.status)) throw ApiError.of('CONFLICT', { message: INTAKE_FILE_MESSAGES.batchClosed })
  }

  async upload(auth: AuthContext, idText: string, parts: UploadedPart[], who: CallerInfo, signal?: AbortSignal): Promise<IntakeUploadResult> {
    await this.assertOpen(auth, idText)
    // Excess requests wait here (their bodies are already buffered, which multer bounds per request).
    const release = await this.slots.acquire(signal)
    try {
      return await this.uploadLocked(auth, idText, parts, who, signal)
    } finally {
      release()
    }
  }

  private async uploadLocked(auth: AuthContext, idText: string, parts: UploadedPart[], who: CallerInfo, signal?: AbortSignal): Promise<IntakeUploadResult> {
    // The batch may have been closed while this request waited for a slot.
    await this.assertOpen(auth, idText)
    const batchId = idFromString(idText)
    if (parts.length === 0) throw invalid(INTAKE_FILE_MESSAGES.type)
    const max = this.config.maxFilesPerBatch
    if (parts.length > max) throw invalid(INTAKE_FILE_MESSAGES.tooManyFiles(max))

    const checked = await this.validate(parts, signal)
    await this.admit(this.prisma.client, auth, batchId, checked)

    // Store the bytes (outside the transaction), then write the rows and the jobs in one transaction.
    const stored: StoredFile[] = []
    try {
      for (const c of checked) {
        stored.push(
          await this.files.storeDerived({ ownerUserId: auth.userId, purpose: 'intake_original', bytes: c.bytes, isTest: auth.mode !== null }),
        )
      }
      return await this.prisma.transaction(
        async (tx) => {
          await this.lock(tx, auth, batchId, checked)
          await this.admit(tx, auth, batchId, checked)
          return this.write(tx, auth, batchId, checked, stored, who)
        },
        { maxWait: 10_000, timeout: 30_000 },
      )
    } catch (err) {
      await this.discard(stored)
      throw err
    }
  }

  // ---- validation (no storage) -----------------------------------------------------------------

  /** One file after the other, stopping at the first refusal, so a bad request costs at most one worker. */
  private async validate(parts: UploadedPart[], signal?: AbortSignal): Promise<Checked[]> {
    const limit = this.filesConfig.intakeMaxBytes
    const checked: Checked[] = []
    const seen = new Set<string>()
    for (const part of parts) {
      const result = await this.checkOne(part, limit, signal)
      if ('error' in result) throw result.error
      if (seen.has(result.sha256)) throw invalid(INTAKE_FILE_MESSAGES.duplicate)
      seen.add(result.sha256)
      checked.push(result)
    }
    return checked
  }

  private async checkOne(part: UploadedPart, limit: number, signal?: AbortSignal): Promise<Checked | { error: ApiError }> {
    const buffer = part.buffer
    if (buffer.length > limit) return { error: invalid(INTAKE_FILE_MESSAGES.size(Math.floor(limit / (1024 * 1024)))) }
    const inspected = inspectUpload(buffer)
    if (!inspected || inspected.mime !== 'application/pdf') return { error: invalid(INTAKE_FILE_MESSAGES.type) }
    let pages: number
    try {
      const info = await this.pdf.inspect(buffer, signal)
      if (info.encrypted) return { error: invalid(INTAKE_FILE_MESSAGES.encrypted) }
      pages = info.pageCount
    } catch (err) {
      if (err instanceof OcrError) return { error: invalid(this.messageFor(err.code)) }
      throw err
    }
    if (!Number.isInteger(pages) || pages < 1) return { error: invalid(INTAKE_FILE_MESSAGES.corrupt) }
    if (pages > this.ocr.maxPages) return { error: invalid(INTAKE_FILE_MESSAGES.pages(this.ocr.maxPages)) }
    return {
      part,
      bytes: inspected.bytes,
      name: sanitizeOriginalName(decodeUploadName(part.originalname)),
      sha256: createHash('sha256').update(inspected.bytes).digest('hex'),
      pages,
    }
  }

  /** BM message of a PDF inspection failure. */
  private messageFor(code: OcrError['code']): string {
    switch (code) {
      case 'ENCRYPTED':
        return INTAKE_FILE_MESSAGES.encrypted
      case 'TOO_COMPLEX':
      case 'OCR_TIMEOUT':
        return INTAKE_FILE_MESSAGES.tooComplex
      case 'TOO_MANY_PAGES':
        return INTAKE_FILE_MESSAGES.pages(this.ocr.maxPages)
      default:
        return INTAKE_FILE_MESSAGES.corrupt
    }
  }

  // ---- admission (state-dependent rules) -------------------------------------------------------

  /** Serialises uploads of one batch, of one user (daily quota) and of the same content (duplicates). */
  private async lock(tx: TxClient, auth: AuthContext, batchId: bigint, checked: Checked[]): Promise<void> {
    await tx.$queryRaw`SELECT id FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:user:${auth.userId}`}, 0))`
    for (const sha of checked.map((c) => c.sha256).sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intake:sha:${sha}`}, 0))`
    }
  }

  private async admit(db: Pick<TxClient, 'intakeBatch' | 'intakeFile'>, auth: AuthContext, batchId: bigint, checked: Checked[]): Promise<void> {
    const batch = await db.intakeBatch.findUnique({ where: { id: batchId }, select: { status: true } })
    if (!batch) throw ApiError.of('NOT_FOUND')
    if (!OPEN.includes(batch.status)) throw ApiError.of('CONFLICT', { message: INTAKE_FILE_MESSAGES.batchClosed })

    const max = this.config.maxFilesPerBatch
    const existing = await db.intakeFile.count({ where: { batchId } })
    if (existing + checked.length > max) throw invalid(INTAKE_FILE_MESSAGES.tooManyFiles(max))

    const shas = checked.map((c) => c.sha256)
    const dup = await db.intakeFile.findFirst({
      where: { sha256: { in: shas }, OR: [{ batchId }, { batch: { status: { notIn: ['failed', 'cancelled'] } } }] },
      select: { id: true },
    })
    if (dup) throw invalid(INTAKE_FILE_MESSAGES.duplicate)

    if (!isAdmin(auth)) {
      const today = startOfMytDay(this.clock.now())
      const used = await db.intakeFile.aggregate({
        _sum: { pageCount: true },
        where: { batch: { ownerUserId: idFromString(auth.userId) }, createdAt: { gte: today, lt: new Date(today.getTime() + 24 * 3600 * 1000) } },
      })
      const adding = checked.reduce((n, c) => n + c.pages, 0)
      if ((used._sum.pageCount ?? 0) + adding > this.config.dailyPageQuota) {
        throw ApiError.of('RATE_LIMITED', { message: INTAKE_FILE_MESSAGES.quota, retryAfter: 3600 })
      }
    }
  }

  // ---- writes ----------------------------------------------------------------------------------

  private async write(
    tx: TxClient,
    auth: AuthContext,
    batchId: bigint,
    checked: Checked[],
    stored: StoredFile[],
    who: CallerInfo,
  ): Promise<IntakeUploadResult> {
    const now = this.clock.now()
    const created: bigint[] = []
    for (const [i, c] of checked.entries()) {
      const file = await tx.intakeFile.create({
        data: {
          batchId,
          fileId: idFromString((stored[i] as StoredFile).id),
          originalName: c.name,
          sha256: c.sha256,
          sizeBytes: BigInt(c.bytes.length),
          pageCount: c.pages,
          status: 'uploaded',
          createdAt: now,
        },
      })
      await tx.intakePage.createMany({ data: Array.from({ length: c.pages }, (_, n) => ({ intakeFileId: file.id, pageNo: n + 1 })) })
      await this.jobs.enqueue(
        {
          type: INTAKE_JOB_TYPES.processFile,
          idempotencyKey: `${INTAKE_JOB_TYPES.processFile}:${c.sha256}:${idToString(file.id)}`,
          entityType: INTAKE_JOB_ENTITY,
          entityId: idToString(file.id),
          payload: { intakeFileId: idToString(file.id) },
        },
        tx,
      )
      created.push(file.id)
    }
    const batch = await tx.intakeBatch.findUniqueOrThrow({ where: { id: batchId }, select: { submittedAt: true } })
    await tx.intakeBatch.update({
      where: { id: batchId },
      data: { status: 'processing', submittedAt: batch.submittedAt ?? now },
    })
    await this.audit.record({
      action: AUDIT_ACTIONS.INTAKE_FILES_UPLOADED,
      actorUserId: auth.userId,
      actorRole: auth.active.role,
      scopeLevel: auth.active.scope.level,
      schoolId: auth.active.scope.schoolId ?? null,
      targetType: 'intake_batch',
      targetId: idToString(batchId),
      requestId: who.requestId,
      ip: who.ip,
      isTest: auth.mode !== null,
      details: { files: checked.length, pages: checked.reduce((n, c) => n + c.pages, 0) },
      tx,
    })
    const detail = await this.batches.detail(auth, batchId)
    const ids = new Set(created.map((id) => idToString(id)))
    return { files: detail.files.filter((f) => ids.has(f.id)) }
  }

  /** Removes objects stored for a request that did not commit. Never throws. */
  private discard(stored: StoredFile[]): Promise<void> {
    return discardStored(this.prisma, this.storage, stored.map((s) => s.id))
  }
}
