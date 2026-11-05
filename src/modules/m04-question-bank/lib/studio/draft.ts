/**
 * The Studio question draft (R1-F03b, V2 flow 1 step 2): the form state, how complete it is ("· n belum lengkap"), and the
 * request body of `POST/PUT /api/questions`. The part tree is the v2 wire model: leaves carry marks, a mode, a key, and here
 * the DSKP tags `difficultyTp` (TP) and `kbat` (Aras pemikiran). Pure, no I/O.
 */
import { DIFFICULTY_LABELS } from '../question-list'
import { dskpItems, isCognitive, isKbat, leafName, questionTp, type CognitiveValue } from './dskp-tags'

export type LeafMode = 'mcq' | 'match_letter' | 'short_text' | 'numeric' | 'working' | 'essay' | 'essay_choice'
/** `Jenis jawapan` (L-02). `drawing` and `table_fill` come with S2-T10 part D; `pksk_choice` is never authored in the Studio. */
export const LEAF_MODES: readonly { value: LeafMode; label: string }[] = [
  { value: 'mcq', label: 'Aneka pilihan' },
  { value: 'match_letter', label: 'Padanan' },
  { value: 'short_text', label: 'Jawapan pendek' },
  { value: 'numeric', label: 'Nombor' },
  { value: 'working', label: 'Pengiraan dengan langkah kerja' },
  { value: 'essay', label: 'Karangan / respons terbuka' },
  { value: 'essay_choice', label: 'Esei pilihan' },
]
/** Modes whose answer key is a marking scheme (points or rubric); part C edits the full scheme. */
export const SCHEME_MODES: readonly LeafMode[] = ['working', 'essay', 'essay_choice']

/** FR-QA-27: 2 to 8 options (S1-T09a). */
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 8
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const STEM_MIN = 10

/** PRD45 3.1.6 / L-13 / contract copy. */
export const EXAMPLE_ANSWER_MESSAGE = 'Jawapan contoh diperlukan.'
export const MATCH_NO_GROUP_MESSAGE = 'Padanan memerlukan kumpulan dengan bank pilihan.'
export const WORD_RANGE_MESSAGE = 'Julat perkataan tidak sah.'
export const ESSAY_CHOICE_MESSAGE = 'Esei pilihan mesti mempunyai 2 hingga 6 topik.'
export const MCQ_MULTI_MESSAGE = 'Pilih sekurang-kurangnya satu jawapan betul dan sekurang-kurangnya satu jawapan salah.'
/** L-13: the text of a non-option example answer is at most 200 characters. */
export const EXAMPLE_ANSWER_MAX = 200

export interface OptionDraft {
  label: string
  text: string
  /** The English text of a stored bilingual option; null = none. Carried, not edited here (part D). */
  textEn?: string | null
  /** Public token of an uploaded option picture. */
  imageToken: string | null
}

type Json = Record<string, unknown>

export const ANSWER_SPACES = [
  { value: 'short', label: 'Pendek' },
  { value: 'medium', label: 'Sederhana' },
  { value: 'long', label: 'Panjang' },
] as const
export type AnswerSpace = (typeof ANSWER_SPACES)[number]['value']

/** One `Gesaan alternatif` of an `essay_choice` leaf: `topics[i]` (id, `Tajuk`) joined with `modeConfig.alternatives[i]`. */
export interface AlternativeDraft {
  id: string
  title: string
  prompt: string
  promptEn: string | null
  stimulusId: string | null
}
/** What the leaf forms read from the question's stimulus group: its bank (`match_letter`) and stimuli (`essay_choice`). */
export interface LeafGroup {
  bank: { label: string; text: string }[]
  stimuli: { id: string; label: string }[]
}
export const MIN_ALTERNATIVES = 2
export const MAX_ALTERNATIVES = 6

/** One marking point of the minimal `working` form; `rest` keeps every other stored field of the point. */
export interface PointDraft {
  id: string
  code: PointCode
  label: string
  marks: number
  rest: Json
}
export const POINT_CODES = ['K', 'N', 'P', 'B', 'M', 'F', 'C'] as const
export type PointCode = (typeof POINT_CODES)[number]
export interface FinalDraft {
  display: string
  /** Accepted final answers, one per line. */
  accepted: string
  tolerance: string
  unit: string
}

export interface LeafDraft {
  /** Local key only; never sent. */
  uid: string
  label: string
  mode: LeafMode
  prompt: string
  marks: number
  tp: number | null
  cognitive: CognitiveValue | null
  options: OptionDraft[]
  correct: string
  /** Accepted answers, one per line. */
  accepted: string
  numeric: { value: string; tolerance: string; unit: string }
  /** The English prompt of a stored bilingual leaf; null = none. Carried, not edited here (part D). */
  promptEn: string | null
  /** `Rangsangan bahagian` (L-10): a stimulus of the group. Carried here. */
  stimulusId: string | null
  /** Stored leaf fields the Studio does not edit (`reveal`, `unitNodeId`, `formOrigin`, `blankCount`, a leaf `wordRange`, ...), written back verbatim. */
  extra: Json
  /** The stored answer key, written back with the edited fields laid over it (so `caseSensitive`, `tolKind`, a scheme v2 key ... survive). */
  keyBase: Json | null
  /** Stored `modeConfig` fields the forms below do not edit, written back verbatim (`maxWords`, `preFill`, `dependsOnPart`, `drawingKind`, ...). */
  modeConfigRest: Json
  /** mcq: `Pelbagai jawapan` (`modeConfig.multi`). */
  multi: boolean
  /** mcq `Pelbagai jawapan`: the correct labels. */
  correctMulti: string[]
  /** mcq `Terima pilihan lain`: extra accepted labels (`key.accepted`). */
  acceptedOptions: string[]
  /** mcq `Nota kunci` (`key.note`). */
  keyNote: string
  /** match_letter: the bank letter (`key.map[label]`) and `Setiap huruf digunakan sekali` (`key.bankUnique`). */
  bankLetter: string
  bankUnique: boolean
  /** L-13: null = not an example leaf; otherwise `Jawapan contoh` (`modeConfig.example.answer`). */
  exampleAnswer: string | null
  /** essay / essay_choice: `Bilangan patah perkataan`, `Had keras`, `Ruang jawapan`. */
  words: { min: string; max: string }
  hardLimit: boolean
  answerSpace: '' | AnswerSpace
  /** essay_choice: 2 to 6 topics. */
  alternatives: AlternativeDraft[]
  /** working: the plain-input points and `Jawapan akhir` (the full scheme editor is S2-T10 part C). */
  points: PointDraft[]
  final: FinalDraft
}

export type Kertas = '' | '1' | '2' | '3'
/** FR-ADM-QE3.7: `Tahap kesukaran` 1 to 5 (DM-47), the labels of the question list. */
export const KESUKARAN = [1, 2, 3, 4, 5].map((value) => ({ value, label: DIFFICULTY_LABELS[value] ?? String(value) }))

export interface StudioDraft {
  /** Stored question TP of a question whose parts carry no TP (intake-born): the parts inherit it, a save keeps it. */
  inheritedTp?: number | null
  subjectId: string
  educationLevelId: string
  kertas: Kertas
  /** V2 `Nombor soalan`. */
  numberLabel: string
  /** Teks soalan (stem). */
  stem: string
  /** Public token of the stem picture. */
  stemImageToken: string | null
  chapterId: string
  difficulty: number
  unitId: string | null
  spIds: string[]
  /** The stimulus group this question belongs to (D90), or null. */
  groupId: string | null
  leaves: LeafDraft[]
  /** PO decision 3: `Penjelasan`, shown to the pupil after answering. */
  explanation: string
  /** The English explanation of a `ms+en` question; null = not bilingual, so no field and nothing sent. */
  explanationEn: string | null
  /** `Jenis tulisan` (PRD30 04-23); PO decision 4: `mixed` is stored as `ms_en`. */
  scriptType: ScriptType
}

export type ScriptType = 'rumi' | 'arab' | 'jawi' | 'mixed'
export const SCRIPT_TYPES: readonly { value: ScriptType; label: string }[] = [
  { value: 'rumi', label: 'Rumi' },
  { value: 'arab', label: 'Arab' },
  { value: 'jawi', label: 'Jawi' },
  { value: 'mixed', label: 'Campuran' },
]
/** The subjects that ask for `Jenis tulisan` (plan S2-T01); the others are always Rumi. */
const SCRIPT_SUBJECTS = new Set(['Pendidikan Islam', 'Bahasa Arab', 'Jawi', 'Pendidikan Al-Quran & As-Sunnah', 'Tasawwur Islam', 'Pendidikan Syariah Islamiah'])
export const asksScript = (subjectName: string): boolean => SCRIPT_SUBJECTS.has(subjectName)

let seq = 0
export const newUid = (): string => `leaf-${String((seq += 1))}`

export function blankOptions(n = 4): OptionDraft[] {
  return OPTION_LABELS.slice(0, n).map((label) => ({ label, text: '', imageToken: null }))
}

export const blankFinal = (): FinalDraft => ({ display: '', accepted: '', tolerance: '', unit: '' })

/** The mode-specific answer fields of a fresh leaf (also what a mode switch resets to). */
function blankAnswer(mode: LeafMode) {
  return {
    options: mode === 'mcq' ? blankOptions() : [],
    correct: '',
    accepted: '',
    numeric: { value: '', tolerance: '', unit: '' },
    keyBase: null,
    modeConfigRest: {},
    multi: false,
    correctMulti: [] as string[],
    acceptedOptions: [] as string[],
    keyNote: '',
    bankLetter: '',
    bankUnique: false,
    words: { min: '', max: '' },
    hardLimit: false,
    answerSpace: '' as const,
    alternatives: mode === 'essay_choice' ? blankAlternatives() : ([] as AlternativeDraft[]),
    points: [] as PointDraft[],
    final: blankFinal(),
  }
}

export function blankAlternatives(n = MIN_ALTERNATIVES): AlternativeDraft[] {
  return Array.from({ length: n }, (_v, i) => ({ id: `t${String(i + 1)}`, title: '', prompt: '', promptEn: null, stimulusId: null }))
}

export function blankLeaf(label = 'a', mode: LeafMode = 'mcq'): LeafDraft {
  return {
    uid: newUid(),
    label,
    mode,
    prompt: '',
    marks: 1,
    tp: null,
    cognitive: null,
    promptEn: null,
    stimulusId: null,
    extra: {},
    exampleAnswer: null,
    ...blankAnswer(mode),
  }
}

export function blankDraft(): StudioDraft {
  return {
    subjectId: '',
    educationLevelId: '',
    kertas: '',
    numberLabel: '',
    stem: '',
    stemImageToken: null,
    chapterId: '',
    difficulty: 3,
    unitId: null,
    spIds: [],
    groupId: null,
    leaves: [blankLeaf('a')],
    explanation: '',
    explanationEn: null,
    scriptType: 'rumi',
  }
}

/** Switching the mode keeps the label, marks, prompt and tags, and starts the answer fields afresh. */
export function withMode(leaf: LeafDraft, mode: LeafMode): LeafDraft {
  if (leaf.mode === mode) return leaf
  // The example flag survives (its answer is mode-specific, so it starts empty); the stored extras of the old mode do not.
  return { ...leaf, ...blankAnswer(mode), mode, extra: {}, exampleAnswer: leaf.exampleAnswer === null ? null : '' }
}

/** `Betul / Salah`: two fixed rows, text not editable (mirrors the contract's `TRUE_FALSE_OPTIONS`). */
export const TRUE_FALSE = [
  { label: 'A', text: 'Betul' },
  { label: 'B', text: 'Salah' },
] as const
export const isTrueFalse = (leaf: Pick<LeafDraft, 'options'>): boolean =>
  leaf.options.length === 2 && leaf.options.every((o, i) => o.label === TRUE_FALSE[i]?.label && o.text === TRUE_FALSE[i]?.text && o.imageToken === null)

/** Switches the mcq leaf to or from `Betul / Salah`; the answer fields start afresh. */
export function setTrueFalse(leaf: LeafDraft, on: boolean): LeafDraft {
  const fresh = { ...leaf, correct: '', correctMulti: [], acceptedOptions: [], multi: false, keyBase: null }
  return { ...fresh, options: on ? TRUE_FALSE.map((o) => ({ label: o.label, text: o.text, imageToken: null })) : blankOptions() }
}

/** Switches `Pelbagai jawapan` (`modeConfig.multi`); the correct answers start afresh. */
export const setMulti = (leaf: LeafDraft, multi: boolean): LeafDraft => ({ ...leaf, multi, correct: '', correctMulti: [], acceptedOptions: [], keyBase: null })

/** Next free option label; null at the maximum. */
export const nextOptionLabel = (options: readonly OptionDraft[]): string | null => (options.length >= MAX_OPTIONS ? null : (OPTION_LABELS[options.length] ?? null))

export function addOption(leaf: LeafDraft): LeafDraft {
  const label = nextOptionLabel(leaf.options)
  return label === null ? leaf : { ...leaf, options: [...leaf.options, { label, text: '', imageToken: null }] }
}

/** Removes an option, closes the letters up again and keeps the correct answers that still exist. */
export function removeOption(leaf: LeafDraft, index: number): LeafDraft {
  if (leaf.options.length <= MIN_OPTIONS) return leaf
  const gone = leaf.options[index]?.label
  const options = leaf.options.filter((_o, i) => i !== index).map((o, i) => ({ ...o, label: OPTION_LABELS[i] as string }))
  /** The new letter of an old one; '' when it was the removed option. */
  const moved = (label: string): string => {
    const at = leaf.options.findIndex((o) => o.label === label)
    return at < 0 || at === index ? '' : (OPTION_LABELS[at > index ? at - 1 : at] as string)
  }
  const keep = (labels: string[]): string[] => labels.map(moved).filter((l) => l !== '')
  return {
    ...leaf,
    options,
    correct: gone === undefined ? '' : moved(leaf.correct),
    correctMulti: keep(leaf.correctMulti),
    acceptedOptions: keep(leaf.acceptedOptions),
    exampleAnswer: leaf.exampleAnswer !== null && leaf.mode === 'mcq' ? moved(leaf.exampleAnswer) : leaf.exampleAnswer,
  }
}

export function nextLeafLabel(leaves: readonly LeafDraft[]): string {
  return String.fromCharCode('a'.charCodeAt(0) + Math.min(leaves.length, 25))
}

export function totalMarks(draft: StudioDraft): number {
  return draft.leaves.reduce((s, l) => s + (Number.isFinite(l.marks) ? l.marks : 0), 0)
}

/** The question TP: highest over leaves, where a part without its own TP counts as the stored (inherited) question TP. */
export const draftTp = (draft: StudioDraft): number | null =>
  questionTp(draft.leaves.map((l) => ({ tp: l.tp ?? draft.inheritedTp ?? null }))) ?? draft.inheritedTp ?? null

/** The note after "TP soalan: n": the highest part TP when a part carries it, else the TP inherited from the question. */
export function draftTpNote(draft: StudioDraft): string {
  const tp = draftTp(draft)
  return tp !== null && draft.leaves.some((l) => l.tp === tp) ? '(tertinggi antara bahagian)' : '(diwarisi daripada soalan)'
}

/* -------------------------------------------------------------------------------------------- completeness */

export interface Gap {
  /** The wizard step the author fixes it in: 1 Tag, 2 Kertas, 3 Rangsangan, 4 Sub-bahagian (FR-QA-16). */
  step: 1 | 2 | 3 | 4
  message: string
  /** `data-testid` of the field the jump link focuses. */
  field: string
  /** The path the server gate uses for the same gap. */
  path: string
  /** A DSKP item: the server decides it (no DSKP nodes, no such rule; FR-ADM-QE4.6). */
  dskp?: boolean
}

/** What the wizard has read about the Subjek + Tingkatan; null or absent = not known yet. */
export interface GapFacts {
  hasChapters?: boolean | null
}

/** What stops a draft being ready to approve. A draft may be saved with gaps; the gate is at Terbitkan (V2 S1.2). */
export function draftGaps(d: StudioDraft, levelName = '', facts: GapFacts = {}): Gap[] {
  const gaps: Gap[] = []
  if (d.subjectId === '') gaps.push({ step: 1, field: 'studio-subject', path: 'subjectId', message: 'Sila pilih subjek.' })
  if (d.educationLevelId === '') gaps.push({ step: 1, field: 'studio-level', path: 'educationLevelId', message: 'Sila pilih tahap pendidikan.' })
  if (d.numberLabel.trim() === '') gaps.push({ step: 2, field: 'studio-number', path: 'numberLabel', message: 'Sila isi nombor soalan.' })
  if (d.kertas === '' && /\b[45]\b/.test(levelName)) gaps.push({ step: 2, field: 'studio-kertas', path: 'kertas', message: 'Sila pilih kertas untuk soalan SPM.' })
  if ([...d.stem.trim()].length < STEM_MIN) gaps.push({ step: 2, field: 'studio-stem', path: 'questionText', message: 'Teks soalan mesti sekurang-kurangnya 10 aksara.' })
  if (d.leaves.length === 0) gaps.push({ step: 4, field: 'studio-add-leaf', path: 'parts', message: 'Soalan tiada sub-bahagian — tiada apa untuk dijawab.' })
  d.leaves.forEach((l, i) => {
    const leaf = { step: 4 as const, field: `studio-leaf-${String(i)}`, path: `parts.${l.label}` }
    const name = leafName(l.label)
    if (l.prompt.trim() === '') gaps.push({ ...leaf, message: `${name} belum ada arahan.` })
    const example = l.exampleAnswer !== null
    if (example && l.exampleAnswer?.trim() === '') gaps.push({ ...leaf, message: EXAMPLE_ANSWER_MESSAGE })
    if (l.mode === 'mcq') {
      if (l.options.some((o) => o.text.trim() === '' && o.imageToken === null)) gaps.push({ ...leaf, message: `${name} ada pilihan kosong.` })
      // an example leaf carries its answer in `Jawapan contoh`, not in a key
      if (!example && l.multi && (l.correctMulti.length < 1 || l.correctMulti.length > l.options.length - 1)) gaps.push({ ...leaf, message: MCQ_MULTI_MESSAGE })
      else if (!example && !l.multi && !l.options.some((o) => o.label === l.correct)) gaps.push({ ...leaf, message: `${name} mempunyai 0 pilihan betul — mesti tepat 1.` })
    } else if (l.mode === 'match_letter') {
      if (d.groupId === null) gaps.push({ ...leaf, message: MATCH_NO_GROUP_MESSAGE })
      else if (!example && l.bankLetter === '') gaps.push({ ...leaf, message: `${name} tiada skema jawapan.` })
    } else if (l.mode === 'short_text') {
      if (!example && acceptedValues(l).length === 0) gaps.push({ ...leaf, message: `${name} tiada skema jawapan.` })
    } else if (l.mode === 'numeric') {
      if (!example && (!Number.isFinite(Number(l.numeric.value)) || l.numeric.value.trim() === '')) gaps.push({ ...leaf, message: `${name} tiada skema jawapan.` })
    } else {
      // working, essay, essay_choice: a scheme (points or rubric); the full editor is part C.
      if (!example && keyOf(l) === undefined) gaps.push({ ...leaf, message: `${name} tiada skema jawapan.` })
      if (l.mode !== 'working' && wordRangeOf(l) === 'invalid') gaps.push({ ...leaf, message: WORD_RANGE_MESSAGE })
      if (l.mode === 'essay_choice') {
        if (l.alternatives.length < MIN_ALTERNATIVES || l.alternatives.length > MAX_ALTERNATIVES) gaps.push({ ...leaf, message: ESSAY_CHOICE_MESSAGE })
        else if (l.alternatives.some((a) => a.title.trim() === '')) gaps.push({ ...leaf, message: `${name} ada gesaan alternatif tanpa tajuk.` })
      }
    }
  })
  if (facts.hasChapters === true && d.chapterId === '') gaps.push({ step: 1, field: 'q-chapter', path: 'chapterId', message: 'Sila pilih Bab.' })
  // A leaf without its own TP inherits the question's, the highest of the leaves (FR-ADM-QE3.4; `dskp-gate.ts`).
  const tp = draftTp(d)
  for (const g of dskpItems({ unitId: d.unitId, spIds: d.spIds, leaves: d.leaves.map((l) => ({ ...l, tp: l.tp ?? tp })) })) {
    const field = g.leaf !== undefined ? `studio-leaf-${String(g.leaf)}` : g.path === 'spIds' ? 'studio-sp' : 'studio-unit'
    gaps.push({ step: g.leaf !== undefined ? 4 : 1, field, path: g.path, message: g.message, dskp: true })
  }
  return gaps
}

/** The leaf a gate path names (`parts.<label>.<field>`): the longest label wins, as a label may hold a dot. */
function leafOfPath(path: string, leaves: readonly Pick<LeafDraft, 'label'>[]): number {
  let hit = -1
  leaves.forEach((l, i) => {
    if (path.startsWith(`parts.${l.label}.`) && l.label.length > (leaves[hit]?.label.length ?? -1)) hit = i
  })
  return hit
}

/** The field a gate issue `path` names (API-Q-05), for the jump link of the completeness panel. */
export function issueField(path: string, leaves: readonly Pick<LeafDraft, 'label'>[]): string {
  const known: Readonly<Record<string, string>> = {
    subjectId: 'studio-subject',
    educationLevelId: 'studio-level',
    kertas: 'studio-kertas',
    numberLabel: 'studio-number',
    questionText: 'studio-stem',
    stem: 'studio-stem',
    media: 'studio-stem-image',
    unitId: 'studio-unit',
    spIds: 'studio-sp',
    tp: 'studio-leaf-0',
    chapterId: 'q-chapter',
    difficultyLevel: 'studio-difficulty',
  }
  const hit = known[path]
  if (hit !== undefined) return hit
  const leaf = leafOfPath(path, leaves)
  return leaf < 0 ? 'studio-add-leaf' : `studio-leaf-${String(leaf)}`
}

/** The form's value for a gate path; undefined for a path the form has no field for. */
function valueAt(path: string, d: StudioDraft): unknown {
  const flat: Readonly<Record<string, unknown>> = {
    subjectId: d.subjectId,
    educationLevelId: d.educationLevelId,
    kertas: d.kertas,
    numberLabel: d.numberLabel,
    questionText: d.stem,
    stem: d.stem,
    unitId: d.unitId,
    spIds: d.spIds,
    chapterId: d.chapterId,
    tp: draftTp(d),
    difficultyLevel: d.difficulty,
  }
  if (path in flat) return flat[path]
  const leaf = d.leaves[leafOfPath(path, d.leaves)]
  if (leaf === undefined) return undefined
  if (path.endsWith('.difficultyTp')) return leaf.tp
  if (path.endsWith('.cognitiveLevel')) return leaf.cognitive
  return undefined
}

const filled = (v: unknown): boolean => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

/**
 * A stored gate issue the form has since fixed: its field changed from the stored question and now holds a value, or its leaf
 * is gone. A field that merely holds a value stays listed: the gate may refuse it for another reason (an SP outside the unit).
 */
function fixedInForm(path: string, d: StudioDraft, stored: StudioDraft): boolean {
  const before = valueAt(path, stored)
  const now = valueAt(path, d)
  if (now === undefined) return before !== undefined
  return filled(now) && JSON.stringify(now) !== JSON.stringify(before)
}

export interface CompletenessRow {
  message: string
  /** `data-testid` of the field. */
  field: string
}

export interface CompletenessInput {
  draft: StudioDraft
  gaps: readonly Gap[]
  /** API-Q-05 for the stored question; null before a save or when the read failed. */
  issues: readonly { path: string; message: string }[] | null
  /** The stored question as the form first held it; null before a save. */
  stored: StudioDraft | null
  /** The Subjek + Tingkatan has DSKP nodes; null = not known yet (FR-ADM-QE4.6). */
  hasDskp: boolean | null
}

/**
 * The rows of the completeness panel. The form lists what it can see live; the gate adds what only it knows. A DSKP item binds
 * only where the Subjek + Tingkatan has DSKP nodes: while that is not known, the gate decides once it has answered.
 */
export function completenessRows({ draft, gaps, issues, stored, hasDskp }: CompletenessInput): CompletenessRow[] {
  const own = gaps.filter((g) => g.dskp !== true || hasDskp === true || (hasDskp === null && issues === null))
  const rows: CompletenessRow[] = own.map((g) => ({ message: g.message, field: g.field }))
  const leafTpGap = (issues ?? []).some((i) => i.path.endsWith('.difficultyTp'))
  for (const i of issues ?? []) {
    if (own.some((g) => g.path === i.path)) continue
    if (stored !== null && fixedInForm(i.path, draft, stored)) continue
    if (i.path === 'tp' && leafTpGap) continue
    if (!rows.some((r) => r.message === i.message)) rows.push({ message: i.message, field: issueField(i.path, draft.leaves) })
  }
  return rows
}

export const acceptedValues = (l: Pick<LeafDraft, 'accepted'>): string[] =>
  l.accepted
    .split('\n')
    .map((v) => v.trim())
    .filter((v) => v !== '')

/* -------------------------------------------------------------------------------------------------- wire */

/** A stored scalar as text ('' for anything else). */
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const isObj = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: string, en: string | null): Json => ({ ms: v.trim(), ...(en === null ? {} : { en }) })
const withOrWithout = (o: Json, k: string, v: unknown, keep: boolean): Json => {
  const { [k]: _gone, ...rest } = o
  void _gone
  return keep ? { ...rest, [k]: v } : rest
}
const wholeNumber = (v: string): number | null => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null)

/** The word range of an essay leaf: none (both blank), a valid {min,max} (0 to 5000, min <= max), or invalid. */
export function wordRangeOf(l: Pick<LeafDraft, 'words'>): { min: number; max: number } | null | 'invalid' {
  const lo = l.words.min.trim()
  const hi = l.words.max.trim()
  if (lo === '' && hi === '') return null
  const min = wholeNumber(lo)
  const max = wholeNumber(hi)
  return min === null || max === null || min > max || max > 5000 ? 'invalid' : { min, max }
}

/* --- working: plain points and `Jawapan akhir` over the stored key (scheme v1 `final` or v2 `finalAnswer`) --- */

const isV2 = (key: Json | null): boolean => key?.scheme_v === 2
export const pointsOf = (key: Json | null): PointDraft[] =>
  (Array.isArray(key?.points) ? (key.points as Json[]) : []).map((raw) => {
    const { id, code, label, marks, ...rest } = raw
    return { id: str(id), code: POINT_CODES.includes(code as PointCode) ? (code as PointCode) : 'M', label: str(label), marks: Number(marks ?? 0), rest }
  })
export function finalOf(key: Json | null): FinalDraft {
  const f = key?.[isV2(key) ? 'finalAnswer' : 'final']
  if (!isObj(f)) return blankFinal()
  const acc = f[isV2(key) ? 'accepted' : 'accept']
  const tol = f[isV2(key) ? 'tol' : 'tolerance']
  return {
    display: typeof f.display === 'string' ? f.display : '',
    accepted: Array.isArray(acc) ? acc.map(String).join('\n') : '',
    tolerance: typeof tol === 'number' ? String(tol) : '',
    unit: typeof f.unit === 'string' ? f.unit : '',
  }
}
export const nextPointId = (points: readonly PointDraft[]): string => {
  let n = points.length + 1
  while (points.some((p) => p.id === `p${String(n)}`)) n += 1
  return `p${String(n)}`
}

/** The `working` key: the stored key with the edited points and final answer laid over it; a new key is scheme v1 (what the write path accepts today). */
function workingKey(l: LeafDraft): Json | undefined {
  const finalText = l.final
  const accepted = finalText.accepted.split('\n').map((v) => v.trim()).filter((v) => v !== '')
  const hasFinal = finalText.display.trim() !== '' || accepted.length > 0
  const base = l.keyBase?.kind === 'points' ? l.keyBase : null
  if (base === null && l.points.length === 0 && !hasFinal) return undefined
  const v2 = isV2(base)
  const tol = finalText.tolerance.trim()
  const unit = finalText.unit.trim()
  const prior = base?.[v2 ? 'finalAnswer' : 'final']
  const finalObj: Json = {
    ...(isObj(prior) ? prior : {}),
    display: finalText.display.trim(),
    [v2 ? 'accepted' : 'accept']: accepted,
    ...(tol === '' ? {} : { [v2 ? 'tol' : 'tolerance']: Number(tol) }),
    ...(unit === '' ? {} : { unit }),
  }
  if (tol === '') delete finalObj[v2 ? 'tol' : 'tolerance']
  if (unit === '') delete finalObj.unit
  const key: Json = {
    ...(base ?? {}),
    kind: 'points',
    marks: base?.marks ?? Math.max(0, Math.trunc(l.marks)),
    points: l.points.map((p) => ({ ...p.rest, id: p.id, code: p.code, label: p.label.trim(), marks: Math.max(0, Math.trunc(p.marks)) })),
  }
  return hasFinal || isObj(prior) ? { ...key, [v2 ? 'finalAnswer' : 'final']: finalObj } : key
}

/** The answer key of a leaf: the stored key with the edited fields laid over it. undefined = no key yet (a scheme mode without a scheme). */
export function keyOf(l: LeafDraft): Json | undefined {
  const same = (kind: string): Json => (l.keyBase?.kind === kind ? l.keyBase : {})
  const ex = l.exampleAnswer?.trim() ?? ''
  if (l.mode === 'mcq') {
    if (l.multi) {
      const k = withOrWithout(same('options'), 'note', l.keyNote.trim(), l.keyNote.trim() !== '')
      return { ...k, kind: 'options', correctOptionIds: l.correctMulti }
    }
    let k = withOrWithout(same('option'), 'accepted', l.acceptedOptions, l.acceptedOptions.length > 0)
    k = withOrWithout(k, 'note', l.keyNote.trim(), l.keyNote.trim() !== '')
    return { ...k, kind: 'option', correct: l.correct === '' ? ex : l.correct }
  }
  if (l.mode === 'match_letter') {
    const letter = l.bankLetter === '' ? ex : l.bankLetter
    return { ...withOrWithout(same('mapping'), 'bankUnique', true, l.bankUnique), kind: 'mapping', map: letter === '' ? {} : { [l.label.trim()]: letter } }
  }
  if (l.mode === 'short_text') {
    const values = acceptedValues(l)
    return { ...same('accepted'), kind: 'accepted', values: values.length === 0 && ex !== '' ? [ex] : values }
  }
  if (l.mode === 'numeric') {
    const stored = Array.isArray(l.keyBase?.values) ? (l.keyBase.values as unknown[]) : []
    const first = isObj(stored[0]) ? stored[0] : {}
    const tol = l.numeric.tolerance.trim()
    const unit = l.numeric.unit.trim()
    const v = l.numeric.value.trim() === '' && ex !== '' ? Number(ex) : Number(l.numeric.value)
    let one = withOrWithout(first, 'tol', Number(tol), tol !== '')
    one = withOrWithout(one, 'unit', unit, unit !== '')
    return { ...same('accepted'), kind: 'accepted', values: [{ ...one, v }, ...stored.slice(1)] }
  }
  if (l.mode === 'working') return workingKey(l)
  return l.keyBase ?? undefined
}

/** `modeConfig` of a leaf: the stored rest with the edited fields laid over it. undefined = nothing to write. */
function modeConfigOf(l: LeafDraft): Json | undefined {
  let mc: Json = { ...l.modeConfigRest }
  if (l.mode === 'mcq' && l.multi) mc.multi = true
  if (l.exampleAnswer !== null) mc.example = { answer: l.exampleAnswer.trim() }
  if (l.mode === 'essay' || l.mode === 'essay_choice') {
    const range = wordRangeOf(l)
    if (range !== null && range !== 'invalid') mc.wordRange = range
    if (l.hardLimit) mc.hardLimit = true
    if (l.answerSpace !== '') mc.answerSpace = l.answerSpace
  }
  if (l.mode === 'essay_choice') {
    const used = l.alternatives.some((a) => a.prompt.trim() !== '' || a.stimulusId !== null)
    mc = withOrWithout(
      mc,
      'alternatives',
      l.alternatives.map((a) => ({ id: a.id, prompt: text(a.prompt, a.promptEn), ...(a.stimulusId === null ? {} : { stimulusId: a.stimulusId }) })),
      used,
    )
  }
  return Object.keys(mc).length === 0 ? undefined : mc
}

export function leafToPart(l: LeafDraft): Json {
  const modeConfig = modeConfigOf(l)
  const base: Json = {
    ...l.extra,
    label: l.label.trim(),
    prompt: text(l.prompt, l.promptEn),
    marks: Math.max(0, Math.trunc(l.marks)),
    ...(l.stimulusId === null ? {} : { stimulusId: l.stimulusId }),
    ...(modeConfig === undefined ? {} : { modeConfig }),
    ...(l.tp === null ? {} : { difficultyTp: l.tp }),
    ...(l.cognitive === null ? {} : { cognitiveLevel: l.cognitive, kbat: isKbat(l.cognitive) ? l.cognitive : 'bukan' }),
  }
  const key = keyOf(l)
  const keyed: Json = key === undefined ? { ...base, mode: l.mode } : { ...base, mode: l.mode, key }
  if (l.mode === 'mcq') {
    return {
      ...keyed,
      options: l.options.map((o) => ({
        label: o.label,
        body: { ms: o.text.trim() === '' ? o.label : o.text.trim(), ...(o.textEn == null ? {} : { en: o.textEn }) },
        ...(o.imageToken === null ? {} : { imageId: o.imageToken }),
      })),
    }
  }
  if (l.mode === 'essay_choice') return { ...keyed, topics: l.alternatives.map((a) => ({ id: a.id, label: a.title.trim() })) }
  return keyed
}

/**
 * Body of `POST /api/questions` (create), `POST /api/stimulus-groups/:id/questions` and `PUT /api/questions/:id`. The question TP is the highest leaf TP (AC-03.6).
 * `questionType: 'essay'` is the wire wrapper of a part tree: the server derives the stored type from the parts, and the
 * flat objective fields (four options, one answer) are not needed.
 */
export function toRequestBody(d: StudioDraft, opts: { sendScript?: boolean } = {}): Json {
  // The group is NOT sent: membership is changed through the group API (`StudioGroupEditor`), never by this save.
  return {
    subjectId: d.subjectId,
    educationLevelId: d.educationLevelId,
    difficultyLevel: d.difficulty,
    questionType: 'essay',
    questionText: d.stem.trim(),
    parts: d.leaves.map(leafToPart),
    tag: { unitId: d.unitId, spIds: d.spIds, tp: draftTp(d) },
    curriculumChapterId: d.chapterId === '' ? null : d.chapterId,
    kertas: d.kertas === '' ? null : d.kertas,
    numberLabel: d.numberLabel.trim() === '' ? null : d.numberLabel.trim(),
    questionImageFileId: d.stemImageToken,
    explanation: d.explanation.trim() === '' ? null : d.explanation.trim(),
    ...(d.explanationEn === null ? {} : { explanationEn: d.explanationEn.trim() === '' ? null : d.explanationEn.trim() }),
    ...(opts.sendScript === true ? { scriptType: d.scriptType } : {}),
  }
}

/* ------------------------------------------------------------------------------------------------- hydrate */

export interface WirePart {
  label: string
  prompt: { ms: string; en?: string }
  marks?: number
  mode?: string
  options?: Array<{ label: string; body: { ms: string; en?: string }; imageId?: string | null }>
  key?: Json & { kind: string }
  modeConfig?: Json | null
  stimulusId?: string | null
  topics?: Array<{ id: string; label: string }>
  difficultyTp?: number | null
  kbat?: string | null
  cognitiveLevel?: string | null
  children?: unknown[]
}

export interface WireQuestion {
  subjectId: string | null
  educationLevelId: string | null
  difficultyLevel: number
  questionText: string
  questionImage: string | null
  numberLabel?: string | null
  kertas?: string | null
  curriculumChapterId: string | null
  parts?: unknown[]
  tag?: { unitId: string | null; spIds: string[]; tp: number | null }
  stimulusGroup?: { id: string } | null
  explanation?: string | null
  explanationEn?: string | null
  scriptType?: ScriptType
}

export interface Hydrated {
  draft: StudioDraft
  /** Reasons the Studio cannot edit this question without losing data (a mode or a nesting it does not offer yet). */
  unsupported: string[]
}

/** Leaf fields the draft models itself; every other stored field is carried in `LeafDraft.extra`. */
const LEAF_KEYS = new Set(['label', 'prompt', 'marks', 'mode', 'options', 'key', 'difficultyTp', 'cognitiveLevel', 'kbat', 'modeConfig', 'stimulusId', 'topics', 'children'])
const isSet = (v: unknown): boolean => v !== undefined && v !== null

/** The key kind each editable mode stores. */
const KEY_KIND: Readonly<Record<LeafMode, readonly string[]>> = {
  mcq: ['option', 'options'],
  match_letter: ['mapping'],
  short_text: ['accepted'],
  numeric: ['accepted'],
  working: ['points'],
  essay: ['rubric', 'points'],
  essay_choice: ['rubric', 'points'],
}

/**
 * Everything on a stored leaf that `leafToPart` would not write back (so a save would drop it). Empty = lossless. The leaf fields
 * (`prompt.en`, option `body.en`, `modeConfig`, `stimulusId`, every key field incl. the scheme v2 keys) are carried; what is left
 * is a shape the form cannot hold (an untrimmed accepted text, a match map with another leaf's label, an option with extra fields).
 */
export function lossOf(p: WirePart): string[] {
  const lost: string[] = []
  for (const o of p.options ?? []) if (Object.keys(o).some((k) => !['label', 'body', 'imageId'].includes(k)) || Object.keys(o.body ?? {}).some((k) => !['ms', 'en'].includes(k))) lost.push('options')
  if (Object.keys(p.prompt ?? {}).some((k) => !['ms', 'en'].includes(k))) lost.push('prompt')
  const key = p.key
  if (key !== undefined && key !== null) {
    const modes = KEY_KIND[p.mode as LeafMode]
    if (modes !== undefined && !modes.includes(key.kind)) lost.push('key.kind')
    if (p.mode === 'short_text') {
      const values = key.values
      if (!Array.isArray(values) || values.some((v) => typeof v !== 'string' || v !== v.trim() || v.includes('\n'))) lost.push('key.values')
    }
    if (p.mode === 'numeric') {
      const values = key.values
      if (!Array.isArray(values) || !isObj(values[0])) lost.push('key.values')
    }
    if (p.mode === 'match_letter') {
      const keys = Object.keys(isObj(key.map) ? key.map : {})
      if (keys.length > 1 || (keys.length === 1 && keys[0] !== p.label.trim())) lost.push('key.map')
      if (isObj(key.cells)) lost.push('key.cells')
    }
  }
  // The save writes `kbat` from the cognitive level; a stored `kbat` that contradicts it is lost. (`kbat: 'bukan'` alone is read as
  // "level unset, author chooses" by design.)
  if (isSet(p.kbat) && isCognitive(p.cognitiveLevel)) {
    const written = isKbat(p.cognitiveLevel) ? p.cognitiveLevel : 'bukan'
    if (p.kbat !== written) lost.push('kbat')
  }
  return [...new Set(lost)]
}

/**
 * Body of "Edit sebagai draf": `PUT /api/questions/:id` is a patch (only the four required fields are mandatory), so the stored
 * question is sent back as it was read: its own `parts` verbatim (never rebuilt from the editor model) and nothing else. Every
 * other field (tag, TP, chapter, kertas, number, language, explanation, pictures, group) is omitted and so kept by the server,
 * which writes version n+1 as a draft equal to the live one.
 */
export function editAsDraftBody(q: WireQuestion): Json {
  return {
    subjectId: q.subjectId ?? '',
    educationLevelId: q.educationLevelId ?? '',
    difficultyLevel: q.difficultyLevel,
    questionText: q.questionText,
    ...(q.parts === undefined ? {} : { parts: q.parts }),
  }
}

/** Builds the form state from the admin read. A question the editor cannot hold faithfully is read-only (`unsupported`). */
export function hydrate(q: WireQuestion): Hydrated {
  const unsupported: string[] = []
  const leaves: LeafDraft[] = []
  for (const raw of q.parts ?? []) {
    const p = raw as WirePart
    if (Array.isArray(p.children)) {
      unsupported.push(`Bahagian (${p.label}) mempunyai sub-bahagian bersarang.`)
      continue
    }
    const lost = lossOf(p)
    if (lost.length > 0) {
      unsupported.push(`Bahagian (${p.label}) mempunyai tetapan yang belum boleh disunting di Studio (${lost.join(', ')}).`)
      continue
    }
    const mode = LEAF_MODES.find((m) => m.value === p.mode)?.value
    if (mode === undefined || (!isObj(p.key) && !SCHEME_MODES.includes(mode))) {
      unsupported.push(`Bahagian (${p.label}) berjenis ${p.mode ?? '?'} yang belum boleh disunting di Studio.`)
      continue
    }
    const leaf = blankLeaf(p.label, mode)
    leaf.prompt = p.prompt.ms
    leaf.promptEn = isSet(p.prompt.en) ? (p.prompt.en as string) : null
    leaf.marks = p.marks ?? 1
    leaf.stimulusId = isSet(p.stimulusId) ? (p.stimulusId as string) : null
    leaf.tp = typeof p.difficultyTp === 'number' ? p.difficultyTp : null
    // `kbat: 'bukan'` alone cannot tell Mengingat from Memahami: left unset so the author chooses.
    leaf.cognitive = isCognitive(p.cognitiveLevel) ? p.cognitiveLevel : isCognitive(p.kbat) ? p.kbat : null
    leaf.extra = Object.fromEntries(Object.entries(p).filter(([k, v]) => !LEAF_KEYS.has(k) && v !== undefined))
    leaf.keyBase = isObj(p.key) ? p.key : null
    const cfg: Json = isObj(p.modeConfig) ? { ...p.modeConfig } : {}
    if (isObj(cfg.example) && typeof cfg.example.answer === 'string') {
      leaf.exampleAnswer = cfg.example.answer
      delete cfg.example
    }
    const key = leaf.keyBase
    if (mode === 'mcq') {
      leaf.options = (p.options ?? []).map((o) => ({ label: o.label, text: o.body.ms === o.label ? '' : o.body.ms, ...(isSet(o.body.en) ? { textEn: o.body.en } : {}), imageToken: o.imageId ?? null }))
      if (key?.kind === 'options') {
        leaf.multi = true
        leaf.correctMulti = Array.isArray(key.correctOptionIds) ? key.correctOptionIds.map(String) : []
      } else {
        leaf.correct = typeof key?.correct === 'string' ? key.correct : ''
        leaf.acceptedOptions = Array.isArray(key?.accepted) ? key.accepted.map(String) : []
      }
      leaf.keyNote = typeof key?.note === 'string' ? key.note : ''
      if (cfg.multi === true) delete cfg.multi
    } else if (mode === 'match_letter') {
      const map = isObj(key?.map) ? key.map : {}
      leaf.bankLetter = str(Object.values(map)[0])
      leaf.bankUnique = key?.bankUnique === true
    } else if (mode === 'short_text') {
      leaf.accepted = ((key?.values ?? []) as string[]).join('\n')
    } else if (mode === 'numeric') {
      const v = (key?.values as Json[])[0] as Json
      leaf.numeric = { value: String(v.v), tolerance: str(v.tol), unit: typeof v.unit === 'string' ? v.unit : '' }
    } else if (mode === 'working') {
      leaf.points = pointsOf(key)
      leaf.final = finalOf(key)
    } else {
      if (isObj(cfg.wordRange)) {
        leaf.words = { min: str(cfg.wordRange.min), max: str(cfg.wordRange.max) }
        delete cfg.wordRange
      }
      if (cfg.hardLimit === true) {
        leaf.hardLimit = true
        delete cfg.hardLimit
      }
      if (cfg.answerSpace === 'short' || cfg.answerSpace === 'medium' || cfg.answerSpace === 'long') {
        leaf.answerSpace = cfg.answerSpace
        delete cfg.answerSpace
      }
      if (mode === 'essay_choice') {
        const alts = Array.isArray(cfg.alternatives) ? (cfg.alternatives as Json[]) : []
        leaf.alternatives = (p.topics ?? []).map((t, i) => {
          const a = alts.find((x) => x.id === t.id) ?? alts[i] ?? {}
          const pr = isObj(a.prompt) ? a.prompt : {}
          return { id: t.id, title: t.label, prompt: typeof pr.ms === 'string' ? pr.ms : '', promptEn: typeof pr.en === 'string' ? pr.en : null, stimulusId: typeof a.stimulusId === 'string' ? a.stimulusId : null }
        })
        delete cfg.alternatives
      }
    }
    leaf.modeConfigRest = cfg
    leaves.push(leaf)
  }
  // A save writes the question TP as the highest leaf TP. Parts without any TP inherit the stored question TP (kept as `inheritedTp`);
  // a stored TP that the parts' own TPs do not give would be reset, so that stays refused.
  const leafTp = questionTp(leaves)
  const storedTp = typeof q.tag?.tp === 'number' ? q.tag.tp : null
  if (unsupported.length === 0 && isSet(q.tag?.tp) && leafTp !== null && q.tag?.tp !== leafTp) {
    unsupported.push('TP soalan tidak sepadan dengan TP bahagian, jadi tidak boleh disimpan semula di Studio.')
  }
  const draft: StudioDraft = {
    subjectId: q.subjectId ?? '',
    educationLevelId: q.educationLevelId ?? '',
    kertas: q.kertas === '1' || q.kertas === '2' || q.kertas === '3' ? q.kertas : '',
    numberLabel: q.numberLabel ?? '',
    stem: q.questionText,
    stemImageToken: q.questionImage,
    chapterId: q.curriculumChapterId ?? '',
    difficulty: q.difficultyLevel,
    unitId: q.tag?.unitId ?? null,
    spIds: q.tag?.spIds ?? [],
    groupId: q.stimulusGroup?.id ?? null,
    leaves: leaves.length === 0 && unsupported.length === 0 ? [blankLeaf('a')] : leaves,
    explanation: q.explanation ?? '',
    explanationEn: q.explanationEn ?? null,
    scriptType: q.scriptType ?? 'rumi',
    ...(leafTp === null && storedTp !== null ? { inheritedTp: storedTp } : {}),
  }
  return { draft, unsupported }
}
