/**
 * S22 form values and the #53 request body (FR-M10-99..105; BR-M10-22). Pure, so it is unit tested.
 */
import type {
  CreateQuestionRequest,
  DifficultyInput,
  QuestionType,
  ScriptType,
} from '../../api/types'

export interface QuestionFormValues {
  levelId: string
  subjectId: string
  chapterId: string
  topicId: string
  questionType: QuestionType
  difficulty: '' | 'easy' | 'medium' | 'hard'
  scriptType: ScriptType
  bidangId: string
  skId: string
  spId: string
  questionText: string
  options: string[]
  /** MCQ correct option index (A preselected, as live). */
  correct: number
  tfAnswer: '' | 'true' | 'false'
  correctAnswerText: string
  altAnswers: string
  modelAnswer: string
  explanation: string
}

export function emptyValues(): QuestionFormValues {
  return {
    levelId: '',
    subjectId: '',
    chapterId: '',
    topicId: '',
    questionType: 'mcq',
    difficulty: '',
    scriptType: 'rumi',
    bidangId: '',
    skId: '',
    spId: '',
    questionText: '',
    options: ['', '', '', ''],
    correct: 0,
    tfAnswer: '',
    correctAnswerText: '',
    altAnswers: '',
    modelAnswer: '',
    explanation: '',
  }
}

const num = (v: string): number | null => (v === '' ? null : Number(v))

/** The #53 body for the chosen type; only the active answer block is sent. */
export function buildBody(v: QuestionFormValues): CreateQuestionRequest {
  const body: CreateQuestionRequest = {
    educationLevelId: Number(v.levelId),
    subjectId: Number(v.subjectId),
    questionType: v.questionType,
    difficultyLevel: v.difficulty as DifficultyInput,
    questionText: v.questionText,
    scriptType: v.scriptType,
    dskpSpId: num(v.spId),
    curriculumChapterId: num(v.chapterId),
    curriculumTopicId: num(v.topicId),
  }
  if (v.explanation.trim() !== '') body.explanation = v.explanation
  if (v.questionType === 'mcq') {
    body.options = [...v.options]
    body.correctAnswer = v.correct
  } else if (v.questionType === 'true_false') {
    if (v.tfAnswer !== '') body.tfAnswer = v.tfAnswer === 'true'
  } else if (v.questionType === 'short_answer' || v.questionType === 'fill_blank') {
    body.correctAnswer = v.correctAnswerText
    if (v.altAnswers.trim() !== '') body.altAnswers = v.altAnswers
  } else if (v.modelAnswer.trim() !== '') {
    body.modelAnswer = v.modelAnswer
  }
  return body
}
