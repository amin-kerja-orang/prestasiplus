import { REWARD_ERRORS, REWARD_MESSAGES, type RewardErrorCode } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { MOD_PELAJAR_REFUSAL } from './shop.constants'

/** A module 409 of the contract table (`REWARD_ERRORS`): exact status and BM text. */
export function rewardError(code: Exclude<RewardErrorCode, 'CONFLICT'>): ApiError {
  const e = REWARD_ERRORS[code]
  return new ApiError({ code, status: e.status, message: e.messages[0] })
}

/** 409 `CONFLICT` with the queue copy (deliver or cancel of a row that is not `pending_admin`). */
export const notPending = (): ApiError => new ApiError({ code: 'CONFLICT', status: 409, message: REWARD_ERRORS.CONFLICT.messages[0] })

export const rewardNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: REWARD_MESSAGES.rewardNotFound })
export const redemptionNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: REWARD_MESSAGES.redemptionNotFound })
export const boxNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: REWARD_MESSAGES.boxNotFound })
/** The default "Not Found." of an unmatched id (admin GET/PUT/deliver, a non-numeric path id). */
export const plainNotFound = (): ApiError => ApiError.of('NOT_FOUND')

export const modPelajarRefused = (): ApiError => ApiError.of('FORBIDDEN', { message: MOD_PELAJAR_REFUSAL })

/** 422 with the mock's Laravel-style summary: the first message plus " (and N more error(s))". */
export function validation(fields: Record<string, string>): ApiError {
  const messages = Object.values(fields)
  const [first] = messages
  const more = messages.length - 1
  const message = first === undefined ? undefined : more <= 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
  return ApiError.of('VALIDATION_ERROR', { ...(message ? { message } : {}), fields })
}
