/**
 * Question bank admin operations of the mock Bijak SPM server (v2-question-bank): review queue,
 * bank browser and paper builder. `BijakServer` delegates to `AdminOps`; the state slice lives in
 * the same persisted document, so a paper published here shows up in the student hub.
 *
 * Published seed questions are copied into the shared in-memory `BANK` (idempotent) so the student
 * attempt code needs no change; the review records decide what is Terbit.
 */
import { BANK, BLUEPRINTS, PAPERS, SUBJECTS, subjectName } from '../data/registry'
import { REVIEW_SEEDS } from '../data/review-seed'
import { checkPaper, type PaperCheck } from '../domain/paper-builder'
import type {
  AdminPaper,
  AdminPaperSummary,
  BankDetail,
  BankFilter,
  BankRow,
  BankStats,
  BlueprintView,
  BuilderGroup,
  BuilderQuestion,
  DecisionAction,
  DecisionResult,
  HistoryEntry,
  PaperEditorData,
  PaperPatch,
  PublishPaperResult,
  QueueFilter,
  QueueItem,
  QuestionKind,
  QuestionStatus,
  ReviewDetail,
  ReviewQuestion,
  ReviewRec,
  ReviewSeed,
  SchemeLine,
} from '../domain/admin-types'
import { leavesOf } from '../domain/paper-model'
import type {
  Blueprint,
  PaperDef,
  QuestionDef,
  SchemeDef,
  StimulusDef,
  SubjectCode,
} from '../domain/types'

const DAY = 86_400_000
export const ADMIN_NAME = 'Admin Pusat'

/** The part of the persisted state the admin side owns. */
export interface AdminSlice {
  review?: Record<string, ReviewRec>
  adminPapers?: Record<string, AdminPaper>
  paperSeq?: number
}

export interface AdminHost {
  slice(): AdminSlice
  now(): number
  persist(): void
  tick(): Promise<void>
  error(code: 'not_found' | 'bad_request', message: string): Error
}

/* ------------------------------------------------------------------------------ seed lookup */

const SEED_BY_KEY = new Map<string, ReviewSeed>(REVIEW_SEEDS.map((s) => [s.key, s]))
const SEED_OF_Q = new Map<string, ReviewSeed>()
const SEED_Q = new Map<string, QuestionDef>()
const SEED_SCHEMES = new Map<string, SchemeDef>()
for (const s of REVIEW_SEEDS) {
  for (const q of s.questions) {
    SEED_OF_Q.set(q.id, s)
    SEED_Q.set(q.id, q)
  }
  for (const [id, sc] of Object.entries(s.schemes)) SEED_SCHEMES.set(id, sc)
}

const getQ = (id: string): QuestionDef | undefined => BANK.questions.get(id) ?? SEED_Q.get(id)
const getScheme = (id: string): SchemeDef | undefined =>
  BANK.schemes.get(id) ?? SEED_SCHEMES.get(id)
const getGroup = (gid: string) => BANK.groups.get(gid) ?? SEED_BY_KEY.get(gid)?.group?.def
const getStimulus = (gid: string): StimulusDef | undefined => {
  const g = BANK.groups.get(gid)
  if (g) return BANK.stimuli.get(g.stimulusId)
  return SEED_BY_KEY.get(gid)?.group?.stimulus
}
const membersOf = (gid: string): string[] => getGroup(gid)?.questionIds ?? []
const groupOf = (qid: string): string | undefined => getQ(qid)?.groupId

function hydrate(seed: ReviewSeed): void {
  for (const q of seed.questions) if (!BANK.questions.has(q.id)) BANK.questions.set(q.id, q)
  for (const [id, sc] of Object.entries(seed.schemes))
    if (!BANK.schemes.has(id)) BANK.schemes.set(id, sc)
  if (seed.group) {
    BANK.stimuli.set(seed.group.stimulus.id, seed.group.stimulus)
    BANK.groups.set(seed.group.def.id, seed.group.def)
  }
}

function setLiveStem(qid: string, stem: string): void {
  const q = BANK.questions.get(qid)
  if (q) BANK.questions.set(qid, { ...q, stem })
}

/** Seeds the admin slice on first load and re-applies published content to the shared bank. */
export function seedAdminSlice(slice: AdminSlice, now: number): void {
  slice.review ??= {}
  for (const seed of REVIEW_SEEDS) {
    for (const q of seed.questions) {
      if (slice.review[q.id]) continue
      const at = now - seed.ageDays * DAY
      slice.review[q.id] = {
        status: seed.status,
        version: 1,
        submittedAt: at,
        history: [
          {
            at,
            by: seed.uploader,
            version: 1,
            action: 'Dihantar untuk semakan',
            note: seed.source,
          },
          ...(seed.status === 'terbit'
            ? [{ at: at + DAY / 2, by: ADMIN_NAME, version: 1, action: 'Diterbitkan' }]
            : []),
        ],
      }
    }
  }
  for (const seed of REVIEW_SEEDS) {
    if (seed.questions.every((q) => slice.review![q.id]?.status === 'terbit')) hydrate(seed)
  }
  for (const [qid, rec] of Object.entries(slice.review))
    if (rec.liveStem) setLiveStem(qid, rec.liveStem)

  slice.paperSeq ??= 1
  if (!slice.adminPapers) {
    const bp = BLUEPRINTS.find((b) => b.subject === 'MAT' && b.kertas === 2)!
    const paper = newPaper('kp-seed-1', bp, now)
    paper.title = 'Percubaan SPM Matematik Kertas 2 Set B (draf)'
    paper.sections[0]!.questionIds = ['mat2-algebra-v1', 'mat2-diskaun-v2']
    paper.sections[1]!.questionIds = ['mat2-garis-v2']
    paper.sections[2]!.questionIds = ['mat2-statistik-v2', 'mat2-kuadratik-v2']
    slice.adminPapers = { [paper.id]: paper }
  }
}

/* ------------------------------------------------------------------------------- helpers */

function kindOf(q: QuestionDef): QuestionKind {
  if (q.mcq) return 'objektif'
  const rubric = leavesOf(q.parts ?? []).some((l) => getScheme(l.id)?.kind === 'rubric')
  return rubric ? 'esei' : 'berstruktur'
}

function marksOf(q: QuestionDef): number {
  if (q.mcq) return getScheme(q.id)?.marks ?? 1
  return leavesOf(q.parts ?? []).reduce((n, l) => n + l.marks, 0)
}

function kertasOf(qid: string): number {
  const seed = SEED_OF_Q.get(qid)
  if (seed) return seed.kertas
  const pool = BANK.pool.find((p) => p.questionId === qid)?.pool
  const m = pool ? /^[A-Z]+(\d)-/.exec(pool) : null
  if (m) return Number(m[1])
  return PAPERS.find((p) => p.sections.some((s) => s.questionIds.includes(qid)))?.kertas ?? 2
}

function previewOf(q: QuestionDef, stem = q.stem): string {
  const p = q.parts?.[0]
  return p && !p.children?.length ? `${stem} ${p.label} ${p.prompt}` : stem
}

/** Plain-text form of a stem with `$latex$` spans (for card titles and search). */
export function plainMath(text: string): string {
  return text
    .replace(/\frac{([^}]*)}{([^}]*)}/g, '$1/$2')
    .replace(/\times/g, '×')
    .replace(/\cos|\sin|\angle/g, (m) => m.slice(1))
    .replace(/\text{([^}]*)}/g, '$1')
    .replace(/[$\{}]/g, '')
    .replace(/^(d)/g, '^$1')
}

const LETTERS = 'ABCDEFGH'

function describeScheme(sc: SchemeDef): SchemeLine[] {
  switch (sc.kind) {
    case 'option':
      return [{ text: sc.reason }]
    case 'accepted':
      return sc.values.map((v) => ({ text: `Diterima: ${v.v}${v.unit ? ` ${v.unit}` : ''}` }))
    case 'mapping':
      return Object.entries(sc.map).map(([k, v]) => ({ text: `${k} = ${v}` }))
    case 'rubric':
      return [
        ...sc.bands.map((b) => ({
          text: `${b.name} (${b.range[0]}-${b.range[1]}): ${b.descriptor}`,
        })),
        ...(sc.notes ?? []).map((n) => ({ text: n })),
      ]
    case 'points': {
      const count = new Map<string, number>()
      const lines: SchemeLine[] = sc.points.map((p) => {
        const n = (count.get(p.code) ?? 0) + 1
        count.set(p.code, n)
        return { tag: `${p.code}${n}`, text: p.label, marks: p.marks }
      })
      if (sc.final) lines.push({ text: `Jawapan akhir: $${sc.final.display}$` })
      return lines
    }
  }
}

function reviewQuestion(q: QuestionDef, stem = q.stem): ReviewQuestion {
  const scheme: ReviewQuestion['scheme'] = {}
  let correct: string | undefined
  if (q.mcq) {
    const sc = getScheme(q.id)
    if (sc?.kind === 'option') {
      correct = sc.correct
      const letter = LETTERS[q.mcq.options.findIndex((o) => o.id === sc.correct)] ?? '?'
      scheme[q.id] = {
        marks: sc.marks,
        lines: [{ text: `Jawapan betul: ${letter}` }, ...describeScheme(sc)],
      }
    } else scheme[q.id] = null
  } else {
    for (const l of leavesOf(q.parts ?? [])) {
      const sc = getScheme(l.id)
      scheme[l.id] = sc ? { marks: sc.marks, lines: describeScheme(sc) } : null
    }
  }
  return {
    id: q.id,
    stem,
    marks: marksOf(q),
    curriculum: q.curriculum,
    ...(q.mcq ? { mcq: { options: q.mcq.options, ...(correct ? { correct } : {}) } } : {}),
    ...(q.parts ? { parts: q.parts } : {}),
    scheme,
  }
}

/** Publish gate (v2-question-bank 4.8): answer key present and consistent with the marks. */
export function gateErrors(qs: readonly QuestionDef[]): string[] {
  const out: string[] = []
  qs.forEach((q, i) => {
    const n = `Soalan ${i + 1}`
    if (q.mcq) {
      const sc = getScheme(q.id)
      if (!sc) out.push(`${n}: skema jawapan belum ada`)
      else if (sc.kind !== 'option' || !q.mcq.options.some((o) => o.id === sc.correct))
        out.push(`${n}: pilihan jawapan betul tidak sah`)
    } else {
      for (const l of leavesOf(q.parts ?? [])) {
        const sc = getScheme(l.id)
        if (!sc) out.push(`${n} ${l.label}: skema markah belum ada`)
        else if (sc.marks !== l.marks)
          out.push(`${n} ${l.label}: markah skema ${sc.marks} tidak sama dengan markah ${l.marks}`)
      }
    }
    if (!q.curriculum.unitLabel) out.push(`${n}: topik DSKP belum dipilih`)
  })
  return out
}

function newPaper(id: string, bp: Blueprint, now: number): AdminPaper {
  return {
    id,
    status: 'draf',
    title: `Percubaan SPM ${subjectName(bp.subject)} Kertas ${bp.kertas} (draf)`,
    subject: bp.subject,
    kertas: bp.kertas,
    year: new Date(now).getFullYear(),
    code: bp.code,
    durationMin: bp.durationMin,
    instructions: bp.instructions,
    ...(bp.reference ? { reference: bp.reference } : {}),
    createdAt: now,
    updatedAt: now,
    sections: bp.sections.map((s, i) => ({
      id: `${id}-s${i + 1}`,
      label: s.label,
      ...(s.instruction ? { instruction: s.instruction } : {}),
      ...(s.compulsory ? { compulsory: true } : {}),
      rule: s.rule,
      markBudget: s.markBudget ?? s.take,
      questionCount: s.take,
      questionIds: [],
    })),
  }
}

function blueprintView(bp: Blueprint): BlueprintView {
  const sections = bp.sections.map((s) => ({
    label: s.label,
    markBudget: s.markBudget ?? s.take,
    questionCount: s.take,
    compulsory: !!s.compulsory,
    instruction:
      s.instruction ??
      (s.rule.type === 'all'
        ? 'Jawab semua soalan.'
        : `Jawab ${s.rule.n} daripada ${s.take} soalan.`),
    rule: s.rule,
    pool: s.pool,
  }))
  return {
    subject: bp.subject,
    subjectName: subjectName(bp.subject),
    kertas: bp.kertas,
    source: bp.source,
    code: bp.code,
    durationMin: bp.durationMin,
    instructions: bp.instructions,
    totalMarks: sections.reduce((n, s) => n + s.markBudget, 0),
    sections,
  }
}

/* ---------------------------------------------------------------------------------- ops */

export class AdminOps {
  constructor(private readonly host: AdminHost) {}

  private get review(): Record<string, ReviewRec> {
    return this.host.slice().review!
  }
  private get papers(): Record<string, AdminPaper> {
    return this.host.slice().adminPapers!
  }

  statusOf(qid: string): QuestionStatus {
    const rec = this.review[qid]
    if (rec) return rec.status
    return BANK.questions.has(qid) ? 'terbit' : 'draf'
  }
  private versionOf(qid: string): number {
    return this.review[qid]?.version ?? 1
  }
  private ageDays(at: number): number {
    return Math.max(0, Math.floor((this.host.now() - at) / DAY))
  }

  /* ---------------------------------------------------------------- review queue */

  private unitItem(seed: ReviewSeed): QueueItem {
    const q0 = seed.questions[0]!
    const rec = this.review[q0.id]!
    return {
      key: seed.key,
      isRevision: false,
      questionIds: seed.questions.map((q) => q.id),
      ...(seed.group ? { groupId: seed.group.def.id } : {}),
      subject: seed.subject,
      subjectName: subjectName(seed.subject),
      kertas: seed.kertas,
      kind: kindOf(q0),
      topic: q0.curriculum.unitLabel,
      preview: previewOf(q0),
      previewPlain: plainMath(previewOf(q0)),
      marks: seed.questions.reduce((n, q) => n + marksOf(q), 0),
      version: rec.version,
      source: seed.source,
      uploader: seed.uploader,
      ageDays: this.ageDays(rec.submittedAt),
      confidence: seed.confidence,
      status: rec.status,
    }
  }

  private revisionItem(qid: string): QueueItem {
    const q = getQ(qid)!
    const rec = this.review[qid]!
    const rev = rec.revision!
    return {
      key: `v:${qid}`,
      isRevision: true,
      questionIds: [qid],
      ...(q.groupId ? { groupId: q.groupId } : {}),
      subject: q.curriculum.subject,
      subjectName: subjectName(q.curriculum.subject),
      kertas: kertasOf(qid),
      kind: kindOf(q),
      topic: q.curriculum.unitLabel,
      preview: previewOf(q, rev.stem),
      previewPlain: plainMath(previewOf(q, rev.stem)),
      marks: marksOf(q),
      version: rev.version,
      source: `Sunting versi ${rec.version}`,
      uploader: ADMIN_NAME,
      ageDays: this.ageDays(rev.at),
      confidence: 'tinggi',
      status: 'semakan',
    }
  }

  private allItems(): QueueItem[] {
    const items: QueueItem[] = []
    for (const seed of REVIEW_SEEDS) {
      if (seed.questions.some((q) => this.review[q.id]?.status !== 'terbit' || !this.review[q.id]))
        items.push(this.unitItem(seed))
    }
    for (const [qid, rec] of Object.entries(this.review))
      if (rec.revision) items.push(this.revisionItem(qid))
    return items
  }

  async listReviewQueue(f: QueueFilter = {}): Promise<{
    items: QueueItem[]
    counts: Record<QuestionStatus, number>
  }> {
    await this.host.tick()
    const all = this.allItems()
    const counts: Record<QuestionStatus, number> = { semakan: 0, terbit: 0, draf: 0, ditolak: 0 }
    for (const i of all) counts[i.status] += 1
    const status = f.status ?? 'semakan'
    const items = all
      .filter(
        (i) =>
          (status === 'semua' || i.status === status) &&
          (!f.subject || i.subject === f.subject) &&
          (!f.kertas || i.kertas === f.kertas) &&
          (!f.kind || i.kind === f.kind),
      )
      .sort((a, b) => b.ageDays - a.ageDays || a.key.localeCompare(b.key))
    return { items, counts }
  }

  async getReviewItem(key: string): Promise<ReviewDetail> {
    await this.host.tick()
    if (key.startsWith('v:')) {
      const qid = key.slice(2)
      const rec = this.review[qid]
      if (!rec?.revision || !getQ(qid))
        throw this.host.error('not_found', 'Item semakan tidak ditemui')
      const q = getQ(qid)!
      const item = this.revisionItem(qid)
      return {
        item,
        questions: [reviewQuestion(q, rec.revision.stem)],
        ...(q.groupId ? this.groupParts(q.groupId) : {}),
        history: rec.history,
        gate: rec.revision.stem.trim() ? [] : ['Teks soalan tidak boleh kosong'],
        liveStem: q.stem,
        revisionNote: rec.revision.note,
      }
    }
    const seed = SEED_BY_KEY.get(key)
    if (!seed) throw this.host.error('not_found', 'Item semakan tidak ditemui')
    const rec = this.review[seed.questions[0]!.id]!
    return {
      item: this.unitItem(seed),
      questions: seed.questions.map((q) => reviewQuestion(q)),
      ...(seed.group ? this.groupParts(seed.group.def.id) : {}),
      history: rec.history,
      ...(rec.reason ? { reason: rec.reason } : {}),
      gate: rec.status === 'terbit' ? [] : gateErrors(seed.questions),
    }
  }

  private groupParts(gid: string): {
    stimulus?: StimulusDef
    optionBank?: ReviewDetail['optionBank']
  } {
    const st = getStimulus(gid)
    const ob = getGroup(gid)?.optionBank
    return { ...(st ? { stimulus: st } : {}), ...(ob ? { optionBank: ob } : {}) }
  }

  async reviewDecision(
    key: string,
    d: { action: DecisionAction; reason?: string; by?: string },
  ): Promise<DecisionResult> {
    await this.host.tick()
    const by = d.by ?? ADMIN_NAME
    const reason = d.reason?.trim() ?? ''
    if (d.action !== 'terbit' && !reason)
      return { ok: false, errors: ['Sebab diperlukan untuk Tolak atau Minta Pembetulan'] }
    const at = this.host.now()
    const entry = (version: number, action: string, note?: string): HistoryEntry => ({
      at,
      by,
      version,
      action,
      ...(note ? { note } : {}),
    })

    if (key.startsWith('v:')) {
      const qid = key.slice(2)
      const rec = this.review[qid]
      if (!rec?.revision) return { ok: false, errors: ['Item tiada dalam baris gilir'] }
      const rev = rec.revision
      if (d.action === 'terbit') {
        if (!rev.stem.trim()) return { ok: false, errors: ['Teks soalan tidak boleh kosong'] }
        rec.history.push(
          entry(rev.version, 'Diterbitkan', rev.note),
          entry(rec.version, 'Diarkibkan (digantikan)'),
        )
        rec.version = rev.version
        rec.liveStem = rev.stem
        setLiveStem(qid, rev.stem)
      } else {
        rec.history.push(
          entry(rev.version, d.action === 'tolak' ? 'Ditolak' : 'Pembetulan diminta', reason),
        )
      }
      delete rec.revision
      this.host.persist()
      return { ok: true, errors: [] }
    }

    const seed = SEED_BY_KEY.get(key)
    if (!seed) return { ok: false, errors: ['Item tiada dalam baris gilir'] }
    const recs = seed.questions.map((q) => this.review[q.id]!)
    if (recs.some((r) => r.status !== 'semakan'))
      return { ok: false, errors: ['Item ini tidak lagi menunggu semakan'] }
    if (d.action === 'terbit') {
      const errors = gateErrors(seed.questions)
      if (errors.length) return { ok: false, errors }
      for (const r of recs) {
        r.status = 'terbit'
        delete r.reason
        r.history.push(entry(r.version, 'Diluluskan'), entry(r.version, 'Diterbitkan'))
      }
      hydrate(seed)
    } else {
      for (const r of recs) {
        r.status = d.action === 'tolak' ? 'ditolak' : 'draf'
        r.reason = reason
        r.history.push(
          entry(r.version, d.action === 'tolak' ? 'Ditolak' : 'Pembetulan diminta', reason),
        )
      }
    }
    this.host.persist()
    return { ok: true, errors: [] }
  }

  /** The uploader fixed a returned or rejected item: it re-enters the queue. */
  async resubmit(key: string): Promise<DecisionResult> {
    await this.host.tick()
    const seed = SEED_BY_KEY.get(key)
    if (!seed) return { ok: false, errors: ['Item tidak ditemui'] }
    const at = this.host.now()
    for (const q of seed.questions) {
      const r = this.review[q.id]!
      if (r.status === 'draf' || r.status === 'ditolak') {
        r.status = 'semakan'
        r.submittedAt = at
        r.history.push({
          at,
          by: seed.uploader,
          version: r.version,
          action: 'Dihantar semula untuk semakan',
        })
      }
    }
    this.host.persist()
    return { ok: true, errors: [] }
  }

  /** "Sunting" on a Terbit question: version n+1 waits in the queue, the live version keeps serving. */
  async reviseQuestion(qid: string, stem: string, note: string): Promise<DecisionResult> {
    await this.host.tick()
    const q = getQ(qid)
    if (!q || this.statusOf(qid) !== 'terbit')
      return { ok: false, errors: ['Hanya soalan Terbit boleh disunting'] }
    if (!stem.trim()) return { ok: false, errors: ['Teks soalan tidak boleh kosong'] }
    const at = this.host.now()
    const rec = (this.review[qid] ??= {
      status: 'terbit',
      version: 1,
      submittedAt: at,
      history: [{ at, by: ADMIN_NAME, version: 1, action: 'Diterbitkan (asal)' }],
    })
    if (rec.revision) return { ok: false, errors: ['Sudah ada versi baharu menunggu semakan'] }
    rec.revision = { version: rec.version + 1, stem: stem.trim(), note: note.trim(), at }
    rec.history.push({
      at,
      by: ADMIN_NAME,
      version: rec.revision.version,
      action: `Versi ${rec.revision.version} dicipta (Draf, dihantar untuk semakan)`,
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    this.host.persist()
    return { ok: true, errors: [] }
  }

  /* ---------------------------------------------------------------------- bank */

  private usedIn(qid: string): { id: string; title: string }[] {
    const hit = (p: Pick<PaperDef, 'sections'>) =>
      p.sections.some((s) => s.questionIds.includes(qid))
    return [...PAPERS.filter(hit), ...Object.values(this.papers).filter(hit)].map((p) => ({
      id: p.id,
      title: p.title,
    }))
  }

  private bankRow(qid: string): BankRow {
    const q = getQ(qid)!
    return {
      id: qid,
      ...(q.groupId ? { groupId: q.groupId } : {}),
      subject: q.curriculum.subject,
      subjectName: subjectName(q.curriculum.subject),
      kertas: kertasOf(qid),
      kind: kindOf(q),
      topic: q.curriculum.unitLabel,
      marks: marksOf(q),
      preview: previewOf(q),
      previewPlain: plainMath(previewOf(q)),
      version: this.versionOf(qid),
      status: this.statusOf(qid),
      usedIn: this.usedIn(qid).length,
    }
  }

  private allQuestionIds(): string[] {
    return [...new Set([...BANK.questions.keys(), ...SEED_Q.keys()])]
  }

  async listBank(f: BankFilter = {}): Promise<BankRow[]> {
    await this.host.tick()
    const status = f.status ?? 'terbit'
    const term = f.q?.trim().toLowerCase()
    return this.allQuestionIds()
      .map((id) => this.bankRow(id))
      .filter(
        (r) =>
          (status === 'semua' || r.status === status) &&
          (!f.subject || r.subject === f.subject) &&
          (!f.kertas || r.kertas === f.kertas) &&
          (!f.kind || r.kind === f.kind) &&
          (!term ||
            r.preview.toLowerCase().includes(term) ||
            r.id.toLowerCase().includes(term) ||
            r.topic.toLowerCase().includes(term)),
      )
      .sort(
        (a, b) =>
          a.subject.localeCompare(b.subject) || a.kertas - b.kertas || a.id.localeCompare(b.id),
      )
  }

  async bankStats(): Promise<BankStats> {
    await this.host.tick()
    const rows = this.allQuestionIds().map((id) => this.bankRow(id))
    return {
      total: rows.length,
      bySubject: SUBJECTS.map((s) => {
        const mine = rows.filter((r) => r.subject === s.code)
        const n = (st: QuestionStatus) => mine.filter((r) => r.status === st).length
        return {
          code: s.code,
          name: s.name,
          terbit: n('terbit'),
          semakan: n('semakan'),
          draf: n('draf'),
          ditolak: n('ditolak'),
        }
      }),
    }
  }

  async getBankDetail(qid: string): Promise<BankDetail> {
    await this.host.tick()
    const q = getQ(qid)
    if (!q) throw this.host.error('not_found', 'Soalan tidak ditemui')
    const rec = this.review[qid]
    return {
      row: this.bankRow(qid),
      question: reviewQuestion(q),
      ...(q.groupId ? this.groupParts(q.groupId) : {}),
      history: rec?.history ?? [
        { at: 0, by: 'Pangkalan sedia ada', version: 1, action: 'Diterbitkan' },
      ],
      usedInPapers: this.usedIn(qid),
      pendingRevision: !!rec?.revision,
    }
  }

  /* -------------------------------------------------------------------- papers */

  async listBlueprints(): Promise<BlueprintView[]> {
    await this.host.tick()
    return BLUEPRINTS.filter((b) => b.source !== 'Draf').map(blueprintView)
  }

  private checkOf(p: AdminPaper): PaperCheck {
    return checkPaper({
      specs: p.sections.map((s) => ({
        label: s.label,
        markBudget: s.markBudget,
        questionCount: s.questionCount,
        rule: s.rule,
      })),
      sections: p.sections,
      marksOf: (id) => marksOf(getQ(id)!),
      groupOf,
      membersOf,
      isLive: (id) => this.statusOf(id) === 'terbit',
    })
  }

  async listAdminPapers(): Promise<AdminPaperSummary[]> {
    await this.host.tick()
    return Object.values(this.papers)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => {
        const c = this.checkOf(p)
        return {
          id: p.id,
          title: p.title,
          subject: p.subject,
          subjectName: subjectName(p.subject),
          kertas: p.kertas,
          code: p.code,
          status: p.status,
          questionCount: p.sections.reduce((n, s) => n + s.questionIds.length, 0),
          marks: c.totalMarks,
          budget: c.totalBudget,
          ok: c.ok,
          updatedAt: p.updatedAt,
        }
      })
  }

  private builderQuestion(qid: string): BuilderQuestion {
    const q = getQ(qid)!
    const st = q.groupId ? getStimulus(q.groupId) : undefined
    return {
      id: qid,
      ...(q.groupId ? { groupId: q.groupId } : {}),
      ...(st ? { stimulusLabel: st.label } : {}),
      preview: previewOf(q),
      marks: marksOf(q),
      kind: kindOf(q),
      topic: q.curriculum.unitLabel,
      status: this.statusOf(qid),
      kertas: kertasOf(qid),
      subject: q.curriculum.subject,
    }
  }

  async getPaperEditor(id: string): Promise<PaperEditorData> {
    await this.host.tick()
    const paper = this.papers[id]
    if (!paper) throw this.host.error('not_found', 'Kertas tidak ditemui')
    const used = paper.sections.flatMap((s) => s.questionIds)
    const candidates = this.allQuestionIds().filter(
      (qid) =>
        this.statusOf(qid) === 'terbit' &&
        getQ(qid)!.curriculum.subject === paper.subject &&
        kertasOf(qid) === paper.kertas,
    )
    const ids = [...new Set([...used, ...candidates])]
    const groupIds = [...new Set(ids.map(groupOf).filter((g): g is string => !!g))]
    const groups: BuilderGroup[] = groupIds.map((gid) => ({
      id: gid,
      stimulus: getStimulus(gid)!,
      questionIds: membersOf(gid),
    }))
    const bp = BLUEPRINTS.find((b) => b.subject === paper.subject && b.kertas === paper.kertas)
    return {
      paper,
      blueprint: bp ? blueprintView(bp) : null,
      questions: ids.map((qid) => this.builderQuestion(qid)),
      groups,
    }
  }

  async createPaper(input: {
    subject: SubjectCode
    kertas: 1 | 2
    title?: string
  }): Promise<string> {
    await this.host.tick()
    const bp = BLUEPRINTS.find(
      (b) => b.subject === input.subject && b.kertas === input.kertas && b.source !== 'Draf',
    )
    if (!bp) throw this.host.error('bad_request', 'Tiada blueprint untuk subjek dan kertas ini')
    const slice = this.host.slice()
    slice.paperSeq = (slice.paperSeq ?? 1) + 1
    const paper = newPaper(`kp-${slice.paperSeq}`, bp, this.host.now())
    if (input.title?.trim()) paper.title = input.title.trim()
    this.papers[paper.id] = paper
    this.host.persist()
    return paper.id
  }

  async savePaper(id: string, patch: PaperPatch): Promise<PaperEditorData> {
    await this.host.tick()
    const paper = this.papers[id]
    if (!paper) throw this.host.error('not_found', 'Kertas tidak ditemui')
    if (paper.status === 'terbit')
      throw this.host.error(
        'bad_request',
        'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.',
      )
    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw this.host.error('bad_request', 'Tajuk kertas diperlukan')
      paper.title = patch.title.trim()
    }
    if (patch.year !== undefined) paper.year = patch.year
    if (patch.durationMin !== undefined) paper.durationMin = patch.durationMin
    for (const ps of patch.sections ?? []) {
      const sec = paper.sections.find((s) => s.id === ps.id)
      if (!sec) throw this.host.error('bad_request', 'Bahagian tidak sah')
      for (const qid of ps.questionIds) {
        const q = getQ(qid)
        if (!q || q.curriculum.subject !== paper.subject)
          throw this.host.error('bad_request', 'Soalan tidak sah untuk kertas ini')
      }
      sec.questionIds = [...ps.questionIds]
    }
    paper.updatedAt = this.host.now()
    this.host.persist()
    return this.getPaperEditor(id)
  }

  async publishPaper(id: string): Promise<PublishPaperResult> {
    await this.host.tick()
    const paper = this.papers[id]
    if (!paper) throw this.host.error('not_found', 'Kertas tidak ditemui')
    const c = this.checkOf(paper)
    const errors = [
      ...c.errors,
      ...c.sections.flatMap((s) => s.errors.map((e) => `${s.label}: ${e}`)),
    ]
    if (errors.length) return { ok: false, errors }
    paper.status = 'terbit'
    paper.publishedAt = this.host.now()
    paper.updatedAt = paper.publishedAt
    this.host.persist()
    return { ok: true, errors: [] }
  }

  async unpublishPaper(id: string): Promise<void> {
    await this.host.tick()
    const paper = this.papers[id]
    if (!paper) throw this.host.error('not_found', 'Kertas tidak ditemui')
    paper.status = 'draf'
    delete paper.publishedAt
    paper.updatedAt = this.host.now()
    this.host.persist()
  }

  async deletePaper(id: string): Promise<void> {
    await this.host.tick()
    const paper = this.papers[id]
    if (!paper) return
    if (paper.status === 'terbit')
      throw this.host.error('bad_request', 'Tarik balik kertas Terbit sebelum memadam')
    delete this.papers[id]
    this.host.persist()
  }

  /** Student-view preview of questions (builder): content only, grouped stimuli resolved. */
  async previewQuestions(ids: string[]): Promise<{
    questions: ReviewQuestion[]
    stimuli: Record<string, StimulusDef>
    optionBanks: Record<string, NonNullable<ReviewDetail['optionBank']>>
  }> {
    await this.host.tick()
    const questions: ReviewQuestion[] = []
    const stimuli: Record<string, StimulusDef> = {}
    const optionBanks: Record<string, NonNullable<ReviewDetail['optionBank']>> = {}
    for (const id of ids) {
      const q = getQ(id)
      if (!q) continue
      questions.push(reviewQuestion(q))
      if (q.groupId) {
        const st = getStimulus(q.groupId)
        if (st) stimuli[q.groupId] = st
        const ob = getGroup(q.groupId)?.optionBank
        if (ob) optionBanks[q.groupId] = ob
      }
    }
    return { questions, stimuli, optionBanks }
  }

  /** Student side: papers published by the admin, as curated papers. */
  publishedPapers(): AdminPaper[] {
    return Object.values(this.papers).filter((p) => p.status === 'terbit')
  }

  publishedPaper(id: string): AdminPaper | undefined {
    const p = this.papers[id]
    return p?.status === 'terbit' ? p : undefined
  }
}
