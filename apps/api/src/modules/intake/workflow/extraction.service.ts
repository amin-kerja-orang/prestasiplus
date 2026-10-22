import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import {
  AI_FAILURE_CODES,
  AI_MAX_PAGES,
  AI_MESSAGES,
  AiExtractedPaperSchema,
  INTAKE_MESSAGES,
  intakeOpenState,
  type AiExtractedPaper,
  type AiExtractRequest,
  type AiQuestionDraft,
  type IntakeExtractionRun,
  type IntakeRunReasonCode,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import { toMytTimestamp } from '../../../common/time/myt'
import type { TxClient } from '../../../db/client'
import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { scrubContactDetails } from '../../ai-extraction'
import { type ClaimedJob, JobError, JobsService } from '../../jobs'
import { AI_EXTRACTOR, IntakeExtractionInput, IntakeFiguresService, type AiExtractor } from '../files'
import { isAdmin, parseId, visibleBatches } from '../files/intake-access'
import { CurriculumFactsService } from './curriculum-facts'
import { DuplicateDetector, type Finding } from './duplicate-detector'
import { signatureOf, textOfQuestion, type Signature } from './duplicates'
import { PayloadSchema, stateDuplicates, type StoredPayload } from './item-model'
import { INTAKE_AUDIT, MAX_STIMULI_PER_BATCH, WORKFLOW_JOB_ENTITY, WORKFLOW_JOB_TYPE } from './workflow.constants'
import { IntakeWorkflowConfig } from './workflow.config'

export interface CallerInfo {
  ip: string | null
  requestId: string | null
}

const REASON_MESSAGE: Record<IntakeRunReasonCode, string> = {
  AI_BUDGET_EXHAUSTED: INTAKE_MESSAGES.budgetExhausted,
  AI_UNAVAILABLE: INTAKE_MESSAGES.unavailable,
  EXTRACTION_FAILED: INTAKE_MESSAGES.extractionFailed,
}

/** Low band of AC-05.3: a field under this confidence is a low field (the person must confirm it). */
const LOW_CONFIDENCE = 0.7
const ACTIVE_RUN = ['queued', 'running']
const DEFAULT_TAG_UNIT = null

/**
 * A failure of the extractor as the port can report it. `AiExtractor.extractPaper` rejects with an error that carries a
 * `code` (the BE-36 `AiFailure` code, or a `JobError` code). ASSUMPTION (documented in the PR): the port has no budget
 * signal of its own, so a rejection whose `code` is `AI_BUDGET_EXHAUSTED` means "the monthly cap is reached".
 */
function codeOf(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string') return (err as { code: string }).code
  return null
}

/** Reason code stored for a final failure. */
function reasonFor(code: string | null): IntakeRunReasonCode {
  if (code === 'AI_BUDGET_EXHAUSTED') return 'AI_BUDGET_EXHAUSTED'
  if (code === 'AI_UNAVAILABLE' || code === 'AI_PROVIDER_ERROR' || code === 'AI_TIMEOUT' || code === 'RATE_LIMITED' || code === 'TIMEOUT') return 'AI_UNAVAILABLE'
  return 'EXTRACTION_FAILED'
}

type RunRow = Prisma.IntakeExtractionRunGetPayload<Record<string, never>>

export function runToWire(run: RunRow): IntakeExtractionRun {
  const code = run.reasonCode as IntakeRunReasonCode | null
  return {
    id: idToString(run.id),
    batchId: idToString(run.batchId),
    state: run.state as IntakeExtractionRun['state'],
    reason: code === null ? null : { code, message: REASON_MESSAGE[code] },
    itemCount: run.itemCount,
    provider: run.provider,
    model: run.model,
    attempts: run.attempts,
    queuedAt: toMytTimestamp(run.queuedAt),
    startedAt: run.startedAt === null ? null : toMytTimestamp(run.startedAt),
    finishedAt: run.finishedAt === null ? null : toMytTimestamp(run.finishedAt),
  }
}

/** Page numbers of the AI request (1.. over the `done` files in file order) and the stored page each one is. */
interface PageRef {
  fileId: bigint
  pageId: bigint
  pageNo: number
}

const STATE_FOR_DRAFT = (d: { lowFields: string[]; needsManual?: boolean }, dups: Finding[]): 'generated' | 'needs_review' =>
  intakeOpenState({
    lowFields: d.lowFields,
    confirmed: [],
    needsManual: d.needsManual,
    duplicates: stateDuplicates(dups.map((f) => ({ kind: f.kind, decision: 'pending' }))),
  }) as 'generated' | 'needs_review'

/**
 * Extraction orchestration (BE-38, plan 15 "Workflow" and "Jobs"): `request` enqueues a run for a batch (idempotent, refused
 * for an already imported file hash before any provider call), the job handler reads the stored pages, hands the
 * provider-neutral, text-only request to the `AI_EXTRACTOR` port (BE-36 redacts it, AC-8), maps the answer to items with confidence and region,
 * runs the duplicate check and closes the run. The AI can only produce `generated` or `needs_review` items; nothing here
 * accepts, rejects or confirms anything (AC-2).
 *
 * Recovery (AC-7): a provider failure is retried by the job runner and, when it gives up, leaves the batch `failed` with a
 * visible reason and a failed run (a new request starts a new run, and no item was written by the failed one). A budget
 * exhaustion keeps the run `queued` and the batch `submitted` with the reason, and a delayed follow-up job looks again.
 */
@Injectable()
export class IntakeExtractionService implements OnModuleInit {
  private readonly logger = new Logger(IntakeExtractionService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AI_EXTRACTOR) private readonly extractor: AiExtractor,
    @Inject(IntakeExtractionInput) private readonly input: IntakeExtractionInput,
    @Inject(IntakeFiguresService) private readonly figures: IntakeFiguresService,
    @Inject(CurriculumFactsService) private readonly curriculum: CurriculumFactsService,
    @Inject(DuplicateDetector) private readonly detector: DuplicateDetector,
    @Inject(IntakeWorkflowConfig) private readonly config: IntakeWorkflowConfig,
  ) {}

  onModuleInit(): void {
    this.jobs.register(WORKFLOW_JOB_TYPE, (job, signal) => this.handle(job, signal), {
      timeoutMs: 10 * 60_000,
      onExhausted: (job, code) => this.onExhausted(job, code),
    })
  }

  // ---- request -----------------------------------------------------------------------------------

  async latestRun(batchId: bigint): Promise<RunRow | null> {
    return this.prisma.client.intakeExtractionRun.findFirst({ where: { batchId }, orderBy: { id: 'desc' } })
  }

  /** POST /intake/batches/{id}/extract. `status` is the HTTP status to answer. */
  async request(auth: AuthContext, idText: string, who: CallerInfo): Promise<{ run: IntakeExtractionRun; status: 200 | 202 }> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.batchNotFound })
    const batch = await this.prisma.client.intakeBatch.findFirst({
      where: { id, ...visibleBatches(auth) },
      select: { id: true, status: true, files: { select: { id: true, status: true, sha256: true } } },
    })
    if (!batch) throw ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.batchNotFound })

    const existing = await this.shortcut(id)
    if (existing) return existing

    const done = batch.files.filter((f) => f.status === 'done')
    if ((batch.status !== 'ready_for_review' && batch.status !== 'failed') || done.length === 0) {
      throw ApiError.of('CONFLICT', { message: INTAKE_MESSAGES.notExtractable })
    }
    await this.refuseImported(auth, id, done.map((f) => f.sha256))

    try {
      const run = await this.prisma.transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ status: string; source_paper_id: bigint | null }[]>`
          SELECT status, source_paper_id FROM intake_batches WHERE id = ${id} FOR UPDATE`
        const lockedBatch = locked[0]
        if (!lockedBatch) throw ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.batchNotFound })
        const again = await tx.intakeExtractionRun.findFirst({ where: { batchId: id }, orderBy: { id: 'desc' } })
        if (again && (ACTIVE_RUN.includes(again.state) || again.state === 'succeeded')) return { row: again, created: false }
        if (lockedBatch.status !== 'ready_for_review' && lockedBatch.status !== 'failed') throw ApiError.of('CONFLICT', { message: INTAKE_MESSAGES.notExtractable })

        const created = await tx.intakeExtractionRun.create({ data: { batchId: id, requestedById: idFromString(auth.userId) } })
        const job = await this.jobs.enqueue(
          {
            type: WORKFLOW_JOB_TYPE,
            idempotencyKey: `${WORKFLOW_JOB_TYPE}:${created.id}`,
            entityType: WORKFLOW_JOB_ENTITY,
            entityId: idToString(id),
            payload: { runId: idToString(created.id), wait: 0 },
          },
          tx,
        )
        const row = await tx.intakeExtractionRun.update({ where: { id: created.id }, data: { jobId: idFromString(job.id) } })
        await this.ensureSourcePaper(tx, id, lockedBatch.source_paper_id, done[0]?.sha256 ?? null)
        await tx.intakeBatch.update({ where: { id }, data: { status: 'processing', statusReason: null } })
        await this.audit.record({
          action: INTAKE_AUDIT.extractionRequested,
          actorUserId: auth.userId,
          actorRole: auth.active.role,
          scopeLevel: auth.active.scope.level,
          schoolId: auth.active.scope.schoolId ?? null,
          targetType: 'intake_batch',
          targetId: idToString(id),
          requestId: who.requestId,
          ip: who.ip,
          isTest: auth.mode !== null,
          details: { runId: idToString(created.id) },
          tx,
        })
        return { row, created: true }
      })
      return { run: runToWire(run.row), status: run.created ? 202 : run.row.state === 'succeeded' ? 200 : 202 }
    } catch (err) {
      // Two requests raced: the partial unique index let one run in. The other one returns that run.
      if (isUniqueViolation(err)) {
        const winner = await this.shortcut(id)
        if (winner) return winner
      }
      throw err
    }
  }

  /** An active run is returned as it is (202); a succeeded one is returned unchanged (200, no new items, no cost). */
  private async shortcut(batchId: bigint): Promise<{ run: IntakeExtractionRun; status: 200 | 202 } | null> {
    const latest = await this.latestRun(batchId)
    if (!latest) return null
    if (ACTIVE_RUN.includes(latest.state)) return { run: runToWire(latest), status: 202 }
    if (latest.state === 'succeeded') return { run: runToWire(latest), status: 200 }
    return null
  }

  /** The same file hash in another batch whose extraction succeeded: refused before a run, a job or a provider call exists. */
  private async refuseImported(auth: AuthContext, batchId: bigint, hashes: string[]): Promise<void> {
    const other = await this.prisma.client.intakeFile.findFirst({
      where: { sha256: { in: hashes }, batchId: { not: batchId }, batch: { runs: { some: { state: 'succeeded' } } } },
      orderBy: { id: 'asc' },
      select: { batchId: true, batch: { select: { ownerUserId: true } } },
    })
    if (!other) return
    // The earlier batch is named only to a caller who may see it (a Guru is never told about another teacher's batch).
    const visible = isAdmin(auth) || other.batch.ownerUserId === idFromString(auth.userId)
    throw ApiError.of('CONFLICT', { message: INTAKE_MESSAGES.alreadyImported, ...(visible ? { details: { batchId: idToString(other.batchId) } } : {}) })
  }

  /** Points the batch at a `source_papers` row (find or create); BE-10 owns the table but has no writer for it. */
  private async ensureSourcePaper(tx: TxClient, batchId: bigint, current: bigint | null, fileHash: string | null): Promise<void> {
    if (current !== null) return
    const b = await tx.intakeBatch.findUniqueOrThrow({ where: { id: batchId }, select: { subject: true, kertas: true, year: true, paperType: true, rightsStatus: true } })
    const subject = await tx.subject.findUnique({ where: { code: b.subject.toUpperCase() }, select: { id: true } })
    // Only an official paper has a natural key (it is the same paper whoever uploads it); everything else is its own row.
    const naturalKey = b.paperType === 'exam' ? `${b.subject.toLowerCase()}|${b.year}||k${b.kertas}|sebenar` : null
    const examType = b.paperType === 'exam' ? 'sebenar' : b.paperType === 'trial' ? 'percubaan' : b.paperType === 'exercise_book' ? 'latihan' : null
    const inserted = await tx.$queryRaw<{ id: bigint }[]>`
      INSERT INTO source_papers (natural_key, file_hash, subject_id, kertas, year, exam_type, rights_status)
      VALUES (${naturalKey}, ${fileHash}, ${subject?.id ?? null}, ${`K${b.kertas}`}, ${b.year}, ${examType}, ${b.rightsStatus})
      ON CONFLICT (natural_key) DO NOTHING
      RETURNING id`
    const paperId = inserted[0]?.id ?? (await tx.sourcePaper.findFirst({ where: { naturalKey }, select: { id: true } }))?.id
    if (paperId !== undefined) await tx.intakeBatch.update({ where: { id: batchId }, data: { sourcePaperId: paperId } })
  }

  // ---- job handler -------------------------------------------------------------------------------

  async handle(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    const payload = (job.payload ?? {}) as { runId?: unknown; wait?: unknown }
    let runId: bigint
    try {
      runId = idFromString(String(payload.runId ?? ''))
    } catch {
      throw new JobError('BAD_PAYLOAD', false)
    }
    const wait = typeof payload.wait === 'number' && Number.isInteger(payload.wait) && payload.wait >= 0 ? payload.wait : 0
    const run = await this.prisma.client.intakeExtractionRun.findUnique({ where: { id: runId } })
    if (!run || !ACTIVE_RUN.includes(run.state)) return // finished, replaced or removed: nothing to do (idempotent)
    const batch = await this.prisma.client.intakeBatch.findUnique({ where: { id: run.batchId }, select: { id: true, status: true, subject: true } })
    if (!batch || batch.status === 'cancelled') {
      await this.finish(run.id, 'failed', 'EXTRACTION_FAILED')
      return
    }

    await this.prisma.client.intakeExtractionRun.update({
      where: { id: run.id },
      data: { state: 'running', startedAt: run.startedAt ?? new Date(), attempts: job.attempts, reasonCode: null },
    })
    await this.prisma.client.intakeBatch.updateMany({ where: { id: batch.id, status: { in: ['submitted', 'processing'] } }, data: { status: 'processing', statusReason: null } })

    let paper: AiExtractedPaper | null
    let pageMap: PageRef[]
    try {
      const prepared = await this.prepare(batch.id, batch.subject)
      pageMap = prepared.pageMap
      paper = prepared.request.pages.length === 0 ? null : await this.call(prepared.request, signal)
    } catch (err) {
      await this.onAttemptFailed(run.id, batch.id, job, wait, err)
      return
    }
    try {
      await this.persist(run.id, batch.id, batch.subject, paper, pageMap, signal)
    } catch (err) {
      if (err instanceof JobError) throw err
      await this.prisma.client.intakeExtractionRun.update({ where: { id: run.id }, data: { state: 'queued' } })
      throw new JobError('EXTRACTION_FAILED', true)
    }
  }

  /**
   * Builds the text-only request and the page map. Nothing is redacted here: the request goes to the `AI_EXTRACTOR`
   * port, whose implementation (BE-36's `AiExtractorAdapter`) hands it to `AiExtractionService`, which redacts it once
   * with BE-36's redactor right before the provider and masks a provider that echoes a masked value (#189, LEAD
   * decision (c), 2026-10-21). The request carries no page image, not even a reference: the provider receives
   * local-OCR text only (v2-threat-model rows 46 and 50). `images` is left out explicitly so that no later change to
   * `IntakeExtractionInput` can bring it back.
   */
  private async prepare(batchId: bigint, subject: string): Promise<{ request: AiExtractRequest; pageMap: PageRef[] }> {
    const built = await this.input.build(idToString(batchId))
    const files = await this.prisma.client.intakeFile.findMany({
      where: { batchId, status: 'done' },
      orderBy: { id: 'asc' },
      select: { id: true, pages: { orderBy: { pageNo: 'asc' }, select: { id: true, pageNo: true } } },
    })
    const pageMap: PageRef[] = []
    for (const f of files) {
      for (const p of f.pages) {
        if (pageMap.length >= AI_MAX_PAGES) break
        pageMap.push({ fileId: f.id, pageId: p.id, pageNo: p.pageNo })
      }
    }
    const taxonomy = await this.curriculum.taxonomy(subject)
    const request: AiExtractRequest = {
      pages: built.pages,
      subject: built.subject,
      kertas: built.kertas,
      ...(taxonomy.length > 0 ? { taxonomy } : {}),
    }
    return { request, pageMap }
  }

  /** Calls the port and validates the answer. Anything that is not a valid result is a failure of the run. */
  private async call(request: AiExtractRequest, signal: AbortSignal): Promise<AiExtractedPaper> {
    const answer = await this.extractor.extractPaper(request, signal)
    const parsed = AiExtractedPaperSchema.safeParse(answer)
    if (!parsed.success) throw new JobError('EXTRACTION_FAILED', true)
    return parsed.data
  }

  /** A failed attempt: budget exhaustion waits, anything else is rethrown for the runner (retry with backoff). */
  private async onAttemptFailed(runId: bigint, batchId: bigint, job: ClaimedJob, wait: number, err: unknown): Promise<void> {
    const code = codeOf(err)
    if (code === 'AI_BUDGET_EXHAUSTED') {
      await this.prisma.transaction(async (tx) => {
        await tx.intakeExtractionRun.update({ where: { id: runId }, data: { state: 'queued', reasonCode: 'AI_BUDGET_EXHAUSTED', attempts: 0 } })
        await tx.intakeBatch.updateMany({
          where: { id: batchId, status: { in: ['submitted', 'processing'] } },
          data: { status: 'submitted', statusReason: INTAKE_MESSAGES.budgetExhausted },
        })
        const next = wait + 1
        await this.jobs.enqueue(
          {
            type: WORKFLOW_JOB_TYPE,
            idempotencyKey: `${WORKFLOW_JOB_TYPE}:${runId}:wait:${next}`,
            entityType: WORKFLOW_JOB_ENTITY,
            entityId: idToString(batchId),
            payload: { runId: idToString(runId), wait: next },
            runAfter: new Date(Date.now() + this.config.budgetRecheckSeconds * 1000),
          },
          tx,
        )
      })
      return
    }
    // Back to queued while the runner waits to retry; the attempt count stays visible.
    await this.prisma.client.intakeExtractionRun.update({ where: { id: runId }, data: { state: 'queued', attempts: job.attempts } })
    if (err instanceof JobError) throw err
    const retryable = !(err instanceof Error && err.name === 'AbortError')
    throw new JobError(code !== null && (AI_FAILURE_CODES as readonly string[]).includes(code) ? code : 'AI_UNAVAILABLE', retryable)
  }

  /** The runner gave up: the run fails with a visible reason and the batch is recoverable (a new request starts a new run). */
  async onExhausted(job: ClaimedJob, code: string): Promise<void> {
    const runId = (job.payload as { runId?: unknown } | null)?.runId
    if (typeof runId !== 'string') return
    let id: bigint
    try {
      id = idFromString(runId)
    } catch {
      return
    }
    await this.finish(id, 'failed', reasonFor(code))
  }

  private async finish(runId: bigint, state: 'failed', reason: IntakeRunReasonCode): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const run = await tx.intakeExtractionRun.findUnique({ where: { id: runId } })
      if (!run || !ACTIVE_RUN.includes(run.state)) return
      await tx.intakeExtractionRun.update({ where: { id: runId }, data: { state, reasonCode: reason, finishedAt: new Date() } })
      await tx.intakeBatch.updateMany({
        where: { id: run.batchId, status: { in: ['submitted', 'processing'] } },
        data: { status: 'failed', statusReason: REASON_MESSAGE[reason] },
      })
    })
  }

  // ---- result to items ----------------------------------------------------------------------------

  private async persist(runId: bigint, batchId: bigint, subject: string, paper: AiExtractedPaper | null, pageMap: PageRef[], signal: AbortSignal): Promise<void> {
    const drafts = paper?.questions ?? []
    const stimuliIn = (paper?.stimuli ?? []).slice(0, MAX_STIMULI_PER_BATCH)

    // The duplicate check reads the bank, so it runs before the transaction.
    const bank = await this.detector.bank(subject)
    const existing = await this.prisma.client.intakeItem.findMany({
      where: { batchId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, numberLabel: true, payload: true },
    })
    const earlier: Array<{ id: string; sig: Signature }> = existing.flatMap((e) => {
      const p = PayloadSchema.safeParse(e.payload)
      return p.success ? [{ id: idToString(e.id), sig: signatureOf(textOfQuestion(p.data)) }] : []
    })
    const room = Math.max(0, this.config.maxItemsPerBatch - existing.length)
    const mapped = drafts.slice(0, room).map((d) => this.mapDraft(d, subject, pageMap))
    const sigs = mapped.map((m) => signatureOf(textOfQuestion(m.payload)))
    const findings: Finding[][] = mapped.map((_m, i) => {
      const sig = sigs[i] as Signature
      return this.detector.againstBank(sig, bank)
    })

    const stimulusIdByRef = new Map<string, bigint>()
    await this.prisma.transaction(async (tx) => {
      const run = await tx.intakeExtractionRun.findUnique({ where: { id: runId } })
      if (!run || !ACTIVE_RUN.includes(run.state)) throw new JobError('CANCELLED', false)
      const locked = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
      if (!locked[0] || locked[0].status === 'cancelled') throw new JobError('CANCELLED', false)

      for (const s of stimuliIn) {
        if (stimulusIdByRef.has(s.id)) continue
        const page = this.pageOf(pageMap, s.page ?? s.region?.page)
        const row = await tx.intakeStimulus.create({
          data: {
            batchId,
            ref: s.id,
            kind: s.kind,
            label: scrubContactDetails(s.label).slice(0, 100),
            caption: s.caption === undefined ? null : scrubContactDetails(s.caption).slice(0, 300),
            altText: scrubContactDetails(s.alt).slice(0, 1000),
            body: s.text === undefined ? null : scrubContactDetails(s.text),
            ...(s.table === undefined ? {} : { tableData: scrubContactDetails(s.table) as Prisma.InputJsonValue }),
            pageNo: page?.pageNo ?? null,
            ...(s.region && page ? { region: { page: page.pageNo, x: s.region.x, y: s.region.y, w: s.region.w, h: s.region.h } } : {}),
          },
        })
        stimulusIdByRef.set(s.id, row.id)
      }

      const base = existing.reduce((m, e) => Math.max(m, e.position), 0)
      const created: Array<{ id: bigint; index: number }> = []
      const batchSigs: Array<{ id: string; sig: Signature }> = [...earlier]
      for (const [i, m] of mapped.entries()) {
        const sig = sigs[i] as Signature
        const dups = [...(findings[i] as Finding[]), ...this.detector.againstBatch(sig, batchSigs)]
        const state = STATE_FOR_DRAFT({ lowFields: m.lowFields, needsManual: m.needsManual }, dups)
        const row = await tx.intakeItem.create({
          data: {
            batchId,
            intakeFileId: m.page?.fileId ?? null,
            intakePageId: m.page?.pageId ?? null,
            aiRunId: runId,
            stimulusId: m.stimulusRef === null ? null : (stimulusIdByRef.get(m.stimulusRef) ?? null),
            position: base + i + 1,
            sourceType: 'pdf',
            numberLabel: m.label,
            itemType: m.type,
            payload: { ...m.payload, origin: { label: m.label, page: m.page?.pageNo ?? m.pageNo } } satisfies StoredPayload as unknown as Prisma.InputJsonValue,
            pageNo: m.page?.pageNo ?? m.pageNo,
            ...(m.region === null ? {} : { region: m.region as Prisma.InputJsonValue }),
            lowFields: m.lowFields,
            needsManual: m.needsManual,
            fieldConfidence: m.fieldConfidence,
            lowestConfidence: m.lowest,
            reviewState: state,
          },
        })
        batchSigs.push({ id: idToString(row.id), sig })
        for (const f of dups) {
          await tx.duplicateLink.create({
            data: {
              itemId: row.id,
              kind: f.kind,
              similarity: f.similarity,
              ...(f.matchedQuestionId === undefined ? {} : { matchedQuestionId: idFromString(f.matchedQuestionId) }),
              ...(f.matchedItemId === undefined ? {} : { matchedItemId: idFromString(f.matchedItemId) }),
            },
          })
        }
        await tx.intakeItemEvent.create({ data: { itemId: row.id, event: 'extracted', toState: state } })
        created.push({ id: row.id, index: i })
      }

      await tx.intakeExtractionRun.update({
        where: { id: runId },
        data: {
          state: 'succeeded',
          reasonCode: null,
          itemCount: created.length,
          provider: paper?.provider ?? null,
          model: paper?.model ?? null,
          warnings: scrubContactDetails(paper === null ? [AI_MESSAGES.noQuestions] : paper.warnings) as Prisma.InputJsonValue,
          unmatched: scrubContactDetails(paper?.unmatched ?? []) as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      })
      await tx.intakeBatch.update({ where: { id: batchId }, data: { status: 'ready_for_review', statusReason: null } })
      return created
    })

    // Figure crops are cut from the stored page image after the items are safe. A failed crop leaves the stimulus without a
    // figure, which the accept gate reports (`figureNotResolved`).
    for (const s of stimuliIn) {
      const stimulusId = stimulusIdByRef.get(s.id)
      const page = this.pageOf(pageMap, s.page ?? s.region?.page)
      if (stimulusId === undefined || !s.region || !page || s.kind !== 'diagram' || signal.aborted) continue
      try {
        const crop = await this.figures.crop(idToString(page.pageId), { x: s.region.x, y: s.region.y, w: s.region.w, h: s.region.h }, s.alt || undefined, signal)
        if (crop) await this.prisma.client.intakeStimulus.update({ where: { id: stimulusId }, data: { figureId: idFromString(crop.figureId) } })
      } catch {
        this.logger.warn(`figure crop failed for a stimulus of batch ${idToString(batchId)}`)
      }
    }
  }

  private pageOf(pageMap: readonly PageRef[], number: number | undefined): PageRef | null {
    return number === undefined ? null : (pageMap[number - 1] ?? null)
  }

  /** One provider draft as the columns of an item. The provider never sets `confirmed`, a state or an id. */
  private mapDraft(d: AiQuestionDraft, subject: string, pageMap: readonly PageRef[]) {
    const page = this.pageOf(pageMap, d.page)
    const regionPage = this.pageOf(pageMap, d.region?.page)
    const region = d.region && regionPage ? { page: regionPage.pageNo, x: d.region.x, y: d.region.y, w: d.region.w, h: d.region.h } : null
    const fieldConfidence: Record<string, number> = {}
    for (const [k, v] of Object.entries(d.fieldConfidence)) if (k.length >= 1 && k.length <= 64) fieldConfidence[k] = Math.min(1, Math.max(0, v))
    const low = new Set<string>(d.lowFields.filter((f) => f.length >= 1 && f.length <= 64))
    for (const [k, v] of Object.entries(fieldConfidence)) if (v < LOW_CONFIDENCE) low.add(k)
    const lowFields = [...low].slice(0, 50)
    const values = Object.values(fieldConfidence)
    const lowest = values.length === 0 ? null : Math.min(...values)

    const candidate = {
      stem: d.stem,
      options: d.options,
      marks: d.marks,
      mode: d.mode,
      ...(d.unit === undefined ? {} : { unit: d.unit }),
      ...(d.wordRange === undefined ? {} : { wordRange: d.wordRange }),
      parts: d.parts,
      ...(d.scheme === undefined ? {} : { scheme: d.scheme }),
      tag: d.tag,
    }
    const parsed = PayloadSchema.safeParse(scrubContactDetails(candidate))
    // A draft the item schema cannot hold is kept as a placeholder with its text, so no question is silently lost (AC-04.5).
    const payload = parsed.success
      ? parsed.data
      : PayloadSchema.parse({
          stem: scrubContactDetails(d.stem).slice(0, 100_000),
          options: [],
          marks: 0,
          mode: 'short_text',
          parts: [],
          tag: { subject, level: 'T4+T5', unit: DEFAULT_TAG_UNIT, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' },
        })
    return {
      label: scrubContactDetails(d.label).slice(0, 32),
      type: d.type,
      payload,
      page,
      pageNo: Math.min(Math.max(1, d.page), 10_000),
      region,
      lowFields,
      needsManual: d.needsManual === true || !parsed.success,
      fieldConfidence,
      lowest,
      stimulusRef: d.stimulusId ?? null,
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } }; cause?: unknown }
  if (e.code === 'P2002' || e.code === '23505') return true
  if (e.meta?.code === '23505' || e.meta?.driverAdapterError?.cause?.originalCode === '23505') return true
  return isUniqueViolation(e.cause)
}

