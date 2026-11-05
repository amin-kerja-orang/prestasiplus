/**
 * The shared cross-mode reader over the single answer store `practice_answers` (S10-T01, decided D-A / D115).
 * The real adapter lives in `modules/practice/reads/answer-facts.adapter.ts` and is bound from
 * `PracticeReadsModule.onModuleInit` through `PerformancePorts.provideAnswerFacts`. It reads only
 * `practice_answers`, never returns `is_test` rows (the port has no parameter to ask for them), is set-based
 * (a fixed number of statements, no per-pupil loop) and is the only place the pooled accuracy sum
 * (correct / answered, XS-5) is made.
 */
import type { QuestionPublicSchema, QuestionStimulusGroupSchema } from '@pp/contract'
import type { z } from 'zod'

type PublicQuestionShape = z.output<typeof QuestionPublicSchema>
type StimulusGroupShape = z.output<typeof QuestionStimulusGroupSchema>

export interface AnswerFactsQuery {
  userIds?: readonly string[]
  schoolIds?: readonly string[]
  classroomId?: string
  subjectId?: string
  levelCode?: 't1' | 't2' | 't3' | 't4' | 't5'
  /** Stored `mode` values; default: all. */
  modes?: readonly string[]
  /** [from, to) on the answer's own time. */
  from?: Date
  to?: Date
}

/**
 * Grain: user, subject, question, chapter, topic, mode. An id the row does not carry reads '0' (subject, question).
 * `firstCorrect` and `firstAnsweredAt` (S10-T03, additive): the first answer of the row's grain by `answered_at`
 * (ties by the stored order) and when it was given, so a caller can find the first attempt of a pupil on a question
 * across several rows (the row with the earliest `firstAnsweredAt`) without a second statement.
 */
export interface AnswerFactRow {
  userId: string
  subjectId: string
  questionId: string
  chapterId: string | null
  topicId: string | null
  mode: string
  attempts: number
  correct: number
  lastAnsweredAt: Date
  firstCorrect: boolean
  firstAnsweredAt: Date
}

export interface WeeklyFactRow {
  userId: string
  /** Monday of the week, YYYY-MM-DD, Asia/Kuala_Lumpur. */
  weekStart: string
  attempts: number
  correct: number
  /** Distinct `session_id`; answers with no session count one session per mode per MYT day. */
  sessions: number
}

/**
 * Distinct sessions over the whole window, never summed from weeks (a session that crosses Monday 00:00 is ONE session).
 * `subjectId` null = the total over all subjects of the pupil; otherwise that subject's own count.
 * Same session rule as `WeeklyFactRow.sessions`; callers pass `modes` to leave the game modes out.
 */
export interface SessionCountRow {
  userId: string
  subjectId: string | null
  sessions: number
}

export interface SpInfo {
  id: string
  kind: 'topic' | 'chapter'
  label: string
  code: string | null
  subjectCode: string
  levelId: string | null
}

export interface AnswerFactsPort {
  answerFacts(query: AnswerFactsQuery): Promise<AnswerFactRow[]>
  weeklyFacts(query: AnswerFactsQuery): Promise<WeeklyFactRow[]>
  /** Added for S10-T01 (not on the card): a distinct count cannot be built from `weeklyFacts` rows. */
  sessionCounts(query: AnswerFactsQuery): Promise<SessionCountRow[]>
  spInfo(ids: { topicIds: readonly string[]; chapterIds: readonly string[] }): Promise<SpInfo[]>
}

export const ANSWER_FACTS_PORT = Symbol('ANSWER_FACTS_PORT')

/**
 * What the pupil's own Analisa Item shows of a question (R1-MUR-6, FR-MUR-6-5/-7/-10), read-only through the S1 questions
 * read contract (`QuestionsRepository.getMany(ids, 'live')` and `groupsByIds`). A question that is archived, inactive or
 * unknown has no entry: it is dropped from the list. `question` is the public projection (no key); the types are those of
 * the contract (`QuestionPublic`, `QuestionStimulusGroup`).
 */
export interface QuestionContent {
  questionId: string
  question: PublicQuestionShape
  explanation: string | null
  /** "Sumber" of the question; '' when the question records none. */
  source: string
  stimulusGroup: StimulusGroupShape | null
}

export interface QuestionContentPort {
  /** Unknown, inactive or archived ids are absent from the map. */
  questionContent(ids: readonly string[]): Promise<Map<string, QuestionContent>>
}

export const QUESTION_CONTENT_PORT = Symbol('QUESTION_CONTENT_PORT')

/** Default until the questions adapter is bound: no content, so no item is listed. */
export class EmptyQuestionContent implements QuestionContentPort {
  async questionContent(): Promise<Map<string, QuestionContent>> {
    return new Map()
  }
}

/** Default until the practice adapter is registered: nothing answered. */
export class EmptyAnswerFacts implements AnswerFactsPort {
  async answerFacts(): Promise<AnswerFactRow[]> {
    return []
  }
  async weeklyFacts(): Promise<WeeklyFactRow[]> {
    return []
  }
  async sessionCounts(): Promise<SessionCountRow[]> {
    return []
  }
  async spInfo(): Promise<SpInfo[]> {
    return []
  }
}
