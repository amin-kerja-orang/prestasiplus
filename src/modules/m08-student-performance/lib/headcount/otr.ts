/**
 * HC-SPEC rules of the headcount screens (docs/prd/r1/20-guru-admin-sekolah.md R1-GUR-3, HC-1…HC-6).
 * Pure functions, shared by the pages and the mock so both compute the same numbers as the API.
 */

import { PERFORMANCE_HEADCOUNT_MESSAGES } from '@pp/contract'

import type { ConfidenceLabel, TrendLabel } from '../../api/headcount-types'

/**
 * HC-2: the OTR target of checkpoint `k` (1-based) of `n`. OTR_k = round(TOV + (ETR − TOV) × r_k) with
 * r_k = floor(100·k/n)/100 for k < n, and OTR_n = ETR. `null` when ETR or TOV is missing (the targets
 * then show "—"), or `k` is outside 1..n. TOV 40, ETR 80, n = 3 gives 53 / 66 / 80.
 */
export function otrTarget(
  tov: number | null | undefined,
  etr: number | null | undefined,
  k: number,
  n: number,
): number | null {
  if (tov == null || etr == null || k < 1 || k > n) return null
  if (k >= n) return etr
  // Integer tenths (marks have one decimal), so no float drift: half-up on a non-negative value (same as the API).
  const t = Math.round(tov * 10)
  const e = Math.round(etr * 10)
  const r = Math.floor((100 * k) / n)
  return Math.floor((t * 100 + (e - t) * r + 500) / 1000)
}

/** The n targets OTR1…OTRn of one pupil. */
export const otrTargets = (
  tov: number | null | undefined,
  etr: number | null | undefined,
  n: number,
): (number | null)[] => Array.from({ length: n }, (_, i) => otrTarget(tov, etr, i + 1, n))

/** HC-4 / Ringkasan bands: Above AR − OTR > 2, On Track 0…2, Below < 0, na when either is missing. */
export function bandOf(
  ar: number | null | undefined,
  target: number | null | undefined,
): 'above' | 'on' | 'below' | 'na' {
  if (ar == null || target == null) return 'na'
  const diff = ar - target
  if (diff > 2) return 'above'
  if (diff >= 0) return 'on'
  return 'below'
}

/** Jurang = ETR − TOV; `null` when either is empty. */
export const jurangOf = (
  tov: number | null | undefined,
  etr: number | null | undefined,
): number | null => (tov == null || etr == null ? null : etr - tov)

export interface ProjectionInput {
  tov: number | null
  etr: number | null
  /** The latest AR. */
  ar: number | null
}

export interface ProjectionResult {
  end: number
  trend: TrendLabel
  confidence: ConfidenceLabel
}

/**
 * HC-6: end = ETR when AR ≥ TOV, else AR; trend Meningkat (end > AR + 2), Menurun (end < AR − 2), else
 * Stabil; Keyakinan Tinggi (AR ≥ ETR), Sederhana (AR ≥ TOV), else Rendah. `null` without AR, TOV or ETR.
 */
export function projectionOfAr({ tov, etr, ar }: ProjectionInput): ProjectionResult | null {
  if (ar === null || tov === null || etr === null) return null
  const end = ar >= tov ? etr : ar
  const trend: TrendLabel = end > ar + 2 ? 'Meningkat' : end < ar - 2 ? 'Menurun' : 'Stabil'
  const confidence: ConfidenceLabel = ar >= etr ? 'Tinggi' : ar >= tov ? 'Sederhana' : 'Rendah'
  return { end, trend, confidence }
}

/** The form range 0…100 of every mark field. */
export const MARK_RANGE_ERROR = PERFORMANCE_HEADCOUNT_MESSAGES.markRange

/** Validates a typed mark: `''` = empty (allowed), else a finite number in 0…100. */
export function parseMark(
  raw: string | number | null | undefined,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  const text = String(raw).trim()
  if (text === '') return { ok: true, value: null }
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > 100) return { ok: false, error: MARK_RANGE_ERROR }
  return { ok: true, value }
}
