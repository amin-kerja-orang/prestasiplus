/**
 * Http-mode id handling (ids are opaque strings on the wire, ADR-0018 item 6). Mock mode is unchanged.
 */
import { isHttpMode } from '@/api/mode'

/** An id for a request body: a string in http mode, as sent in mock mode otherwise. */
export function wireId<T extends number | string | null | undefined>(v: T): T | string {
  return isHttpMode() && typeof v === 'number' ? String(v) : v
}

/** Id fields of a body that the contract types as strings; applied in http mode only. */
export function wireIds<T extends object>(body: T, keys: readonly (keyof T)[]): T {
  if (!isHttpMode()) return body
  const out: Record<string, unknown> = { ...body }
  for (const k of keys) {
    const v = out[k as string]
    if (typeof v === 'number') out[k as string] = String(v)
    else if (Array.isArray(v)) out[k as string] = v.map((x) => (typeof x === 'number' ? String(x) : x))
  }
  return out as T
}

/** The queue id of a start answer: a decimal string in http mode becomes the number the page keeps. */
export function queueIdOf(v: unknown): number | null {
  if (typeof v === 'number') return v > 0 ? v : null
  if (isHttpMode() && typeof v === 'string' && /^\d+$/.test(v)) {
    const n = Number(v)
    return n > 0 ? n : null
  }
  return null
}

/** Equality of two ids that may be a number (session user) or a string (http body). */
export function sameId(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
}
