/**
 * The Studio question draft (R1-F03b, V2 flow 1 step 2): the form state, how complete it is ("· n belum lengkap"), and the
 * request body of `POST/PUT /api/questions`. The part tree is the v2 wire model: leaves carry marks, a mode, a key, and here
 * the DSKP tags `difficultyTp` (TP) and `kbat` (Aras pemikiran). Pure, no I/O.
 */
import { DIFFICULTY_LABELS } from '../question-list'
import { dskpItems, isCognitive, isKbat, leafName, questionTp, type CognitiveValue } from './dskp-tags'

export type LeafMode = 'mcq' | 'short_text' | 'numeric'
export const LEAF_MODES: readonly { value: LeafMode; label: string }[] = [
  { value: 'mcq', label: 'Aneka pilihan' },
  { value: 'short_text', label: 'Jawapan pendek' },
  { value: 'numeric', label: 'Nombor' },
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
  return { ...leaf, mode, options: mode === 'mcq' ? blankOptions() : [], correct: '', accepted: '', numeric: { value: '', tolerance: '', unit: '' } }
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
    if (l.prompt.trim() === '') gaps.push({ ...leaf, message: `${name} belum ada arahan.` })
    if (l.mode === 'mcq') {
      if (l.options.some((o) => o.text.trim() === '' && o.imageToken === null)) gaps.push({ ...leaf, message: `${name} ada pilihan kosong.` })
      if (!l.options.some((o) => o.label === l.correct)) gaps.push({ ...leaf, message: `${name} mempunyai 0 pilihan betul — mesti tepat 1.` })
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

/** Everything on a stored leaf that `leafToPart` would not write back (so a save would drop it). Empty = lossless. */
function lossOf(p: WirePart): string[] {
  const lost: string[] = []
  for (const k of Object.keys(p)) if (!LEAF_KEYS.has(k) && isSet((p as unknown as Record<string, unknown>)[k])) lost.push(k)
  if (isSet(p.prompt?.en)) lost.push('prompt.en')
  for (const o of p.options ?? []) if (isSet(o.body?.en) || Object.keys(o).some((k) => !['label', 'body', 'imageId'].includes(k))) lost.push('options')
  const key = p.key
  if (key) {
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
    } else {
      unsupported.push(`Bahagian (${p.label}) berjenis ${p.mode ?? '?'} yang belum boleh disunting di Studio.`)
      continue
    }
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
