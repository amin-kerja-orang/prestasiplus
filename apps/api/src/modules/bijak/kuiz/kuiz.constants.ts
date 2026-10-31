import { BIJAK_KUIZ_MESSAGES } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import type { RateLimitSpec } from '../../../common/throttle'

/** Rate limits of the Simulasi Kuiz routes (per signed-in user; the environment variables are in .env.api.example). */
export const BIJAK_KUIZ_LIMITS = {
  read: { bucket: 'bijak.kuiz.read', env: 'THROTTLE_BIJAK_KUIZ_READ_PER_MINUTE', default: 240, per: 'user' },
  /** Starting a quiz draws and hydrates up to 40 questions. */
  start: { bucket: 'bijak.kuiz.start', env: 'THROTTLE_BIJAK_KUIZ_START_PER_MINUTE', default: 20, per: 'user' },
  check: { bucket: 'bijak.kuiz.check', env: 'THROTTLE_BIJAK_KUIZ_CHECK_PER_MINUTE', default: 300, per: 'user' },
  finish: { bucket: 'bijak.kuiz.finish', env: 'THROTTLE_BIJAK_KUIZ_FINISH_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** The random draw asks for this many times the wanted count, so a question that cannot be shown does not make the quiz short. */
export const KUIZ_OVER_FETCH = 3

/** V2 empty state: nothing objective to serve. */
export const noQuestions = (): ApiError =>
  new ApiError({ code: 'NO_QUESTIONS', status: 422, message: BIJAK_KUIZ_MESSAGES.noQuestions })

export const quizNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: BIJAK_KUIZ_MESSAGES.notFound })
export const kuizPaperNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: BIJAK_KUIZ_MESSAGES.paperNotFound })

export const alreadyFinished = (): ApiError =>
  new ApiError({ code: 'ALREADY_SUBMITTED', status: 409, message: BIJAK_KUIZ_MESSAGES.alreadyFinished })

export const invalidAnswer = (field: string): ApiError =>
  ApiError.of('VALIDATION_ERROR', { message: BIJAK_KUIZ_MESSAGES.invalidAnswer, fields: { [field]: BIJAK_KUIZ_MESSAGES.invalidAnswer } })

export const invalidValue = (field: string): ApiError =>
  ApiError.of('VALIDATION_ERROR', { message: BIJAK_KUIZ_MESSAGES.invalidValue, fields: { [field]: BIJAK_KUIZ_MESSAGES.invalidValue } })
