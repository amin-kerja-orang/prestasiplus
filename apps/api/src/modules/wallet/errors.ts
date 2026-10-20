import { ApiError } from '../../common/errors/api-error'
import { INSUFFICIENT_SYILING, INSUFFICIENT_TOKENS } from './wallet.constants'

/**
 * 409 `INSUFFICIENT_BALANCE` (contract `WALLET_ERRORS`, mock `M14Error`). Raised by a debit that would take a
 * balance below zero; nothing is written. The message tells syiling from tokens.
 */
export function insufficientBalance(kind: 'syiling' | 'token'): ApiError {
  return new ApiError({
    code: 'INSUFFICIENT_BALANCE',
    status: 409,
    message: kind === 'syiling' ? INSUFFICIENT_SYILING : INSUFFICIENT_TOKENS,
  })
}
