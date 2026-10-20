/**
 * The AI doorway of Cikgu Alesa (M13). The controllers and the service never know which provider answers: they call
 * `CikguAiPort` (DI token `CIKGU_AI`). Swapping the provider is a provider override in the module, with no change to a
 * controller (card BE-43 AC 13).
 *
 * Today only `MockCikguAi` exists (the canned logic of the frontend mock, byte for byte). The real implementation will
 * delegate to BE-36's `generateText` (redaction, rate limit, cost log, budget) once that method has merged; this module
 * adds no vendor SDK, key or HTTP client.
 *
 * PRIVACY (PDPA, minors): no method receives a student's name; the essay text is the only child content that may leave,
 * and a real provider sends it only after BE-36 redaction. Nothing here is ever logged.
 */
import type { CikguRubric } from '@pp/contract'

export const CIKGU_AI = Symbol('CIKGU_AI')

/** Token counts a provider reports. When it reports none, the service uses the mock estimate. */
export interface CikguAiTokens {
  in: number
  out: number
}

export interface CikguAiText {
  text: string
  tokens?: CikguAiTokens
}

export interface CikguChatReplyInput {
  /** The routes that are answered by the model: the general reply and the practice questions. */
  route: 'general' | 'practice'
  /** The trimmed user message. */
  message: string
}

/** The hand-off fields of an essay, WITHOUT the student's name (open question 2 of the card). */
export interface CikguMarkEssayInput {
  rubric: CikguRubric
  subject: string | null
  level: string | null
  title: string | null
  essay: string
}

export interface CikguMarkEssayOutput {
  /** An integer from 0 to `rubric.max`. */
  marks: number
  /** The whole marking reply shown in the chat and stored as the marking comment. */
  reply: string
  tokens?: CikguAiTokens
}

export interface CikguRphPlanInput {
  subjectName: string
  /** `D1`..`D6`, `T1`..`T5`. */
  level: string
  levelLabel: string
  tajuk: string
  className: string | null
  /** `dd/mm/yyyy`. */
  dateLabel: string
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
}

export interface CikguAiPort {
  chatReply(input: CikguChatReplyInput): Promise<CikguAiText>
  markEssay(input: CikguMarkEssayInput): Promise<CikguMarkEssayOutput>
  /** The text of a lesson plan (used by the form and by the chat RPH tool). */
  rphPlan(input: CikguRphPlanInput): Promise<CikguAiText>
}

/**
 * The provider cannot answer now: provider error, timeout, BE-36 rate limit or `AI_BUDGET_EXHAUSTED`. The caller maps it
 * to 503 `AI_UNAVAILABLE`, stores nothing and consumes no quota turn. Carries no content.
 */
export class CikguAiUnavailableError extends Error {
  constructor() {
    super('Cikgu Alesa AI is unavailable.')
    this.name = 'CikguAiUnavailableError'
  }
}
