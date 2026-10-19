import { ApiError } from '../../common/errors/api-error'
import { isOverloadError, rateLimited } from '../auth/auth.errors'

/** Holds the answer until `floorMs` after `started` (a timer, no CPU), so fast and slow outcomes look alike. */
export async function holdUntil(started: number, floorMs: number): Promise<void> {
  const wait = floorMs - (performance.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

/** An overloaded database is retryable: answer 429 with a short `retryAfter`, never 500. Other errors pass through. */
export async function overloadTo429<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (isOverloadError(err)) throw rateLimited(5)
    throw err
  }
}

/** Client address as the throttles and the audit log see it. */
export function ipOf(req: { ip?: string; socket: { remoteAddress?: string } }): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown'
}
