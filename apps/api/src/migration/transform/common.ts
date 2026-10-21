/**
 * Shared helpers of the BE-28 transforms (pure functions, no I/O). A staged row is a record of
 * text values (`staging_cloud` is read with every column cast to text).
 */
import type { RejectReason } from '../kit/types'

export type Staged = Readonly<Record<string, string | null | undefined>>

/** The outcome of a transform: values for the target, or a reason-coded reject (never the row's values). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; reject: RejectSpec }

export interface RejectSpec {
  reason: RejectReason
  /** The source / v2 column that caused it. */
  column: string
  /** The offending ENUM code (see `Rejects`: stored raw only when it looks like a code). */
  enumValue?: string
  allowedCodes?: readonly string[]
}

export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value })
export const reject = <T = never>(reason: RejectReason, column: string, extra: Partial<RejectSpec> = {}): Outcome<T> => ({
  ok: false,
  reject: { reason, column, ...extra },
})

/** Deterministic stand-in for a missing `created_at` / `updated_at` of a NOT NULL target column. */
export const FALLBACK_TS = '1970-01-01T00:00:00Z'

/** Trimmed text; blank becomes null. */
export function text(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const t = value.trim()
  return t === '' ? null : t
}

/** Whitespace runs collapsed to one space, then trimmed; blank becomes null. */
export function squash(value: string | null | undefined): string | null {
  const t = text(value)
  return t === null ? null : t.replace(/\s+/g, ' ')
}

const TRUE_WORDS = new Set(['1', 'true', 't', 'yes', 'y', 'ya'])
const FALSE_WORDS = new Set(['0', 'false', 'f', 'no', 'n', 'tidak'])

/** A MySQL flag column staged as text. `null` / blank gives `fallback`; any other word is `invalid`. */
export function flag(value: string | null | undefined, fallback: boolean): boolean | 'invalid' {
  const t = text(value)
  if (t === null) return fallback
  const k = t.toLowerCase()
  if (TRUE_WORDS.has(k)) return true
  if (FALSE_WORDS.has(k)) return false
  return 'invalid'
}

/** A non-negative integer given as text; blank is `null`, anything else is `invalid`. */
export function integer(value: string | null | undefined): number | null | 'invalid' {
  const t = text(value)
  if (t === null) return null
  if (!/^-?\d{1,9}$/.test(t)) return 'invalid'
  return Number(t)
}

/** An enum word as the maps expect it: lower-case, spaces and dashes folded to `_`. */
export function enumKey(value: string | null | undefined): string | null {
  const t = text(value)
  return t === null ? null : t.toLowerCase().replace(/[\s-]+/g, '_')
}

/** The first four-digit year in a text such as `2026` or `2026/2027`, or null. */
export function firstYear(value: string | null | undefined): number | null {
  const m = /\b(\d{4})\b/.exec(value ?? '')
  return m ? Number(m[1]) : null
}

/** `a:b` legacy ids of pivot tables (plan 14.2: composite keys joined with `:` in column order). */
export const pairId = (a: string | null | undefined, b: string | null | undefined): string => `${a ?? 'x'}:${b ?? 'x'}`

/** created_at / updated_at of a staged row (updated falls back to created, then to the fixed stamp). */
export function stamps(row: Staged): { created_at: string; updated_at: string } {
  const created = text(row.created_at) ?? FALLBACK_TS
  return { created_at: created, updated_at: text(row.updated_at) ?? created }
}
