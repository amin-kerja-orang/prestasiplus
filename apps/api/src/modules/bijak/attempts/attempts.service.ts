import { Inject, Injectable, Logger } from '@nestjs/common'
import type {
  BijakAttemptHistoryRow,
  BijakAttemptInProgress,
  BijakAttemptMeta,
  BijakAttemptPaperView,
  BijakAttemptPhoto,
  BijakAttemptQuestionResult,
  BijakAttemptResult,
  BijakAttemptPastSittings,
  BijakAttemptResultView,
  BijakAttemptSelfMarkRequest,
  BijakAttemptSelfMarkResult,
  BijakAttemptSavePayload,
  BijakAttemptSaveResult,
  BijakAttemptStartRequest,
  BijakAttemptSubmitPayload,
  BijakAttemptSubmitResult,
} from '@pp/contract'

import { AUDIT_ACTIONS } from '../../../common/audit/audit-actions'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FilesService } from '../../files'
import {
  AUTO_SUBMIT_TOLERANCE_SECONDS,
  BIJAK_ATTEMPTS_MESSAGES as MSG,
  FRESH_SECONDS,
  GRACE_SECONDS,
  HISTORY_LIMIT,
  LATE_SYNC_WINDOW_MS,
  MAX_CHECKS_PER_QUESTION,
  MAX_PHOTOS_PER_PART,
  PAYLOAD_LIMITS,
  PAST_SITTINGS_LIMIT,
  PAYLOAD_MESSAGES,
  SWEEP_BATCH,
} from './attempts.constants'
import {
  type AnswerRow,
  type AttemptRow,
  AttemptsRepository,
  type PhotoRow,
} from './attempts.repository'
import type { PartAnswer, SectionSnapshot } from './exam-core.adapter'
import {
  type Bundles,
  buildLeafIndex,
  buildServedPaper,
  checkResult,
  gradeAttempt,
  type LeafIndex,
  lockedParts,
  questionIdsOf,
} from './marking'
import { assertAttemptPayload } from './payload-limits'
import { BIJAK_REWARD_DESCRIPTION, BijakAttemptPorts } from './ports'
import { applySelfMarks, clamp, decorateResult, isSelfMarkable, type SelfMarks } from './self-mark'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Photos accept only these leaf answer modes (AC-09.2). */
const PHOTO_KINDS: ReadonlySet<string> = new Set(['working', 'drawing'])
/** Interactive transactions may hold a lock while marking runs. */
const TX = { maxWait: 10_000, timeout: 30_000 } as const
const LEAF_CACHE_TTL_MS = 10 * 60_000
const LEAF_CACHE_MAX = 2000

type Change = { partId: string; answer: PartAnswer; rev: number; savedAt: string }
type FinishedStatus = 'submitted' | 'auto_submitted'

/** What happened to an attempt in a transaction; handled after the commit (audit, reward, analytics). */
interface ClosedEvent {
  attempt: AttemptRow
  status: FinishedStatus
  result: BijakAttemptResult
  /** Closed by the sweeper or on access after deadline + grace, not by the student. */
  swept: boolean
  /** A late sync re-graded an attempt that was already closed. */
  regraded: boolean
}

export interface CallerInfo {
  ip: string | null
  requestId: string | null
}

const ts = (d: Date) => toMytTimestamp(d)
/** BM message of a start that has no servable question (422 VALIDATION_ERROR, declared in the start contract). */
export const NO_ELIGIBLE_QUESTIONS = 'Tiada soalan layak untuk kertas ini.'
const noEligibleQuestions = () => ApiError.of('VALIDATION_ERROR', { message: NO_ELIGIBLE_QUESTIONS })

const notFoundAttempt = () => ApiError.of('NOT_FOUND', { message: MSG.attemptNotFound })
const forbiddenOwner = () => ApiError.of('FORBIDDEN', { message: MSG.forbidden })
const attemptClosed = () => ApiError.of('CONFLICT', { message: MSG.attemptClosed })
const notSubmitted = () => new ApiError({ code: 'NOT_SUBMITTED', status: 409, message: MSG.schemeAfterSubmit })
const isClosed = (status: AttemptRow['status']) => status === 'submitted' || status === 'auto_submitted'

@Injectable()
export class BijakAttemptsService {
  private readonly logger = new Logger(BijakAttemptsService.name)
  private readonly leafCache = new Map<string, { index: LeafIndex; expires: number }>()

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AttemptsRepository) private readonly repo: AttemptsRepository,
    @Inject(BijakAttemptPorts) private readonly ports: BijakAttemptPorts,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  /* ------------------------------------------------------------------------------ helpers */

  private now(): Date {
    return this.clock.now()
  }

  private expired(row: AttemptRow): boolean {
    return row.status === 'in_progress' && row.deadlineAt !== null && this.now().getTime() > row.deadlineAt.getTime() + GRACE_SECONDS * 1000
  }

  /** `auto: true` is client-claimed: believed only when the server deadline is (nearly) reached. */
  private autoHonoured(row: AttemptRow, auto: boolean | undefined): boolean {
    return auto === true && row.deadlineAt !== null && this.now().getTime() >= row.deadlineAt.getTime() - AUTO_SUBMIT_TOLERANCE_SECONDS * 1000
  }

  /** 404 for an unknown (or malformed) id, 403 "Akses ditolak" for someone else's attempt (D54b). */
  private async owned(userId: string, id: string): Promise<AttemptRow> {
    if (!UUID.test(id)) throw notFoundAttempt()
    const row = await this.repo.find(id.toLowerCase())
    if (!row) throw notFoundAttempt()
    if (row.userId !== userId) throw forbiddenOwner()
    return row
  }

  private async loadBundles(composition: readonly SectionSnapshot[], onMissing: () => ApiError = () => ApiError.of('SERVER_ERROR')): Promise<Bundles> {
    const ids = [...new Set(questionIdsOf(composition))]
    const bundles = await this.ports.questionSource.loadQuestions(ids)
    const missing = ids.filter((id) => !bundles.has(id))
    if (missing.length) {
      this.logger.error(`Question bundles missing for ${String(missing.length)} question(s) of an attempt`)
      throw onMissing()
    }
    return bundles
  }

  /** Memoises the bundle load of one request. */
  private lazyBundles(row: AttemptRow): () => Promise<Bundles> {
    let pending: Promise<Bundles> | undefined
    return () => (pending ??= this.loadBundles(row.composition))
  }

  private async leafIndexOf(row: AttemptRow, load: () => Promise<Bundles>): Promise<LeafIndex> {
    const now = this.now().getTime()
    const hit = this.leafCache.get(row.id)
    if (hit && hit.expires > now) return hit.index
    const index = buildLeafIndex(row.composition, await load())
    if (this.leafCache.size >= LEAF_CACHE_MAX) this.leafCache.delete(this.leafCache.keys().next().value as string)
    this.leafCache.set(row.id, { index, expires: now + LEAF_CACHE_TTL_MS })
    return index
  }

  private answerMap(answers: ReadonlyMap<string, AnswerRow>): Map<string, PartAnswer> {
    return new Map([...answers].map(([k, v]) => [k, v.answer]))
  }

  private toMeta(row: AttemptRow, answers: ReadonlyMap<string, AnswerRow>, checks: { order: string[]; counts: Map<string, number> }): BijakAttemptMeta {
    return {
      id: row.id,
      paperId: row.paperId ?? '0',
      paperKind: row.paperKind,
      title: row.title,
      subject: row.subject,
      kertas: row.kertas,
      code: row.code,
      mode: row.mode,
      status: row.status,
      startedAt: ts(row.startedAt),
      deadline: row.deadlineAt ? ts(row.deadlineAt) : null,
      durationMin: row.durationMin,
      answers: Object.fromEntries([...answers].map(([k, v]) => [k, { answer: v.answer, rev: v.rev, savedAt: ts(v.savedAt) }])),
      flags: [...row.flags],
      picks: row.picks,
      position: row.position,
      checked: [...checks.order],
      ...(checks.counts.size ? { checkCounts: Object.fromEntries(checks.counts) } : {}),
      ...(row.submittedAt ? { submittedAt: ts(row.submittedAt) } : {}),
      ...(row.lateBySeconds !== null ? { lateBySeconds: row.lateBySeconds } : {}),
      ...(row.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
    }
  }

  /* ----------------------------------------------------------------------------- start / resume */

  async findInProgress(userId: string, paperId: string): Promise<BijakAttemptInProgress | null> {
    await this.sweepUser(userId)
    if (!isIdString(paperId)) return null
    const [a] = await this.repo.openFor(userId, paperId)
    if (!a) return null
    const elapsed = Math.max(0, Math.floor((this.now().getTime() - a.startedAt.getTime()) / 1000))
    return { attemptId: a.id, title: a.title, mode: a.mode, elapsedSeconds: elapsed, fresh: elapsed <= FRESH_SECONDS }
  }

  /** Starts a sitting (201), or returns the open one (200) unless `restart` abandons it first. */
  async start(auth: AuthContext, body: BijakAttemptStartRequest, who: CallerInfo, opts: { fresh?: boolean } = {}): Promise<{ attemptId: string; created: boolean }> {
    const userId = auth.userId
    const isTest = auth.mode !== null
    if (!isIdString(body.paperId)) throw ApiError.of('NOT_FOUND', { message: MSG.paperNotFound })
    const resolved = await this.ports.paperSource.resolveForAttempt({ userId, paperId: body.paperId, isTest })
    if (!resolved.ok) {
      if (resolved.reason === 'not_eligible') {
        // H-A13: a sitting already open keeps its pinned version, so "Mula" resumes it even though a new sitting is refused.
        if (!body.restart && !opts.fresh) {
          const open = (await this.repo.openFor(userId, body.paperId))[0]
          if (open) return { attemptId: open.id, created: false }
        }
        throw ApiError.of('FORBIDDEN', { message: MSG.paperUnavailable })
      }
      throw ApiError.of('NOT_FOUND', { message: MSG.paperNotFound })
    }
    const paper = resolved.paper
    const composition = freezeComposition(paper.sections)
    if (!composition.length || questionIdsOf(composition).length === 0) {
      this.logger.error('A paper without questions was offered for an attempt')
      throw noEligibleQuestions()
    }
    // Fail now, not in the middle of a sitting: a missing bundle at START is a handled 422 (nothing is created).
    await this.loadBundles(composition, noEligibleQuestions)
    const out = await this.prisma.transaction(async () => {
      await this.repo.lockStart(userId, body.paperId)
      const open = await this.repo.openFor(userId, body.paperId)
      const newest = open[0]
      // `fresh` (Cuba Lagi, V2 retry :204-224): always a new attempt, other open sittings are left as they are.
      if (newest && !body.restart && !opts.fresh) return { attempt: newest, created: false }
      if (!opts.fresh) await this.repo.abandonMany(open.map((o) => o.id))
      const startedAt = this.now()
      const attempt = await this.repo.create({
        userId,
        paperId: body.paperId,
        paperKind: paper.kind,
        title: paper.title,
        subject: paper.subject,
        subjectName: paper.subjectName,
        kertas: paper.kertas,
        code: paper.code,
        mode: body.mode,
        startedAt,
        deadlineAt: body.mode === 'exam' ? new Date(startedAt.getTime() + paper.durationMin * 60_000) : null,
        durationMin: paper.durationMin,
        composition,
        isTest,
      })
      return { attempt, created: true, abandoned: open.length }
    }, TX)
    if (out.created) await this.record(AUDIT_ACTIONS.BIJAK_ATTEMPT_STARTED, auth, out.attempt.id, who, { mode: body.mode, restart: body.restart === true })
    return { attemptId: out.attempt.id, created: out.created }
  }

  /* ---------------------------------------------------------------------------------- views */

  private async buildView(row: AttemptRow, withChecks: boolean, preloaded?: Bundles): Promise<BijakAttemptPaperView> {
    const [answers, checks, bundles] = await Promise.all([this.repo.answers(row.id), this.repo.checkCounts(row.id), preloaded ?? this.loadBundles(row.composition)])
    const served = buildServedPaper(row.composition, bundles)
    const showChecks = withChecks && row.status === 'in_progress' && row.mode === 'latihan'
    const map = this.answerMap(answers)
    const results: BijakAttemptQuestionResult[] = showChecks ? checks.order.map((qid) => checkResult(row.composition, bundles, map, qid)) : []
    return {
      serverNow: ts(this.now()),
      attempt: this.toMeta(row, answers, checks),
      sections: served.sections,
      questions: served.questions,
      groups: served.groups,
      checks: results,
    }
  }

  async view(userId: string, id: string): Promise<BijakAttemptPaperView> {
    let row = await this.owned(userId, id)
    if (this.expired(row)) {
      await this.closeExpired(row.id)
      row = await this.owned(userId, id)
    }
    return this.buildView(row, true)
  }

  async result(userId: string, id: string): Promise<BijakAttemptResultView> {
    let row = await this.owned(userId, id)
    if (this.expired(row)) {
      await this.closeExpired(row.id)
      row = await this.owned(userId, id)
    }
    const stored = await this.repo.gradedWithMarks(row.id)
    if (!stored) throw notSubmitted()
    if (!row.resultViewedAt) await this.repo.markResultViewed(row.id, this.now())
    const bundles = await this.loadBundles(row.composition)
    const paper = await this.buildView(row, false, bundles)
    const result = this.present(row, stored, this.answerMap(await this.repo.answers(row.id)), bundles)
    return { attempt: paper.attempt, result, paper }
  }

  /** The result as served: automatic grading + keyword suggestions (R1-B13) + the pupil's self-marks on top (R1-B12). */
  private present(row: AttemptRow, stored: { result: BijakAttemptResult; selfMarks: SelfMarks }, answers: Map<string, PartAnswer>, bundles: Bundles): BijakAttemptResult {
    return applySelfMarks(decorateResult(stored.result, bundles, answers), row.composition, stored.selfMarks)
  }

  /* ------------------------------------------------------------ self-mark (Semakan, R1-B12) */

  /**
   * V2 `selfMark`: the pupil's own mark for one subjective part of a CLOSED attempt. Owner only; the part
   * must be on this attempt and have a points or rubric scheme; the mark is clamped (never rejected for being
   * out of range); no lock, idempotent (a repeat with the same body changes nothing and records nothing).
   * The totals are recomputed with best-N and the performance aggregate is told (regraded: the same attempt id
   * replaces its earlier figures). The wallet reward given at submit is NOT repeated.
   */
  async selfMark(auth: AuthContext, id: string, body: BijakAttemptSelfMarkRequest): Promise<BijakAttemptSelfMarkResult> {
    await this.owned(auth.userId, id)
    const events: ClosedEvent[] = []
    const out = await this.prisma.transaction(async (): Promise<BijakAttemptSelfMarkResult> => {
      if (!(await this.repo.lock(id))) throw notFoundAttempt()
      let row = (await this.repo.find(id)) as AttemptRow
      const answers = await this.repo.answers(id)
      const load = this.lazyBundles(row)
      if (this.expired(row)) row = await this.finish(row, answers, 'auto_submitted', { key: null, swept: true }, load, events)
      if (!isClosed(row.status)) throw notSubmitted()
      const stored = await this.repo.gradedWithMarks(id)
      if (!stored) throw notSubmitted()
      const bundles = await load()
      const found = stored.result.questions.flatMap((q) => q.parts.map((p) => ({ q, p }))).find((x) => x.p.partId === body.partId)
      if (!found) throw ApiError.of('VALIDATION_ERROR', { fields: { partId: MSG.selfMarkPartUnknown } })
      const scheme = bundles.get(found.q.questionId)?.schemes[body.partId]
      if (!isSelfMarkable(scheme)) throw ApiError.of('VALIDATION_ERROR', { fields: { partId: MSG.selfMarkNotSubjective } })
      const marks = found.p.marks
      let mark = clamp(body.mark, 0, marks)
      if (body.band !== undefined) {
        if (scheme?.kind !== 'rubric') throw ApiError.of('VALIDATION_ERROR', { fields: { band: MSG.selfMarkBandNotRubric } })
        const band = scheme.bands.find((b) => b.name === body.band)
        if (!band) throw ApiError.of('VALIDATION_ERROR', { fields: { band: MSG.selfMarkBandUnknown } })
        mark = clamp(mark, Math.min(band.range[0], marks), Math.min(band.range[1], marks))
      }
      const entry = body.band !== undefined ? { mark, band: body.band } : { mark }
      const before = stored.selfMarks[body.partId]
      const unchanged = before !== undefined && before.mark === entry.mark && before.band === body.band
      const selfMarks: SelfMarks = unchanged ? stored.selfMarks : { ...stored.selfMarks, [body.partId]: entry }
      const result = this.present(row, { result: stored.result, selfMarks }, this.answerMap(answers), bundles)
      if (!unchanged) {
        await this.repo.saveSelfMarks(id, selfMarks, result)
        events.push({ attempt: row, status: row.status as FinishedStatus, result, swept: false, regraded: true })
      }
      const part = result.questions.flatMap((q) => q.parts).find((p) => p.partId === body.partId)!
      return {
        partId: body.partId,
        awarded: part.awarded,
        max: part.marks,
        ...(entry.band !== undefined ? { band: entry.band } : {}),
        status: part.status,
        attemptScore: result.score,
        attemptMax: result.max,
        provisional: result.provisional,
        pendingReview: result.pendingReview,
        result,
      }
    }, TX)
    await this.emit(events)
    return out
  }

  /* ------------------------------------------------------- Cuba Lagi / Lihat semakan lepas (R1-B15) */

  /**
   * V2 `retry`: from a CLOSED attempt, a brand-new blank sitting of the same paper (same mode). The
   * paper must still be offered (V2 `servable()`); the old attempt and its result are untouched. Other open
   * sittings of the caller on the paper are NOT abandoned (V2 retry does not).
   */
  async retry(auth: AuthContext, id: string, who: CallerInfo): Promise<{ attemptId: string }> {
    let row = await this.owned(auth.userId, id)
    if (this.expired(row)) {
      await this.closeExpired(row.id)
      row = await this.owned(auth.userId, id)
    }
    if (!isClosed(row.status)) throw ApiError.of('CONFLICT', { message: MSG.retryNotClosed })
    const gone = () => ApiError.of('CONFLICT', { message: MSG.retryPaperGone })
    if (row.paperId === null) throw gone()
    try {
      const out = await this.start(auth, { paperId: row.paperId, mode: row.mode }, who, { fresh: true })
      return { attemptId: out.attemptId }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOT_FOUND') throw gone()
      throw err
    }
  }

  /** V2 "Lihat semakan lepas": the caller's closed sittings of a paper, newest first; read one with the result route. */
  async pastSittings(userId: string, paperId: string): Promise<BijakAttemptPastSittings> {
    await this.sweepUser(userId)
    if (!isIdString(paperId)) return { lastSubmittedAttemptId: null, sittings: [] }
    const rows = await this.repo.closedForPaper(userId, paperId, PAST_SITTINGS_LIMIT)
    const sittings = rows.map(({ row, score, max, provisional }) => ({
      attemptId: row.id,
      mode: row.mode,
      status: row.status as FinishedStatus,
      startedAt: ts(row.startedAt),
      submittedAt: ts(row.submittedAt ?? row.startedAt),
      score,
      max,
      provisional,
    }))
    return { lastSubmittedAttemptId: sittings[0]?.attemptId ?? null, sittings }
  }

  async history(userId: string): Promise<BijakAttemptHistoryRow[]> {
    await this.sweepUser(userId)
    const now = this.now().getTime()
    const rows = await this.repo.history(userId, HISTORY_LIMIT)
    return rows.map(({ row, score, max }) => ({
      attemptId: row.id,
      title: row.title,
      subject: row.subject,
      subjectName: row.subjectName,
      kertas: row.kertas,
      kind: row.paperKind,
      mode: row.mode,
      status: row.status,
      startedAt: ts(row.startedAt),
      durationSeconds: Math.max(0, Math.round(((row.submittedAt?.getTime() ?? now) - row.startedAt.getTime()) / 1000)),
      ...(score !== null && max !== null ? { score, max } : {}),
    }))
  }

  /* ----------------------------------------------------------------------- merge (autosave) */

  /**
   * Merge by per-part revision: a part that is not on the attempt, is locked, or whose stored rev is
   * at or above the change rev is ignored. The device clock is not trusted: the stored save time never
   * lies in the future of the server. Photos are kept only when this attempt issued the key for that
   * part (name and size come from the stored row, not from the client). Mutates `answers`; returns
   * how many parts changed.
   */
  private async merge(
    row: AttemptRow,
    answers: Map<string, AnswerRow>,
    changes: readonly Change[],
    index: LeafIndex,
    locked: ReadonlySet<string>,
  ): Promise<number> {
    const at = this.now().getTime()
    let photos: Map<string, Map<string, PhotoRow>> | undefined
    const dirty = new Map<string, AnswerRow>()
    for (const c of changes) {
      if (!index.parts.has(c.partId) || locked.has(c.partId)) continue
      const cur = answers.get(c.partId)
      if (cur && cur.rev >= c.rev) continue
      let answer = c.answer
      if (answer.photos) {
        if (!photos) {
          photos = new Map()
          for (const p of await this.repo.photos(row.id)) {
            const m = photos.get(p.partId) ?? new Map<string, PhotoRow>()
            m.set(p.key, p)
            photos.set(p.partId, m)
          }
        }
        const known = photos.get(c.partId)
        const kept = answer.photos.flatMap((p) => {
          const stored = known?.get(p.key)
          return stored ? [{ key: stored.key, name: stored.name, size: stored.size }] : []
        })
        answer = { ...answer, photos: kept.slice(0, MAX_PHOTOS_PER_PART) }
      }
      const savedAt = new Date(Math.min(new Date(c.savedAt).getTime(), at))
      const next: AnswerRow = { partId: c.partId, answer, rev: c.rev, savedAt }
      answers.set(c.partId, next)
      dirty.set(c.partId, next)
    }
    await this.repo.upsertAnswers(row.id, [...dirty.values()])
    return dirty.size
  }

  private async applyMeta(row: AttemptRow, p: { flags?: string[]; picks?: Record<string, string[]>; position?: number }): Promise<void> {
    await this.repo.setMeta(row.id, {
      ...(p.flags ? { flags: [...p.flags] } : {}),
      ...(p.picks ? { picks: { ...p.picks } } : {}),
      ...(typeof p.position === 'number' ? { position: p.position } : {}),
    })
  }

  /**
   * An exam attempt the server already closed as auto_submitted still accepts what the device saved
   * AT OR BEFORE the deadline, within 24 h of it, and is graded again (AC-05.4). Returns true when
   * the stored answers changed.
   */
  private async lateSync(
    row: AttemptRow,
    answers: Map<string, AnswerRow>,
    changes: readonly Change[],
    load: () => Promise<Bundles>,
    events: ClosedEvent[],
  ): Promise<boolean> {
    if (row.status !== 'auto_submitted' || !row.deadlineAt) return false
    const now = this.now().getTime()
    if (now > row.deadlineAt.getTime() + LATE_SYNC_WINDOW_MS) return false
    // The scheme may already be known: this result was shown, or a later attempt on the paper
    // (e.g. a latihan with "Semak") could have shown it. Rewriting answers then would be copying.
    if (row.resultViewedAt) return false
    if (row.paperId === null) return false // unknown paper: cannot rule out a later look at the scheme
    if (await this.repo.hasLaterAttempt(row.userId, row.paperId, row.startedAt, row.id)) return false
    const ok = changes.filter((c) => Math.min(new Date(c.savedAt).getTime(), now) <= (row.deadlineAt as Date).getTime())
    if (!ok.length) return false
    const index = await this.leafIndexOf(row, load)
    const changed = await this.merge(row, answers, ok, index, new Set())
    if (!changed) return false
    const base = gradeAttempt(row.composition, await load(), this.answerMap(answers))
    // A self-mark made in between (R1-B12) stays: the new automatic grading gets the pupil's marks on top again.
    const selfMarks = (await this.repo.gradedWithMarks(row.id))?.selfMarks ?? {}
    const result = applySelfMarks(base, row.composition, selfMarks)
    await this.repo.saveResult(row.id, base, selfMarks, result)
    events.push({ attempt: row, status: 'auto_submitted', result, swept: false, regraded: true })
    return true
  }

  /* ------------------------------------------------------------------------- close (grading) */

  /** Marks and stores the result, closes the attempt. The caller holds the row lock. */
  private async finish(
    row: AttemptRow,
    answers: ReadonlyMap<string, AnswerRow>,
    status: FinishedStatus,
    opts: { key: string | null; swept: boolean },
    load: () => Promise<Bundles>,
    events: ClosedEvent[],
  ): Promise<AttemptRow> {
    const at = this.now()
    let late: number | null = null
    if (row.deadlineAt && at.getTime() > row.deadlineAt.getTime()) {
      const seconds = Math.round((at.getTime() - row.deadlineAt.getTime()) / 1000)
      // A sweep closes long after the deadline; the lateness it records stops at the grace period.
      late = opts.swept ? Math.min(seconds, GRACE_SECONDS) : seconds
    }
    const result = gradeAttempt(row.composition, await load(), this.answerMap(answers))
    const closed = await this.repo.close(row.id, { status, submittedAt: at, lateBySeconds: late, idempotencyKey: opts.key })
    if (!closed) throw new Error('Attempt was closed by another request while locked')
    await this.repo.saveResult(row.id, result)
    const next: AttemptRow = { ...row, status, submittedAt: at, lateBySeconds: late, idempotencyKey: opts.key ?? row.idempotencyKey }
    events.push({ attempt: next, status, result, swept: opts.swept, regraded: false })
    return next
  }

  /**
   * Closes ONE exam attempt that is past deadline + grace from its last saved answers. Safe to call
   * from several places and several API instances at once: the row lock plus the re-check make the
   * second caller a no-op. Returns true when this call closed it.
   */
  async closeExpired(id: string): Promise<boolean> {
    const events: ClosedEvent[] = []
    await this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) return
      const row = await this.repo.find(id)
      if (!row || !this.expired(row)) return
      const answers = await this.repo.answers(id)
      await this.finish(row, answers, 'auto_submitted', { key: null, swept: true }, this.lazyBundles(row), events)
    }, TX)
    await this.emit(events)
    return events.length > 0
  }

  /** Closes the caller's expired attempts (called by the routes that list or open attempts). */
  private async sweepUser(userId: string): Promise<void> {
    const cutoff = new Date(this.now().getTime() - GRACE_SECONDS * 1000)
    for (const id of await this.repo.expiredIds(cutoff, SWEEP_BATCH, userId)) await this.closeExpired(id)
  }

  /** The scheduled sweep: every open exam attempt past deadline + grace. Returns how many were closed. */
  async sweepExpired(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - GRACE_SECONDS * 1000)
    let closed = 0
    for (const id of await this.repo.expiredIds(cutoff, SWEEP_BATCH)) {
      try {
        if (await this.closeExpired(id)) closed += 1
      } catch (err) {
        this.logger.warn(`Could not close expired attempt ${id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return closed
  }

  /* --------------------------------------------------------------------- save / submit / abandon */

  async save(userId: string, id: string, payload: BijakAttemptSavePayload): Promise<BijakAttemptSaveResult> {
    assertAttemptPayload(payload)
    await this.owned(userId, id)
    const events: ClosedEvent[] = []
    const out = await this.prisma.transaction(async (): Promise<BijakAttemptSaveResult> => {
      if (!(await this.repo.lock(id))) throw notFoundAttempt()
      let row = (await this.repo.find(id)) as AttemptRow
      const answers = await this.repo.answers(id)
      const load = this.lazyBundles(row)
      if (this.expired(row)) row = await this.finish(row, answers, 'auto_submitted', { key: null, swept: true }, load, events)
      if (row.status !== 'in_progress') {
        const regraded = await this.lateSync(row, answers, payload.changes, load, events)
        return { savedAt: ts(this.now()), closed: true, ...(regraded ? { regraded: true as const } : {}) }
      }
      const index = await this.leafIndexOf(row, load)
      const checks = await this.repo.checkCounts(id)
      await this.merge(row, answers, payload.changes, index, lockedParts(row.mode, checks.counts, index))
      await this.applyMeta(row, payload)
      return { savedAt: ts(this.now()) }
    }, TX)
    await this.emit(events)
    return out
  }

  async submit(auth: AuthContext, id: string, payload: BijakAttemptSubmitPayload, who: CallerInfo): Promise<BijakAttemptSubmitResult> {
    assertAttemptPayload(payload)
    await this.owned(auth.userId, id)
    const events: ClosedEvent[] = []
    const carried: Change[] = [
      ...payload.changes,
      ...Object.entries(payload.answers ?? {}).map(([partId, v]) => ({ partId, answer: v.answer, rev: v.rev, savedAt: v.savedAt })),
    ]
    const out = await this.prisma.transaction(async (): Promise<BijakAttemptSubmitResult> => {
      if (!(await this.repo.lock(id))) throw notFoundAttempt()
      let row = (await this.repo.find(id)) as AttemptRow
      const answers = await this.repo.answers(id)
      const load = this.lazyBundles(row)
      if (this.expired(row)) row = await this.finish(row, answers, 'auto_submitted', { key: null, swept: true }, load, events)
      if (row.status !== 'in_progress') {
        // A replay (same key) or a later submit: nothing is recomputed, except a legitimate late sync.
        const regraded = await this.lateSync(row, answers, carried, load, events)
        return { attemptId: row.id, late: row.lateBySeconds ?? 0, closed: true, ...(regraded ? { regraded: true as const } : {}) }
      }
      const index = await this.leafIndexOf(row, load)
      const checks = await this.repo.checkCounts(id)
      await this.merge(row, answers, carried, index, lockedParts(row.mode, checks.counts, index))
      await this.applyMeta(row, payload)
      const done = await this.finish(row, answers, this.autoHonoured(row, payload.auto) ? 'auto_submitted' : 'submitted', { key: payload.idempotencyKey, swept: false }, load, events)
      return { attemptId: done.id, late: done.lateBySeconds ?? 0 }
    }, TX)
    await this.emit(events, auth, who)
    return out
  }

  async abandon(auth: AuthContext, id: string, who: CallerInfo): Promise<void> {
    await this.owned(auth.userId, id)
    const events: ClosedEvent[] = []
    const abandoned = await this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) throw notFoundAttempt()
      let row = (await this.repo.find(id)) as AttemptRow
      if (this.expired(row)) {
        row = await this.finish(row, await this.repo.answers(id), 'auto_submitted', { key: null, swept: true }, this.lazyBundles(row), events)
      }
      if (row.status !== 'in_progress') return false
      await this.repo.abandonMany([id])
      return true
    }, TX)
    await this.emit(events)
    if (abandoned) await this.record(AUDIT_ACTIONS.BIJAK_ATTEMPT_ABANDONED, auth, id, who, {})
  }

  /* --------------------------------------------------------------------------- "Semak" (latihan) */

  async check(
    userId: string,
    id: string,
    questionId: string,
    payload: BijakAttemptSavePayload | undefined,
  ): Promise<BijakAttemptQuestionResult> {
    if (payload) assertAttemptPayload(payload)
    const first = await this.owned(userId, id)
    if (first.mode !== 'latihan') throw ApiError.of('FORBIDDEN', { message: MSG.schemeAfterSubmit })
    return this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) throw notFoundAttempt()
      const row = (await this.repo.find(id)) as AttemptRow
      if (row.status !== 'in_progress') throw attemptClosed()
      if (!row.composition.some((s) => s.questionIds.includes(questionId))) throw ApiError.of('NOT_FOUND', { message: MSG.questionNotFound })
      const load = this.lazyBundles(row)
      const answers = await this.repo.answers(id)
      const checks = await this.repo.checkCounts(id)
      const used = checks.counts.get(questionId) ?? 0
      // After the cap the answer is shown and no further payload can change it (nor the count).
      if (used < MAX_CHECKS_PER_QUESTION && payload) {
        const index = await this.leafIndexOf(row, load)
        await this.merge(row, answers, payload.changes, index, lockedParts(row.mode, checks.counts, index))
        await this.applyMeta(row, payload)
      }
      const result = checkResult(row.composition, await load(), this.answerMap(answers), questionId)
      if (used < MAX_CHECKS_PER_QUESTION) await this.repo.saveCheck(id, questionId, used + 1, result)
      else await this.repo.saveCheck(id, questionId, used, result)
      return result
    }, TX)
  }

  /* ------------------------------------------------------------------------------- photos */

  async addPhoto(
    auth: AuthContext,
    id: string,
    partId: string,
    file: { buffer: Buffer; originalname?: string } | undefined,
    who: CallerInfo,
  ): Promise<BijakAttemptPhoto> {
    const first = await this.owned(auth.userId, id)
    if (first.status !== 'in_progress') throw attemptClosed()
    const events: ClosedEvent[] = []
    const out = await this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) throw notFoundAttempt()
      let row = (await this.repo.find(id)) as AttemptRow
      // Same pattern as save/submit: past deadline + grace the attempt is closed first, and the upload is refused.
      if (this.expired(row)) row = await this.finish(row, await this.repo.answers(id), 'auto_submitted', { key: null, swept: true }, this.lazyBundles(row), events)
      if (row.status !== 'in_progress') return null
      const index = await this.leafIndexOf(row, this.lazyBundles(row))
      const leaf = index.parts.get(partId)
      if (!leaf || !PHOTO_KINDS.has(leaf.kind)) throw ApiError.of('VALIDATION_ERROR', { fields: { partId: PAYLOAD_MESSAGES.partPhotos } })
      const existing = (await this.repo.photos(id)).filter((p) => p.partId === partId)
      if (existing.length >= MAX_PHOTOS_PER_PART) throw ApiError.of('VALIDATION_ERROR', { fields: { file: MSG.photoCount } })
      const ref = await this.files.upload(auth, 'bijak_photo', file ? { buffer: file.buffer } : undefined, who)
      const name = cleanFileName(file?.originalname, ref.mime)
      await this.repo.addPhoto({ attemptId: id, partId, filePublicId: ref.id, name, size: ref.size })
      return { key: ref.id, name, size: ref.size }
    }, TX)
    await this.emit(events)
    if (!out) throw attemptClosed()
    return out
  }

  /* -------------------------------------------------------------------- after-commit effects */

  private async record(action: string, auth: AuthContext | null, attemptId: string, who: CallerInfo | null, details: Record<string, unknown>): Promise<void> {
    try {
      await this.audit.record({
        action,
        actorUserId: auth?.userId ?? null,
        actorRole: auth?.active.role ?? 'system',
        scopeLevel: auth?.active.scope.level ?? null,
        schoolId: auth?.active.scope.schoolId ?? null,
        targetType: 'bijak_attempt',
        targetId: attemptId,
        requestId: who?.requestId ?? null,
        ip: who?.ip ?? null,
        isTest: auth ? auth.mode !== null : false,
        details,
      })
    } catch {
      this.logger.warn(`Audit write failed for ${action}`)
    }
  }

  /** Runs after the commit; a failing port never fails the request (the attempt is already closed). */
  private async emit(events: readonly ClosedEvent[], auth: AuthContext | null = null, who: CallerInfo | null = null): Promise<void> {
    for (const e of events) {
      const a = e.attempt
      if (!e.regraded) {
        const actor = auth && auth.userId === a.userId && !e.swept ? auth : null
        await this.record(e.status === 'submitted' ? AUDIT_ACTIONS.BIJAK_ATTEMPT_SUBMITTED : AUDIT_ACTIONS.BIJAK_ATTEMPT_AUTO_SUBMITTED, actor, a.id, who, {
          late: a.lateBySeconds ?? 0,
          swept: e.swept,
          isTestAttempt: a.isTest,
        })
        // Fail closed: a latihan shows the scheme through "Semak", so only a timed exam may earn the reward.
        if (a.mode === 'exam') {
          try {
            await this.ports.reward.award({
              attemptId: a.id,
              userId: a.userId,
              isTest: a.isTest,
              coins: e.result.coins,
              points: e.result.points,
              submittedAt: a.submittedAt,
              score: e.result.score,
              max: e.result.max,
              provisional: e.result.provisional,
              description: BIJAK_REWARD_DESCRIPTION,
            })
          } catch (err) {
            this.logger.error(`Reward port failed for attempt ${a.id}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      }
      try {
        await this.ports.aggregate.recordGraded({
          attemptId: a.id,
          userId: a.userId,
          isTest: a.isTest,
          paperKind: a.paperKind,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          paperId: a.paperId,
          subject: a.subject,
          kertas: a.kertas,
          mode: a.mode,
          status: e.status,
          score: e.result.score,
          max: e.result.max,
          provisional: e.result.provisional,
          regraded: e.regraded,
          questions: e.result.questions.map((q) => ({ questionId: q.questionId, marks: q.marks, awarded: q.awarded, attempted: q.attempted, counted: q.counted })),
        })
      } catch (err) {
        this.logger.error(`Aggregate port failed for attempt ${a.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
}

/** Copies only the composition fields; the port's objects are never stored as they are. */
function freezeComposition(sections: readonly SectionSnapshot[]): SectionSnapshot[] {
  return sections.map((s) => ({
    id: s.id,
    label: s.label,
    ...(s.compulsory ? { compulsory: true } : {}),
    ...(s.instruction ? { instruction: s.instruction } : {}),
    rule: s.rule.type === 'all' ? { type: 'all' as const } : { type: 'choose' as const, n: s.rule.n },
    questionIds: [...s.questionIds],
  }))
}

/** Display name only (never a path): base name, control characters removed, 100 characters, a safe fallback. */
function cleanFileName(raw: string | undefined, mime: string): string {
  const fallback = mime === 'image/png' ? 'gambar.png' : 'gambar.jpg'
  if (!raw) return fallback
  const base = raw.split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>"|?*:]/g, '').trim().slice(0, 100)
  return cleaned || fallback
}

export { PAYLOAD_LIMITS }
