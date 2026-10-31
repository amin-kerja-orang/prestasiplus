/**
 * Mock Bijak SPM server (a NEW store; M04 / M05 / M06 are untouched). All grading, scheme
 * reveal rules, the timer deadline and blueprint generation live here, never in the pages.
 * State is persisted as one JSON document so attempts survive a refresh.
 *
 * Reveal rules (US-15): an answer key or mark scheme leaves this class only inside a graded
 * result, i.e. after submit (exam) or after "Semak" on that one question (latihan).
 */
import type { BijakKuizCheckRequest, BijakKuizStartRequest } from '@pp/contract'

import { blankQuestion } from '../admin/intake/domain/blank'
import { batchToSeeds } from '../admin/intake/domain/convert'
import { groupsOf } from '../admin/intake/domain/grouping'
import { paperMarks } from '../admin/intake/domain/marks'
import { validateBatch } from '../admin/intake/domain/validation'
import { demoBatch } from '../admin/intake/lib/seed'
import type {
  ExtractedPaper,
  IntakeBatch,
  IntakeIssue,
  IntakeMeta,
  IntakeQuestion,
  IntakeStatus,
  IntakeStimulus,
  IntakeSummary,
  ManualMeta,
  PageText,
  SaveExtractedPayload,
} from '../admin/intake/types'
import { AdminOps, seedAdminSlice, type AdminSlice } from './admin'
import { composeFromBlueprint, poolUnits, type PoolUnit } from '../domain/blueprint'
import { BANK, BLUEPRINTS, PAPERS, SUBJECTS, subjectName } from '../data/registry'
import { countedIds } from '../domain/choose-n'
import { gradePart, isBlank } from '../domain/grading'
import { numericValue } from '../domain/math-expr'
import { effectiveMarks, leavesOf, type Leaf } from '../domain/paper-model'
import type { PastSittings, ReviewPart, SelfMarkOutcome } from '../domain/semakan'
import type { BankFilter, DecisionAction, PaperPatch, QueueFilter } from '../domain/admin-types'
import type {
  Attempt,
  AttemptMode,
  AttemptPaperView,
  AttemptResult,
  GenerateOutcome,
  GroupView,
  HistoryRow,
  InProgressInfo,
  PaperCover,
  PaperDef,
  PaperKind,
  PaperSummary,
  PartResult,
  PartStatus,
  QuestionDef,
  QuestionResult,
  QuestionView,
  ResultView,
  SaveChange,
  SavePayload,
  SectionResult,
  SectionSnapshot,
  SectionView,
  StoredAnswer,
  SubjectCode,
  SubmitPayload,
} from '../domain/types'

import { BijakError } from './errors'
import { MockKuiz } from './kuiz-mock'
import { MemoryStorage, type KeyValueStore } from './storage'
import type { BijakApi, SaveResult, SubmitResult } from './types'

// Re-exported so existing imports from './store' keep working (the HTTP client imports the small
// modules directly and never this one, which pulls the seed registry).
export { BijakError, MemoryStorage }
export type { KeyValueStore, SaveResult, SubmitResult }

/** Plain-data copy (structuredClone rejects Vue reactive proxies passed in by pages). */
const jsonClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const SERVER_STORAGE_KEY = 'pp.bijak.server.v1'
/** After the deadline the server closes an unattended exam attempt itself (AC-05.4). */
export const GRACE_SECONDS = 300
/** Late sync window after the deadline (AC-05.4). */
export const LATE_SYNC_WINDOW_MS = 24 * 60 * 60 * 1000
/** Latihan: at most this many "Semak" per question per attempt (NFR-05). */
export const MAX_CHECKS_PER_QUESTION = 3

/** A sitting younger than this resumes silently (AC-12.5). */
export const FRESH_SECONDS = 60

interface GeneratedPaper extends PaperDef {
  userId: number
  createdAt: number
}

interface State extends AdminSlice {
  seq: number
  attempts: Record<string, Attempt>
  generated: Record<string, GeneratedPaper>
  /** Admin SPM question intake batches (additive; seeded on first use). */
  intake?: Record<string, IntakeBatch>
}

export interface ServerOptions {
  storage?: KeyValueStore
  now?: () => number
  latencyMs?: number
  storageKey?: string
}

export class BijakServer implements BijakApi {
  private readonly storage: KeyValueStore
  private readonly now: () => number
  private readonly latencyMs: number
  private readonly key: string
  private state: State
  private offline = false
  private readonly ops: AdminOps
  private readonly kuiz = new MockKuiz(() => this.tick())

  constructor(opts: ServerOptions = {}) {
    this.storage = opts.storage ?? new MemoryStorage()
    this.now = opts.now ?? (() => Date.now())
    this.latencyMs = opts.latencyMs ?? 0
    this.key = opts.storageKey ?? SERVER_STORAGE_KEY
    this.state = this.load()
    this.ops = new AdminOps({
      slice: () => this.state,
      now: () => this.now(),
      persist: () => this.persist(),
      tick: () => this.tick(),
      error: (code, message) => new BijakError(code, message),
    })
  }

  /* ------------------------------------------------------------------------- plumbing */

  private load(): State {
    let st: State = { seq: 0, attempts: {}, generated: {} }
    try {
      const raw = this.storage.getItem(this.key)
      if (raw) st = JSON.parse(raw) as State
    } catch {
      /* start empty */
    }
    seedAdminSlice(st, this.now())
    return st
  }

  private persist(): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.state))
    } catch {
      /* quota: the in-memory state stays authoritative for this session */
    }
  }

  /** Test hook: every call rejects while offline. */
  setOffline(value: boolean): void {
    this.offline = value
  }

  /** Test hook: reload state from storage (a page refresh). */
  reload(): void {
    this.state = this.load()
  }

  private async tick(): Promise<void> {
    if (this.offline) throw new BijakError('offline', 'Luar talian')
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs))
  }

  serverNow(): number {
    return this.now()
  }

  /* --------------------------------------------------------------------------- papers */

  private resolvePaper(id: string, userId: number): PaperDef & { kind: PaperKind } {
    const fixed = PAPERS.find((p) => p.id === id)
    if (fixed) return { ...fixed, kind: 'pilihan' }
    const published = this.ops.publishedPaper(id)
    if (published) return { ...published, kind: 'pilihan' }
    const gen = this.state.generated[id]
    if (gen && gen.userId === userId) return { ...gen, kind: 'jana' }
    throw new BijakError('not_found', 'Kertas tidak ditemui')
  }

  private questionMarks(q: QuestionDef): number {
    if (q.mcq) return BANK.schemes.get(q.id)?.marks ?? 1
    return leavesOf(q.parts ?? []).reduce((n, l) => n + l.marks, 0)
  }

  private paperMarks(sections: Pick<SectionSnapshot, 'rule' | 'questionIds'>[]): number {
    return sections.reduce(
      (n, s) =>
        n +
        effectiveMarks(
          s.rule,
          s.questionIds.map((id) => this.questionMarks(BANK.questions.get(id)!)),
        ),
      0,
    )
  }

  private latestAttempt(userId: number, paperId: string): Attempt | undefined {
    return Object.values(this.state.attempts)
      .filter((a) => a.userId === userId && a.paperId === paperId)
      .sort((a, b) => b.startedAt - a.startedAt)[0]
  }

  private summary(def: PaperDef & { kind: PaperKind }, userId: number): PaperSummary {
    const last = this.latestAttempt(userId, def.id)
    const submitted = Object.values(this.state.attempts)
      .filter((a) => a.userId === userId && a.paperId === def.id && a.result)
      .sort((a, b) => b.startedAt - a.startedAt)[0]
    const inProgress = last?.status === 'in_progress' ? last : undefined
    return {
      id: def.id,
      title: def.title,
      subject: def.subject,
      subjectName: subjectName(def.subject),
      kertas: def.kertas,
      year: def.year,
      code: def.code,
      durationMin: def.durationMin,
      questionCount: def.sections.reduce((n, s) => n + s.questionIds.length, 0),
      marks: this.paperMarks(def.sections),
      kind: def.kind,
      status: inProgress ? 'sedang' : submitted ? 'selesai' : 'belum',
      ...(submitted?.result
        ? { lastScore: { score: submitted.result.score, max: submitted.result.max } }
        : {}),
      ...(inProgress ? { attemptId: inProgress.id } : {}),
    }
  }

  async listPapers(userId: number): Promise<PaperSummary[]> {
    await this.tick()
    this.sweep()
    return [...PAPERS, ...this.ops.publishedPapers()].map((p) =>
      this.summary({ ...p, kind: 'pilihan' }, userId),
    )
  }

  async getCover(userId: number, paperId: string): Promise<PaperCover> {
    await this.tick()
    const def = this.resolvePaper(paperId, userId)
    return {
      ...this.summary(def, userId),
      instructions: def.instructions,
      reference: def.reference ?? [],
      sections: def.sections.map((s) => ({
        label: s.label,
        marks: effectiveMarks(
          s.rule,
          s.questionIds.map((id) => this.questionMarks(BANK.questions.get(id)!)),
        ),
        instruction:
          s.instruction ??
          (s.rule.type === 'all'
            ? 'Jawab semua soalan.'
            : `Jawab ${s.rule.n} daripada ${s.questionIds.length} soalan.`),
        questionCount: s.questionIds.length,
        compulsory: !!s.compulsory,
        ...(s.rule.type === 'choose' ? { chooseN: s.rule.n } : {}),
      })),
    }
  }

  /** Kontrak list for Jana Kertas: which (subject, kertas) can be generated. */
  async listContracts(): Promise<
    {
      subject: SubjectCode
      subjectName: string
      kertas: number
      source: string
      code: string
      durationMin: number
      sections: { label: string; take: number }[]
      canGenerate: boolean
      unavailableReason?: 'NO_BLUEPRINT'
    }[]
  > {
    await this.tick()
    return BLUEPRINTS.map((b) => ({
      subject: b.subject,
      subjectName: subjectName(b.subject),
      kertas: b.kertas,
      source: b.source,
      code: b.code,
      durationMin: b.durationMin,
      sections: b.sections.map((s) => ({ label: s.label, take: s.take })),
      canGenerate: b.source !== 'Draf',
      ...(b.source === 'Draf' ? { unavailableReason: 'NO_BLUEPRINT' as const } : {}),
    }))
  }

  subjects() {
    return SUBJECTS
  }

  /** Jana Kertas (US-03). Returns a shortage list instead of a short paper. */
  async generatePaper(
    userId: number,
    subject: SubjectCode,
    kertas: number,
  ): Promise<GenerateOutcome> {
    await this.tick()
    const bp = BLUEPRINTS.find((b) => b.subject === subject && b.kertas === kertas)
    if (!bp || bp.source === 'Draf') return { ok: false, reason: 'no_blueprint' }
    const unitsByPool = new Map<string, PoolUnit[]>()
    for (const s of bp.sections) {
      unitsByPool.set(
        s.pool,
        poolUnits(s.pool, BANK.pool, BANK.groups, (qid) => BANK.questions.get(qid)?.groupId),
      )
    }
    const seen = new Set(
      Object.values(this.state.attempts)
        .filter((a) => a.userId === userId)
        .flatMap((a) => a.sections.flatMap((s) => s.questionIds)),
    )
    this.state.seq += 1
    const outcome = composeFromBlueprint(bp, unitsByPool, {
      seed: this.now() + this.state.seq * 7919 + userId,
      seen,
    })
    if (!outcome.ok) return { ok: false, reason: 'shortage', shortages: outcome.shortages }
    const id = `jana-${subject.toLowerCase()}-k${kertas}-${this.state.seq}`
    const gen: GeneratedPaper = {
      id,
      userId,
      createdAt: this.now(),
      title: `Kertas Jana ${subjectName(subject)} Kertas ${kertas} (#${this.state.seq})`,
      subject,
      kertas: kertas as 1 | 2,
      year: new Date(this.now()).getFullYear(),
      code: bp.code,
      durationMin: bp.durationMin,
      instructions: bp.instructions,
      reference: bp.reference,
      sections: outcome.sections.map((s, i) => ({
        ...s,
        id: `${id}-s${i + 1}`,
        questionCount: s.questionIds.length,
        markBudget: effectiveMarks(
          s.rule,
          s.questionIds.map((qid) => this.questionMarks(BANK.questions.get(qid)!)),
        ),
      })),
    }
    this.state.generated[id] = gen
    this.persist()
    return { ok: true, paperId: id }
  }

  /* -------------------------------------------------------------------------- attempts */

  private attemptOf(userId: number, attemptId: string): Attempt {
    const a = this.state.attempts[attemptId]
    if (!a) throw new BijakError('not_found', 'Percubaan tidak ditemui')
    if (a.userId !== userId) throw new BijakError('forbidden', 'Akses ditolak')
    return a
  }

  async findInProgress(userId: number, paperId: string): Promise<InProgressInfo | null> {
    await this.tick()
    this.sweep()
    const a = Object.values(this.state.attempts)
      .filter((x) => x.userId === userId && x.paperId === paperId && x.status === 'in_progress')
      .sort((x, y) => y.startedAt - x.startedAt)[0]
    if (!a) return null
    const elapsed = Math.max(0, Math.floor((this.now() - a.startedAt) / 1000))
    return {
      attemptId: a.id,
      title: a.title,
      mode: a.mode,
      elapsedSeconds: elapsed,
      fresh: elapsed <= FRESH_SECONDS,
    }
  }

  /** Starts a sitting. `restart` closes the unsubmitted one as "Ditinggalkan" first (AC-12.2). */
  async startAttempt(
    userId: number,
    paperId: string,
    mode: AttemptMode,
    opts: { restart?: boolean; fresh?: boolean } = {},
  ): Promise<{ attemptId: string }> {
    await this.tick()
    const def = this.resolvePaper(paperId, userId)
    const open = Object.values(this.state.attempts).filter(
      (a) => a.userId === userId && a.paperId === paperId && a.status === 'in_progress',
    )
    if (open.length && !opts.restart && !opts.fresh) {
      const keep = open.sort((a, b) => b.startedAt - a.startedAt)[0]!
      return { attemptId: keep.id }
    }
    if (!opts.fresh) for (const a of open) a.status = 'abandoned'
    this.state.seq += 1
    const id = `pcb-${this.state.seq}-${userId}`
    const started = this.now()
    const attempt: Attempt = {
      id,
      userId,
      paperId,
      paperKind: def.kind,
      title: def.title,
      subject: def.subject,
      kertas: def.kertas,
      code: def.code,
      mode,
      status: 'in_progress',
      startedAt: started,
      deadline: mode === 'exam' ? started + def.durationMin * 60_000 : null,
      durationMin: def.durationMin,
      sections: def.sections.map((s) => ({
        id: s.id,
        label: s.label,
        ...(s.instruction ? { instruction: s.instruction } : {}),
        ...(s.compulsory ? { compulsory: true } : {}),
        rule: s.rule,
        questionIds: [...s.questionIds],
      })),
      answers: {},
      flags: [],
      picks: {},
      position: 0,
      checked: [],
    }
    this.state.attempts[id] = attempt
    this.persist()
    return { attemptId: id }
  }

  private buildView(a: Attempt): AttemptPaperView {
    let n = 0
    const numberOf = new Map<string, number>()
    for (const s of a.sections) for (const qid of s.questionIds) numberOf.set(qid, ++n)
    const questions: QuestionView[] = []
    const sections: SectionView[] = a.sections.map((s) => {
      const marks = s.questionIds.map((qid) => this.questionMarks(BANK.questions.get(qid)!))
      for (const qid of s.questionIds) {
        const q = BANK.questions.get(qid)!
        questions.push({
          id: q.id,
          number: numberOf.get(q.id)!,
          sectionId: s.id,
          topic: q.curriculum.unitLabel,
          formOrigin: q.curriculum.formOrigin,
          ...(q.groupId ? { groupId: q.groupId } : {}),
          ...(q.groupId && BANK.groups.get(q.groupId)?.optionBank
            ? { optionBank: BANK.groups.get(q.groupId)!.optionBank }
            : {}),
          stem: q.stem,
          marks: this.questionMarks(q),
          ...(q.mcq ? { mcq: q.mcq } : {}),
          ...(q.parts ? { parts: q.parts } : {}),
        })
      }
      return {
        ...s,
        marks: marks.reduce((x, y) => x + y, 0),
        effectiveMarks: effectiveMarks(s.rule, marks),
      }
    })
    const groups: GroupView[] = []
    const seen = new Set<string>()
    for (const q of questions) {
      if (!q.groupId || seen.has(q.groupId)) continue
      seen.add(q.groupId)
      const g = BANK.groups.get(q.groupId)!
      const ids = questions.filter((x) => x.groupId === q.groupId).map((x) => x.id)
      const nums = ids.map((id) => numberOf.get(id)!)
      groups.push({
        id: g.id,
        stimulus: BANK.stimuli.get(g.stimulusId)!,
        from: Math.min(...nums),
        to: Math.max(...nums),
        questionIds: ids,
      })
    }
    const { result: _r, sections: _s, ...meta } = a
    void _r
    void _s
    const checks =
      a.status === 'in_progress' && a.mode === 'latihan'
        ? a.checked.map((qid) => this.gradeQuestion(a, qid, numberOf.get(qid)!, true))
        : []
    return { attempt: meta, sections, questions, groups, checks }
  }

  async getAttemptView(userId: number, attemptId: string): Promise<AttemptPaperView> {
    await this.tick()
    this.sweep()
    const a = this.attemptOf(userId, attemptId)
    return this.buildView(a)
  }

  private allowedParts(a: Attempt): Set<string> {
    const ids = new Set<string>()
    for (const s of a.sections)
      for (const qid of s.questionIds) {
        const q = BANK.questions.get(qid)!
        if (q.mcq) ids.add(q.id)
        else for (const l of leavesOf(q.parts ?? [])) ids.add(l.id)
      }
    return ids
  }

  /** Merge by per-part revision: an older revision never overwrites a newer one. */
  private merge(
    a: Attempt,
    changes: Pick<SaveChange, 'partId' | 'answer' | 'rev' | 'savedAt'>[],
  ): void {
    const allowed = this.allowedParts(a)
    const locked = this.lockedParts(a)
    const at = this.now()
    for (const c of changes) {
      if (!allowed.has(c.partId) || locked.has(c.partId)) continue
      const cur = a.answers[c.partId]
      if (cur && cur.rev >= c.rev) continue
      // The device clock is not trusted: a save time never lies in the future of the server.
      a.answers[c.partId] = { answer: c.answer, rev: c.rev, savedAt: Math.min(c.savedAt, at) }
    }
  }

  /** Latihan: after the check cap the answer of a question is final. */
  private lockedParts(a: Attempt): Set<string> {
    const ids = new Set<string>()
    if (a.mode !== 'latihan') return ids
    for (const [qid, n] of Object.entries(a.checkCounts ?? {})) {
      if (n < MAX_CHECKS_PER_QUESTION) continue
      const q = BANK.questions.get(qid)
      if (!q) continue
      if (q.mcq) ids.add(q.id)
      else for (const l of leavesOf(q.parts ?? [])) ids.add(l.id)
    }
    return ids
  }

  /**
   * An exam attempt the server already closed at the deadline still accepts what the device saved
   * before the deadline, within 24 h, and is graded again (AC-05.4).
   */
  private lateSync(
    a: Attempt,
    changes: Pick<SaveChange, 'partId' | 'answer' | 'rev' | 'savedAt'>[],
  ): boolean {
    if (a.status !== 'auto_submitted' || !a.deadline) return false
    if (this.now() > a.deadline + LATE_SYNC_WINDOW_MS) return false
    const at = this.now()
    const ok = changes.filter((c) => Math.min(c.savedAt, at) <= a.deadline!)
    if (!ok.length) return false
    const before = JSON.stringify(a.answers)
    this.merge(a, ok)
    if (JSON.stringify(a.answers) === before) return false
    a.result = this.gradeAttempt(a)
    return true
  }

  private applyMeta(a: Attempt, p: SavePayload): void {
    if (p.flags) a.flags = [...p.flags]
    if (p.picks) a.picks = { ...p.picks }
    if (typeof p.position === 'number') a.position = p.position
  }

  /** Idempotent autosave (US-11). */
  async saveAnswers(userId: number, attemptId: string, payload: SavePayload): Promise<SaveResult> {
    await this.tick()
    this.sweep()
    const a = this.attemptOf(userId, attemptId)
    if (a.status !== 'in_progress') {
      const regraded = this.lateSync(a, payload.changes)
      if (regraded) this.persist()
      return { savedAt: this.now(), closed: true, ...(regraded ? { regraded } : {}) }
    }
    this.merge(a, payload.changes)
    this.applyMeta(a, payload)
    this.persist()
    return { savedAt: this.now() }
  }

  /**
   * Submit (US-13). The server grades the UNION of what it saved and what the request carries, so
   * an answer typed just before the tap is never missing from grading. Repeats return the same
   * result (idempotent).
   */
  async submit(userId: number, attemptId: string, payload: SubmitPayload): Promise<SubmitResult> {
    await this.tick()
    this.sweep()
    const a = this.attemptOf(userId, attemptId)
    const carried = [
      ...payload.changes,
      ...Object.entries(payload.answers ?? {}).map(([partId, v]) => ({ partId, ...v })),
    ]
    if (a.status !== 'in_progress') {
      const regraded = this.lateSync(a, carried)
      if (regraded) this.persist()
      return {
        attemptId: a.id,
        late: a.lateBySeconds ?? 0,
        closed: true,
        ...(regraded ? { regraded } : {}),
      }
    }
    this.merge(a, carried)
    this.applyMeta(a, payload)
    this.finish(a, payload.auto ? 'auto_submitted' : 'submitted', payload.idempotencyKey)
    this.persist()
    return { attemptId: a.id, late: a.lateBySeconds ?? 0 }
  }

  private finish(
    a: Attempt,
    status: 'submitted' | 'auto_submitted',
    key?: string,
    swept = false,
  ): void {
    const at = this.now()
    a.status = status
    a.submittedAt = at
    if (key) a.idempotencyKey = key
    if (a.deadline && at > a.deadline) {
      const late = Math.round((at - a.deadline) / 1000)
      // A sweep closes long after the deadline; the lateness it records stops at the grace period.
      a.lateBySeconds = swept ? Math.min(late, GRACE_SECONDS) : late
    }
    a.result = this.gradeAttempt(a)
  }

  /** Closes exam attempts that are past the deadline plus grace, from their last saved answers. */
  sweep(): void {
    let changed = false
    for (const a of Object.values(this.state.attempts)) {
      if (
        a.status === 'in_progress' &&
        a.deadline &&
        this.now() > a.deadline + GRACE_SECONDS * 1000
      ) {
        this.finish(a, 'auto_submitted', undefined, true)
        changed = true
      }
    }
    if (changed) this.persist()
  }

  async abandon(userId: number, attemptId: string): Promise<void> {
    await this.tick()
    const a = this.attemptOf(userId, attemptId)
    if (a.status === 'in_progress') {
      a.status = 'abandoned'
      this.persist()
    }
  }

  /* --------------------------------------------------------------------------- grading */

  private gradeQuestion(
    a: Attempt,
    qid: string,
    number: number,
    countedDefault: boolean,
  ): QuestionResult {
    const q = BANK.questions.get(qid)!
    const sectionId = a.sections.find((s) => s.questionIds.includes(qid))!.id
    const finals: Record<string, number | null> = {}
    const leaves: Leaf[] = q.mcq
      ? [
          {
            id: q.id,
            label: '',
            prompt: q.stem,
            marks: this.questionMarks(q),
            kind: 'short_text',
            depth: 0,
          },
        ]
      : leavesOf(q.parts ?? [])
    const parts = leaves.map((leaf) => {
      const scheme = BANK.schemes.get(leaf.id)!
      const answer = a.answers[leaf.id]?.answer
      const res = gradePart({
        part: {
          id: leaf.id,
          label: leaf.label,
          prompt: leaf.prompt,
          marks: leaf.marks,
          kind: q.mcq ? 'mcq' : leaf.kind,
        },
        scheme,
        answer,
        ctx: { previousFinals: finals },
      })
      finals[leaf.id] = numericValue(answer?.final ?? '')
      return this.withSelfMark(a, res)
    })
    const marks = parts.reduce((n, p) => n + p.marks, 0)
    return {
      questionId: qid,
      number,
      sectionId,
      marks,
      awarded: parts.reduce((n, p) => n + p.awarded, 0),
      counted: countedDefault,
      attempted: leaves.some((l) => !isBlank(a.answers[l.id]?.answer)),
      parts,
    }
  }

  /**
   * R1-B12 in the mock: a part that waits for a person is `selfMarkable`; once the pupil marks it
   * (`selfMarks[partId]`), its mark replaces the provisional one. The keyword suggestion (R1-B13) is
   * backend-only and is not simulated here.
   */
  private withSelfMark(a: Attempt, part: PartResult): ReviewPart {
    if (part.status !== 'belum_dimarkah' && !this.selfMarksOf(a)[part.partId]) return part
    const mine = this.selfMarksOf(a)[part.partId]
    const base = { ...part, selfMarkable: true as const }
    if (!mine) return base
    const status: PartStatus =
      mine.mark >= part.marks ? 'betul' : mine.mark <= 0 ? 'salah' : 'separa'
    return {
      ...base,
      awarded: mine.mark,
      status,
      selfMarked: true as const,
      ...(mine.band ? { band: mine.band } : {}),
    }
  }

  private selfMarksOf(a: Attempt): Record<string, { mark: number; band?: string }> {
    return ((a as Attempt & { selfMarks?: Record<string, { mark: number; band?: string }> })
      .selfMarks ??= {})
  }

  private findGradedPart(a: Attempt, partId: string): ReviewPart | undefined {
    for (const q of a.result?.questions ?? []) {
      const p = q.parts.find((x) => x.partId === partId)
      if (p) return p
    }
    return undefined
  }

  async selfMark(
    userId: number,
    attemptId: string,
    body: { partId: string; mark: number; band?: string },
  ): Promise<SelfMarkOutcome> {
    await this.tick()
    const a = this.attemptOf(userId, attemptId)
    if (!a.result) throw new BijakError('not_submitted', 'Skema hanya didedahkan selepas Hantar')
    const part = this.findGradedPart(a, body.partId)
    if (!part) throw new BijakError('bad_request', 'Bahagian ini tiada dalam kertas ini.')
    if (!part.selfMarkable) {
      throw new BijakError(
        'bad_request',
        'Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.',
      )
    }
    const bands = part.scheme.rubric?.bands
    let lo = 0
    let hi = part.marks
    if (body.band !== undefined) {
      const b = bands?.find((x) => x.name === body.band)
      if (!bands) throw new BijakError('bad_request', 'Bahagian ini tidak menggunakan band.')
      if (!b) throw new BijakError('bad_request', 'Band tidak sah untuk bahagian ini.')
      lo = Math.min(b.range[0], part.marks)
      hi = Math.min(b.range[1], part.marks)
    }
    const mark = Math.min(Math.max(Math.round(body.mark), lo), hi)
    this.selfMarksOf(a)[body.partId] = { mark, ...(body.band ? { band: body.band } : {}) }
    a.result = this.gradeAttempt(a)
    this.persist()
    const graded = this.findGradedPart(a, body.partId)!
    return {
      partId: body.partId,
      awarded: mark,
      max: part.marks,
      ...(body.band ? { band: body.band } : {}),
      status: graded.status,
      attemptScore: a.result.score,
      attemptMax: a.result.max,
      provisional: a.result.provisional,
      pendingReview: a.result.pendingReview,
      result: a.result,
    }
  }

  async retryAttempt(userId: number, attemptId: string): Promise<{ attemptId: string }> {
    await this.tick()
    const a = this.attemptOf(userId, attemptId)
    if (a.status === 'in_progress') {
      throw new BijakError('bad_request', 'Hantar percubaan ini dahulu sebelum mencuba semula.')
    }
    // A new sitting; other open sittings of the paper are left as they are (as the API does).
    return this.startAttempt(userId, a.paperId, a.mode, { fresh: true })
  }

  async pastSittings(userId: number, paperId: string): Promise<PastSittings> {
    await this.tick()
    this.sweep()
    const closed = Object.values(this.state.attempts)
      .filter(
        (x) =>
          x.userId === userId &&
          x.paperId === paperId &&
          (x.status === 'submitted' || x.status === 'auto_submitted') &&
          x.result,
      )
      .sort((x, y) => (y.submittedAt ?? 0) - (x.submittedAt ?? 0))
      .slice(0, 20)
    return {
      lastSubmittedAttemptId: closed[0]?.id ?? null,
      sittings: closed.map((x) => ({
        attemptId: x.id,
        mode: x.mode,
        status: x.status as 'submitted' | 'auto_submitted',
        startedAt: x.startedAt,
        submittedAt: x.submittedAt ?? x.startedAt,
        score: x.result!.score,
        max: x.result!.max,
        provisional: x.result!.provisional,
      })),
    }
  }

  private gradeAttempt(a: Attempt): AttemptResult {
    let n = 0
    const questions: QuestionResult[] = []
    const sections: SectionResult[] = []
    for (const s of a.sections) {
      const qs = s.questionIds.map((qid) => this.gradeQuestion(a, qid, ++n, true))
      let counted = qs
      if (s.rule.type === 'choose') {
        // Best N attempted by marks (ties: the lower position); a ticked blank question fills a
        // free slot. Ticks never change the score (domain/choose-n.ts, AC-06.3).
        const ids = new Set(
          countedIds(
            qs.map((q) => ({ id: q.questionId, attempted: q.attempted, awarded: q.awarded })),
            s.rule.n,
            a.picks?.[s.id],
          ),
        )
        for (const q of qs) q.counted = ids.has(q.questionId)
        counted = qs.filter((q) => q.counted)
      }
      questions.push(...qs)
      sections.push({
        sectionId: s.id,
        label: s.label,
        marks: effectiveMarks(
          s.rule,
          qs.map((q) => q.marks),
        ),
        awarded: counted.reduce((x, q) => x + q.awarded, 0),
        ...(s.rule.type === 'choose' ? { chooseN: s.rule.n } : {}),
        counted: counted.map((q) => q.questionId),
      })
    }
    const score = sections.reduce((x, s) => x + s.awarded, 0)
    const max = sections.reduce((x, s) => x + s.marks, 0)
    const pending = questions
      .filter((q) => q.counted)
      .flatMap((q) => q.parts)
      .filter((p) => p.status === 'belum_dimarkah').length
    return {
      score,
      max,
      percent: max ? Math.round((score / max) * 1000) / 10 : 0,
      provisional: pending > 0,
      pendingReview: pending,
      sections,
      questions,
      coins: score * 2,
      points: score * 10,
    }
  }

  /** Latihan "Semak" (AC-15.3): grades one question and reveals only its scheme. */
  async checkQuestion(
    userId: number,
    attemptId: string,
    questionId: string,
    payload?: SavePayload,
  ): Promise<QuestionResult> {
    await this.tick()
    const a = this.attemptOf(userId, attemptId)
    if (a.mode !== 'latihan')
      throw new BijakError('forbidden', 'Skema hanya didedahkan selepas Hantar')
    if (a.status !== 'in_progress') throw new BijakError('bad_request', 'Percubaan sudah tamat')
    if (!a.sections.some((s) => s.questionIds.includes(questionId)))
      throw new BijakError('not_found', 'Soalan tidak ditemui')
    const counts = (a.checkCounts ??= {})
    const used = counts[questionId] ?? 0
    // After the cap the answer is shown and no further payload can change it.
    if (used < MAX_CHECKS_PER_QUESTION) {
      if (payload) {
        this.merge(a, payload.changes)
        this.applyMeta(a, payload)
      }
      counts[questionId] = used + 1
    }
    if (!a.checked.includes(questionId)) a.checked.push(questionId)
    this.persist()
    const number = a.sections.flatMap((s) => s.questionIds).indexOf(questionId) + 1
    return this.gradeQuestion(a, questionId, number, true)
  }

  async getResult(userId: number, attemptId: string): Promise<ResultView> {
    await this.tick()
    this.sweep()
    const a = this.attemptOf(userId, attemptId)
    if (!a.result) throw new BijakError('not_submitted', 'Skema hanya didedahkan selepas Hantar')
    const paper = this.buildView(a)
    paper.checks = []
    return { attempt: paper.attempt, result: a.result, paper }
  }

  /* --------------------------------------------------------------------------- history */

  async history(userId: number): Promise<HistoryRow[]> {
    await this.tick()
    this.sweep()
    return Object.values(this.state.attempts)
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((a) => ({
        attemptId: a.id,
        title: a.title,
        subject: a.subject,
        subjectName: subjectName(a.subject),
        kertas: a.kertas,
        kind: a.paperKind,
        mode: a.mode,
        status: a.status,
        startedAt: a.startedAt,
        durationSeconds: Math.max(
          0,
          Math.round(((a.submittedAt ?? this.now()) - a.startedAt) / 1000),
        ),
        ...(a.result ? { score: a.result.score, max: a.result.max } : {}),
      }))
  }

  /* ------------------------------------------------------------------ admin question intake */

  private intakeStore(): Record<string, IntakeBatch> {
    if (!this.state.intake) {
      const demo = demoBatch(this.now())
      this.state.intake = { [demo.id]: demo }
      this.persist()
    }
    return this.state.intake
  }

  private intakeBatch(id: string): IntakeBatch {
    const b = this.intakeStore()[id]
    if (!b) throw new BijakError('not_found', 'Kumpulan ekstrak tidak ditemui')
    return b
  }

  private intakeSummary(b: IntakeBatch): IntakeSummary {
    return {
      id: b.id,
      title: `${subjectName(b.subject)} Kertas ${b.kertas} ${b.year}`,
      subject: b.subject,
      subjectName: subjectName(b.subject),
      kertas: b.kertas,
      year: b.year,
      status: b.status,
      sourceKind: b.sourceKind ?? 'pdf',
      fileName: b.fileName,
      questionCount: b.questions.length,
      groupCount: groupsOf(b.questions).length,
      lowCount: b.questions.reduce(
        (n, q) => n + q.lowFields.filter((f) => !q.confirmed.includes(f)).length,
        0,
      ),
      marks: paperMarks(b.questions),
      updatedAt: b.updatedAt,
    }
  }

  async listIntakeBatches(
    filter: { status?: IntakeStatus; subject?: SubjectCode; q?: string } = {},
  ): Promise<IntakeSummary[]> {
    await this.tick()
    const needle = filter.q?.trim().toLowerCase()
    return Object.values(this.intakeStore())
      .filter((b) => !filter.status || b.status === filter.status)
      .filter((b) => !filter.subject || b.subject === filter.subject)
      .filter(
        (b) =>
          !needle ||
          b.fileName.toLowerCase().includes(needle) ||
          (b.sourceKind === 'manual' &&
            `${subjectName(b.subject)} ${b.source} manual`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((b) => this.intakeSummary(b))
  }

  async getIntakeBatch(id: string): Promise<IntakeBatch> {
    await this.tick()
    return jsonClone(this.intakeBatch(id))
  }

  /** Draf batch from an extraction run. The page text is kept; page images stay in the browser. */
  async createIntakeBatch(
    userId: number,
    meta: IntakeMeta,
    extracted: ExtractedPaper,
    pages: PageText[],
  ): Promise<IntakeBatch> {
    await this.tick()
    const store = this.intakeStore()
    this.state.seq += 1
    const now = this.now()
    const batch: IntakeBatch = {
      ...meta,
      id: `ek-${this.state.seq}`,
      userId,
      status: 'draf',
      createdAt: now,
      updatedAt: now,
      provider: extracted.provider,
      model: extracted.model,
      questions: jsonClone(extracted.questions),
      stimuli: jsonClone(extracted.stimuli),
      unmatched: [...extracted.unmatched],
      pages: jsonClone(pages),
    }
    store[batch.id] = batch
    this.persist()
    return jsonClone(batch)
  }

  /**
   * Draf batch typed by hand (no file): the same declaration as an upload, source kind "manual",
   * one empty question ready to fill. It goes through the same review page and the same gate.
   */
  async createManualBatch(userId: number, meta: ManualMeta): Promise<IntakeBatch> {
    await this.tick()
    const store = this.intakeStore()
    this.state.seq += 1
    const now = this.now()
    const { forPaperId, ...declared } = meta
    const batch: IntakeBatch = {
      ...declared,
      fileName: '',
      fileHash: '',
      pageCount: 0,
      id: `ek-${this.state.seq}`,
      sourceKind: 'manual',
      ...(forPaperId ? { forPaperId } : {}),
      userId,
      status: 'draf',
      createdAt: now,
      updatedAt: now,
      provider: 'manual',
      model: '-',
      questions: [blankQuestion(meta.subject, 1)],
      stimuli: [],
      unmatched: [],
      pages: [],
    }
    store[batch.id] = batch
    this.persist()
    return jsonClone(batch)
  }

  /** Replace the edited content of a Draf batch. A batch under review is read-only. */
  async saveExtracted(id: string, payload: SaveExtractedPayload): Promise<IntakeBatch> {
    await this.tick()
    const b = this.intakeBatch(id)
    if (b.status !== 'draf') throw new BijakError('bad_request', 'Kumpulan sudah dihantar untuk semakan')
    b.questions = jsonClone(payload.questions)
    b.stimuli = jsonClone(payload.stimuli)
    b.updatedAt = this.now()
    this.persist()
    return jsonClone(b)
  }

  /** Draf to Semakan. The quality gate runs here too, so the UI cannot bypass it (E9). */
  async submitForReview(
    id: string,
  ): Promise<{ ok: true; batch: IntakeBatch } | { ok: false; issues: IntakeIssue[] }> {
    await this.tick()
    const b = this.intakeBatch(id)
    if (b.status !== 'draf') throw new BijakError('bad_request', 'Kumpulan sudah dihantar untuk semakan')
    const issues = validateBatch(b)
    if (issues.length > 0) return { ok: false, issues }
    b.status = 'semakan'
    b.submittedAt = this.now()
    b.updatedAt = b.submittedAt
    // The questions enter the review queue: one unit per question, one per stimulus group.
    this.ops.enqueueSeeds(batchToSeeds(b))
    this.persist()
    return { ok: true, batch: jsonClone(b) }
  }

  /* ------------------------------------------------- question bank admin (v2-question-bank) */

  listReviewQueue(f?: QueueFilter) {
    return this.ops.listReviewQueue(f)
  }
  getReviewItem(key: string) {
    return this.ops.getReviewItem(key)
  }
  reviewDecision(key: string, d: { action: DecisionAction; reason?: string; by?: string }) {
    return this.ops.reviewDecision(key, d)
  }
  resubmit(key: string) {
    return this.ops.resubmit(key)
  }
  reviseQuestion(qid: string, stem: string, note: string) {
    return this.ops.reviseQuestion(qid, stem, note)
  }
  /** Full edit of a Terbit question (options, key, parts, scheme, DSKP, stimulus text): version n+1. */
  reviseQuestionFull(
    qid: string,
    edited: IntakeQuestion,
    stimulus: IntakeStimulus | undefined,
    note: string,
  ) {
    return this.ops.reviseQuestionFull(qid, edited, stimulus, note)
  }
  getBankEditable(qid: string) {
    return this.ops.getEditable(qid)
  }
  listBank(f?: BankFilter) {
    return this.ops.listBank(f)
  }
  bankStats() {
    return this.ops.bankStats()
  }
  getBankDetail(qid: string) {
    return this.ops.getBankDetail(qid)
  }
  listBlueprints() {
    return this.ops.listBlueprints()
  }
  listAdminPapers() {
    return this.ops.listAdminPapers()
  }
  getPaperEditor(id: string) {
    return this.ops.getPaperEditor(id)
  }
  createPaper(input: { subject: SubjectCode; kertas: 1 | 2; title?: string }) {
    return this.ops.createPaper(input)
  }
  savePaper(id: string, patch: PaperPatch) {
    return this.ops.savePaper(id, patch)
  }
  publishPaper(id: string) {
    return this.ops.publishPaper(id)
  }
  unpublishPaper(id: string) {
    return this.ops.unpublishPaper(id)
  }
  previewQuestions(ids: string[]) {
    return this.ops.previewQuestions(ids)
  }
  deletePaper(id: string) {
    return this.ops.deletePaper(id)
  }

  /* Simulasi Kuiz (R1-B16): see kuiz-mock.ts. */
  startKuiz(input: BijakKuizStartRequest) {
    return this.kuiz.start(input)
  }
  checkKuiz(sessionId: string, input: BijakKuizCheckRequest) {
    return this.kuiz.check(sessionId, input)
  }
  finishKuiz(sessionId: string) {
    return this.kuiz.finish(sessionId)
  }
  getKuizPaperPage(paperId: string, page: number) {
    return this.kuiz.paperPage(paperId, page)
  }
  checkKuizPaper(paperId: string, input: BijakKuizCheckRequest) {
    return this.kuiz.checkPaper(paperId, input)
  }

  /** Test helper: the saved answers of an attempt, as the server holds them. */
  debugSaved(attemptId: string): Record<string, StoredAnswer> {
    return this.state.attempts[attemptId]?.answers ?? {}
  }
}
