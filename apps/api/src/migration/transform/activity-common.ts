/**
 * Shared helpers of the BE-29 transforms and loaders (activity, wallet, content, operations).
 * Pure functions plus the reject / excluded conventions; builds on the BE-28 `common.ts` and the kit.
 *
 * Rules (v2-backend-plan.md 14.1, v2-data-migration.md 4 and 5):
 *  - an enum value that is not in the explicit map is rejected `UNKNOWN_ENUM`, never defaulted;
 *  - a parent id that is not in `etl_id_map` is rejected `ORPHAN_PARENT`;
 *  - a value outside its range is `INVALID_VALUE`; a repeated key is `DUPLICATE_KEY`; a row the v2 model
 *    cannot represent is `UNSUPPORTED`;
 *  - a row left out by a documented rule (nothing to load, no reject) is counted as `excluded`;
 *  - a reject carries a reason code, a column and a code-like enum value, never a row value.
 */
import type { BatchResult } from '../kit/runner'
import type { RejectReason } from '../kit/types'
import { enumKey, reject, text, type Outcome } from './common'

export type { Outcome, RejectSpec, Staged } from './common'
export { enumKey, flag, integer, ok, reject, squash, stamps, text } from './common'

export const KL_TIME_ZONE = 'Asia/Kuala_Lumpur'

/**
 * SQL for the Malaysian calendar day of a timestamp (T-05, Q8): `(<expr> AT TIME ZONE 'Asia/Kuala_Lumpur')::date`.
 * `expr` is static text from loader code (a column or a bind parameter such as `$1::timestamptz`), never data.
 */
export function klDateSql(expr: string): string {
  if (!/^[A-Za-z0-9_."$:()\s,+\-]+$/.test(expr) || expr.includes(';') || expr.includes('--')) {
    throw new RangeError('klDateSql: the expression must be a column or parameter reference.')
  }
  return `(${expr} AT TIME ZONE '${KL_TIME_ZONE}')::date`
}

export interface EnumMapOptions {
  /** A blank source value gives `null` instead of a reject (for optional columns). Default: INVALID_VALUE reject. */
  blankIsNull?: boolean
}

/**
 * Builds the transform for one enum column from an explicit table. Keys are matched after `enumKey`
 * (lower-case, `_` for spaces and dashes); a value outside the table is `UNKNOWN_ENUM` with the code stored
 * raw only when it looks like a code (see `Rejects`). `allowedCodes` lists the known source codes.
 */
export function enumMapper<T extends string>(
  column: string,
  map: Readonly<Record<string, T>>,
  options: EnumMapOptions = {},
): (raw: string | null | undefined) => Outcome<T | null> {
  const known = Object.keys(map)
  return (raw) => {
    const key = enumKey(raw)
    if (key === null) {
      return options.blankIsNull ? { ok: true, value: null } : reject('INVALID_VALUE', column)
    }
    const mapped = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
    if (mapped === undefined) return reject('UNKNOWN_ENUM', column, { enumValue: text(raw) ?? key, allowedCodes: known })
    return { ok: true, value: mapped }
  }
}

/** Reject outcomes with the BE-28 reason codes (one place, so the codes are spelled once). */
export const orphan = <T = never>(column: string): Outcome<T> => reject<T>('ORPHAN_PARENT', column)
export const invalid = <T = never>(column: string): Outcome<T> => reject<T>('INVALID_VALUE', column)
export const duplicate = <T = never>(column: string): Outcome<T> => reject<T>('DUPLICATE_KEY', column)
export const unsupported = <T = never>(column: string): Outcome<T> => reject<T>('UNSUPPORTED', column)

export const REJECT_CODES: readonly RejectReason[] = ['ORPHAN_PARENT', 'UNKNOWN_ENUM', 'INVALID_VALUE', 'DUPLICATE_KEY', 'UNSUPPORTED']

/** A batch result that only counts rows left out by a documented rule (reconciliation `eligible = read - excluded`). */
export const excludedResult = (n: number): BatchResult => ({ excluded: n })

/** Sums batch results including `excluded` (`load/helpers.sumResults` ignores it). */
export function sumBatch(...results: readonly BatchResult[]): BatchResult {
  const out = { inserted: 0, updated: 0, unchanged: 0, excluded: 0 }
  for (const r of results) {
    out.inserted += r.inserted ?? 0
    out.updated += r.updated ?? 0
    out.unchanged += r.unchanged ?? 0
    out.excluded += r.excluded ?? 0
  }
  return out
}

/** A non-negative integer given as text; blank is `null`, a negative or non-numeric value is `invalid`. */
export function nonNegativeInt(value: string | null | undefined): number | null | 'invalid' {
  const t = text(value)
  if (t === null) return null
  if (!/^\d{1,12}$/.test(t)) return 'invalid'
  const n = Number(t)
  return Number.isSafeInteger(n) ? n : 'invalid'
}
