/**
 * S2 create / S4 edit form helpers (M04-T4; FR-M04-17..36, 48..52). Pure functions: the form values,
 * their fill from a saved question, the API body and the server-error mapping.
 */

import { isApiError } from '@/api'

import type { QuestionDetail, QuestionInputBody, QuestionType } from '../api/questions'
import { GENERIC_ERROR } from './ui-errors'

export const QUESTION_TYPE_OPTIONS: readonly { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Objektif (MCQ)' },
  { value: 'true_false', label: 'Betul / Salah' },
  { value: 'short_answer', label: 'Jawapan Pendek' },
  { value: 'fill_blank', label: 'Isi Tempat Kosong' },
  { value: 'essay', label: 'Esei / Subjektif' },
]

/** The Kertas select (an empty choice means none). */
export const KERTAS_OPTIONS = [
  { value: '1', label: 'Kertas 1' },
  { value: '2', label: 'Kertas 2' },
  { value: '3', label: 'Kertas 3' },
] as const

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

/** The values of the S2 / S4 form (strings as the inputs hold them). */
export interface QuestionFormValues {
  subjectId: string
  educationLevelId: string
  difficulty: string
  questionType: QuestionType
  questionText: string
  questionImage: File | null
  removeQuestionImage: boolean
  options: string[]
  optionImages: (File | null)[]
  removeOptionImage: boolean[]
  correctAnswer: string
  tfAnswer: '' | 'true' | 'false'
  correctAnswerText: string
  altAnswers: string
  modelAnswer: string
  explanation: string
  language: 'bm' | 'en'
  pointsValue: string
  /** '' = none, else '1' | '2' | '3' (Kertas, v2). */
  kertas: '' | '1' | '2' | '3'
  /** Bab: '' = none, else the chapter id. */
  curriculumChapterId: string
}

export function emptyValues(): QuestionFormValues {
  return {
    subjectId: '',
    educationLevelId: '',
    difficulty: '',
    questionType: 'mcq',
    questionText: '',
    questionImage: null,
    removeQuestionImage: false,
    options: ['', '', '', ''],
    optionImages: [null, null, null, null],
    removeOptionImage: [false, false, false, false],
    correctAnswer: '0',
    tfAnswer: '',
    correctAnswerText: '',
    altAnswers: '',
    modelAnswer: '',
    explanation: '',
    language: 'bm',
    pointsValue: '1',
    kertas: '',
    curriculumChapterId: '',
  }
}

const idText = (id: number | null): string => (id === null ? '' : String(id))

/** S4 pre-fill from the saved question (FN-M04-1.7.2..1.7.9). */
export function valuesFromQuestion(q: QuestionDetail): QuestionFormValues {
  const base = emptyValues()
  return {
    ...base,
    subjectId: idText(q.subjectId),
    educationLevelId: idText(q.educationLevelId),
    difficulty: String(q.difficultyLevel),
    questionType: q.questionType,
    questionText: q.questionText,
    options: base.options.map((_, i) => q.options?.[i] ?? ''),
    correctAnswer: String(q.correctAnswer ?? 0),
    tfAnswer: q.tfAnswer === null ? '' : q.tfAnswer ? 'true' : 'false',
    correctAnswerText: q.correctAnswerText ?? '',
    altAnswers: q.altAnswers.join(', '),
    modelAnswer: q.modelAnswer ?? '',
    explanation: q.explanation ?? '',
    language: q.language,
    pointsValue: String(q.pointsValue),
    kertas: q.kertas ?? '',
    curriculumChapterId: idText(q.curriculumChapterId),
  }
}

/**
 * The body of #3 / #5. Create posts every field (hidden answer cards keep their values and all are
 * posted, as live; the server keeps the chosen type's, BR-M04-08). Edit posts the whole form of the saved
 * type, with `dskpSpId` always present (`''` = "Buang tag DSKP", DV-M04-15).
 */
export function buildBody(
  v: QuestionFormValues,
  dskpSpId: string,
  mode: 'create' | 'edit',
): QuestionInputBody {
  const body: QuestionInputBody = {
    subjectId: v.subjectId,
    educationLevelId: v.educationLevelId,
    difficultyLevel: v.difficulty,
    questionText: v.questionText,
    dskpSpId,
    // Create sends a chapter only when one is chosen; edit always sends it ('' clears).
    ...(mode === 'edit' || v.curriculumChapterId !== '' ? { curriculumChapterId: v.curriculumChapterId } : {}),
    questionImage: v.questionImage,
    explanation: v.explanation,
    language: v.language,
    pointsValue: v.pointsValue,
  }
  if (mode === 'create') {
    body.questionType = v.questionType
    if (v.kertas !== '') body.kertas = v.kertas
  } else {
    // Edit: always sent; '' clears it (http mode sends null; the mock ignores the key).
    body.kertas = v.kertas
    if (v.removeQuestionImage) body.removeQuestionImage = true
  }

  const all = mode === 'create'
  if (all || v.questionType === 'mcq') {
    body.options = v.options
    body.optionImages = v.optionImages
    body.correctAnswer = v.correctAnswer
    if (!all) body.removeOptionImage = v.removeOptionImage
  }
  if (all || v.questionType === 'true_false') {
    body.tfAnswer = v.tfAnswer === '' ? null : v.tfAnswer === 'true'
  }
  if (all || v.questionType === 'short_answer' || v.questionType === 'fill_blank') {
    body.correctAnswerText = v.correctAnswerText
    body.altAnswers = v.altAnswers
  }
  if (all || v.questionType === 'essay') body.modelAnswer = v.modelAnswer
  return body
}

/** Where a server field key is shown: the keys of #3 / #5 `fields`. */
export const FIELD_KEYS = [
  'subjectId',
  'educationLevelId',
  'difficultyLevel',
  'questionType',
  'questionText',
  'questionImage',
  'options',
  'correctAnswer',
  'tfAnswer',
  'correctAnswerText',
  'pointsValue',
  'language',
  'dskpSpId',
  'curriculumChapterId',
  'kertas',
] as const

const isKnownKey = (key: string): boolean =>
  (FIELD_KEYS as readonly string[]).includes(key) || /^optionImages\.\d$/.test(key)

export interface FormErrors {
  /** Messages by field key, shown under the field (SRS §5, §8.2). */
  fields: Record<string, string>
  /** Everything else: a failed call, or a message for a field the form does not show. */
  general: string[]
}

export function formErrors(err: unknown): FormErrors {
  if (!isApiError(err) || err.status === 0 || err.code === 'NETWORK_ERROR') {
    return { fields: {}, general: [GENERIC_ERROR] }
  }
  const fields: Record<string, string> = {}
  const general: string[] = []
  for (const [key, message] of Object.entries(err.fields ?? {})) {
    if (isKnownKey(key)) fields[key] = message
    else general.push(message)
  }
  if (Object.keys(fields).length === 0 && general.length === 0) {
    general.push(err.message === '' || /^HTTP \d+$/.test(err.message) ? GENERIC_ERROR : err.message)
  }
  return { fields, general: [...new Set(general)] }
}
