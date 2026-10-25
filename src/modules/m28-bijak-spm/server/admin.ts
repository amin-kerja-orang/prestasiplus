/**
 * Question bank admin operations of the mock Bijak SPM server (v2-question-bank): review queue,
 * bank browser and paper builder. `BijakServer` delegates to `AdminOps`; the state slice lives in
 * the same persisted document, so a paper published here shows up in the student hub.
 *
 * Published seed questions are copied into the shared in-memory `BANK` (idempotent) so the student
 * attempt code needs no change; the review records decide what is Terbit.
 */
import { defToIntake, intakeToDef } from '../admin/intake/domain/convert'
import { validateRevision } from '../admin/intake/domain/validation'
import type { IntakeQuestion, IntakeStimulus } from '../admin/intake/types'
import { BANK, BLUEPRINTS, PAPERS, subjectName } from '../data/registry'
import { REVIEW_SEEDS } from '../data/review-seed'
import { checkPaper, type PaperCheck } from '../domain/paper-builder'
import type {
  AdminPaper,
  AdminPaperSummary,
  BankDetail,
  BankEditable,
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
  RevisionContent,
  SchemeLine,
  StimulusSharers,
  TagSuggestion,
} from '../domain/admin-types'
import { leavesOf } from '../domain/paper-model'
import { tagChanges } from '../domain/tag-audit'
import { tagMatchesFilter } from '../domain/tag-filter'
import { tagIssues } from '../domain/tag-rule'
import type { TagLookup } from '../domain/tag-rule'
import { topicOf } from '../domain/topic'
import { dskpCodeOf, dskpSubjects, tagLookupFor } from '../lib/dskp-source'
import type {
  Blueprint,
  CurriculumTag,
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
  /** Review units made from submitted intake batches (the seed units live in code). */
  dynSeeds?: Record<string, ReviewSeed>
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
/** Stimulus groups of review units, by group id (a unit's key is not always its group id). */
const SEED_GROUP = new Map<string, NonNullable<ReviewSeed['group']>>()
const SEED_SCHEMES = new Map<string, SchemeDef>()
for (const s of REVIEW_SEEDS) {
  if (s.group) SEED_GROUP.set(s.group.def.id, s.group)
  for (const q of s.questions) {
    SEED_OF_Q.set(q.id, s)
    SEED_Q.set(q.id, q)
  }
  for (const [id, sc] of Object.entries(s.schemes)) SEED_SCHEMES.set(id, sc)
}

/** Question id to the key of the dynamic unit that owns it (units of other server instances are ignored). */
const DYN_KEY_OF_Q = new Map<string, string>()

function registerSeed(s: ReviewSeed): void {
  SEED_BY_KEY.set(s.key, s)
  if (s.group) SEED_GROUP.set(s.group.def.id, s.group)
  for (const q of s.questions) {
    SEED_OF_Q.set(q.id, s)
    SEED_Q.set(q.id, q)
    if (s.batchId) DYN_KEY_OF_Q.set(q.id, s.key)
  }
  for (const [id, sc] of Object.entries(s.schemes)) SEED_SCHEMES.set(id, sc)
}

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const getQ = (id: string): QuestionDef | undefined => BANK.questions.get(id) ?? SEED_Q.get(id)
const getScheme = (id: string): SchemeDef | undefined =>
  BANK.schemes.get(id) ?? SEED_SCHEMES.get(id)
const getGroup = (gid: string) => BANK.groups.get(gid) ?? SEED_GROUP.get(gid)?.def
const getStimulus = (gid: string): StimulusDef | undefined => {
  const g = BANK.groups.get(gid)
  if (g) return BANK.stimuli.get(g.stimulusId)
  return SEED_GROUP.get(gid)?.stimulus
}
const membersOf = (gid: string): string[] => getGroup(gid)?.questionIds ?? []
const groupOf = (qid: string): string | undefined => getQ(qid)?.groupId

/** Questions of group `gid` that exist, in group order. */
const liveMembersOf = (gid: string): string[] => membersOf(gid).filter((id) => !!getQ(id))

/**
 * Every question that uses the stimulus of group `gid`, in group order. `position` is the 1-based
 * place in the group; `current` marks the question being viewed or edited.
 */
function sharersOf(gid: string, currentId?: string): StimulusSharers | undefined {
  const st = getStimulus(gid)
  if (!st) return undefined
  const ids = liveMembersOf(gid)
  return {
    stimulusLabel: st.label,
    count: ids.length,
    questions: ids.map((id, i) => ({ id, position: i + 1, ...(id === currentId ? { current: true } : {}) })),
  }
}

/** `{ sharers }` for a question in a group whose stimulus resolves, else nothing. */
function sharersProp(q: QuestionDef): { sharers?: StimulusSharers } {
  const s = q.groupId ? sharersOf(q.groupId, q.id) : undefined
  return s ? { sharers: s } : {}
}

/** Whether a revised stimulus differs from the live one in what the editor can change. */
function stimulusChanged(live: StimulusDef | undefined, next: StimulusDef | undefined): boolean {
  if (!live || !next) return false
  return (
    live.alt !== next.alt ||
    (live.caption ?? '') !== (next.caption ?? '') ||
    (live.text ?? '') !== (next.text ?? '')
  )
}

/** Size of a stimulus group, counted from the group's members (not from its stimulus). */
const groupSizeProp = (gid: string): { groupSize?: number } => {
  const n = liveMembersOf(gid).length
  return n > 0 ? { groupSize: n } : {}
}

function hydrate(seed: ReviewSeed): void {
  // Units made from an intake batch always win: their ids repeat across server instances.
  const force = !!seed.batchId
  for (const q of seed.questions) if (force || !BANK.questions.has(q.id)) BANK.questions.set(q.id, q)
  for (const [id, sc] of Object.entries(seed.schemes))
    if (force || !BANK.schemes.has(id)) BANK.schemes.set(id, sc)
  if (seed.group) {
    BANK.stimuli.set(seed.group.stimulus.id, seed.group.stimulus)
    BANK.groups.set(seed.group.def.id, seed.group.def)
  }
}

function setLiveStem(qid: string, stem: string): void {
  const q = BANK.questions.get(qid)
  if (q) BANK.questions.set(qid, { ...q, stem })
}

/** Puts a fully edited version on the shared bank: the old answer keys go, the new ones stay. */
function applyLive(qid: string, c: RevisionContent): void {
  const old = BANK.questions.get(qid) ?? SEED_Q.get(qid)
  if (old) {
    BANK.schemes.delete(qid)
    for (const l of leavesOf(old.parts ?? [])) BANK.schemes.delete(l.id)
  }
  BANK.questions.set(qid, plain(c.question))
  for (const [id, sc] of Object.entries(c.schemes)) BANK.schemes.set(id, plain(sc))
  if (c.stimulus) BANK.stimuli.set(c.stimulus.id, plain(c.stimulus))
}

const allSeeds = (slice: AdminSlice): ReviewSeed[] => [
  ...REVIEW_SEEDS,
  ...Object.values(slice.dynSeeds ?? {}),
]

/** Seeds the admin slice on first load and re-applies published content to the shared bank. */
export function seedAdminSlice(slice: AdminSlice, now: number): void {
  slice.review ??= {}
  for (const seed of Object.values(slice.dynSeeds ?? {})) registerSeed(seed)
  for (const seed of allSeeds(slice)) {
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
  for (const seed of allSeeds(slice)) {
    if (seed.questions.every((q) => slice.review![q.id]?.status === 'terbit')) hydrate(seed)
  }
  for (const [qid, rec] of Object.entries(slice.review)) {
    if (rec.liveStem) setLiveStem(qid, rec.liveStem)
    if (rec.live) applyLive(qid, rec.live)
  }

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

function kindOf(q: QuestionDef, schemeOf: SchemeLookup = getScheme): QuestionKind {
  if (q.mcq) return 'objektif'
  const rubric = leavesOf(q.parts ?? []).some((l) => schemeOf(l.id)?.kind === 'rubric')
  return rubric ? 'esei' : 'berstruktur'
}

function marksOf(q: QuestionDef, schemeOf: SchemeLookup = getScheme): number {
  if (q.mcq) return schemeOf(q.id)?.marks ?? 1
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

type SchemeLookup = (id: string) => SchemeDef | undefined

function reviewQuestion(
  q: QuestionDef,
  stem = q.stem,
  schemeOf: SchemeLookup = getScheme,
): ReviewQuestion {
  const scheme: ReviewQuestion['scheme'] = {}
  let correct: string | undefined
  if (q.mcq) {
    const sc = schemeOf(q.id)
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
      const sc = schemeOf(l.id)
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

/**
 * Publish gate (v2-question-bank 4.8): answer key present and consistent with the marks, and the
 * shared DSKP tag rule (`tagIssues`, the same one submit and revision run) on every question.
 * `lookup` must know the subjects of `qs` (load them first with `tagLookupFor`): a subject that is
 * not loaded makes its units look absent.
 */
export function gateErrors(
  qs: readonly QuestionDef[],
  schemeOf: SchemeLookup,
  lookup: TagLookup,
): string[] {
  const out: string[] = []
  qs.forEach((q, i) => {
    const n = `Soalan ${i + 1}`
    if (q.mcq) {
      const sc = schemeOf(q.id)
      if (!sc) out.push(`${n}: skema jawapan belum ada`)
      else if (sc.kind !== 'option' || !q.mcq.options.some((o) => o.id === sc.correct))
        out.push(`${n}: pilihan jawapan betul tidak sah`)
    } else {
      for (const l of leavesOf(q.parts ?? [])) {
        const sc = schemeOf(l.id)
        if (!sc) out.push(`${n} ${l.label}: skema markah belum ada`)
        else if (sc.marks !== l.marks)
          out.push(`${n} ${l.label}: markah skema ${sc.marks} tidak sama dengan markah ${l.marks}`)
      }
    }
    // One tag rule for submit, revision and publish; a flagged question (`review`) has no
    // tingkatan, unit or SP, so the rule refuses it until a person tags it (AC-07.5).
    for (const issue of tagIssues(q.curriculum, lookup)) out.push(`${n}: ${issue.message}`)
  })
  return out
}

/**
 * The tag rule for a revision that only changes the stem: the live tag must pass it, so a flagged
 * question cannot be revised or re-published unchanged (AC-07.5). Same messages as a full edit.
 */
export function liveTagErrors(q: QuestionDef, lookup: TagLookup): string[] {
  return tagIssues(q.curriculum, lookup).map((i) => `Soalan: ${i.message}`)
}

/** Subjects whose catalogue must be loaded to resolve the units of `qs` (a tag without a unit needs none). */
const tagSubjectsOf = (qs: Iterable<QuestionDef | undefined>): Set<string> => {
  const out = new Set<string>()
  for (const q of qs) if (q?.curriculum.unitId) out.add(q.curriculum.subject)
  return out
}

/** Loads (once per subject, M03 caches) what is needed to resolve the tags of `qs`. */
const lookupFor = (qs: Iterable<QuestionDef | undefined>): Promise<TagLookup> =>
  tagLookupFor(tagSubjectsOf(qs))

/**
 * The lookup for a read-only listing (bank, queue, detail, builder): a failed catalogue load must not
 * blank the page, so it is warned and the page is answered from what is already loaded (topics stay
 * empty). Gates and every path that mutates use `lookupFor` and fail closed.
 */
const lookupForView = (qs: Iterable<QuestionDef | undefined>): Promise<TagLookup> =>
  lookupFor(qs).catch((error: unknown) => {
    console.warn('[bijak] DSKP catalogue not loaded; topics are left empty', error)
    return tagLookupFor([])
  })

/** The tag fields a bank row and a queue item both carry (`lookup` must know the unit's subject). */
function tagFields(
  c: CurriculumTag,
  lookup: TagLookup,
): Pick<BankRow, 'formOrigin' | 'unitId' | 'unitTitle' | 'spCodes' | 'tp' | 'kbat' | 'tagReview'> {
  return {
    formOrigin: c.formOrigin,
    unitId: c.unitId,
    unitTitle: (c.unitId && lookup.unit(c.unitId)?.title) || null,
    spCodes: c.spIds.map(dskpCodeOf),
    tp: c.tp,
    kbat: c.kbat,
    tagReview: c.review === 'perlu-semakan',
  }
}

/** A tag that passed the rule is complete: the `perlu-semakan` marker is cleared (as `normaliseTag` does). */
function settled(q: QuestionDef): QuestionDef {
  if (!q.curriculum.review) return q
  const { review: _review, ...curriculum } = q.curriculum
  void _review
  return { ...q, curriculum }
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

  /** A review unit of this server: a seed unit, or one made from a batch submitted here. */
  private seed(key: string): ReviewSeed | undefined {
    const s = SEED_BY_KEY.get(key)
    if (!s) return undefined
    return s.batchId && !this.host.slice().dynSeeds?.[key] ? undefined : s
  }

  /**
   * Queues the units of a submitted intake batch for review (the gate already passed). The first
   * history entry of each question records its first tagging (AC-10.1); `suggestions` holds what the
   * AI said per bank question id, so the entry carries it beside the final value (AC-10.2 when none).
   */
  enqueueSeeds(
    seeds: ReviewSeed[],
    suggestions: ReadonlyMap<string, TagSuggestion | undefined> = new Map(),
  ): void {
    const slice = this.host.slice()
    slice.dynSeeds ??= {}
    const at = this.host.now()
    for (const seed of seeds) {
      // The gate passed, so the tag is complete: it no longer needs the `perlu-semakan` marker.
      const stored = plain({ ...seed, questions: seed.questions.map(settled) })
      slice.dynSeeds[seed.key] = stored
      registerSeed(stored)
      for (const q of stored.questions) {
        const tag = tagChanges(undefined, q.curriculum, suggestions.get(q.id))
        this.review[q.id] = {
          status: 'semakan',
          version: 1,
          submittedAt: at,
          history: [
            {
              at,
              by: seed.uploader,
              version: 1,
              action: 'Dihantar untuk semakan',
              note: seed.source,
              ...(tag.length ? { tag } : {}),
            },
          ],
        }
      }
    }
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

  private unitItem(seed: ReviewSeed, lookup: TagLookup): QueueItem {
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
      topic: topicOf(q0.curriculum, lookup),
      ...tagFields(q0.curriculum, lookup),
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

  private revisionItem(qid: string, tags: TagLookup): QueueItem {
    const q = getQ(qid)!
    const rec = this.review[qid]!
    const rev = rec.revision!
    // A full edit carries its own question and answer keys; a stem-only edit reuses the live ones.
    const nq = rev.content?.question ?? q
    const lookup: SchemeLookup = rev.content ? (id) => rev.content!.schemes[id] : getScheme
    return {
      key: `v:${qid}`,
      isRevision: true,
      questionIds: [qid],
      ...(q.groupId ? { groupId: q.groupId } : {}),
      subject: nq.curriculum.subject,
      subjectName: subjectName(nq.curriculum.subject),
      kertas: kertasOf(qid),
      kind: kindOf(nq, lookup),
      topic: topicOf(nq.curriculum, tags),
      ...tagFields(nq.curriculum, tags),
      preview: previewOf(nq, rev.stem),
      previewPlain: plainMath(previewOf(nq, rev.stem)),
      marks: marksOf(nq, lookup),
      version: rev.version,
      source: `Sunting versi ${rec.version}`,
      uploader: ADMIN_NAME,
      ageDays: this.ageDays(rev.at),
      confidence: 'tinggi',
      status: 'semakan',
    }
  }

  /** The questions whose tags the review queue formats (the seed units and the pending revisions). */
  private queueQuestions(): QuestionDef[] {
    const qs: QuestionDef[] = []
    for (const seed of allSeeds(this.host.slice())) qs.push(...seed.questions)
    for (const [qid, rec] of Object.entries(this.review)) {
      if (!rec.revision) continue
      const live = getQ(qid)
      if (live) qs.push(live)
      if (rec.revision.content) qs.push(rec.revision.content.question)
    }
    return qs
  }

  /** Each queue item with the tags of all its questions (a revision: the tag it would publish). */
  private allEntries(lookup: TagLookup): { item: QueueItem; tags: CurriculumTag[] }[] {
    const out: { item: QueueItem; tags: CurriculumTag[] }[] = []
    for (const seed of allSeeds(this.host.slice())) {
      if (seed.questions.some((q) => this.review[q.id]?.status !== 'terbit' || !this.review[q.id]))
        out.push({
          item: this.unitItem(seed, lookup),
          tags: seed.questions.map((q) => q.curriculum),
        })
    }
    for (const [qid, rec] of Object.entries(this.review)) {
      if (!rec.revision) continue
      const nq = rec.revision.content?.question ?? getQ(qid)!
      out.push({ item: this.revisionItem(qid, lookup), tags: [nq.curriculum] })
    }
    return out
  }

  async listReviewQueue(f: QueueFilter = {}): Promise<{
    items: QueueItem[]
    /** Queue items per status (a stimulus group is one item). */
    counts: Record<QuestionStatus, number>
    /**
     * Questions per status, as the bank counts them: a group of 2 is 2 questions, and a revision is a
     * new version of an already published question, so it adds no question.
     */
    questions: Record<QuestionStatus, number>
  }> {
    await this.host.tick()
    const entries = this.allEntries(await lookupForView(this.queueQuestions()))
    const all = entries.map((e) => e.item)
    const counts: Record<QuestionStatus, number> = { semakan: 0, terbit: 0, draf: 0, ditolak: 0 }
    const questions: Record<QuestionStatus, number> = { semakan: 0, terbit: 0, draf: 0, ditolak: 0 }
    for (const i of all) {
      counts[i.status] += 1
      if (!i.isRevision) questions[i.status] += i.questionIds.length
    }
    const status = f.status ?? 'semakan'
    // An item stays when any of its questions passes the tag filters.
    const items = entries
      .filter(
        ({ item: i, tags }) =>
          (status === 'semua' || i.status === status) &&
          (!f.subject || i.subject === f.subject) &&
          (!f.kertas || i.kertas === f.kertas) &&
          (!f.kind || i.kind === f.kind) &&
          tags.some((t) => tagMatchesFilter(t, f)),
      )
      .map((e) => e.item)
      .sort((a, b) => b.ageDays - a.ageDays || a.key.localeCompare(b.key))
    return { items, counts, questions }
  }

  async getReviewItem(key: string): Promise<ReviewDetail> {
    await this.host.tick()
    if (key.startsWith('v:')) {
      const qid = key.slice(2)
      const rec = this.review[qid]
      if (!rec?.revision || !getQ(qid))
        throw this.host.error('not_found', 'Item semakan tidak ditemui')
      const q = getQ(qid)!
      const rev = rec.revision
      const content = rev.content
      const lookup = await lookupFor([q, content?.question])
      const item = this.revisionItem(qid, lookup)
      return {
        item,
        questions: [
          content
            ? reviewQuestion(content.question, rev.stem, (id) => content.schemes[id])
            : reviewQuestion(q, rev.stem),
        ],
        ...(q.groupId ? this.groupParts(q.groupId) : {}),
        ...(content?.stimulus ? { stimulus: content.stimulus } : {}),
        ...(content ? { fullEdit: true } : {}),
        ...(q.groupId && stimulusChanged(getStimulus(q.groupId), content?.stimulus)
          ? sharersProp(q)
          : {}),
        history: rec.history,
        gate: [
          ...(rev.stem.trim() ? [] : ['Teks soalan tidak boleh kosong']),
          ...(content
            ? gateErrors([content.question], (id) => content.schemes[id], lookup)
            : liveTagErrors(q, lookup)),
        ],
        liveStem: q.stem,
        revisionNote: rec.revision.note,
      }
    }
    const seed = this.seed(key)
    if (!seed) throw this.host.error('not_found', 'Item semakan tidak ditemui')
    const rec = this.review[seed.questions[0]!.id]!
    const lookup = await lookupFor(seed.questions)
    return {
      item: this.unitItem(seed, lookup),
      questions: seed.questions.map((q) => reviewQuestion(q)),
      ...(seed.group ? this.groupParts(seed.group.def.id) : {}),
      history: rec.history,
      ...(rec.reason ? { reason: rec.reason } : {}),
      gate: rec.status === 'terbit' ? [] : gateErrors(seed.questions, getScheme, lookup),
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
      const queued = this.review[qid]?.revision
      if (!queued) return { ok: false, errors: ['Item tiada dalam baris gilir'] }
      // Load first; the status check, the gate and the change below run with no await in between,
      // so two decisions made at the same time cannot both succeed.
      const lookup =
        d.action === 'terbit' ? await lookupFor([getQ(qid), queued.content?.question]) : undefined
      const rec = this.review[qid]
      if (!rec?.revision || rec.revision !== queued)
        return { ok: false, errors: ['Item tiada dalam baris gilir'] }
      const rev = rec.revision
      if (d.action === 'terbit') {
        if (!rev.stem.trim()) return { ok: false, errors: ['Teks soalan tidak boleh kosong'] }
        // Publish gate: a full edit is checked as a whole; a stem-only edit keeps the live tag, which
        // must still pass the rule (a flagged question cannot be re-published unchanged, AC-07.5).
        const live = getQ(qid)
        if (!live) throw this.host.error('not_found', 'Soalan tidak ditemui')
        const errors = rev.content
          ? gateErrors([rev.content.question], (id) => rev.content!.schemes[id], lookup!)
          : liveTagErrors(live, lookup!)
        if (errors.length) return { ok: false, errors }
        rec.history.push(
          entry(rev.version, 'Diterbitkan', rev.note),
          entry(rec.version, 'Diarkibkan (digantikan)'),
        )
        rec.version = rev.version
        if (rev.content) {
          rec.live = plain(rev.content)
          delete rec.liveStem
          applyLive(qid, rev.content)
        } else if (rec.live) {
          // a stem-only edit on top of a fully edited live version: keep it in the live content
          rec.live.question.stem = rev.stem
          applyLive(qid, rec.live)
        } else {
          rec.liveStem = rev.stem
          setLiveStem(qid, rev.stem)
        }
      } else {
        rec.history.push(
          entry(rev.version, d.action === 'tolak' ? 'Ditolak' : 'Pembetulan diminta', reason),
        )
      }
      delete rec.revision
      this.host.persist()
      return { ok: true, errors: [] }
    }

    const seed = this.seed(key)
    if (!seed) return { ok: false, errors: ['Item tiada dalam baris gilir'] }
    // Load first; the status check, the gate and the change below run with no await in between.
    const lookup = d.action === 'terbit' ? await lookupFor(seed.questions) : undefined
    const recs = seed.questions.map((q) => this.review[q.id]!)
    if (recs.some((r) => r.status !== 'semakan'))
      return { ok: false, errors: ['Item ini tidak lagi menunggu semakan'] }
    if (d.action === 'terbit') {
      const errors = gateErrors(seed.questions, getScheme, lookup!)
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
    const seed = this.seed(key)
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
    // The live tag must pass the shared rule before a new version may be made (AC-07.5): a flagged
    // question is tagged in Sunting (full edit) first.
    const tagErrors = liveTagErrors(q, await lookupFor([q]))
    if (tagErrors.length) return { ok: false, errors: tagErrors }
    const at = this.host.now()
    const rec = (this.review[qid] ??= {
      status: 'terbit',
      version: 1,
      submittedAt: at,
      history: [{ at, by: ADMIN_NAME, version: 1, action: 'Diterbitkan (asal)' }],
    })
    if (rec.revision) return { ok: false, errors: ['Sudah ada versi baharu menunggu semakan'] }
    const next = Math.max(rec.version, rec.lastVersion ?? 0) + 1
    rec.lastVersion = next
    rec.revision = { version: next, stem: stem.trim(), note: note.trim(), at }
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

  /** The question opened in the full editor ("Sunting" in the bank). */
  async getEditable(qid: string): Promise<BankEditable> {
    await this.host.tick()
    const q = getQ(qid)
    if (!q) throw this.host.error('not_found', 'Soalan tidak ditemui')
    if (this.statusOf(qid) !== 'terbit')
      throw this.host.error('bad_request', 'Hanya soalan Terbit boleh disunting')
    const stimulus = q.groupId ? getStimulus(q.groupId) : undefined
    return {
      row: this.bankRow(qid, await lookupForView([q])),
      question: defToIntake(q, getScheme, '1', stimulus?.id),
      ...(stimulus ? { stimulus: plain(stimulus) } : {}),
      pendingRevision: !!this.review[qid]?.revision,
      ...(stimulus ? sharersProp(q) : {}),
    }
  }

  /**
   * "Sunting" with the whole question: stem, options and key, parts, scheme, DSKP tag and the
   * caption / alt text of the shared stimulus. Version n+1 waits in the queue under the same gate
   * as an extracted batch; the live version keeps serving until it is approved.
   */
  async reviseQuestionFull(
    qid: string,
    edited: IntakeQuestion,
    stimulus: IntakeStimulus | undefined,
    note: string,
  ): Promise<DecisionResult> {
    await this.host.tick()
    // Load first: the checks and the change below run with no await in between, so two Sunting
    // submits made at the same time cannot both create a version.
    const lookup = await tagLookupFor([edited.tag.subject])
    const q = getQ(qid)
    if (!q || this.statusOf(qid) !== 'terbit')
      return { ok: false, errors: ['Hanya soalan Terbit boleh disunting'] }
    if (this.review[qid]?.revision)
      return { ok: false, errors: ['Sudah ada versi baharu menunggu semakan'] }

    const live = q.groupId ? getStimulus(q.groupId) : undefined
    const nextStimulus: StimulusDef | undefined = live
      ? {
          ...live,
          alt: stimulus?.alt ?? live.alt,
          ...(stimulus?.caption !== undefined ? { caption: stimulus.caption } : {}),
          ...(live.kind === 'passage' && stimulus?.text !== undefined
            ? { text: stimulus.text }
            : {}),
        }
      : undefined
    const issues = validateRevision(plain(edited), nextStimulus, lookup)
    if (issues.length > 0) return { ok: false, errors: issues }

    const at = this.host.now()
    const content = intakeToDef(plain(edited), {
      qid,
      ...(q.groupId ? { groupId: q.groupId } : {}),
      newPartId: (j) => `${qid}-n${at.toString(36)}${j}`,
    })
    // The tag passed the rule, so it is complete: the `perlu-semakan` marker goes (as the editor does).
    const question = settled(content.question)
    // AC-10.3: the new version's history shows the before/after of the tag (live tag vs the edited one).
    const tagChange = tagChanges(q.curriculum, question.curriculum)
    const revision: RevisionContent = {
      question,
      schemes: content.schemes,
      ...(nextStimulus ? { stimulus: nextStimulus } : {}),
    }
    const rec = (this.review[qid] ??= {
      status: 'terbit',
      version: 1,
      submittedAt: at,
      history: [{ at, by: ADMIN_NAME, version: 1, action: 'Diterbitkan (asal)' }],
    })
    const next = Math.max(rec.version, rec.lastVersion ?? 0) + 1
    rec.lastVersion = next
    rec.revision = {
      version: next,
      stem: question.stem,
      note: note.trim(),
      at,
      content: revision,
    }
    rec.history.push({
      at,
      by: ADMIN_NAME,
      version: rec.revision.version,
      action: `Versi ${rec.revision.version} dicipta (Draf, dihantar untuk semakan)`,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(tagChange.length ? { tag: tagChange } : {}),
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

  /** `lookup` must know the subject of the question's unit (load it with `lookupFor` first). */
  private bankRow(qid: string, lookup: TagLookup): BankRow {
    const q = getQ(qid)!
    const c = q.curriculum
    return {
      id: qid,
      ...(q.groupId ? { groupId: q.groupId, ...groupSizeProp(q.groupId) } : {}),
      subject: c.subject,
      subjectName: subjectName(c.subject),
      kertas: kertasOf(qid),
      kind: kindOf(q),
      topic: topicOf(c, lookup),
      ...tagFields(c, lookup),
      marks: marksOf(q),
      preview: previewOf(q),
      previewPlain: plainMath(previewOf(q)),
      version: this.versionOf(qid),
      status: this.statusOf(qid),
      usedIn: this.usedIn(qid).length,
    }
  }

  private allQuestionIds(): string[] {
    const dyn = this.host.slice().dynSeeds ?? {}
    const mine = (id: string): boolean => {
      const key = DYN_KEY_OF_Q.get(id)
      return !key || !!dyn[key]
    }
    return [...new Set([...BANK.questions.keys(), ...SEED_Q.keys()])].filter(mine)
  }

  async listBank(f: BankFilter = {}): Promise<BankRow[]> {
    await this.host.tick()
    const status = f.status ?? 'terbit'
    const term = f.q?.trim().toLowerCase()
    const ids = this.allQuestionIds()
    const lookup = await lookupForView(ids.map(getQ))
    // Rows and tag filters are built in one pass, so the page's count is the length of this list.
    return ids
      .map((id) => ({ row: this.bankRow(id, lookup), tag: getQ(id)!.curriculum }))
      .filter(
        ({ row: r, tag: t }) =>
          (status === 'semua' || r.status === status) &&
          (!f.subject || r.subject === f.subject) &&
          (!f.kertas || r.kertas === f.kertas) &&
          (!f.kind || r.kind === f.kind) &&
          tagMatchesFilter(t, f) &&
          (!f.tagReview || r.tagReview) &&
          (!term ||
            r.preview.toLowerCase().includes(term) ||
            r.id.toLowerCase().includes(term) ||
            r.topic.toLowerCase().includes(term) ||
            r.spCodes.some((c) => c.toLowerCase().includes(term))),
      )
      .map(({ row }) => row)
      .sort(
        (a, b) =>
          a.subject.localeCompare(b.subject) || a.kertas - b.kertas || a.id.localeCompare(b.id),
      )
  }

  async bankStats(): Promise<BankStats> {
    await this.host.tick()
    const rows = this.allQuestionIds().map((id) => ({
      subject: getQ(id)!.curriculum.subject,
      status: this.statusOf(id),
    }))
    // Only subjects that hold at least one question (any status) get a tile, so the 13 catalogue
    // subjects do not show ten empty ones (D11: computed from the data). Catalogue order first.
    const order = dskpSubjects().map((s) => s.code as string)
    const rank = (code: string): number => {
      const i = order.indexOf(code)
      return i < 0 ? order.length : i
    }
    const codes = [...new Set(rows.map((r) => r.subject))].sort(
      (a, b) => rank(a) - rank(b) || a.localeCompare(b),
    )
    // "Jumlah soalan" is the Terbit bank (what the list shows by default and what the subject cards
    // count); questions still in review are reported on their own, never added into the total.
    return {
      total: rows.filter((r) => r.status === 'terbit').length,
      semakan: rows.filter((r) => r.status === 'semakan').length,
      bySubject: codes.map((code) => {
        const mine = rows.filter((r) => r.subject === code)
        const n = (st: QuestionStatus) => mine.filter((r) => r.status === st).length
        return {
          code,
          name: subjectName(code),
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
      row: this.bankRow(qid, await lookupForView([q])),
      question: reviewQuestion(q),
      ...(q.groupId ? this.groupParts(q.groupId) : {}),
      history: rec?.history ?? [
        { at: 0, by: 'Pangkalan sedia ada', version: 1, action: 'Diterbitkan' },
      ],
      usedInPapers: this.usedIn(qid),
      pendingRevision: !!rec?.revision,
      ...sharersProp(q),
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

  private builderQuestion(qid: string, lookup: TagLookup): BuilderQuestion {
    const q = getQ(qid)!
    const st = q.groupId ? getStimulus(q.groupId) : undefined
    return {
      id: qid,
      ...(q.groupId ? { groupId: q.groupId } : {}),
      ...(st ? { stimulusLabel: st.label } : {}),
      preview: previewOf(q),
      marks: marksOf(q),
      kind: kindOf(q),
      topic: topicOf(q.curriculum, lookup),
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
    const lookup = await lookupForView(ids.map(getQ))
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
      questions: ids.map((qid) => this.builderQuestion(qid, lookup)),
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
    if (!bp) throw this.host.error('bad_request', 'Tiada cetak biru untuk subjek dan kertas ini')
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
