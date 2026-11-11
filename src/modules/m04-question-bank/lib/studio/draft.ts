/**
 * The Studio question draft (R1-F03b, V2 flow 1 step 2): the form state, how complete it is ("· n belum lengkap"), and the
 * request body of `POST/PUT /api/questions`. The part tree is the v2 wire model: leaves carry marks, a mode, a key, and here
 * the DSKP tags `difficultyTp` (TP) and `kbat` (Aras pemikiran). Pure, no I/O.
 */
import { DIFFICULTY_LABELS } from '../question-list'
import { dskpItems, isCognitive, isKbat, leafName, questionTp, type CognitiveValue } from './dskp-tags'

export type LeafMode = 'mcq' | 'short_text' | 'numeric' | 'essay' | 'working' | 'drawing'
/** The modes whose answer is a marking scheme (`points` key): the loaders give a migrated structured sub-question `working` (1 to 2 marks) or `essay`. */
export const isSchemeMode = (m: LeafMode): boolean => m === 'essay' || m === 'working' || m === 'drawing'
export const LEAF_MODES: readonly { value: LeafMode; label: string }[] = [
  { value: 'mcq', label: 'Aneka pilihan' },
  { value: 'short_text', label: 'Jawapan pendek' },
  { value: 'numeric', label: 'Nombor' },
  { value: 'essay', label: 'Struktur / Esei' },
  { value: 'working', label: 'Langkah kerja' },
  { value: 'drawing', label: 'Lukisan' },
]

export const MIN_OPTIONS = 3
export const MAX_OPTIONS = 8
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const STEM_MIN = 10

export interface OptionDraft {
  label: string
  text: string
  /** Public token of an uploaded option picture. */
  imageToken: string | null
}

/** One mark-scheme point of an `essay` leaf: `text` is what the pupil's answer is marked against. */
export interface PointDraft {
  /** Local key only; never sent. */
  uid: string
  /** The stored point id (`p1`); '' for a point added in the form. */
  id: string
  text: string
  marks: number
}

/**
 * The scheme of an `essay` leaf (a V2 structured sub-question or an essay): `Skema` text and the marking points. `raw` is the stored
 * part as it was read: a save writes the form's values over it, so whatever the form does not show stays as it was (KP-14).
 */
export interface EssayDraft {
  modelText: string
  points: PointDraft[]
  raw: Record<string, unknown> | null
}

export const blankEssay = (): EssayDraft => ({ modelText: '', points: [{ uid: newUid(), id: '', text: '', marks: 1 }], raw: null })

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
  essay: EssayDraft
  /** The branch part this leaf is a child of (a migrated (a)(i)): the branch is kept as stored and written back around its children. */
  group?: BranchRef
}

/** A branch part as it was stored (its own prompt, label, marks and order, and its children); a save writes the edited children into it. */
export interface BranchRef {
  id: string
  raw: Record<string, unknown>
  /** The branch's own text (its `prompt.ms`), editable above its first child; a save writes back only this field of the branch (V2: the parent part has its own Arahan). */
  prompt: string
}

export type Kertas = '' | '1' | '2' | '3' | '4'
/** FR-ADM-QE3.7: `Tahap kesukaran` 1 to 5 (DM-47), the labels of the question list. */
export const KESUKARAN = [1, 2, 3, 4, 5].map((value) => ({ value, label: DIFFICULTY_LABELS[value] ?? String(value) }))

export interface StudioDraft {
  /** Stored question TP of a question whose parts carry no TP (intake-born): the parts inherit it, a save keeps it. */
  inheritedTp?: number | null
  /**
   * A migrated question whose parts the Studio cannot hold (rubric points, marks scheme, nesting): its own parts and TP go back
   * verbatim on save, so the other fields stay editable and savable without losing the scheme (K10). The scheme is edited in Subjektif.
   */
  lockedParts?: { parts: unknown[]; tp: unknown }
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

export function blankLeaf(label = 'a', mode: LeafMode = 'mcq'): LeafDraft {
  return {
    uid: newUid(),
    label,
    mode,
    prompt: '',
    marks: 1,
    tp: null,
    cognitive: null,
    options: mode === 'mcq' ? blankOptions() : [],
    correct: '',
    accepted: '',
    numeric: { value: '', tolerance: '', unit: '' },
    essay: blankEssay(),
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
  // essay, working and drawing share the points key: flipping between them keeps the scheme (and the stored part under it).
  if (isSchemeMode(leaf.mode) && isSchemeMode(mode)) return { ...leaf, mode }
  return { ...leaf, mode, options: mode === 'mcq' ? blankOptions() : [], correct: '', accepted: '', numeric: { value: '', tolerance: '', unit: '' }, essay: blankEssay() }
}

/** Next free option label; null at the maximum. */
export const nextOptionLabel = (options: readonly OptionDraft[]): string | null => (options.length >= MAX_OPTIONS ? null : (OPTION_LABELS[options.length] ?? null))

export function addOption(leaf: LeafDraft): LeafDraft {
  const label = nextOptionLabel(leaf.options)
  return label === null ? leaf : { ...leaf, options: [...leaf.options, { label, text: '', imageToken: null }] }
}

/** Removes an option, closes the letters up again and keeps the correct answer when it still exists. */
export function removeOption(leaf: LeafDraft, index: number): LeafDraft {
  if (leaf.options.length <= MIN_OPTIONS) return leaf
  const removed = leaf.options[index]
  const options = leaf.options.filter((_o, i) => i !== index).map((o, i) => ({ ...o, label: OPTION_LABELS[i] as string }))
  const keptIndex = leaf.options.findIndex((o) => o.label === leaf.correct)
  const correct = removed === undefined || keptIndex < 0 || keptIndex === index ? '' : (OPTION_LABELS[keptIndex > index ? keptIndex - 1 : keptIndex] as string)
  return { ...leaf, options, correct }
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
    if (l.mode === 'mcq') {
      if (l.options.some((o) => o.text.trim() === '' && o.imageToken === null)) gaps.push({ ...leaf, message: `${name} ada pilihan kosong.` })
      if (!l.options.some((o) => o.label === l.correct)) gaps.push({ ...leaf, message: `${name} mempunyai 0 pilihan betul — mesti tepat 1.` })
    } else if (isSchemeMode(l.mode)) {
      const given = l.essay.points.filter((pt) => pt.text.trim() !== '' || pt.id !== '')
      emptiedPoints(l).forEach((i) => gaps.push({ ...leaf, message: `${name}: Poin ${String(i + 1)} tiada teks.` }))
      if (given.length === 0) gaps.push({ ...leaf, message: `${name} tiada poin skema.` })
      else if (given.reduce((n, pt) => n + (Number.isFinite(pt.marks) ? pt.marks : 0), 0) !== Math.trunc(l.marks)) gaps.push({ ...leaf, message: `${name}: jumlah markah poin tidak sama dengan markah bahagian.` })
    } else if (l.mode === 'short_text') {
      if (acceptedValues(l).length === 0) gaps.push({ ...leaf, message: `${name} tiada skema jawapan.` })
    } else if (!Number.isFinite(Number(l.numeric.value)) || l.numeric.value.trim() === '') {
      gaps.push({ ...leaf, message: `${name} tiada skema jawapan.` })
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

type Json = Record<string, unknown>

/** The stored text of a point of this leaf (its stored part), or '' when it has none. */
const storedPointText = (l: LeafDraft, id: string): string => {
  const key = l.essay.raw?.key as { points?: { id?: string; text?: unknown }[] } | undefined
  const old = key?.points?.find((r) => r.id === id)
  return old === undefined ? '' : msOf(old.text).trim()
}

/** Positions of the points whose stored text was emptied in the form (a point that never had text, as a migrated placeholder, is not one). */
export const emptiedPoints = (l: LeafDraft): number[] =>
  l.essay.points.flatMap((pt, i) => (pt.id !== '' && pt.text.trim() === '' && storedPointText(l, pt.id) !== '' ? [i] : []))

/** The part tree of a draft: top-level leaves as they are, and the children of a branch written back into the stored branch. */
function partsOf(leaves: readonly LeafDraft[]): Json[] {
  const out: Json[] = []
  const open = new Map<string, Json[]>()
  for (const l of leaves) {
    const part = leafToPart(l)
    if (l.group === undefined) {
      out.push(part)
      continue
    }
    const children = open.get(l.group.id)
    if (children !== undefined) children.push(part)
    else {
      const fresh = [part]
      open.set(l.group.id, fresh)
      const rawPrompt = typeof l.group.raw.prompt === 'object' && l.group.raw.prompt !== null ? (l.group.raw.prompt as Json) : {}
      // Only a changed text is written, and only its `ms`: the rest of the stored prompt (English text...) stays.
      const prompt = l.group.prompt === msOf(rawPrompt) ? undefined : { ...rawPrompt, ms: l.group.prompt }
      out.push({ ...l.group.raw, ...(prompt === undefined ? {} : { prompt }), children: fresh })
    }
  }
  return out
}

const POINT_LABEL_MAX = 120
const shorten = (v: string): string => ([...v].length <= POINT_LABEL_MAX ? v : [...v].slice(0, POINT_LABEL_MAX).join('').trimEnd())
const msOf = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'object' && v !== null && typeof (v as { ms?: unknown }).ms === 'string' ? (v as { ms: string }).ms : '')

/**
 * The part of an `essay` leaf: the stored part (when there is one) with the form's values written over it, so every field the form
 * does not show (code, label of an untouched point, English text, scheme version) is kept as it was read (KP-14).
 */
function essayToPart(l: LeafDraft, base: Json): Json {
  const raw = l.essay.raw ?? {}
  const rawKey = (raw.key ?? {}) as Json
  const rawPoints = Array.isArray(rawKey.points) ? (rawKey.points as Json[]) : []
  // A removed point's id is never reused: seed from every stored id as well as the ones that survive.
  const used = new Set([...l.essay.points.map((pt) => pt.id), ...rawPoints.map((r) => (typeof r.id === 'string' ? r.id : ''))].filter((id) => id !== ''))
  let n = 0
  const freshId = (): string => {
    do n += 1
    while (used.has(`p${String(n)}`))
    used.add(`p${String(n)}`)
    return `p${String(n)}`
  }
  const points = l.essay.points
    .filter((pt) => pt.text.trim() !== '' || pt.id !== '')
    .map((pt) => {
      const old = rawPoints.find((r) => r.id === pt.id)
      const marks = Math.max(0, Math.trunc(pt.marks))
      if (old === undefined) return { id: freshId(), code: 'P', label: shorten(pt.text.trim()), marks, text: { ms: pt.text.trim() } }
      if (pt.text.trim() === msOf(old.text).trim()) return { ...old, marks }
      return { ...old, marks, label: shorten(pt.text.trim()), text: { ...(typeof old.text === 'object' && old.text !== null ? old.text : {}), ms: pt.text.trim() } }
    })
  const model = l.essay.modelText.trim()
  const rawModel = rawKey.modelText
  const modelText = model === '' ? undefined : typeof rawModel === 'object' && rawModel !== null ? { ...rawModel, ms: model } : model
  // Assigning over the stored key keeps its field order; only the Skema is removed when it was emptied.
  const outKey: Json = { ...rawKey, kind: 'points', marks: Math.max(0, Math.trunc(l.marks)), points }
  if (modelText === undefined) delete outKey.modelText
  else outKey.modelText = modelText
  const rawPrompt = typeof raw.prompt === 'object' && raw.prompt !== null ? (raw.prompt as Json) : {}
  return {
    ...raw,
    ...base,
    prompt: { ...rawPrompt, ms: l.prompt.trim() },
    mode: l.mode,
    key: outKey,
  }
}

function leafToPart(l: LeafDraft): Json {
  const base: Json = {
    label: l.label.trim(),
    prompt: { ms: l.prompt.trim() },
    marks: Math.max(0, Math.trunc(l.marks)),
    ...(l.tp === null ? {} : { difficultyTp: l.tp }),
    ...(l.cognitive === null ? {} : { cognitiveLevel: l.cognitive, kbat: isKbat(l.cognitive) ? l.cognitive : 'bukan' }),
  }
  if (l.mode === 'mcq') {
    return {
      ...base,
      mode: 'mcq',
      options: l.options.map((o) => ({ label: o.label, body: { ms: o.text.trim() === '' ? o.label : o.text.trim() }, ...(o.imageToken === null ? {} : { imageId: o.imageToken }) })),
      key: { kind: 'option', correct: l.correct },
    }
  }
  if (isSchemeMode(l.mode)) return essayToPart(l, base)
  if (l.mode === 'short_text') return { ...base, mode: 'short_text', key: { kind: 'accepted', values: acceptedValues(l) } }
  const tol = l.numeric.tolerance.trim()
  const unit = l.numeric.unit.trim()
  return {
    ...base,
    mode: 'numeric',
    key: { kind: 'accepted', values: [{ v: Number(l.numeric.value), ...(tol === '' ? {} : { tol: Number(tol) }), ...(unit === '' ? {} : { unit }) }] },
  }
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
    parts: d.lockedParts === undefined ? partsOf(d.leaves) : d.lockedParts.parts,
    tag: { unitId: d.unitId, spIds: d.spIds, tp: d.lockedParts === undefined ? draftTp(d) : d.lockedParts.tp },
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

interface WirePart {
  label: string
  prompt: { ms: string; en?: string }
  marks?: number
  mode?: string
  options?: Array<{ label: string; body: { ms: string; en?: string }; imageId?: string | null }>
  key?: {
    kind: string
    correct?: string
    values?: Array<string | { v: number; tol?: number; tolKind?: string; unit?: string; unitAlt?: string[]; sigFigs?: number | null; decimals?: number | null }>
    caseSensitive?: boolean
    anyOrder?: boolean
  }
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
  flags?: readonly string[]
  imageHeld?: boolean
  explanation?: string | null
  explanationEn?: string | null
  scriptType?: ScriptType
}

export interface Hydrated {
  draft: StudioDraft
  /** Reasons the Studio cannot edit this question without losing data (a mode or a nesting it does not offer yet). */
  unsupported: string[]
}

const LEAF_KEYS = new Set(['label', 'prompt', 'marks', 'mode', 'options', 'key', 'difficultyTp', 'cognitiveLevel', 'kbat'])
const isSet = (v: unknown): boolean => v !== undefined && v !== null

const ESSAY_KEY = new Set(['kind', 'marks', 'points', 'modelText'])
const ESSAY_POINT = new Set(['id', 'code', 'label', 'marks', 'text'])
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** What of an `essay` leaf's scheme the form cannot show or keep consistent (grouped points, bonus, alternatives, English text...). */
function essayLoss(key: Record<string, unknown>): string[] {
  const lost: string[] = []
  if (key.kind !== 'points') lost.push('key.kind')
  for (const k of Object.keys(key)) if (!ESSAY_KEY.has(k) && isSet(key[k])) lost.push(`key.${k}`)
  if (isObj(key.modelText) && Object.keys(key.modelText).some((k) => k !== 'ms')) lost.push('key.modelText')
  if (!Array.isArray(key.points) || key.points.length === 0) lost.push('key.points')
  else {
    for (const pt of key.points) {
      if (!isObj(pt) || Object.keys(pt).some((k) => !ESSAY_POINT.has(k) && isSet(pt[k])) || (isSet(pt.text) && (!isObj(pt.text) || Object.keys(pt.text).some((k) => k !== 'ms')))) {
        lost.push('key.points')
        break
      }
    }
  }
  return lost
}

/** Everything on a stored leaf that `leafToPart` would not write back (so a save would drop it). Empty = lossless. */
function lossOf(p: WirePart): string[] {
  const lost: string[] = []
  for (const k of Object.keys(p)) if (!LEAF_KEYS.has(k) && isSet((p as unknown as Record<string, unknown>)[k])) lost.push(k)
  if (isSet(p.prompt?.en)) lost.push('prompt.en')
  for (const o of p.options ?? []) if (isSet(o.body?.en) || Object.keys(o).some((k) => !['label', 'body', 'imageId'].includes(k))) lost.push('options')
  const key = p.key
  if (key && (p.mode === 'essay' || p.mode === 'working' || p.mode === 'drawing')) {
    lost.push(...essayLoss(key))
  } else if (key) {
    for (const k of Object.keys(key)) if (!['kind', 'correct', 'values', 'caseSensitive', 'anyOrder'].includes(k)) lost.push(`key.${k}`)
    if (key.caseSensitive === true) lost.push('key.caseSensitive')
    if (key.anyOrder === true) lost.push('key.anyOrder')
    if (p.mode === 'short_text') {
      const values = key.values ?? []
      if (values.some((v) => typeof v !== 'string' || v !== v.trim() || v.includes('\n'))) lost.push('key.values')
    }
    if (p.mode === 'numeric') {
      const values = key.values ?? []
      if (values.length > 1) lost.push('key.values')
      for (const v of values) {
        if (typeof v !== 'object') continue
        if (isSet(v.tolKind) && v.tolKind !== 'abs') lost.push('key.tolKind')
        if ((v.unitAlt ?? []).length > 0) lost.push('key.unitAlt')
        if (isSet(v.sigFigs)) lost.push('key.sigFigs')
        if (isSet(v.decimals)) lost.push('key.decimals')
      }
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

/**
 * The TP a locked save sends back: the stored value, never null for a value that is stored. A numeric string (a V2 row) is sent as the number;
 * any other stored value is sent as it is, so the server keeps it. Only a TP that is really absent is null.
 */
export function lockedTpOf(raw: unknown): unknown {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim())
  return raw
}

/** Builds the form state from the admin read. A question the editor cannot hold faithfully is read-only (`unsupported`). */
export function hydrate(q: WireQuestion): Hydrated {
  const unsupported: string[] = []
  const leaves: LeafDraft[] = []
  const take = (p: WirePart, group?: BranchRef): void => {
    const lost = lossOf(p)
    if (lost.length > 0) {
      unsupported.push(`Bahagian (${p.label}) mempunyai tetapan khas yang belum boleh disunting di Studio.`)
      return
    }
    const leaf = blankLeaf(p.label)
    leaf.prompt = p.prompt.ms
    leaf.marks = p.marks ?? 1
    leaf.tp = typeof p.difficultyTp === 'number' ? p.difficultyTp : null
    // `kbat: 'bukan'` alone cannot tell Mengingat from Memahami: left unset so the author chooses.
    leaf.cognitive = isCognitive(p.cognitiveLevel) ? p.cognitiveLevel : isCognitive(p.kbat) ? p.kbat : null
    if (p.mode === 'mcq' && p.key?.kind === 'option') {
      leaf.mode = 'mcq'
      leaf.options = (p.options ?? []).map((o) => ({ label: o.label, text: o.body.ms === o.label ? '' : o.body.ms, imageToken: o.imageId ?? null }))
      leaf.correct = p.key.correct ?? ''
    } else if (p.mode === 'short_text' && p.key?.kind === 'accepted') {
      leaf.mode = 'short_text'
      leaf.options = []
      leaf.accepted = (p.key.values ?? []).map((v) => (typeof v === 'string' ? v : String(v.v))).join('\n')
    } else if (p.mode === 'numeric' && p.key?.kind === 'accepted' && typeof p.key.values?.[0] === 'object') {
      const v = p.key.values[0]
      leaf.mode = 'numeric'
      leaf.options = []
      leaf.numeric = { value: String(v.v), tolerance: v.tol === undefined ? '' : String(v.tol), unit: v.unit ?? '' }
    } else if ((p.mode === 'essay' || p.mode === 'working' || p.mode === 'drawing') && p.key?.kind === 'points') {
      const k = p.key as unknown as { marks?: number; points: { id: string; text?: { ms?: string }; marks: number }[]; modelText?: unknown }
      leaf.mode = p.mode
      leaf.options = []
      leaf.essay = {
        modelText: msOf(k.modelText),
        points: k.points.map((pt) => ({ uid: newUid(), id: pt.id, text: pt.text?.ms ?? '', marks: pt.marks })),
        raw: JSON.parse(JSON.stringify(p)) as Record<string, unknown>,
      }
    } else {
      unsupported.push(`Bahagian (${p.label}) berjenis jawapan yang belum boleh disunting di Studio.`)
      return
    }
    if (group !== undefined) leaf.group = group
    leaves.push(leaf)
  }
  // A branch part (a) with leaf children (i), (ii) opens as a group: its children edit like any leaf, the branch itself is kept as stored.
  let branchSeq = 0
  for (const raw of q.parts ?? []) {
    const p = raw as WirePart
    if (!Array.isArray(p.children)) {
      take(p)
      continue
    }
    const kids = p.children as WirePart[]
    if (kids.length === 0 || kids.some((k) => Array.isArray(k.children))) {
      unsupported.push(`Bahagian (${p.label}) mempunyai sub-bahagian bersarang.`)
      continue
    }
    branchSeq += 1
    const ref: BranchRef = { id: `b${String(branchSeq)}`, raw: JSON.parse(JSON.stringify(p)) as Record<string, unknown>, prompt: p.prompt?.ms ?? '' }
    for (const k of kids) take(k, ref)
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
    kertas: q.kertas === '1' || q.kertas === '2' || q.kertas === '3' || q.kertas === '4' ? q.kertas : '',
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
    ...(unsupported.length > 0 ? { lockedParts: { parts: q.parts ?? [], tp: lockedTpOf(q.tag?.tp) } } : {}),
  }
  return { draft, unsupported }
}
