import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { INTAKE_BATCH_TIMEOUT_CODE, INTAKE_FILE_MESSAGES, IntakeFileErrorCodeSchema } from '@pp/contract'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FILE_STORAGE, FilesService, type FileStorage } from '../../files'
import { type ClaimedJob, JobError, JobsService } from '../../jobs'
import {
  OCR_ENGINE,
  OcrConfig,
  OcrError,
  OcrImageService,
  OcrWatchdogError,
  PDF_ENGINE,
  isScannedPage,
  type OcrEngine,
  type PdfEngine,
  type RenderedPage,
  type TextBlock,
} from '../../ocr'
import { BATCH_SWEEP_SECONDS, INTAKE_JOB_ENTITY, INTAKE_JOB_TYPES, IntakeFilesConfig } from './intake-files.config'
import { IntakeFiguresService } from './intake-figures.service'
import { capText, clampBlocks, MAX_PAGE_TEXT, stripNul } from './intake-mappers'
import { discardStored } from './intake-storage'

const ACTIVE = ['submitted', 'processing']
const THUMB_WIDTH = 240
/** Page codes that count towards the circuit breaker, and how many failed pages trip it. */
const BREAKER_CODES = ['TOO_COMPLEX', 'OCR_TIMEOUT', 'RENDER_FAILED'] as const
const BREAKER_PAGES = 2

/** A job error code as a page/file error code of the contract. */
function pageCodeOf(code: string): string {
  switch (code) {
    case 'TIMEOUT':
    case 'STUCK':
      return 'OCR_TIMEOUT'
    case 'MEMORY_WATCHDOG':
      return 'TOO_COMPLEX'
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      return IntakeFileErrorCodeSchema.safeParse(code).success ? code : 'OCR_FAILED'
  }
}

interface PagePayload {
  intakeFileId: bigint
  pageNo: number
}

function readPagePayload(job: ClaimedJob): PagePayload {
  const p = (job.payload ?? {}) as { intakeFileId?: unknown; pageNo?: unknown }
  const pageNo = typeof p.pageNo === 'number' && Number.isInteger(p.pageNo) && p.pageNo >= 1 ? p.pageNo : null
  try {
    if (typeof p.intakeFileId === 'string' && pageNo !== null) return { intakeFileId: idFromString(p.intakeFileId), pageNo }
  } catch {
    // fall through
  }
  throw new JobError('BAD_PAYLOAD', false)
}

/** Result of reading one page, before it is written. */
type PageResult =
  | { kind: 'text'; text: string; blocks: TextBlock[] }
  | { kind: 'ocr'; text: string; confidence: number; blocks: TextBlock[] }
  | { kind: 'failed'; code: OcrError['code'] }

/**
 * Background processing of an upload (BE-37): `intake.process_file` fans a file out into one `intake.page`
 * job per page; a page job reads the text layer, falls back to OCR for scanned pages, stores the page image and
 * thumbnail, and then asks `finalizeIfDone` to close the file and the batch. Handlers re-load everything from the
 * database and do nothing for a cancelled batch. A failure of one PAGE (timeout, no OCR engine, render error) marks only that
 * page; only unexpected errors are thrown, so the runner retries them with backoff.
 */
@Injectable()
export class IntakeProcessingService implements OnModuleInit {
  private readonly logger = new Logger(IntakeProcessingService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(OcrConfig) private readonly ocrConfig: OcrConfig,
    @Inject(PDF_ENGINE) private readonly pdf: PdfEngine,
    @Inject(OCR_ENGINE) private readonly ocr: OcrEngine,
    @Inject(OcrImageService) private readonly images: OcrImageService,
    @Inject(IntakeFiguresService) private readonly figures: IntakeFiguresService,
    @Inject(IntakeFilesConfig) private readonly config: IntakeFilesConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const pageBudget = this.ocrConfig.pageTimeoutMs * 4 + 30_000
    this.jobs.register(INTAKE_JOB_TYPES.processFile, (job, signal) => this.processFile(job, signal), {
      timeoutMs: 120_000,
      onExhausted: (job, code) => this.onProcessFileExhausted(job, code),
    })
    this.jobs.register(INTAKE_JOB_TYPES.page, (job, signal) => this.processPage(job, signal), {
      timeoutMs: pageBudget,
      onExhausted: (job, code) => this.onPageExhausted(job, code),
    })
    this.jobs.register(INTAKE_JOB_TYPES.cropFigure, (job, signal) => this.cropFigure(job, signal), { timeoutMs: pageBudget })
    // S1-T04: the batch clock. A self-rescheduling sweep (the worker has no recurring jobs): every run fails the timed-out batches and
    // queues the next run. If the chain ever breaks (the job ran out of attempts) the hook starts it again; so does every boot.
    this.jobs.register(INTAKE_JOB_TYPES.batchTimeout, () => this.runBatchTimeoutJob(), {
      timeoutMs: 60_000,
      onExhausted: () => this.scheduleBatchTimeout(),
    })
    if (this.config.workerEnabled) {
      try {
        await this.scheduleBatchTimeout()
      } catch {
        // Database not reachable at boot (the next boot or the hook starts the chain); never block start-up.
      }
    }
  }

  // ---- intake.batch_timeout --------------------------------------------------------------------

  /** Queues the sweep for `delaySeconds` from now. The idempotency key is the time bucket, so any number of callers make one job. */
  async scheduleBatchTimeout(delaySeconds = 0): Promise<void> {
    const at = Date.now() + delaySeconds * 1000
    const bucket = Math.floor(at / (BATCH_SWEEP_SECONDS * 1000))
    await this.jobs.enqueue({
      type: INTAKE_JOB_TYPES.batchTimeout,
      idempotencyKey: `${INTAKE_JOB_TYPES.batchTimeout}:${bucket}`,
      payload: { bucket },
      runAfter: delaySeconds > 0 ? new Date(at) : undefined,
    })
  }

  private async runBatchTimeoutJob(): Promise<void> {
    try {
      await this.sweepBatchTimeouts()
    } finally {
      await this.scheduleBatchTimeout(BATCH_SWEEP_SECONDS)
    }
  }

  /**
   * Fails every batch that has been `processing` for longer than `OCR_BATCH_TIMEOUT_MS` (ERR-INT-05, code `OCR_BATCH_TIMEOUT`) and returns
   * how many. The clock of a batch is the earliest `started_at` of the jobs of its current round (its file jobs and its extraction job,
   * started since the batch last changed): "the worker picked up the first file". `started_at` is used instead of `locked_at` because the
   * stuck sweep and a retry backoff clear `locked_at`. A batch that is `submitted` (waiting for the AI budget) is never timed out. The
   * unread pages fail with `OCR_TIMEOUT`, so a retry can run them again.
   */
  async sweepBatchTimeouts(): Promise<number> {
    const due = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT b.id
        FROM intake_batches b
       WHERE b.status = 'processing'
         AND (
           SELECT min(j.started_at)
             FROM jobs j
            WHERE j.started_at IS NOT NULL
              AND j.started_at >= b.updated_at - interval '1 minute'
              AND ((j.entity_type = ${INTAKE_JOB_ENTITY} AND j.entity_id IN (SELECT f.id::text FROM intake_files f WHERE f.batch_id = b.id))
                OR (j.entity_type = 'intake_batch' AND j.entity_id = b.id::text))
         ) < now() - make_interval(secs => ${this.config.batchTimeoutMs}::float8 / 1000.0)`
    let failed = 0
    for (const { id } of due) if (await this.timeOutBatch(id)) failed += 1
    return failed
  }

  private async timeOutBatch(batchId: bigint): Promise<boolean> {
    return this.prisma.transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
      if (locked[0]?.status !== 'processing') return false
      this.logger.warn(`${INTAKE_BATCH_TIMEOUT_CODE}: batch ${idToString(batchId)} is over ${this.config.batchTimeoutMs} ms`)
      const files = await tx.intakeFile.findMany({ where: { batchId }, select: { id: true } })
      const open = await tx.intakeFile.findMany({ where: { batchId, status: { in: ['uploaded', 'processing'] } }, select: { id: true } })
      if (open.length > 0) {
        const ids = open.map((f) => f.id)
        await tx.intakePage.updateMany({ where: { intakeFileId: { in: ids }, ocrStatus: 'pending' }, data: { ocrStatus: 'failed', errorCode: 'OCR_TIMEOUT' } })
        await tx.intakeFile.updateMany({ where: { id: { in: ids } }, data: { status: 'failed', errorCode: 'OCR_TIMEOUT' } })
      }
      await this.jobs.cancelFor(INTAKE_JOB_ENTITY, files.map((f) => idToString(f.id)), tx)
      await this.jobs.cancelFor('intake_batch', [idToString(batchId)], tx)
      // An extraction run that was still going ends with the batch (its late result is dropped by `persist`).
      await tx.intakeExtractionRun.updateMany({
        where: { batchId, state: { in: ['queued', 'running'] } },
        data: { state: 'failed', reasonCode: 'EXTRACTION_FAILED', finishedAt: new Date() },
      })
      await tx.intakeBatch.update({ where: { id: batchId }, data: { status: 'failed', statusReason: INTAKE_FILE_MESSAGES.ocrTimeout } })
      return true
    })
  }

  // ---- intake.process_file ---------------------------------------------------------------------

  async processFile(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    let fileId: bigint
    try {
      fileId = idFromString(String((job.payload as { intakeFileId?: unknown } | null)?.intakeFileId ?? job.entityId ?? ''))
    } catch {
      throw new JobError('BAD_PAYLOAD', false)
    }
    const file = await this.prisma.client.intakeFile.findUnique({
      where: { id: fileId },
      select: { id: true, sha256: true, status: true, batch: { select: { status: true } } },
    })
    if (!file || !ACTIVE.includes(file.batch.status) || (file.status !== 'uploaded' && file.status !== 'processing')) return

    await this.prisma.client.intakeFile.updateMany({ where: { id: fileId, status: 'uploaded' }, data: { status: 'processing' } })
    const pending = await this.prisma.client.intakePage.findMany({
      where: { intakeFileId: fileId, ocrStatus: 'pending' },
      orderBy: { pageNo: 'asc' },
      select: { pageNo: true },
    })
    if (signal.aborted) throw signal.reason
    await this.prisma.transaction(async () => {
      for (const p of pending) {
        await this.jobs.enqueue({
          type: INTAKE_JOB_TYPES.page,
          idempotencyKey: `${INTAKE_JOB_TYPES.page}:${file.sha256}:${idToString(fileId)}:${p.pageNo}`,
          entityType: INTAKE_JOB_ENTITY,
          entityId: idToString(fileId),
          payload: { intakeFileId: idToString(fileId), pageNo: p.pageNo },
        })
      }
    })
    if (pending.length === 0) await this.finalizeIfDone(fileId)
  }

  // ---- intake.page -----------------------------------------------------------------------------

  async processPage(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    const { intakeFileId, pageNo } = readPagePayload(job)
    const page = await this.prisma.client.intakePage.findFirst({
      where: { intakeFileId, pageNo },
      select: {
        id: true,
        ocrStatus: true,
        imageFileId: true,
        intakeFile: { select: { id: true, fileId: true, status: true, batch: { select: { status: true, ownerUserId: true, isTest: true } } } },
      },
    })
    if (!page) return
    const file = page.intakeFile
    if (!ACTIVE.includes(file.batch.status) || file.status === 'cancelled') return
    if (page.ocrStatus !== 'pending') {
      // Already read (a retry after a crash between the page write and the file close): only finish the bookkeeping.
      await this.finalizeIfDone(file.id)
      return
    }

    const original = await this.files.readStored(idToString(file.fileId))
    if (!original) {
      await this.writePage(page.id, { kind: 'failed', code: 'RENDER_FAILED' }, null)
      await this.finalizeIfDone(file.id)
      return
    }

    let rendered: RenderedPage | null | undefined
    const render = async (): Promise<RenderedPage | null> => {
      if (rendered === undefined) {
        rendered = await this.pdf.render(original.bytes, pageNo, { dpi: this.ocrConfig.renderDpi, maxPixels: this.ocrConfig.maxPixels }, signal)
      }
      return rendered
    }

    let result: PageResult
    try {
      const extraction = await this.pdf.extractText(original.bytes, pageNo, signal)
      if (!isScannedPage(extraction, this.ocrConfig.minTextChars)) {
        result = { kind: 'text', text: capText(stripNul(extraction.text), MAX_PAGE_TEXT), blocks: clampBlocks(extraction.blocks) }
      } else if (!this.ocr.available) {
        result = { kind: 'failed', code: 'OCR_UNAVAILABLE' }
      } else {
        const image = await render()
        if (!image) {
          result = { kind: 'failed', code: 'RENDER_FAILED' }
        } else {
          const ocr = await this.ocr.recognize(image.png, signal)
          result = { kind: 'ocr', text: capText(stripNul(ocr.text), MAX_PAGE_TEXT), confidence: ocr.confidence, blocks: clampBlocks(ocr.blocks) }
        }
      }
    } catch (err) {
      if (signal.aborted) throw signal.reason ?? err
      if (!(err instanceof OcrError)) throw err // unexpected: the runner retries with backoff
      // The watchdog measures growth of the whole process, so a neighbour can trip it: retry once before blaming the page.
      if (err instanceof OcrWatchdogError && job.attempts === 1) throw new JobError('MEMORY_WATCHDOG', true)
      result = { kind: 'failed', code: err.code }
    }

    // The page image and thumbnail are best effort: a page that was read keeps its text without them.
    const stored: string[] = []
    let image: { imageFileId: bigint; thumbFileId: bigint; width: number; height: number } | null = null
    const skipImage = result.kind === 'failed' && rendered === undefined && result.code !== 'OCR_UNAVAILABLE'
    if (page.imageFileId === null && !skipImage) {
      try {
        const png = await render()
        if (png) image = await this.storeImages(png.png, file.batch, stored)
      } catch (err) {
        if (signal.aborted) throw signal.reason ?? err
        if (!(err instanceof OcrError)) throw err
      }
    }
    if (signal.aborted) {
      await discardStored(this.prisma, this.storage, stored)
      throw signal.reason
    }

    const written = await this.writePage(page.id, result, image)
    if (!written) await discardStored(this.prisma, this.storage, stored) // lost a race with a cancel
    if (written && result.kind === 'failed') await this.circuitBreaker(file.id)
    await this.finalizeIfDone(file.id)
  }

  // ---- terminal failures -----------------------------------------------------------------------

  /** A page job that ran out of attempts: the page fails with the job's code so the file and batch can finish. */
  async onPageExhausted(job: ClaimedJob, code: string): Promise<void> {
    const { intakeFileId, pageNo } = readPagePayload(job)
    await this.prisma.client.intakePage.updateMany({
      where: { intakeFileId, pageNo, ocrStatus: 'pending' },
      data: { ocrStatus: 'failed', errorCode: pageCodeOf(code) },
    })
    await this.circuitBreaker(intakeFileId)
    await this.finalizeIfDone(intakeFileId)
  }

  /** A process_file job that ran out of attempts: the file fails (its pages never started) and the batch is closed if it was the last. */
  async onProcessFileExhausted(job: ClaimedJob, code: string): Promise<void> {
    const fileId = idFromString(String((job.payload as { intakeFileId?: unknown } | null)?.intakeFileId ?? job.entityId ?? ''))
    await this.failFile(fileId, pageCodeOf(code))
    await this.finalizeIfDone(fileId)
  }

  /**
   * Circuit breaker (F1): when two pages of one file have failed with a resource code (TOO_COMPLEX, OCR_TIMEOUT,
   * RENDER_FAILED), the file is treated as hostile or hopeless: it is marked failed (TOO_COMPLEX), its remaining
   * pages fail with it and its queued and running jobs are cancelled.
   */
  private async circuitBreaker(fileId: bigint): Promise<void> {
    // After a retry the breaker starts again: the TOO_COMPLEX pages the earlier trip failed in bulk (never read) no longer count.
    const file = await this.prisma.client.intakeFile.findUnique({ where: { id: fileId }, select: { retryCount: true } })
    const codes = (file?.retryCount ?? 0) > 0 ? BREAKER_CODES.filter((c) => c !== 'TOO_COMPLEX') : [...BREAKER_CODES]
    const tripped = await this.prisma.client.intakePage.count({
      where: { intakeFileId: fileId, ocrStatus: 'failed', errorCode: { in: codes } },
    })
    if (tripped < BREAKER_PAGES) return
    await this.failFile(fileId, 'TOO_COMPLEX')
  }

  /** Marks an open file failed with `code`, fails its pending pages and cancels its jobs, under the batch lock. */
  private async failFile(fileId: bigint, code: string): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: bigint; status: string }[]>`
        SELECT b.id, b.status FROM intake_batches b JOIN intake_files f ON f.batch_id = b.id WHERE f.id = ${fileId} FOR UPDATE OF b`
      if (!locked[0] || !ACTIVE.includes(locked[0].status)) return
      const changed = await tx.intakeFile.updateMany({
        where: { id: fileId, status: { in: ['uploaded', 'processing'] } },
        data: { status: 'failed', errorCode: code },
      })
      if (changed.count === 0) return
      await tx.intakePage.updateMany({ where: { intakeFileId: fileId, ocrStatus: 'pending' }, data: { ocrStatus: 'failed', errorCode: code } })
      await this.jobs.cancelFor(INTAKE_JOB_ENTITY, [idToString(fileId)], tx)
    })
  }

  private async storeImages(
    png: Buffer,
    batch: { ownerUserId: bigint | null; isTest: boolean },
    stored: string[],
  ): Promise<{ imageFileId: bigint; thumbFileId: bigint; width: number; height: number }> {
    const owner = batch.ownerUserId === null ? null : idToString(batch.ownerUserId)
    const full = await this.images.encode(png, { format: 'webp' })
    const thumb = await this.images.encode(png, { format: 'webp', maxWidth: THUMB_WIDTH })
    const a = await this.files.storeDerived({ ownerUserId: owner, purpose: 'intake_page', bytes: full.data, isTest: batch.isTest })
    stored.push(a.id)
    const b = await this.files.storeDerived({ ownerUserId: owner, purpose: 'intake_page', bytes: thumb.data, isTest: batch.isTest })
    stored.push(b.id)
    return { imageFileId: idFromString(a.id), thumbFileId: idFromString(b.id), width: full.width, height: full.height }
  }

  /** Conditional write: only a still-pending page is changed, so a retry or a cancel cannot be overwritten. */
  private async writePage(
    pageId: bigint,
    result: PageResult,
    image: { imageFileId: bigint; thumbFileId: bigint; width: number; height: number } | null,
  ): Promise<boolean> {
    const imageData = image
      ? { imageFileId: image.imageFileId, thumbFileId: image.thumbFileId, width: image.width, height: image.height }
      : {}
    const data: Prisma.IntakePageUncheckedUpdateManyInput =
      result.kind === 'text'
        ? {
            ocrStatus: 'not_needed',
            text: result.text,
            textSource: 'text_layer',
            hasTextLayer: true,
            ocrConfidence: null,
            ocrBlocks: result.blocks as unknown as Prisma.InputJsonValue,
            errorCode: null,
            ...imageData,
          }
        : result.kind === 'ocr'
          ? {
              ocrStatus: 'done',
              text: result.text,
              textSource: 'ocr',
              hasTextLayer: false,
              ocrConfidence: Math.min(100, Math.max(0, Number.isFinite(result.confidence) ? result.confidence : 0)),
              ocrBlocks: result.blocks as unknown as Prisma.InputJsonValue,
              errorCode: null,
              ...imageData,
            }
          : { ocrStatus: 'failed', errorCode: result.code, ...imageData }
    const res = await this.prisma.client.intakePage.updateMany({ where: { id: pageId, ocrStatus: 'pending' }, data })
    return res.count === 1
  }

  // ---- closing a file and its batch ------------------------------------------------------------

  /**
   * When every page of the file is terminal the file becomes `done` (`failed` when every page failed) and, when
   * every file of the batch is terminal, the batch becomes `ready_for_review` (at least one page was read) or `failed` (none was).
   * The batch row is locked first, so pages finishing together close the file and the batch exactly once.
   */
  async finalizeIfDone(fileId: bigint): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: bigint; status: string }[]>`
        SELECT b.id, b.status FROM intake_batches b JOIN intake_files f ON f.batch_id = b.id WHERE f.id = ${fileId} FOR UPDATE OF b`
      const batch = locked[0]
      if (!batch || !ACTIVE.includes(batch.status)) return

      const file = await tx.intakeFile.findUnique({ where: { id: fileId }, select: { status: true } })
      if (!file) return
      if (file.status === 'uploaded' || file.status === 'processing') {
        const groups = await tx.intakePage.groupBy({
          by: ['ocrStatus'],
          where: { intakeFileId: fileId },
          _count: { _all: true },
        })
        const count = (s: string): number => groups.find((g) => g.ocrStatus === s)?._count._all ?? 0
        const total = groups.reduce((n, g) => n + g._count._all, 0)
        if (count('pending') > 0 || total === 0) return
        const allFailed = count('failed') === total
        let errorCode: string | null = null
        if (allFailed) {
          const first = await tx.intakePage.findFirst({ where: { intakeFileId: fileId, ocrStatus: 'failed' }, orderBy: { pageNo: 'asc' }, select: { errorCode: true } })
          errorCode = first?.errorCode ?? 'OCR_FAILED'
        }
        await tx.intakeFile.updateMany({
          where: { id: fileId, status: { in: ['uploaded', 'processing'] } },
          data: { status: allFailed ? 'failed' : 'done', errorCode },
        })
      }

      const open = await tx.intakeFile.count({ where: { batchId: batch.id, status: { in: ['uploaded', 'processing'] } } })
      if (open > 0) return
      // A pages run (extract with `pages[]`, or a retry on a batch that already has items) closes the batch itself when it has read the pages again.
      const run = await tx.intakeExtractionRun.count({ where: { batchId: batch.id, state: { in: ['queued', 'running'] } } })
      if (run > 0) return
      // End of OCR (45 section 3.3.2 item 7): failed when no page was read. The items do not exist yet, so `selesai_dengan_ralat` is decided
      // when the extraction ends; failed pages stay listed on their files.
      const done = await tx.intakeFile.count({ where: { batchId: batch.id, status: 'done' } })
      await tx.intakeBatch.updateMany({
        where: { id: batch.id, status: { in: ACTIVE } },
        data: { status: done > 0 ? 'ready_for_review' : 'failed' },
      })
    })
  }

  // ---- intake.crop_figure ----------------------------------------------------------------------

  async cropFigure(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    const p = (job.payload ?? {}) as { pageId?: unknown; bbox?: unknown; altTextSuggestion?: unknown }
    if (typeof p.pageId !== 'string') throw new JobError('BAD_PAYLOAD', false)
    await this.figures.crop(p.pageId, p.bbox, typeof p.altTextSuggestion === 'string' ? p.altTextSuggestion : undefined, signal)
  }
}
