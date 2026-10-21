import type { Server } from 'node:http'

export interface ServerTimeouts {
  requestTimeout: number
  headersTimeout: number
  keepAliveTimeout: number
  shutdownGraceMs: number
}

export const MIN_TIMEOUT_MS = 1000
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000
export const DEFAULT_HEADERS_TIMEOUT_MS = 60_000
export const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 65_000
export const DEFAULT_SHUTDOWN_GRACE_MS = 25_000

type Raw = Partial<Record<'REQUEST_TIMEOUT_MS' | 'HEADERS_TIMEOUT_MS' | 'KEEP_ALIVE_TIMEOUT_MS' | 'SHUTDOWN_GRACE_MS', unknown>>

function num(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : fallback
}

/** Timeouts from the (validated) env with the defaults. Both have a 1 s floor (0 = off is refused); headersTimeout is clamped to requestTimeout. */
export function resolveServerTimeouts(raw: Raw): ServerTimeouts {
  // 0 would disable slowloris protection: below the 1 s floor falls back to the default.
  const floored = (v: unknown, fallback: number): number => {
    const n = num(v, fallback)
    return n < MIN_TIMEOUT_MS ? fallback : n
  }
  const requestTimeout = floored(raw.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS)
  const headersTimeout = Math.min(floored(raw.HEADERS_TIMEOUT_MS, DEFAULT_HEADERS_TIMEOUT_MS), requestTimeout)
  const shutdownGraceMs = Math.max(1000, num(raw.SHUTDOWN_GRACE_MS, DEFAULT_SHUTDOWN_GRACE_MS))
  return { requestTimeout, headersTimeout, keepAliveTimeout: num(raw.KEEP_ALIVE_TIMEOUT_MS, DEFAULT_KEEP_ALIVE_TIMEOUT_MS), shutdownGraceMs }
}

/** Applies the timeouts to the Node http server (call after `listen`). */
export function applyServerTimeouts(server: Pick<Server, 'requestTimeout' | 'headersTimeout' | 'keepAliveTimeout'>, timeouts: ServerTimeouts): void {
  server.requestTimeout = timeouts.requestTimeout
  server.headersTimeout = timeouts.headersTimeout
  server.keepAliveTimeout = timeouts.keepAliveTimeout
}
