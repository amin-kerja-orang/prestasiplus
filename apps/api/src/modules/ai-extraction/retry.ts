import { AiCancelledError, AiError } from './ai.errors'
import { ProviderAttemptError } from './providers/provider-errors'
import type { AiSleep } from './ai.types'

export interface RetryPolicy {
  /** Retries after the first attempt (`AI_MAX_RETRIES`); the number of attempts is this plus one. */
  maxRetries: number
  baseMs: number
  maxMs: number
  /** Per attempt. */
  timeoutMs: number
  sleep: AiSleep
  /** 0..1, for the jitter. Injectable so tests are deterministic. */
  random: () => number
  /** The caller's signal (job cancelled or timed out). */
  signal?: AbortSignal | undefined
  /**
   * Called before every attempt (the first and each retry), outside the attempt timeout; it returns the release of what it
   * took (the concurrency slot). Because it is released before the backoff sleep, a waiting retry holds no slot. It may
   * throw an `AiError` (budget): that ends the call at once.
   */
  gate?: () => Promise<() => void>
  /** A 2xx reply that could not be used was still billed: called once per such attempt. */
  onBilled?: (billed: { tokensIn: number; tokensOut: number }) => Promise<void>
}

export interface AttemptOptions {
  signal: AbortSignal
}

/** Backoff before retry number `retry` (1-based): exponential from `baseMs`, never below a provider's `Retry-After`, capped. */
export function backoffMs(retry: number, p: Pick<RetryPolicy, 'baseMs' | 'maxMs' | 'random'>, retryAfterMs?: number): number {
  const exp = Math.min(p.maxMs, p.baseMs * 2 ** (retry - 1))
  const jittered = exp * (0.8 + 0.4 * p.random())
  return Math.min(p.maxMs, Math.max(Math.round(jittered), retryAfterMs ?? 0))
}

/**
 * Runs `attempt` with a per-attempt timeout; retries 429, 5xx, network errors and timeouts with exponential backoff, then
 * fails with a clear code (`AI_PROVIDER_ERROR` or `AI_TIMEOUT`, AC4). A 4xx other than 429, an unusable reply or an unsafe
 * URL fails at once. A caller abort stops everything and is `AiCancelledError`. Returns the result and the attempts made.
 */
export async function withRetry<T>(attempt: (o: AttemptOptions) => Promise<T>, policy: RetryPolicy): Promise<{ value: T; attempts: number }> {
  const total = policy.maxRetries + 1
  let last: ProviderAttemptError | null = null
  for (let n = 1; n <= total; n += 1) {
    if (policy.signal?.aborted) throw new AiCancelledError()
    const release = policy.gate ? await policy.gate() : undefined
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), policy.timeoutMs)
    const signal = policy.signal ? AbortSignal.any([policy.signal, timeout.signal]) : timeout.signal
    try {
      return { value: await attempt({ signal }), attempts: n }
    } catch (err) {
      if (err instanceof ProviderAttemptError && err.billed) await policy.onBilled?.(err.billed)
      if (policy.signal?.aborted) throw new AiCancelledError()
      if (err instanceof ProviderAttemptError) last = err
      else if (err instanceof AiError || err instanceof AiCancelledError) throw err
      else if (timeout.signal.aborted) last = new ProviderAttemptError('timeout')
      // Anything else is a defect in an adapter: fatal, and its message is dropped.
      else last = new ProviderAttemptError('fatal')
      if (!last.retryable || n === total) {
        if (last.kind === 'timeout') throw AiError.timeout(n)
        throw AiError.provider({ retryable: last.retryable, attempts: n, ...(last.status !== undefined ? { providerStatus: last.status } : {}) })
      }
    } finally {
      clearTimeout(timer)
      release?.()
    }
    try {
      await policy.sleep(backoffMs(n, policy, last?.retryAfterMs), policy.signal)
    } catch {
      // The only way a sleep fails is the caller's abort.
      throw new AiCancelledError()
    }
  }
  // Unreachable: the loop returns or throws. Kept so the function is total for the compiler.
  throw AiError.provider({ retryable: false, attempts: total })
}
