/**
 * "Tambah Soalan" form values, validation and the API-GUR-18 request body (44-F1; FR-GUR-44-9, FR-GUR-44-11). MCQ only:
 * four options A to D and one correct answer. Pure, so it is unit tested.
 */
import type { CreateQuestionRequest, ScriptType } from '../../api/types'
import { parseTp, validateDskp, type DskpContext, type DskpField } from './dskp-rule'

export interface QuestionFormValues {
  levelId: string
  subjectId: string
  chapterId: string
  /** The single SP of the select (sent as a one-element `spIds`). */
  spId: string
  tp: string
  cognitiveLevel: string
  /** Kesukaran 1 to 5 as text; '' = not chosen. */
  difficulty: string
  scriptType: ScriptType
  questionText: string
  options: string[]
  /** MCQ correct option index; `null` = none preselected on create. */
  correct: number | null
  explanation: string
}

export function emptyValues(): QuestionFormValues {
  return {
    levelId: '',
    subjectId: '',
    chapterId: '',
    spId: '',
    tp: '',
    cognitiveLevel: '',
    difficulty: '',
    scriptType: 'rumi',
    questionText: '',
    options: ['', '', '', ''],
    correct: null,
    explanation: '',
  }
}

/** The API-GUR-18 body; only the DSKP fields that were chosen are sent. */
export function buildBody(v: QuestionFormValues): CreateQuestionRequest {
  const body: CreateQuestionRequest = {
    educationLevelId: Number(v.levelId),
    subjectId: Number(v.subjectId),
    questionType: 'mcq',
    difficultyLevel: Number(v.difficulty),
    questionText: v.questionText,
    scriptType: v.scriptType,
    options: [...v.options],
    correctAnswer: v.correct ?? 0,
  }
  if (v.explanation.trim() !== '') body.explanation = v.explanation
  if (v.chapterId !== '') body.chapterId = Number(v.chapterId)
  if (v.spId !== '') body.spIds = [Number(v.spId)]
  const tp = parseTp(v.tp)
  if (tp !== null) body.tp = tp
  if (v.cognitiveLevel !== '') body.cognitiveLevel = v.cognitiveLevel
  return body
}

/** Texts of the 44-F1 field errors outside the DSKP rule. */
export const FORM_MESSAGES = {
  level: 'Sila pilih tingkatan.',
  subject: 'Sila pilih subjek.',
  difficulty: 'Sila pilih kesukaran.',
  text: 'Sila isi soalan.',
  textLong: 'Soalan tidak boleh melebihi 2000 aksara.',
  option: (letter: string): string => `Sila isi pilihan ${letter}.`,
  optionLong: (letter: string): string => `Pilihan ${letter} tidak boleh melebihi 500 aksara.`,
  correct: 'Sila tanda satu jawapan yang betul.',
  explanationLong: 'Penerangan tidak boleh melebihi 2000 aksara.',
} as const

/** Wire field names of the errors (the keys of the server `fields`). */
export type FormField =
  | 'educationLevelId'
  | 'subjectId'
  | DskpField
  | 'difficultyLevel'
  | 'questionText'
  | 'options'
  | 'correctAnswer'
  | 'explanation'

const len = (text: string): number => [...text].length
const LETTERS = ['A', 'B', 'C', 'D'] as const

/** Field errors of the whole form, in form order (`{}` = valid). The first error of the options is shown under them. */
export function validateForm(
  v: QuestionFormValues,
  ctx: DskpContext,
): Partial<Record<FormField, string>> {
  const e: Partial<Record<FormField, string>> = {}
  if (v.levelId === '') e.educationLevelId = FORM_MESSAGES.level
  if (v.subjectId === '') e.subjectId = FORM_MESSAGES.subject
  Object.assign(
    e,
    validateDskp(
      {
        chapterId: v.chapterId,
        spIds: v.spId === '' ? [] : [v.spId],
        tp: v.tp,
        cognitiveLevel: v.cognitiveLevel,
      },
      ctx,
    ),
  )
  if (v.difficulty === '') e.difficultyLevel = FORM_MESSAGES.difficulty
  const text = v.questionText.trim()
  if (text === '') e.questionText = FORM_MESSAGES.text
  else if (len(text) > 2000) e.questionText = FORM_MESSAGES.textLong
  for (const [i, letter] of LETTERS.entries()) {
    const option = (v.options[i] ?? '').trim()
    if (option === '') {
      e.options ??= FORM_MESSAGES.option(letter)
    } else if (len(option) > 500) e.options ??= FORM_MESSAGES.optionLong(letter)
  }
  if (v.correct === null) e.correctAnswer = FORM_MESSAGES.correct
  if (len(v.explanation) > 2000) e.explanation = FORM_MESSAGES.explanationLong
  return e
}
