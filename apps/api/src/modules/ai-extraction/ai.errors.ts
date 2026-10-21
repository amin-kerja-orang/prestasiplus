import { AI_MESSAGES, type AiFailureCode } from '@pp/contract'

export interface AiErrorOptions {
  message?: string
  /** True when the same call may be tried again later (rate limit, transient provider failure). */
  retryable?: boolean
  /** Seconds, on RATE_LIMITED only. */
  retryAfter?: number
  /** Provider attempts made before giving up. */
  attempts?: number
  /** HTTP status of the last provider answer (a number only, never a body). */
  providerStatus?: number
}

/**
 * Every failure of an AI call. `message` is safe by construction: BM copy from the contract, never the key, the prompt,
 * the page text or a provider reply (AC3, AC9). It never carries a `cause`, because an underlying network error may
 * name a host or echo a header.
 */
export class AiError extends Error {
  readonly code: AiFailureCode
  readonly retryable: boolean
  readonly retryAfter: number | undefined
  readonly attempts: number | undefined
  readonly providerStatus: number | undefined

  constructor(code: AiFailureCode, opts: AiErrorOptions = {}) {
    super(opts.message ?? AI_MESSAGES.unavailable)
    this.name = 'AiError'
    this.code = code
    this.retryable = opts.retryable ?? false
    this.retryAfter = opts.retryAfter
    this.attempts = opts.attempts
    this.providerStatus = opts.providerStatus
  }

  /** The selected provider has no key, model or valid base URL (prototype copy "Dikonfigurasi di pelayan"). */
  static notConfigured(): AiError {
    return new AiError('AI_UNAVAILABLE', { message: AI_MESSAGES.notConfigured })
  }

  /** Monthly cap reached (AC6). The caller may queue the work and retry after the cap is raised or next month. */
  static budgetExhausted(): AiError {
    return new AiError('AI_BUDGET_EXHAUSTED', { message: AI_MESSAGES.budgetExhausted, retryable: true })
  }

  static rateLimited(retryAfter: number): AiError {
    return new AiError('RATE_LIMITED', { message: 'Terlalu banyak percubaan. Sila cuba sebentar lagi.', retryable: true, retryAfter })
  }

  /** The provider failed after the retries, or answered something this service cannot use. */
  static provider(opts: { retryable: boolean; attempts: number; providerStatus?: number }): AiError {
    return new AiError('AI_PROVIDER_ERROR', { message: AI_MESSAGES.unavailable, ...opts })
  }

  static timeout(attempts: number): AiError {
    return new AiError('AI_TIMEOUT', { message: AI_MESSAGES.unavailable, retryable: true, attempts })
  }
}

/** The caller aborted (job cancelled or timed out). Not a provider failure and never retried by this service. */
export class AiCancelledError extends Error {
  constructor() {
    super('The AI call was cancelled.')
    this.name = 'AbortError'
  }
}
