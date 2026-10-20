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

/**
 * 409 `CONFLICT` (generic contract code, `details.reason = 'IDEMPOTENCY_MISMATCH'`). A credit or debit reuses an
 * idempotency key `(userId, source, sourceId)` that already holds a DIFFERENT movement (another type, amount or
 * token count): a same-input retry is a replay, a different request is a caller bug and is never swallowed.
 * Nothing is written.
 */
export function idempotencyConflict(): ApiError {
  return ApiError.of('CONFLICT', { message: 'This movement key was already used for a different movement.', details: { reason: 'IDEMPOTENCY_MISMATCH' } })
}

/** 409 `CONFLICT` (`details.reason = 'SESSION_OWNER_MISMATCH'`): the session was credited to another user. Never returns that user's data. */
export function sessionCreditOwnerConflict(): ApiError {
  return ApiError.of('CONFLICT', { message: 'This session was already credited to another user.', details: { reason: 'SESSION_OWNER_MISMATCH' } })
}

/** 422 `VALIDATION_ERROR` (`details.reason = AMOUNT_CEILING`): one call above `MAX_AMOUNT_PER_CALL`. Nothing is written. */
export function amountCeiling(): ApiError {
  return ApiError.of('VALIDATION_ERROR', { message: 'The amount is too large for one movement.', details: { reason: 'AMOUNT_CEILING' } })
}

/** 409 `CONFLICT` (`details.reason = BALANCE_LIMIT`): the balance, lifetime total, XP or token balance would pass the integer range. Nothing is written. */
export function balanceLimit(): ApiError {
  return ApiError.of('CONFLICT', { message: 'The balance limit would be exceeded.', details: { reason: 'BALANCE_LIMIT' } })
}
