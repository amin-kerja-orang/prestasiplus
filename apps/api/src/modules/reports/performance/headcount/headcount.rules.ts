/**
 * Pure headcount rules (SRS M08 BR-M08-01/07/08/24/33), ported from the mock `headcount-port.ts` and
 * `headcount-views.ts`. No store access. Percentages are 0-100.
 */
import type { HeadcountBand, HeadcountPairStatus, HeadcountTone, LatestAr } from '../domain/headcount'
import { gradeOfPercent, round, type Grade } from '../domain/rules'

/** The marks of one pupil in one config (blank slots when the pupil has no entry). TOV and ETR are the RESOLVED values. */
export interface HeadcountMarks {
  tov: number | null
  /** `activeOtrs` slots, COMPUTED by `otrTargets` (HC-2); the stored `headcount_entry_marks.target` is never read. */
  targets: readonly (number | null)[]
  /** `activeOtrs` slots. */
  actuals: readonly (number | null)[]
  etr: number | null
  rs: number | null
}

export const blankSlots = (n: number): (number | null)[] => Array.from({ length: n }, () => null)

/**
 * HC-2: OTR_k = round(TOV + (ETR - TOV) * r_k), r_k = floor(100 k / n) / 100, OTR_n = ETR; whole number, half up (computed in integer tenths).
 * Null slots when TOV or ETR is missing.
 */
export function otrTargets(tov: number | null, etr: number | null, n: number): (number | null)[] {
  if (tov === null || etr === null) return blankSlots(n)
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1
    if (k >= n) return etr
    // Integer tenths (marks have one decimal), so no float drift: half-up on a non-negative value.
    const t = Math.round(tov * 10)
    const e = Math.round(etr * 10)
    const r = Math.floor((100 * k) / n)
    return Math.floor((t * 100 + (e - t) * r + 500) / 1000)
  })
}

/** What a stored entry (or a roster pupil without one) holds before resolution. */
export interface RawMarks {
  tov: number | null
  etr: number | null
  rs: number | null
  /** Stored AR by checkpoint (any length; read up to `activeOtrs`). */
  actuals: readonly (number | null | undefined)[]
}

/**
 * THE marks assembler (HC-1, HC-2, DM-49): resolved TOV = entry TOV else the config default, ETR likewise, OTR targets
 * computed, actuals sized to `activeOtrs`. Every reader (the service, the facts service, the figures) gets its marks here.
 */
export function resolveMarks(
  raw: RawMarks | null,
  config: { activeOtrs: number; defaultTov: number | null; defaultEtr: number | null },
): HeadcountMarks {
  const tov = raw?.tov ?? config.defaultTov
  const etr = raw?.etr ?? config.defaultEtr
  const n = config.activeOtrs
  return {
    tov,
    targets: otrTargets(tov, etr, n),
    actuals: Array.from({ length: n }, (_, i) => raw?.actuals[i] ?? null),
    etr,
    rs: raw?.rs ?? null,
  }
}

export type HeadcountStatusReason = 'belum_ada_data' | 'belum_ada_tov'
export type HeadcountEntryStatus = 'active' | 'draft'

/** HC-SPEC: no ETR = "Belum Ada Data"; an ETR without a TOV = "Belum Ada TOV"; otherwise none. */
export function statusReasonOf(m: Pick<HeadcountMarks, 'tov' | 'etr'>): HeadcountStatusReason | null {
  if (m.etr === null) return 'belum_ada_data'
  return m.tov === null ? 'belum_ada_tov' : null
}

/** Active exactly when the pupil has an ETR for the config (own or default); TOV alone never makes it Active. */
export const entryStatusOf = (m: Pick<HeadcountMarks, 'etr'>): HeadcountEntryStatus => (m.etr === null ? 'draft' : 'active')

/** The latest checkpoint that has an AR (BR-M08-01 "latest AR"). */
export function latestAr(m: Pick<HeadcountMarks, 'targets' | 'actuals'>): LatestAr | null {
  for (let i = m.actuals.length - 1; i >= 0; i--) {
    const ar = m.actuals[i]
    if (ar !== null && ar !== undefined) return { n: i + 1, ar, target: m.targets[i] ?? null }
  }
  return null
}

/** BR-M08-01: an entry is graded when it has an AR. */
export const isGraded = (m: Pick<HeadcountMarks, 'targets' | 'actuals'>): boolean => latestAr(m) !== null

/** BR-M08-08 rule (1) with the "no data" bucket: the latest AR against its target. */
export function pairStatus(m: Pick<HeadcountMarks, 'targets' | 'actuals'>): HeadcountPairStatus {
  const l = latestAr(m)
  if (l === null || l.target === null) return 'none'
  return l.ar >= l.target ? 'on' : 'below'
}

/** Ringkasan Kelas bands (HC-SPEC): above = AR - OTR > 2; on = 0 to 2; below = AR < OTR. */
export function bandStatus(ar: number | null, target: number | null): HeadcountBand {
  if (ar === null || target === null) return 'na'
  const d = ar - target
  if (d > 2) return 'above'
  if (d >= 0) return 'on'
  return 'below'
}

/** HC-5: the value is first rounded to a whole number (half away from zero), so 89.5 reads A+. */
export const gradeOrNull = (v: number | null): Grade | null => (v === null ? null : gradeOfPercent(round(v, 0)))

/** Mean of the non-null values, 1 decimal; null when there are none. */
export function meanOrNull(values: readonly (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null)
  return v.length === 0 ? null : round(v.reduce((a, b) => a + b, 0) / v.length, 1)
}

export type ProjectionVariant = 'green' | 'amber' | 'red'
export type TrendLabel = 'Meningkat' | 'Stabil' | 'Menurun'
export type ConfidenceLabel = 'Tinggi' | 'Sederhana' | 'Rendah'
export type PredictionVerdict = 'Ramalan Tepat' | 'Hampir Tepat' | 'Selisih Besar'

export interface ProjectionResult {
  value: number
  variant: ProjectionVariant
  trend: TrendLabel
  confidence: ConfidenceLabel
}

/**
 * HC-6: with an AR, a TOV and an ETR, the end = ETR when the latest AR >= TOV, else the latest AR. Trend Meningkat when
 * end > AR + 2, Menurun when end < AR - 2, else Stabil. Keyakinan Tinggi (AR >= ETR), Sederhana (AR >= TOV), else Rendah.
 * Null without an AR, a TOV or an ETR.
 */
export function projectionOf(m: Pick<HeadcountMarks, 'actuals' | 'tov' | 'etr'>): ProjectionResult | null {
  let ar: number | null = null
  for (let i = m.actuals.length - 1; i >= 0; i--) {
    const v = m.actuals[i]
    if (v !== null && v !== undefined) {
      ar = v
      break
    }
  }
  if (ar === null || m.tov === null || m.etr === null) return null
  const end = ar >= m.tov ? m.etr : ar
  const value = Math.min(100, Math.max(0, round(end, 1)))
  const variant: ProjectionVariant = value >= m.etr ? 'green' : 'amber'
  const trend: TrendLabel = end > ar + 2 ? 'Meningkat' : end < ar - 2 ? 'Menurun' : 'Stabil'
  const confidence: ConfidenceLabel = ar >= m.etr ? 'Tinggi' : ar >= m.tov ? 'Sederhana' : 'Rendah'
  return { value, variant, trend, confidence }
}

export interface PredictionResult {
  etr: number
  rs: number
  diff: number
  verdict: PredictionVerdict
}

/** BR-M08-33: d = RS - ETR (1 decimal); |d| <= 5 exact, <= 10 near, else a large gap. */
export function predictionOf(m: Pick<HeadcountMarks, 'etr' | 'rs'>): PredictionResult | null {
  if (m.etr === null || m.rs === null) return null
  const diff = round(m.rs - m.etr, 1)
  const abs = Math.abs(diff)
  const verdict: PredictionVerdict = abs <= 5 ? 'Ramalan Tepat' : abs <= 10 ? 'Hampir Tepat' : 'Selisih Besar'
  return { etr: m.etr, rs: m.rs, diff, verdict }
}

/** Row tone of the pupil sections (S15). */
export function rowTone(ar: number | null, target: number | null): HeadcountTone {
  return ar === null ? 'noAr' : target === null ? 'noTarget' : ar >= target ? 'on' : 'below'
}

/** Value of a possibly missing numeric (Prisma Decimal | number | string | null) as a number or null. */
export function toNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v.toString())
  return Number.isFinite(n) ? n : null
}

/** GPS grade points (plan section 3): A+ 0 ... G 9. */
export const GRADE_POINTS: Readonly<Record<Grade, number>> = {
  'A+': 0,
  A: 1,
  'A-': 2,
  'B+': 3,
  B: 4,
  'C+': 5,
  C: 6,
  D: 7,
  E: 8,
  G: 9,
}
