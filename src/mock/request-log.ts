/**
 * The request log (overview §6.4, §6.13 `lastRequest(pathPattern)`; M07 E2E): the last N requests
 * with method, path, query and body, recorded **when the request arrives** (before latency), and
 * completed with the outcome when it settles. Faulted and aborted requests are logged too.
 *
 * Bodies are stored as plain JSON-able values: a `FormData` body becomes an object whose files are
 * described as `{name, size, type}`, and a `Blob` body as `{size, type}`. So a test hook can hand
 * them to Playwright unchanged.
 */

import type { HttpMethod } from '@/api/transport'

import { compilePathPattern, type PathPattern } from './server/path-pattern'

export const DEFAULT_REQUEST_LOG_SIZE = 200

export type RequestOutcome = 'pending' | 'response' | 'network-error' | 'aborted'

export interface RequestLogEntry {
  /** 1, 2, 3… per log. */
  seq: number
  /** Mock-clock time (epoch ms) when the request arrived. */
  at: number
  method: HttpMethod
  path: string
  query: Record<string, string | string[]>
  body: unknown
  outcome: RequestOutcome
  /** HTTP status once answered; `null` while pending, for network errors and aborts. */
  status: number | null
  /** `true` when an injected fault answered instead of the handler. */
  faulted: boolean
}

export interface RequestLog {
  record(entry: Pick<RequestLogEntry, 'at' | 'method' | 'path' | 'query' | 'body'>): RequestLogEntry
  /** Newest request whose path matches, or `undefined`. */
  last(pattern?: PathPattern): RequestLogEntry | undefined
  /** Oldest first; filtered when a pattern is given. */
  entries(pattern?: PathPattern): readonly RequestLogEntry[]
  clear(): void
  readonly size: number
}

function describeFile(value: Blob): Record<string, unknown> {
  const out: Record<string, unknown> = { size: value.size, type: value.type }
  if (typeof File !== 'undefined' && value instanceof File) out.name = value.name
  return out
}

/** A JSON-able snapshot of a request body. */
export function snapshotBody(body: unknown): unknown {
  if (body === undefined || body === null) return body ?? null
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of body.entries()) {
      const v = typeof value === 'string' ? value : describeFile(value)
      const prev = out[key]
      out[key] =
        prev === undefined ? v : Array.isArray(prev) ? [...(prev as unknown[]), v] : [prev, v]
    }
    return out
  }
  if (body instanceof Blob) return describeFile(body)
  try {
    return JSON.parse(JSON.stringify(body)) as unknown
  } catch {
    return Object.prototype.toString.call(body)
  }
}

export function createRequestLog(maxSize = DEFAULT_REQUEST_LOG_SIZE): RequestLog {
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new RangeError(`request log: invalid size ${String(maxSize)}`)
  }
  let items: RequestLogEntry[] = []
  let seq = 0

  const filter = (pattern?: PathPattern) => {
    if (pattern === undefined) return items
    const matcher = compilePathPattern(pattern)
    return items.filter((e) => matcher.test(e.method, e.path))
  }

  return {
    record(input) {
      const entry: RequestLogEntry = {
        ...input,
        seq: ++seq,
        outcome: 'pending',
        status: null,
        faulted: false,
      }
      items.push(entry)
      if (items.length > maxSize) items = items.slice(items.length - maxSize)
      return entry
    },
    last(pattern) {
      const list = filter(pattern)
      return list[list.length - 1]
    },
    entries: (pattern) => [...filter(pattern)],
    clear() {
      items = []
    },
    get size() {
      return items.length
    },
  }
}
