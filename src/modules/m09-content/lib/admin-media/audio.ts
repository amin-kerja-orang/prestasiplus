/**
 * Audio KBAT admin constants and form state (SRS M09 FR-M09-61..71, BR-M09-15, FN-M09-5.1.x/5.2.x).
 * A set is exactly 4 sections (Q1–8, 9–16, 17–24, 25–30) and 30 questions in a fixed order.
 */

import type {
  AudioQuestionInput,
  AudioSectionInput,
  AudioSetInput,
  AudioSetStatus,
} from '../../api/admin-media'

/** The live `accept` of "Fail Audio" (FN-M09-5.2.4). */
export const AUDIO_ACCEPT = '.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*'

export const SECTION_RANGES: readonly { no: number; from: number; to: number }[] = [
  { no: 1, from: 1, to: 8 },
  { no: 2, from: 9, to: 16 },
  { no: 3, from: 17, to: 24 },
  { no: 4, from: 25, to: 30 },
]

export const QUESTION_COUNT = 30

/** "Status" of the filter (all four) and of the create form (no "Archived", BR-M09-15). */
export const FILTER_STATUS_OPTIONS: readonly { value: AudioSetStatus; label: string }[] = [
  { value: 'draft', label: 'Draf' },
  { value: 'pending_review', label: 'Menunggu Semakan' },
  { value: 'approved', label: 'Diluluskan' },
  { value: 'archived', label: 'Diarkibkan' },
]
export const CREATE_STATUS_OPTIONS: readonly {
  value: 'approved' | 'pending_review' | 'draft'
  label: string
}[] = [
  { value: 'approved', label: 'Diluluskan' },
  { value: 'pending_review', label: 'Menunggu Semakan' },
  { value: 'draft', label: 'Draf' },
]

export const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'] as const

/** Subjects sorted A–Z by name (FN-M09-5.1.6, 5.2.3), a copy. */
export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ms'))
}

/** FN-M09-5.1.4 / 5.2.2: the exact guide copy. */
export const LIST_GUIDE = {
  title: 'Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT',
  paragraphs: [
    'Set ini bukan soalan rawak. Cikgu perlu bekalkan satu set lengkap 30 soalan MCQ bersama 4 fail audio mengikut julat tetap: audio 1 untuk soalan 1-8, audio 2 untuk soalan 9-16, audio 3 untuk soalan 17-24 dan audio 4 untuk soalan 25-30.',
    'Jika cikgu mahu bahan yang mudah ditaip, gunakan Templat Word. Jika mahu format paling senang diimport oleh admin, gunakan Templat XLSX. Nama fail audio dalam template mesti sama dengan fail audio yang dihantar.',
  ],
} as const

export const CREATE_GUIDE = {
  title: 'Apa yang cikgu perlu sediakan?',
  paragraphs: [
    'Lengkapkan 30 soalan mengikut turutan asal. Muat naik audio untuk setiap bahagian: soalan 1-8, 9-16, 17-24 dan 25-30. Jangan rawakkan nombor soalan kerana audio dirujuk mengikut julat tetap.',
    'Jika cikgu bekalkan bahan luar talian, Word lebih mudah untuk menulis soalan dan transkrip. XLSX pula lebih kemas untuk import/pemetaan admin.',
  ],
} as const

/** The editable state of one question block (numbers stay text so an empty box is "empty"). */
export interface QuestionState {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  marks: number | string
  kbatLevel: number | string
  dskpSpId: number | string
  explanation: string
}

export interface SectionState {
  title: string
  audio: File | null
  transcript: string
}

export interface AudioSetFormState {
  title: string
  educationLevelId: number | ''
  subjectId: number | ''
  status: 'approved' | 'pending_review' | 'draft'
  sourceLabel: string
  instructions: string
  sections: SectionState[]
  questions: QuestionState[]
}

/** Defaults of FN-M09-5.2.3..5.2.5: "Approved", "Audio n", answer A, marks 1, KBAT level 3. */
export function emptyAudioSetForm(): AudioSetFormState {
  return {
    title: '',
    educationLevelId: '',
    subjectId: '',
    status: 'approved',
    sourceLabel: '',
    instructions: '',
    sections: SECTION_RANGES.map((range) => ({
      title: `Audio ${String(range.no)}`,
      audio: null,
      transcript: '',
    })),
    questions: Array.from({ length: QUESTION_COUNT }, () => ({
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A' as const,
      marks: 1,
      kbatLevel: 3,
      dskpSpId: '',
      explanation: '',
    })),
  }
}

const toInt = (value: number | string, fallback: number): number => {
  const n = value === '' ? fallback : Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

/** The #23 body of a valid (natively validated) form. */
export function audioSetPayload(form: AudioSetFormState): AudioSetInput {
  const sections: AudioSectionInput[] = form.sections.map((s) => ({
    title: s.title,
    ...(s.audio ? { audio: s.audio } : {}),
    ...(s.transcript ? { transcript: s.transcript } : {}),
  }))
  const questions: AudioQuestionInput[] = form.questions.map((q) => ({
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    marks: toInt(q.marks, 1),
    kbatLevel: toInt(q.kbatLevel, 3),
    ...(q.dskpSpId !== '' ? { dskpSpId: toInt(q.dskpSpId, 0) } : {}),
    ...(q.explanation ? { explanation: q.explanation } : {}),
  }))
  return {
    title: form.title,
    educationLevelId: Number(form.educationLevelId),
    subjectId: Number(form.subjectId),
    status: form.status,
    ...(form.sourceLabel ? { sourceLabel: form.sourceLabel } : {}),
    ...(form.instructions ? { instructions: form.instructions } : {}),
    sections,
    questions,
  }
}
