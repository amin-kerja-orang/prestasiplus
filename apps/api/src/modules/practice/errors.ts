import { PRACTICE_ERRORS, PRACTICE_MESSAGES, type PracticeErrorCode } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** Module error with the exact status and BM message of the mock table (contract `PRACTICE_ERRORS`). */
export function practiceError(code: PracticeErrorCode, messageIndex = 0): ApiError {
  const e = PRACTICE_ERRORS[code]
  return new ApiError({ code, status: e.status, message: e.messages[messageIndex] ?? e.messages[0] })
}

export const trialExhausted = (): ApiError => practiceError('TRIAL_EXHAUSTED')
export const chapterLocked = (): ApiError => practiceError('CHAPTER_LOCKED')
export const notEnoughQuestions = (): ApiError => practiceError('NOT_ENOUGH_QUESTIONS')
export const setNotReady = (): ApiError => practiceError('SET_NOT_READY')
export const noWrongQuestions = (): ApiError => practiceError('NO_WRONG_QUESTIONS')
export const missionDone = (): ApiError => practiceError('ALREADY_COMPLETED', 0)
export const remedialDone = (): ApiError => practiceError('ALREADY_COMPLETED', 1)
export const noAttemptsLeft = (): ApiError => practiceError('NO_ATTEMPTS_LEFT')
export const alreadySubmitted = (): ApiError => practiceError('ALREADY_SUBMITTED')

export const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: PRACTICE_MESSAGES.notFound })

/** 422 on one named field, "Nilai tidak sah." (start request). */
export const invalidField = (field: string): ApiError =>
  ApiError.of('VALIDATION_ERROR', {
    message: PRACTICE_MESSAGES.invalidValue,
    fields: { [field]: PRACTICE_MESSAGES.invalidValue },
  })

/** 422 "Jawapan tidak sah." on one named field (check-answer). */
export const invalidAnswer = (field?: string): ApiError =>
  ApiError.of('VALIDATION_ERROR', {
    message: PRACTICE_MESSAGES.invalidAnswer,
    ...(field ? { fields: { [field]: PRACTICE_MESSAGES.invalidAnswer } } : {}),
  })

export const invalidModes = (): ApiError =>
  ApiError.of('VALIDATION_ERROR', {
    message: PRACTICE_MESSAGES.invalidModes,
    fields: { modes: PRACTICE_MESSAGES.invalidModes },
  })

const codeOf = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string'
    ? (e as { code: string }).code
    : undefined

/** True for a Prisma unique violation (P2002), however the driver adapter words it. */
export function isUniqueViolation(e: unknown): boolean {
  return codeOf(e) === 'P2002' || codeOf(e) === '23505'
}
