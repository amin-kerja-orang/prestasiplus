/** Shared helpers of the M12 repositories: errors, the bound clock and the number formats (BR-M12-33). */

import { mytParts, toIsoMyt, type Clock } from '@/lib/time'

export type M12ErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT'

/** A refused M12 write (nothing is written). Handlers map `code` to the §7 error responses. */
export class M12Error extends Error {
  readonly code: M12ErrorCode
  /** The request field a validation refusal belongs to, when known. */
  readonly field: string | undefined
  constructor(code: M12ErrorCode, message: string, field?: string) {
    super(message)
    this.name = 'M12Error'
    this.code = code
    this.field = field
  }
}

let boundClock: Clock | null = null

/** Bound by the M12 seed (every boot and reset). */
export function bindM12Clock(clock: Clock): void {
  boundClock = clock
}

/** Now (epoch ms) of the runtime being served. */
export function m12Now(): number {
  if (!boundClock) throw new Error('M12: not booted (no clock bound)')
  return boundClock.now()
}

export const nowIso = (): string => toIsoMyt(m12Now())

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** `YYYY-MM-DD` (Asia/Kuala_Lumpur) of an epoch ms. */
export function dayKey(ms: number): string {
  const p = mytParts(ms)
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`
}

/** `YYYY-MM` (Asia/Kuala_Lumpur) of an epoch ms. */
export function monthKeyOf(ms: number): string {
  const p = mytParts(ms)
  return `${pad(p.year, 4)}-${pad(p.month)}`
}

/** Rounds `value` half-up to one decimal (the displayed precision of every M12 percentage). */
export function round1(value: number): number {
  const r = Math.round((Math.abs(value) + Number.EPSILON) * 10) / 10
  return value < 0 ? -r : r
}

/** `part / whole x 100`, half-up to 1 decimal in integer arithmetic; 0 when `whole` is 0 (BR-M12-03). */
export function pct1(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.floor((2000 * part + whole) / (2 * whole)) / 10
}

/** The same ratio in tenths of a percent (integer), for sorting and grade bounds on the displayed value. */
export function pctTenths(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.floor((2000 * part + whole) / (2 * whole))
}

/** A mean (`sum / count`) half-up to 1 decimal; 0 when `count` is 0. */
export function mean1(sum: number, count: number): number {
  if (count <= 0) return 0
  return Math.floor((20 * sum + count) / (2 * count)) / 10
}

/** "x" or "x.y": the number as the screens print it (trailing ".0" dropped, no thousands separator). */
export function fmt1(value: number): string {
  const r = round1(value)
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
