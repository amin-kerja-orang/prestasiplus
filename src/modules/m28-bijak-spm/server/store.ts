/**
 * Mock Bijak SPM server (a NEW store; M04 / M05 / M06 are untouched). All grading, scheme
 * reveal rules, the timer deadline and blueprint generation live here, never in the pages.
 * State is persisted as one JSON document so attempts survive a refresh.
 *
 * Reveal rules (US-15): an answer key or mark scheme leaves this class only inside a graded
 * result, i.e. after submit (exam) or after "Semak" on that one question (latihan).
 */
import { composeFromBlueprint, poolUnits, type PoolUnit } from '../domain/blueprint'
import { BANK, BLUEPRINTS, PAPERS, SUBJECTS, subjectName } from '../data/registry'
import { gradePart, isBlank } from '../domain/grading'
import { numericValue } from '../domain/math-expr'
import { effectiveMarks, leavesOf, type Leaf } from '../domain/paper-model'
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

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class MemoryStorage implements KeyValueStore {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

export const SERVER_STORAGE_KEY = 'pp.bijak.server.v1'
/** After the deadline the server closes an unattended exam attempt itself (AC-05.4). */
export const GRACE_SECONDS = 300
/** Late sync window after the deadline (AC-05.4). */
export const LATE_SYNC_WINDOW_MS = 24 * 60 * 60 * 1000
/** Latihan: at most this many "Semak" per question per attempt (NFR-05). */
export const MAX_CHECKS_PER_QUESTION = 3

export interface SaveResult {
  savedAt: number
  /** The attempt is already closed; the device keeps its local copy. */
  closed?: boolean
  /** Late-synced changes that were accepted and re-graded (AC-05.4). */
  regraded?: boolean
}
export interface SubmitResult {
  attemptId: string
  late: number
  closed?: boolean
  regraded?: boolean
}
/** A sitting younger than this resumes silently (AC-12.5). */
export const FRESH_SECONDS = 60

interface GeneratedPaper extends PaperDef {
  userId: number
  createdAt: number
}

interface State {
  seq: number
  attempts: Record<string, Attempt>
  generated: Record<string, GeneratedPaper>
}

export class BijakError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'not_submitted' | 'offline' | 'bad_request',
    message: string,
  ) {
    super(message)
  }
}

export interface ServerOptions {
  storage?: KeyValueStore
  now?: () => number
  latencyMs?: number
  storageKey?: string
}

export class BijakServer {
  private readonly storage: KeyValueStore
  private readonly now: () => number
  private readonly latencyMs: number
  private readonly key: string
  private state: State
  private offline = false

  constructor(opts: ServerOptions = {}) {
    this.storage = opts.storage ?? new MemoryStorage()
    this.now = opts.now ?? (() => Date.now())
    this.latencyMs = opts.latencyMs ?? 0
    this.key = opts.storageKey ?? SERVER_STORAGE_KEY
    this.state = this.load()
  }

  /* ------------------------------------------------------------------------- plumbing */

  private load(): State {
    try {
      const raw = this.storage.getItem(this.key)
      if (raw) return JSON.parse(raw) as State
    } catch {
      /* start empty */
    }
    return { seq: 0, attempts: {}, generated: {} }
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
    return PAPERS.map((p) => this.summary({ ...p, kind: 'pilihan' }, userId))
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
    opts: { restart?: boolean } = {},
  ): Promise<{ attemptId: string }> {
    await this.tick()
    const def = this.resolvePaper(paperId, userId)
    const open = Object.values(this.state.attempts).filter(
      (a) => a.userId === userId && a.paperId === paperId && a.status === 'in_progress',
    )
    if (open.length && !opts.restart) {
      const keep = open.sort((a, b) => b.startedAt - a.startedAt)[0]!
      return { attemptId: keep.id }
    }
    for (const a of open) a.status = 'abandoned'
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
      return res
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

  private gradeAttempt(a: Attempt): AttemptResult {
    let n = 0
    const questions: QuestionResult[] = []
    const sections: SectionResult[] = []
    for (const s of a.sections) {
      const qs = s.questionIds.map((qid) => this.gradeQuestion(a, qid, ++n, true))
      let counted = qs
      if (s.rule.type === 'choose') {
        // Best N attempted by marks (ties: the lower position). Ticks never change the score.
        const ranked = qs
          .map((q, pos) => ({ q, pos }))
          .filter((x) => x.q.attempted)
          .sort((x, y) => y.q.awarded - x.q.awarded || x.pos - y.pos)
          .slice(0, s.rule.n)
        const ids = new Set(ranked.map((x) => x.q.questionId))
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

  /** Test helper: the saved answers of an attempt, as the server holds them. */
  debugSaved(attemptId: string): Record<string, StoredAnswer> {
    return this.state.attempts[attemptId]?.answers ?? {}
  }
}
