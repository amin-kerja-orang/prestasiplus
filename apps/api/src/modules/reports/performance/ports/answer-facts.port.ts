/**
 * The shared cross-mode reader over the single answer store `practice_answers` (S10-T01, decided D-A / D115).
 * The real adapter lives in `modules/practice/reads/answer-facts.adapter.ts` and is bound from
 * `PracticeReadsModule.onModuleInit` through `PerformancePorts.provideAnswerFacts`. It reads only
 * `practice_answers`, never returns `is_test` rows (the port has no parameter to ask for them), is set-based
 * (a fixed number of statements, no per-pupil loop) and is the only place the pooled accuracy sum
 * (correct / answered, XS-5) is made.
 */
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

/** Grain: user, subject, question, chapter, topic, mode. An id the row does not carry reads '0' (subject, question). */
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
  spInfo(ids: { topicIds: readonly string[]; chapterIds: readonly string[] }): Promise<SpInfo[]>
}

export const ANSWER_FACTS_PORT = Symbol('ANSWER_FACTS_PORT')

/** Default until the practice adapter is registered: nothing answered. */
export class EmptyAnswerFacts implements AnswerFactsPort {
  async answerFacts(): Promise<AnswerFactRow[]> {
    return []
  }
  async weeklyFacts(): Promise<WeeklyFactRow[]> {
    return []
  }
  async spInfo(): Promise<SpInfo[]> {
    return []
  }
}
