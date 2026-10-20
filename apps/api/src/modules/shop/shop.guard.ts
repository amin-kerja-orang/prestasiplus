import { ApiError } from '../../common/errors/api-error'
import { isOverloadError } from '../auth/auth.errors'

/** A Postgres deadlock (40P01) or serialisation failure (40001, Prisma P2034). */
function isLockConflict(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; message?: unknown; cause?: unknown }
  if (e.code === 'P2034' || e.code === '40P01' || e.code === '40001') return true
  if (typeof e.message === 'string' && /deadlock detected|could not serialize access/i.test(e.message)) return true
  return e.cause !== undefined && e.cause !== err && isLockConflict(e.cause)
}

/**
 * An overloaded database, a deadlock or a serialisation failure is a retryable 429, never a raw 500. The transaction
 * has already rolled back, so a retry starts clean.
 */
export async function retryable<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isOverloadError(err) || isLockConflict(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
    throw err
  }
}
