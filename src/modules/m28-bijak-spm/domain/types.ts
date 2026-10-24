/**
 * Bijak SPM (v2, docs/requirements/v2-bijak-spm.md): domain types. This module owns a NEW store; it
 * never reads or writes the M04 / M05 / M06 stores. Fictitious data only.
 */

/** Open dictionary (exam schema D9): MAT, SN, SEJ, ... */
export type SubjectCode = string

export interface Subject {
  code: SubjectCode
  name: string
}

/** A shared stimulus (Rajah / petikan / jadual) pinned while its group's questions are answered. */
export interface StimulusDef {
  id: string
  kind: 'diagram' | 'passage' | 'table'
  /** Short label used in headings and chips, e.g. "Rajah 2". */
  label: string
  caption?: string
  /** Accessible description of the diagram. */
  alt: string
  /** Inline SVG markup (bundled, trusted, uses currentColor / theme variables only). */
  svg?: string
  text?: string
  table?: { head: string[]; rows: string[][] }
}

export interface McqOption {
  id: string
  /** May contain `$latex$` spans. */
  text: string
}

/**
 * Leaf answer modes (exam schema D2). MCQ stays a question-level leaf in this prototype.
 * `table_fill` is a typed stub (no widget yet); `drawing` is a photo plus a teacher checklist.
 */
export type LeafKind =
  'working' | 'numeric' | 'short_text' | 'match_letter' | 'essay' | 'drawing' | 'table_fill'

export interface PartDef {
  id: string
  /** "(a)", "(i)" ... */
  label: string
  prompt: string
  /** Marks of a leaf part; 0 on a part that only holds children. */
  marks: number
  answer?: { kind: LeafKind; unit?: string; wordRange?: { min: number; max: number } }
  children?: PartDef[]
}

export interface QuestionDef {
  id: string
  /** Curriculum tag (exam schema D9); the free-text topic is gone. */
  curriculum: CurriculumTag
  /** Stimulus group this question belongs to. */
  groupId?: string
  stem: string
  /** MCQ: the question itself is the leaf (its id is the answer key). */
  mcq?: { options: McqOption[] }
  /** Structured: nested parts. */
  parts?: PartDef[]
}

/** Curriculum tag (exam schema D9). T1-T3 Matematik content: `formOrigin: 'T1-T3'`, `unit: null` (Q-S2). */
export interface CurriculumTag {
  subject: SubjectCode
  level: 'T4' | 'T5' | 'T4+T5'
  /** Unit code from the loaded DSKP, or null when the content lies outside it. */
  unit: string | null
  /** Display name of the unit (stands in for the DSKP lookup in this prototype). */
  unitLabel: string
  sp: string[]
  tp: number
  formOrigin: 'T1-T3' | 'T4' | 'T5'
  /** Optional KBAT (higher-order thinking) level (FB-026); null/absent = not a KBAT question. Not gated. */
  kbat?: KbatLevel | null
}

/** KBAT levels a question can be tagged with (FB-026). */
export type KbatLevel = 'Mengaplikasi' | 'Menganalisis' | 'Menilai' | 'Mencipta'

export interface GroupDef {
  id: string
  stimulusId: string
  /** Shared lettered bank for `match_letter` items (exam schema D6). */
  optionBank?: McqOption[]
  /** Question ids in the published order. */
  questionIds: string[]
}

/* ------------------------------------------------------------------ mark schemes (server only) */

export interface FinalDef {
  /** Accepted equivalent forms (plain or LaTeX); any one of them matches. */
  accept: string[]
  /** Absolute tolerance for numeric answers. */
  tolerance?: number
  unit?: string
  /** The answer must contain this text (e.g. "(" for a factorised form), else it is wrong. */
  mustContain?: string
  /** Reason shown when `mustContain` fails. */
  formHint?: string
  /** LaTeX shown in the revealed scheme. */
  display: string
}

export type PointMatch =
  | { type: 'step'; accept: string[] }
  /** "&": every item must appear in the working or the final answer. */
  | { type: 'all_of'; items: string[] }
  | { type: 'final' }
  | { type: 'unit' }
  | { type: 'keywords'; anyOf: string[] }
  /** Checked by a teacher (drawing checklist, rubric content point): never auto-awarded. */
  | { type: 'manual' }

/** Own figure carried forward, as data (exam schema D4.2): expected = f(previous final). */
export type EcfRule =
  | { op: 'same' }
  | { op: 'sub_from'; k: number }
  | { op: 'add'; k: number }
  | { op: 'mul'; k: number }

/** Mark-point letters follow the subject (Q-S3): K/N/P maths, M sciences, F/C Sejarah and BI, B independent. */
export type PointCode = 'K' | 'N' | 'P' | 'B' | 'M' | 'F' | 'C'

export interface PointDef {
  id: string
  /** Letter of the mark point; the shown tag is the letter plus its sequence in the part (K1, K2, M1, F3). */
  code: PointCode
  /** Explicit marks: the digit of a tag is a sequence number, never the marks. */
  marks: number
  label: string
  match: PointMatch
  /** Only awarded when every one of these other points was hit. */
  requires?: string[]
  /** Own figure carried forward from an earlier part. */
  ecf?: { fromPart: string; rule: EcfRule; note: string }
}

/** "[mana-mana n x k m]": at most `anyN` of these points count. */
export interface PointGroup {
  id: string
  anyN: number
  pointIds: string[]
}

export interface RubricBand {
  name: string
  range: [number, number]
  descriptor: string
}

/** Answer-key kinds (exam schema D3): option, mapping, accepted, points, rubric. */
export type SchemeDef =
  | { kind: 'option'; marks: number; correct: string; reason: string }
  | { kind: 'mapping'; marks: number; map: Record<string, string> }
  | {
      kind: 'accepted'
      marks: number
      values: { v: string; tol?: number; unit?: string }[]
      caseSensitive?: boolean
    }
  | {
      kind: 'points'
      marks: number
      points: PointDef[]
      groups?: PointGroup[]
      final?: FinalDef
      model?: string
    }
  | {
      kind: 'rubric'
      marks: number
      criteria: { id: string; name: string }[]
      bands: RubricBand[]
      notes?: string[]
    }

/* ------------------------------------------------------------------------------- papers */

export interface SectionDef {
  id: string
  label: string
  title?: string
  /** Marks the section is worth after choose-N (printed budget). */
  markBudget: number
  /** Questions on the paper in this section (not the number to answer). */
  questionCount: number
  /** "Soalan ini mesti dijawab". */
  compulsory?: boolean
  /** Authored instruction line, else derived from the rule. */
  instruction?: string
  rule: { type: 'all' } | { type: 'choose'; n: number }
  questionIds: string[]
}

export interface PaperDef {
  id: string
  title: string
  subject: SubjectCode
  kertas: 1 | 2
  year: number
  code: string
  durationMin: number
  instructions: string[]
  /** Reference sheet panels shown on the cover (formula sheet). */
  reference?: { title: string; items: string[] }[]
  sections: SectionDef[]
}

/** Blueprint (Kontrak Blueprint): the contract a generated paper follows. */
export interface BlueprintSection {
  label: string
  markBudget?: number
  compulsory?: boolean
  instruction?: string
  rule: { type: 'all' } | { type: 'choose'; n: number }
  /** Pool tag the section draws from. */
  pool: string
  /** Number of questions the section holds (groups count with all their questions). */
  take: number
}

export interface Blueprint {
  subject: SubjectCode
  kertas: 1 | 2
  source: 'Disahkan' | 'Spec' | 'Draf'
  code: string
  durationMin: number
  instructions: string[]
  reference?: PaperDef['reference']
  sections: BlueprintSection[]
}

/** A question in the pool, tagged with the pool it belongs to. */
export interface PoolEntry {
  questionId: string
  pool: string
}

/* ------------------------------------------------------------------------------ attempts */

export interface PhotoMeta {
  key: string
  name: string
  size: number
}

/** What the student typed for one leaf part. LaTeX is canonical; the plain forms are derived. */
export interface PartAnswer {
  choice?: string
  steps?: string[]
  final?: string
  unit?: string
  text?: string
  photos?: PhotoMeta[]
  /** Plain-text forms of the LaTeX above, so marking and staff review can read either (AC-09.5). */
  plain?: { steps: string[]; final: string }
}

export interface StoredAnswer {
  answer: PartAnswer
  /** Per-part revision: a save with an older revision never overwrites a newer one. */
  rev: number
  savedAt: number
}

export type AttemptMode = 'exam' | 'latihan'
export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned'
export type PaperKind = 'pilihan' | 'jana'

export interface SectionSnapshot {
  id: string
  label: string
  compulsory?: boolean
  instruction?: string
  rule: SectionDef['rule']
  questionIds: string[]
}

export interface Attempt {
  id: string
  userId: number
  paperId: string
  paperKind: PaperKind
  title: string
  subject: SubjectCode
  kertas: number
  code: string
  mode: AttemptMode
  status: AttemptStatus
  startedAt: number
  deadline: number | null
  durationMin: number
  /** Frozen composition: later pool or paper edits never change this attempt. */
  sections: SectionSnapshot[]
  answers: Record<string, StoredAnswer>
  flags: string[]
  picks: Record<string, string[]>
  position: number
  /** Latihan: question ids already checked with "Semak". */
  checked: string[]
  /** Latihan: how many times each question was checked (capped, NFR-05). */
  checkCounts?: Record<string, number>
  submittedAt?: number
  lateBySeconds?: number
  idempotencyKey?: string
  result?: AttemptResult
}

/* --------------------------------------------------------------------------------- results */

export type PartStatus = 'betul' | 'separa' | 'salah' | 'kosong' | 'belum_dimarkah'

export interface PointResult {
  id: string
  code: PointDef['code']
  /** Shown tag: letter plus sequence, e.g. K1, M2, F3. */
  tag: string
  /** A teacher still has to check this point. */
  manual?: boolean
  label: string
  marks: number
  awarded: number
  hit: boolean
  reason: string
}

export interface SchemeReveal {
  marks: number
  /** MCQ: the correct option id. */
  correctOption?: string
  /** match_letter: the correct letter. */
  correctLetter?: string
  /** accepted: the accepted answers as text. */
  acceptedText?: string[]
  /** rubric: bands and criteria. */
  rubric?: { criteria: string[]; bands: RubricBand[]; notes?: string[] }
  explanation?: string
  /** LaTeX of the model final answer. */
  finalDisplay?: string
  unit?: string
  model?: string
}

export interface PartResult {
  partId: string
  label: string
  prompt: string
  marks: number
  awarded: number
  status: PartStatus
  confidence: 'high' | 'low'
  points: PointResult[]
  /** Set when an own-figure-carried-forward mark was given. */
  ecf?: string
  answer: PartAnswer
  scheme: SchemeReveal
}

export interface QuestionResult {
  questionId: string
  number: number
  sectionId: string
  marks: number
  awarded: number
  /** False when a choose-N section dropped this question from the total. */
  counted: boolean
  attempted: boolean
  parts: PartResult[]
}

export interface SectionResult {
  sectionId: string
  label: string
  marks: number
  awarded: number
  chooseN?: number
  counted: string[]
}

export interface AttemptResult {
  score: number
  max: number
  percent: number
  /** True while any part waits for a human (the total is provisional). */
  provisional: boolean
  pendingReview: number
  sections: SectionResult[]
  questions: QuestionResult[]
  coins: number
  points: number
}

/* ------------------------------------------------------------------------------ DTOs (client) */

export interface PartView {
  id: string
  label: string
  prompt: string
  marks: number
  answer?: PartDef['answer']
  children?: PartView[]
}

export interface QuestionView {
  id: string
  number: number
  sectionId: string
  /** Display name of the unit (from the curriculum tag). */
  topic: string
  formOrigin: CurriculumTag['formOrigin']
  /** Shared lettered bank of this question's group (match_letter items). */
  optionBank?: McqOption[]
  groupId?: string
  stem: string
  marks: number
  mcq?: { options: McqOption[] }
  parts?: PartView[]
}

export interface GroupView {
  id: string
  stimulus: StimulusDef
  /** Question numbers covered, e.g. 6 to 9. */
  from: number
  to: number
  questionIds: string[]
}

export interface SectionView extends SectionSnapshot {
  marks: number
  effectiveMarks: number
}

/** The paper as served to an attempt: no answer keys, no schemes. */
export interface AttemptPaperView {
  attempt: Omit<Attempt, 'result' | 'sections'>
  sections: SectionView[]
  questions: QuestionView[]
  groups: GroupView[]
  /** Latihan: results of the questions already checked with "Semak" (scheme revealed per question). */
  checks: QuestionResult[]
}

export interface ResultView {
  attempt: Omit<Attempt, 'result' | 'sections'>
  result: AttemptResult
  paper: AttemptPaperView
}

export interface InProgressInfo {
  attemptId: string
  title: string
  mode: AttemptMode
  elapsedSeconds: number
  /** Under one minute old: resume silently. */
  fresh: boolean
}

export interface PaperSummary {
  id: string
  title: string
  subject: SubjectCode
  subjectName: string
  kertas: number
  year: number
  code: string
  durationMin: number
  questionCount: number
  marks: number
  kind: PaperKind
  /** Latest status for the caller. */
  status: 'belum' | 'sedang' | 'selesai'
  lastScore?: { score: number; max: number }
  attemptId?: string
}

export interface PaperCover extends PaperSummary {
  instructions: string[]
  reference: NonNullable<PaperDef['reference']>
  sections: {
    label: string
    marks: number
    instruction: string
    questionCount: number
    compulsory: boolean
    chooseN?: number
  }[]
}

export interface Shortage {
  section: string
  need: number
  have: number
}

export type GenerateOutcome =
  | { ok: true; paperId: string }
  | { ok: false; reason: 'no_blueprint' }
  | { ok: false; reason: 'shortage'; shortages: Shortage[] }

export interface SaveChange {
  partId: string
  answer: PartAnswer
  rev: number
  savedAt: number
}

export interface SavePayload {
  changes: SaveChange[]
  flags?: string[]
  picks?: Record<string, string[]>
  position?: number
}

export interface SubmitPayload extends SavePayload {
  idempotencyKey: string
  /** The client's full local answer set (the server grades the union). */
  answers?: Record<string, { answer: PartAnswer; rev: number; savedAt: number }>
  auto?: boolean
}

export interface HistoryRow {
  attemptId: string
  title: string
  subject: SubjectCode
  subjectName: string
  kertas: number
  kind: PaperKind
  mode: AttemptMode
  status: AttemptStatus
  startedAt: number
  durationSeconds: number
  score?: number
  max?: number
}

export interface QuestionCheck {
  questionId: string
  result: QuestionResult
}

/**
 * How a match_letter question is laid out (FB-064, draft for the user to compare). `list` (default):
 * every sub-part repeats the whole lettered list as full-width buttons. `compact`: the letter bank
 * is shown once above the sub-parts and each sub-part has one row of letter buttons.
 */
export type MatchLayout = 'list' | 'compact'
