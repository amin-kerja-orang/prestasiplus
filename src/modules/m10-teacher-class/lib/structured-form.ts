/**
 * Pure logic of the teacher structured-question form (R1-GUR-44b, S6-T17): copy, option lists, the
 * validation of the field table (client side, the same BM texts as the API's 422), the request body
 * of API-GUR-17 (structured variant) and the total marks.
 *
 * The DSKP rule (D112) is a minimal mirror of the S6-T06 rule: Bab is required only where the Subjek +
 * Tingkatan has chapters, SP, TP and Aras only where it has DSKP nodes. S6-T06 owns the shared rule on
 * its own branch; dedupe both once it is merged.
 */

export const MAX_PARTS = 10
export const MIN_MARKS = 1
export const MAX_MARKS = 20
export const STIMULUS_MAX = 4000
export const PART_TEXT_MAX = 2000
export const SCHEME_MAX = 2000
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Exact BM copy of the R1-GUR-44b field table and the API contract (`GURU_STRUCTURED_MESSAGES`, `GURU_QUESTION_MESSAGES`). */
export const STRUCTURED_COPY = {
  level: 'Sila pilih tingkatan.',
  subject: 'Sila pilih subjek.',
  chapter: 'Sila pilih bab.',
  sp: 'Sila pilih Standard Pembelajaran (SP).',
  tp: 'Sila pilih TP.',
  tpRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  cognitive: 'Sila pilih aras pemikiran.',
  difficulty: 'Sila pilih kesukaran.',
  stimulusLong: 'Rangsangan tidak boleh melebihi 4000 aksara.',
  imageType: 'Fail mesti berupa imej (jpg, png atau webp).',
  imageSize: 'Saiz imej tidak boleh melebihi 2 MB.',
  partText: 'Sila isi teks sub-soalan.',
  partTextLong: 'Teks sub-soalan tidak boleh melebihi 2000 aksara.',
  marks: 'Markah mesti antara 1 dan 20.',
  scheme: 'Sila isi skema jawapan.',
  schemeLong: 'Skema jawapan tidak boleh melebihi 2000 aksara.',
  partsMin: 'Sekurang-kurangnya satu sub-soalan diperlukan.',
  partsMax: 'Bilangan sub-soalan mesti antara 1 dan 10.',
  submitted: 'Soalan berstruktur dihantar untuk semakan.',
  /** Placeholder / hint texts of 44-F1. */
  noChapters: 'Tiada bab untuk subjek dan tingkatan ini.',
} as const

/** Texts that are not in the PRD or the contract (UNVERIFIED COPY): flashes and fallbacks. */
export const STRUCTURED_EXTRA_COPY = {
  updated: 'Soalan berstruktur dikemas kini.',
  saveFailed: 'Gagal menghantar soalan berstruktur. Sila cuba lagi.',
  loadFailed: 'Gagal memuatkan data. Sila cuba lagi.',
  retry: 'Cuba Semula',
} as const

export const COGNITIVE_LEVELS = [
  { value: 'mengingat', label: 'Mengingat' },
  { value: 'memahami', label: 'Memahami' },
  { value: 'mengaplikasi', label: 'Mengaplikasi' },
  { value: 'menganalisis', label: 'Menganalisis' },
  { value: 'menilai', label: 'Menilai' },
  { value: 'mencipta', label: 'Mencipta' },
] as const
export type CognitiveLevel = (typeof COGNITIVE_LEVELS)[number]['value']

/** OPT-KESUKARAN. */
export const DIFFICULTY_OPTIONS = [
  { value: '1', label: 'Sangat Mudah' },
  { value: '2', label: 'Mudah' },
  { value: '3', label: 'Sederhana' },
  { value: '4', label: 'Sukar' },
  { value: '5', label: 'Sangat Sukar' },
] as const

/** OPT-TP: "1" to "6". */
export const TP_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))

export interface PartValues {
  /** Stable key for the v-for (a removed row must not reuse another row's inputs). */
  key: number
  text: string
  /** Typed text (a number input hands a number over); parsed on validate. */
  marks: string | number
  scheme: string
  cognitiveLevel: '' | CognitiveLevel
}

export interface StructuredFormValues {
  levelId: string
  subjectId: string
  chapterId: string
  spId: string
  tp: string
  cognitiveLevel: '' | CognitiveLevel
  difficulty: string
  stimulus: string
  parts: PartValues[]
}

let partKey = 0
export function emptyPart(cognitiveLevel: '' | CognitiveLevel = ''): PartValues {
  partKey += 1
  return { key: partKey, text: '', marks: '', scheme: '', cognitiveLevel }
}

export function emptyValues(): StructuredFormValues {
  return {
    levelId: '',
    subjectId: '',
    chapterId: '',
    spId: '',
    tp: '',
    cognitiveLevel: '',
    difficulty: '',
    stimulus: '',
    parts: [emptyPart()],
  }
}

/** The request body of `POST /api/guru/intake/structured` and `PUT .../:id` (strict JSON, no total marks). */
export interface StructuredSubmitBody {
  subjectId: string
  educationLevelId: string
  chapterId?: string | null
  spIds?: string[] | null
  tp?: number | null
  cognitiveLevel?: CognitiveLevel | null
  difficultyLevel: number
  stimulus?: string | null
  stimulusImageId?: string | null
  parts: {
    text: string
    marks: number
    scheme: string
    cognitiveLevel?: CognitiveLevel | null
  }[]
}

/** What exists for the chosen Subjek + Tingkatan (D112): decided by the lookups the form loaded. */
export interface DskpFacts {
  hasChapters: boolean
  hasDskpNodes: boolean
}

/** A typed marks text as an integer, or `null` when it is not a whole number. */
export function parseMarks(text: string | number | null | undefined): number | null {
  const t = String(text ?? '').trim()
  return /^-?\d+$/.test(t) ? Number(t) : null
}

/** "Jumlah markah: {n}" = the sum of the valid part marks. */
export function totalMarks(parts: readonly Pick<PartValues, 'marks'>[]): number {
  return parts.reduce((sum, p) => {
    const m = parseMarks(p.marks)
    return sum + (m !== null && m >= MIN_MARKS && m <= MAX_MARKS ? m : 0)
  }, 0)
}

export const totalMarksText = (parts: readonly Pick<PartValues, 'marks'>[]): string =>
  `Jumlah markah: ${String(totalMarks(parts))}`

/** The image rule of the field table; `null` when the file is acceptable. */
export function imageError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return STRUCTURED_COPY.imageType
  if (file.size > IMAGE_MAX_BYTES) return STRUCTURED_COPY.imageSize
  return null
}

/**
 * Field errors keyed like the API's 422 `fields` (`subjectId`, `parts.0.marks`, ...). Empty = valid.
 * A removed last part is refused by the form itself (`canRemovePart`), but a hand-built empty list still
 * reports `parts`.
 */
export function validate(
  v: StructuredFormValues,
  facts: DskpFacts,
  image: Pick<File, 'type' | 'size'> | null,
): Record<string, string> {
  const e: Record<string, string> = {}
  if (v.levelId === '') e.educationLevelId = STRUCTURED_COPY.level
  if (v.subjectId === '') e.subjectId = STRUCTURED_COPY.subject
  if (facts.hasChapters && v.chapterId === '') e.chapterId = STRUCTURED_COPY.chapter
  if (facts.hasDskpNodes) {
    if (v.spId === '') e.spIds = STRUCTURED_COPY.sp
    if (v.tp === '') e.tp = STRUCTURED_COPY.tp
    if (v.cognitiveLevel === '') e.cognitiveLevel = STRUCTURED_COPY.cognitive
  }
  if (v.tp !== '') {
    const tp = parseMarks(v.tp)
    if (tp === null || tp < 1 || tp > 6) e.tp = STRUCTURED_COPY.tpRange
  }
  if (v.difficulty === '') e.difficultyLevel = STRUCTURED_COPY.difficulty
  if (v.stimulus.length > STIMULUS_MAX) e.stimulus = STRUCTURED_COPY.stimulusLong
  if (image) {
    const message = imageError(image)
    if (message) e.stimulusImage = message
  }
  if (v.parts.length < 1) e.parts = STRUCTURED_COPY.partsMin
  else if (v.parts.length > MAX_PARTS) e.parts = STRUCTURED_COPY.partsMax
  v.parts.forEach((p, i) => {
    const at = (k: string) => `parts.${String(i)}.${k}`
    if (p.text.trim() === '') e[at('text')] = STRUCTURED_COPY.partText
    else if (p.text.length > PART_TEXT_MAX) e[at('text')] = STRUCTURED_COPY.partTextLong
    const marks = parseMarks(p.marks)
    if (marks === null || marks < MIN_MARKS || marks > MAX_MARKS)
      e[at('marks')] = STRUCTURED_COPY.marks
    if (p.scheme.trim() === '') e[at('scheme')] = STRUCTURED_COPY.scheme
    else if (p.scheme.length > SCHEME_MAX) e[at('scheme')] = STRUCTURED_COPY.schemeLong
  })
  return e
}

/** Kesukaran default (44-F1): min(5, TP) once a TP is chosen and until the teacher touches it. */
export const defaultDifficulty = (tp: string): string => {
  const n = parseMarks(tp)
  return n !== null && n >= 1 ? String(Math.min(5, n)) : ''
}

/** The body of the API call. `stimulusImageId` is the token of the earlier image upload. */
export function buildBody(
  v: StructuredFormValues,
  stimulusImageId: string | null,
): StructuredSubmitBody {
  const tp = parseMarks(v.tp)
  const stimulus = v.stimulus.trim()
  return {
    subjectId: v.subjectId,
    educationLevelId: v.levelId,
    ...(v.chapterId !== '' ? { chapterId: v.chapterId } : {}),
    ...(v.spId !== '' ? { spIds: [v.spId] } : {}),
    ...(tp !== null ? { tp } : {}),
    ...(v.cognitiveLevel !== '' ? { cognitiveLevel: v.cognitiveLevel } : {}),
    difficultyLevel: Number(v.difficulty),
    ...(stimulus !== '' ? { stimulus } : {}),
    ...(stimulusImageId ? { stimulusImageId } : {}),
    parts: v.parts.map((p) => ({
      text: p.text.trim(),
      marks: Number(String(p.marks).trim()),
      scheme: p.scheme.trim(),
      ...(p.cognitiveLevel !== '' ? { cognitiveLevel: p.cognitiveLevel } : {}),
    })),
  }
}

/**
 * The field of the form a 422 key belongs to (`parts.2.marks` stays itself; `stimulusImageId` shows
 * under the image control).
 */
export const fieldKeyOf = (key: string): string =>
  key === 'stimulusImageId' ? 'stimulusImage' : key

/** Part "Buang" is refused at one part (the part stays and the PRD message shows). */
export const canRemovePart = (count: number): boolean => count > 1
export const canAddPart = (count: number): boolean => count < MAX_PARTS

/** The saved submission as the edit form shows it (API-GUR-26 detail `form` + stimulus + parts). */
export interface SavedSubmission {
  stimulus: string
  subQuestions: {
    questionText: string
    marks: number
    cognitiveLevel: CognitiveLevel | null
    modelAnswer: string
  }[]
  form: {
    subjectId: number | string
    educationLevelId: number | string
    chapterId: number | string | null
    spIds: (number | string)[]
    tp: number | null
    cognitiveLevel: CognitiveLevel | null
    difficultyLevel: number
  }
}

export function valuesFromSaved(s: SavedSubmission): StructuredFormValues {
  const f = s.form
  return {
    levelId: String(f.educationLevelId),
    subjectId: String(f.subjectId),
    chapterId: f.chapterId === null ? '' : String(f.chapterId),
    spId: f.spIds[0] === undefined ? '' : String(f.spIds[0]),
    tp: f.tp === null ? '' : String(f.tp),
    cognitiveLevel: f.cognitiveLevel ?? '',
    difficulty: String(f.difficultyLevel),
    stimulus: s.stimulus,
    parts: s.subQuestions.map((p) => ({
      ...emptyPart(p.cognitiveLevel ?? ''),
      text: p.questionText,
      marks: String(p.marks),
      scheme: p.modelAnswer,
    })),
  }
}
