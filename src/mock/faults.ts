/**
 * Fault injection (overview §6.13): `failNext(pathPattern, spec)` makes the **next** matching
 * request fail instead of reaching its handler (so it has no side effects). Forms of `spec`:
 *
 * | Spec | Response |
 * |---|---|
 * | `500` (a status) | that status with `{error: {code: codeForStatus(status), message}}` |
 * | `'CONFLICT'` (a known code) | the code's status (`STATUS_FOR_CODE`) and body |
 * | `'network'` | no response: the transport rejects with `TransportNetworkError` (client `NETWORK_ERROR`) |
 * | `{status, body}` | exactly that status and body (e.g. a live-shaped body) |
 * | `{status, code?, message?, fields?, retryAfter?}` | an error envelope with those values |
 *
 * `networkErrorNext(pattern)` is an alias for `failNext(pattern, 'network')`. Faults queue: each
 * one is consumed by the first request that matches it, in the order they were added.
 */

import { codeForStatus, type ApiErrorCode } from '@/api/errors'
import type { HttpMethod } from '@/api/transport'

import { cloneBody, DEFAULT_ERROR_MESSAGES, fail, raw, STATUS_FOR_CODE } from './server/respond'
import { compilePathPattern, type PathMatcher, type PathPattern } from './server/path-pattern'
import type { MockResponse } from './server/types'

export type FaultSpec =
  | number
  | ApiErrorCode
  | 'network'
  | { status: number; body: unknown; headers?: Record<string, string> }
  | {
      status: number
      code?: ApiErrorCode
      message?: string
      fields?: Record<string, string>
      retryAfter?: number
    }

export type FaultOutcome = { kind: 'network' } | { kind: 'response'; response: MockResponse }

export interface FaultControl {
  failNext(pattern: PathPattern, spec: FaultSpec): void
  networkErrorNext(pattern: PathPattern): void
  /** Consumes and returns the first queued fault that matches, or `null`. */
  take(method: HttpMethod, path: string): FaultOutcome | null
  pending(): number
  clear(): void
}

function defaultMessage(code: string): string {
  return (
    (DEFAULT_ERROR_MESSAGES as Record<string, string>)[code] ?? DEFAULT_ERROR_MESSAGES.SERVER_ERROR
  )
}

function errorResponse(
  status: number,
  code?: ApiErrorCode,
  message?: string,
  fields?: Record<string, string>,
  retryAfter?: number,
): MockResponse {
  const c = code ?? codeForStatus(status)
  return fail(
    status,
    c,
    message ?? defaultMessage(c),
    fields,
    retryAfter === undefined ? {} : { retryAfter },
  )
}

/** Turns a spec into its outcome; throws for specs that cannot be honoured (typos). */
export function resolveFaultSpec(spec: FaultSpec): FaultOutcome {
  if (spec === 'network') return { kind: 'network' }
  if (typeof spec === 'number') return { kind: 'response', response: errorResponse(spec) }
  if (typeof spec === 'string') {
    const status = STATUS_FOR_CODE[spec]
    if (status === undefined) {
      throw new Error(
        `failNext: unknown code '${spec}'. Use a status, 'network', or {status, code, message}.`,
      )
    }
    return { kind: 'response', response: errorResponse(status, spec) }
  }
  if (typeof spec === 'object' && spec !== null && typeof spec.status === 'number') {
    if ('body' in spec)
      return { kind: 'response', response: raw(spec.status, cloneBody(spec.body), spec.headers) }
    return {
      kind: 'response',
      response: errorResponse(spec.status, spec.code, spec.message, spec.fields, spec.retryAfter),
    }
  }
  throw new Error(`failNext: invalid spec ${JSON.stringify(spec)}`)
}

export function createFaults(): FaultControl {
  let queue: { matcher: PathMatcher; outcome: FaultOutcome }[] = []

  const control: FaultControl = {
    failNext(pattern, spec) {
      // Resolve now so that a bad spec fails in the test that set it, not in a later request.
      queue.push({ matcher: compilePathPattern(pattern), outcome: resolveFaultSpec(spec) })
    },
    networkErrorNext: (pattern) => control.failNext(pattern, 'network'),
    take(method, path) {
      const index = queue.findIndex((f) => f.matcher.test(method, path))
      if (index < 0) return null
      const [fault] = queue.splice(index, 1)
      return fault ? fault.outcome : null
    },
    pending: () => queue.length,
    clear() {
      queue = []
    },
  }
  return control
}
