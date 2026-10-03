/**
 * Start-error handling of the SPM quiz pages Q1/Q2 (SRS M06 FR-M06-20, 33, 87; BR-M06-13).
 *
 * `QuizRunner` alerts and goes back for any start failure it does not know. M06 needs two quieter
 * outcomes, so the pages give the runner a `QuizApi` whose `start` reports them and then never
 * settles (the page unmounts the runner):
 * - 422 with no matching question (M05 `NOT_ENOUGH_QUESTIONS`, SRS name `NO_QUESTIONS`) → the §8 message
 *   with a link back to S4 (PROPOSED COPY);
 * - 422 for the single-question form (`targetQuestionId`, SRS `QUESTION_NOT_ELIGIBLE`) → back to S4 with
 *   no message (INFERRED, L-3).
 */

import { ApiError } from '@/api'
import {
  checkAnswer,
  startSession,
  submitSession,
  type QuizApi,
  type StartSessionRequest,
} from '@/modules/m05-practice'

export type SpmStartOutcome = 'no-questions' | 'invalid-target'

/** Which quiet outcome a failed start is, or `null` when the runner's own handling applies. */
export function classifyStartError(err: unknown): SpmStartOutcome | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  if (err.code === 'NOT_ENOUGH_QUESTIONS' || err.code === 'NO_QUESTIONS') return 'no-questions'
  if (err.code === 'QUESTION_NOT_ELIGIBLE' || err.fields?.targetQuestionId !== undefined) {
    return 'invalid-target'
  }
  return null
}

/** A `QuizApi` (M05 client) whose `start` reports the quiet outcomes through `onOutcome`. */
export function createSpmQuizApi(onOutcome: (outcome: SpmStartOutcome) => void): QuizApi {
  return {
    async start(body: StartSessionRequest) {
      try {
        return await startSession(body)
      } catch (err) {
        const outcome = classifyStartError(err)
        if (outcome === null) throw err
        onOutcome(outcome)
        return new Promise<never>(() => undefined)
      }
    },
    check: checkAnswer,
    submit: submitSession,
  }
}
