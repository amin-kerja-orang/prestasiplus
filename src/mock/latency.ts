/**
 * Mock latency (overview §6.4, §6.13 `setLatency(ms, pathPattern?)`; NFR-M01-02).
 *
 * - The global default comes from `VITE_MOCK_LATENCY_MS` (400 ms), so loading labels are visible.
 * - `set(ms, pattern)` adds a per-path rule (M04's 300 ms default, M06's walkthrough latency). The
 *   most recently set matching rule wins; `set(ms)` without a pattern changes the global value.
 * - The wait is abortable: an aborted request rejects with the signal's reason and never reaches
 *   the handler, so it has no side effects.
 */

import type { HttpMethod } from '@/api/transport'

import { compilePathPattern, type PathMatcher, type PathPattern } from './server/path-pattern'

/** Default when `VITE_MOCK_LATENCY_MS` is missing or invalid. */
export const DEFAULT_LATENCY_MS = 400

export function latencyFromEnv(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_LATENCY_MS
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LATENCY_MS
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>

/** The error an aborted request rejects with: the signal's reason, or an `AbortError`. */
export function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason
  return reason instanceof Error
    ? reason
    : new DOMException('The operation was aborted.', 'AbortError')
}

/** `setTimeout`-based wait that rejects with the abort reason. */
export const defaultSleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortReason(signal as AbortSignal))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })

export interface LatencyRule {
  pattern: PathPattern
  ms: number
}

export interface LatencyControl {
  /** Global latency (no pattern) or a per-path rule. */
  set(ms: number, pattern?: PathPattern): void
  /** Removes the rule for `pattern`, or every per-path rule when omitted. */
  clear(pattern?: PathPattern): void
  /** The latency that applies to a request. */
  for(method: HttpMethod, path: string): number
  readonly globalMs: number
  rules(): readonly LatencyRule[]
  /** Waits `for(method, path)` ms. */
  wait(method: HttpMethod, path: string, signal?: AbortSignal): Promise<void>
}

function checkMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`latency: invalid ms ${String(ms)}`)
  return ms
}

function sameKey(a: PathPattern, b: PathPattern): boolean {
  return String(a) === String(b) && typeof a === typeof b
}

export function createLatency(options: { defaultMs?: number; sleep?: Sleep } = {}): LatencyControl {
  let globalMs = checkMs(options.defaultMs ?? DEFAULT_LATENCY_MS)
  const sleep = options.sleep ?? defaultSleep
  let rules: { rule: LatencyRule; matcher: PathMatcher }[] = []

  const control: LatencyControl = {
    set(ms, pattern) {
      checkMs(ms)
      if (pattern === undefined) {
        globalMs = ms
        return
      }
      const matcher = compilePathPattern(pattern)
      rules = rules.filter((r) => !sameKey(r.rule.pattern, pattern))
      rules.push({ rule: { pattern, ms }, matcher })
    },
    clear(pattern) {
      rules = pattern === undefined ? [] : rules.filter((r) => !sameKey(r.rule.pattern, pattern))
    },
    for(method, path) {
      for (let i = rules.length - 1; i >= 0; i--) {
        const r = rules[i] as (typeof rules)[number]
        if (r.matcher.test(method, path)) return r.rule.ms
      }
      return globalMs
    },
    get globalMs() {
      return globalMs
    },
    rules: () => rules.map((r) => r.rule),
    async wait(method, path, signal) {
      const ms = control.for(method, path)
      if (signal?.aborted) throw abortReason(signal)
      if (ms > 0) await sleep(ms, signal)
    },
  }
  return control
}
