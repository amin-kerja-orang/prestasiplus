import { Logger } from '@nestjs/common'

import type { AiFetch, AiResolver } from '../ai.types'
import { checkProviderUrl, UnsafeUrlError } from '../net/safe-url'
import { ProviderAttemptError } from './provider-errors'

export interface JsonPostRequest {
  url: string
  /** Lower-case host names or `*.suffix` patterns this request may go to. */
  allowlist: readonly string[]
  headers: Record<string, string>
  body: unknown
  signal: AbortSignal
}

const TRANSIENT_STATUS = new Set([408, 425, 429])

/** Seconds (or an HTTP date) of a `Retry-After` header as milliseconds, capped at one minute; undefined when absent. */
function retryAfterMs(res: Response): number | undefined {
  const ms = res.headers.get('retry-after-ms')
  if (ms && /^\d{1,7}$/.test(ms)) return Math.min(Number(ms), 60_000)
  const raw = res.headers.get('retry-after')
  if (!raw) return undefined
  if (/^\d{1,5}$/.test(raw)) return Math.min(Number(raw) * 1000, 60_000)
  const at = Date.parse(raw)
  return Number.isNaN(at) ? undefined : Math.min(Math.max(0, at - Date.now()), 60_000)
}

/** Only a short lower-case token of a provider error object is ever logged, never its message. */
function errorToken(json: unknown): string | undefined {
  const err = (json as { error?: { type?: unknown; code?: unknown; status?: unknown } } | null)?.error
  const candidate = [err?.type, err?.code, err?.status].find((v) => typeof v === 'string')
  return typeof candidate === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(candidate) ? candidate : undefined
}

/**
 * One JSON POST to a provider. Everything that can go wrong with the URL or the answer is decided here:
 *  - the SSRF check runs immediately before the call (https, allow-listed host, every resolved address public);
 *  - redirects are never followed (`redirect: 'manual'`; a 3xx answer is a failure and is not requested again);
 *  - 429 and 5xx (and network errors) are transient, other 4xx are fatal;
 *  - the provider's reply body is parsed but never logged or put in an error. The log line has the provider id,
 *    the status number and, at most, a short error token.
 */
export class ProviderHttp {
  private readonly logger = new Logger('AiProviderHttp')

  constructor(
    private readonly fetchImpl: AiFetch,
    private readonly resolver: AiResolver,
    private readonly providerId: string,
  ) {}

  async postJson(req: JsonPostRequest): Promise<{ status: number; json: unknown }> {
    let checked
    try {
      checked = await checkProviderUrl(req.url, { allowlist: req.allowlist, resolver: this.resolver })
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        this.logger.warn(`provider=${this.providerId} url refused (${err.reason})`)
        throw new ProviderAttemptError(err.reason === 'unresolvable' ? 'transient' : 'fatal')
      }
      throw err
    }
    let res: Response
    try {
      res = await this.fetchImpl(checked.url.toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', ...req.headers },
        body: JSON.stringify(req.body),
        signal: req.signal,
        redirect: 'manual',
        pinnedAddresses: checked.addresses,
      })
    } catch (err) {
      if (req.signal.aborted) throw err instanceof ProviderAttemptError ? err : new ProviderAttemptError('timeout')
      // A network failure: transient. The underlying error is dropped (it may name the host or echo a header).
      this.logger.warn(`provider=${this.providerId} network error`)
      throw new ProviderAttemptError('transient')
    }
    if (res.status >= 300 && res.status < 400) {
      // A redirect could point at an internal address; it is never followed.
      this.logger.warn(`provider=${this.providerId} redirect refused status=${String(res.status)}`)
      throw new ProviderAttemptError('fatal', res.status)
    }
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    if (res.status >= 200 && res.status < 300) return { status: res.status, json }
    const token = errorToken(json)
    this.logger.warn(`provider=${this.providerId} status=${String(res.status)}${token ? ` error=${token}` : ''}`)
    const transient = res.status >= 500 || TRANSIENT_STATUS.has(res.status)
    throw new ProviderAttemptError(transient ? 'transient' : 'fatal', res.status, retryAfterMs(res))
  }
}
