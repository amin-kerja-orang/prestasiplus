/**
 * Internal failure of one provider attempt. These never leave the module: the call pipeline turns them into an `AiError`
 * after the retries. They carry no message that depends on the provider's reply, only a status number.
 */
export class ProviderAttemptError extends Error {
  constructor(
    readonly kind: 'transient' | 'fatal' | 'timeout',
    readonly status?: number,
    readonly retryAfterMs?: number,
    /** Set when the provider answered 2xx (so the call was billed) but the reply was unusable. */
    readonly billed?: { tokensIn: number; tokensOut: number },
  ) {
    super(`Provider attempt failed (${kind}${status ? ` ${String(status)}` : ''}).`)
    this.name = 'ProviderAttemptError'
  }

  get retryable(): boolean {
    return this.kind !== 'fatal'
  }
}
