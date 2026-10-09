/**
 * Start handling of the Tracking A set quiz Q3 (SRS M06 FR-M06-52, BR-M06-13).
 *
 * M05 #4 refuses a Belum Cukup or unknown set (422 `SET_NOT_READY` / `NOT_ENOUGH_QUESTIONS`, 404). M06
 * then replaces the URL with the set list and creates no session: the runner is given a `QuizApi`
 * whose `start` reports the refusal and never settles (the page navigates away).
 */

import { ApiError } from '@/api'
import {
  checkAnswer,
  startSession,
  submitSession,
  type QuizApi,
  type StartSessionRequest,
} from '@/modules/m05-practice'

/** True when a failed start means "this set cannot be started". */
export function isSetRefusal(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.status === 404) return true
  return err.status === 422 && (err.code === 'SET_NOT_READY' || err.code === 'NOT_ENOUGH_QUESTIONS')
}

export function createTrackingQuizApi(onRefused: () => void): QuizApi {
  return {
    async start(body: StartSessionRequest) {
      try {
        return await startSession(body)
      } catch (err) {
        if (!isSetRefusal(err)) throw err
        onRefused()
        return new Promise<never>(() => undefined)
      }
    },
    check: checkAnswer,
    submit: submitSession,
  }
}
