/**
 * Evaluation of `Where` conditions and `SortSpec`s (overview §6.5). Shared by materialised tables
 * and (for derived-field fallbacks) virtual datasets.
 */

import { MockDbError } from './errors'
import type { SortDirection, SortSpec, Where } from './store'

const CONDITION_KEYS = new Set(['ne', 'gte', 'lte', 'isNull'])

export type ParsedCondition =
  | { kind: 'eq'; value: unknown }
  | { kind: 'in'; values: readonly unknown[] }
  | { kind: 'ne'; value: unknown }
  | { kind: 'range'; gte?: unknown; lte?: unknown }
  | { kind: 'isNull'; isNull: boolean }
  | { kind: 'any' }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

export function parseCondition(field: string, raw: unknown): ParsedCondition {
  if (Array.isArray(raw)) return { kind: 'in', values: raw }
  if (isPlainObject(raw)) {
    const keys = Object.keys(raw)
    if (keys.length === 0 || !keys.every((k) => CONDITION_KEYS.has(k))) {
      throw new MockDbError(
        'INVALID',
        `where.${field}: unsupported condition {${keys.join(', ')}}; use a value, value[], {ne}, {gte, lte} or {isNull}`,
      )
    }
    if ('isNull' in raw) {
      if (keys.length !== 1) throw new MockDbError('INVALID', `where.${field}: isNull stands alone`)
      return { kind: 'isNull', isNull: raw.isNull === true }
    }
    if ('ne' in raw) {
      if (keys.length !== 1) throw new MockDbError('INVALID', `where.${field}: ne stands alone`)
      return { kind: 'ne', value: raw.ne }
    }
    // A range with no defined bound is no condition at all (null rows are not excluded).
    if (raw.gte === undefined && raw.lte === undefined) return { kind: 'any' }
    return { kind: 'range', gte: raw.gte, lte: raw.lte }
  }
  return { kind: 'eq', value: raw }
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

/** Equality used by `where`: nullish equals nullish, `Date`s by time, otherwise `===`. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (isNullish(a) || isNullish(b)) return isNullish(a) && isNullish(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

/** Total order for sorting and ranges: nullish first, then numbers/strings/booleans/Dates. */
export function compareValues(a: unknown, b: unknown): number {
  const an = isNullish(a)
  const bn = isNullish(b)
  if (an || bn) return an === bn ? 0 : an ? -1 : 1
  const av = a instanceof Date ? a.getTime() : a
  const bv = b instanceof Date ? b.getTime() : b
  if (typeof av === 'string' && typeof bv === 'string') return av < bv ? -1 : av > bv ? 1 : 0
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  if (typeof av === 'boolean' && typeof bv === 'boolean') return Number(av) - Number(bv)
  // Mixed types: order by type name, then by string form (deterministic, never used by design).
  const at = typeof av
  const bt = typeof bv
  if (at !== bt) return at < bt ? -1 : 1
  const as = JSON.stringify(av) ?? ''
  const bs = JSON.stringify(bv) ?? ''
  return as < bs ? -1 : as > bs ? 1 : 0
}

export function testCondition(cond: ParsedCondition, value: unknown): boolean {
  switch (cond.kind) {
    case 'any':
      return true
    case 'eq':
      return valuesEqual(value, cond.value)
    case 'in':
      return cond.values.some((v) => valuesEqual(value, v))
    case 'ne':
      return !valuesEqual(value, cond.value)
    case 'isNull':
      return isNullish(value) === cond.isNull
    case 'range':
      if (isNullish(value)) return false
      if (cond.gte !== undefined && compareValues(value, cond.gte) < 0) return false
      if (cond.lte !== undefined && compareValues(value, cond.lte) > 0) return false
      return true
  }
}

export type CompiledWhere = [field: string, cond: ParsedCondition][]

/** Parses a `Where` once; fields whose condition is `undefined` are ignored. */
export function compileWhere<Row>(where: Where<Row> | undefined): CompiledWhere {
  if (!where) return []
  const out: CompiledWhere = []
  for (const [field, raw] of Object.entries(where as Record<string, unknown>)) {
    if (raw === undefined) continue
    out.push([field, parseCondition(field, raw)])
  }
  return out
}

export function rowMatches(row: object, compiled: CompiledWhere): boolean {
  const record = row as Record<string, unknown>
  for (const [field, cond] of compiled) {
    if (!testCondition(cond, record[field])) return false
  }
  return true
}

/** Convenience: does `row` satisfy `where` (and `match`, if given)? */
export function matchesWhere<Row extends object>(
  row: Row,
  where?: Where<Row>,
  match?: (row: Row) => boolean,
): boolean {
  return rowMatches(row, compileWhere(where)) && (match ? match(row) : true)
}

/** A comparator for `sort`. Callers sort rows already in ascending-id order (stable ties). */
export function compileSort<Row>(sort: SortSpec<Row>): (a: Row, b: Row) => number {
  const keys = (Array.isArray(sort) ? sort : [sort]) as readonly (
    string | { field: string; dir?: SortDirection }
  )[]
  const parsed = keys.map((k) =>
    typeof k === 'string'
      ? { field: k, sign: 1 }
      : { field: k.field, sign: k.dir === 'desc' ? -1 : 1 },
  )
  return (a, b) => {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    for (const { field, sign } of parsed) {
      const c = compareValues(ra[field], rb[field])
      if (c !== 0) return c * sign
    }
    return 0
  }
}
