/**
 * Pure rules of the Command Center (SRS M10 v1.18 §4 BR-M10-08, 09, 11, 14, 15, 16; URS FN-M10-2.2.7,
 * 2.2.13). No store access, so every rule is unit-tested on its own.
 *
 * The SPM grade table and its points are the M08 rule (BR-M08-01 / BR-M08-02: BR-M10-14 says "M08
 * grade band of accuracy"). M08 does not export them (D12: only public mock entries are imported), so
 * the two small tables are repeated here and cited.
 */

/** BR-M08-01: the ten SPM grades in point order (A+ 0 … G 9). */
export const SPM_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const
export type SpmGrade = (typeof SPM_GRADES)[number]

/** BR-M08-01: grade points (A+ 0 … G 9); `-1` for an unknown label. */
export const gradePoints = (grade: string): number => SPM_GRADES.indexOf(grade as SpmGrade)

/** BR-M08-02: percentage → grade. */
export function gradeOfPercent(value: number): SpmGrade {
  if (value >= 90) return 'A+'
  if (value >= 80) return 'A'
  if (value >= 70) return 'A-'
  if (value >= 65) return 'B+'
  if (value >= 60) return 'B'
  if (value >= 55) return 'C+'
  if (value >= 50) return 'C'
  if (value >= 45) return 'D'
  if (value >= 40) return 'E'
  return 'G'
}

/** FN-M10-2.2.7: the drill "Gred" from a GPS (the live script's own scale, ≤1.5 A+ … else E). */
export function drillGradeOfGps(gps: number): string {
  if (gps <= 1.5) return 'A+'
  if (gps <= 2.0) return 'A'
  if (gps <= 2.5) return 'A-'
  if (gps <= 3.0) return 'B+'
  if (gps <= 3.5) return 'B'
  if (gps <= 4.0) return 'C+'
  if (gps <= 4.5) return 'C'
  if (gps <= 5.0) return 'D'
  return 'E'
}

/** Rounds half away from zero to `digits` decimals. */
export function round(value: number, digits = 0): number {
  const f = 10 ** digits
  // Math.round sends -87.5 to -87; work on the magnitude so that halves go away from zero.
  return (Math.sign(value) * Math.round(Math.abs(value) * f + 1e-9)) / f
}

/** `part ÷ whole × 100`, or 0 when `whole` is 0. */
export const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : (part / whole) * 100

/** BR-M10-08: week change = round((week − previous 7 days) ÷ previous × 100), 0 when previous = 0. */
export function weekChange(week: number, previous: number): number {
  return previous === 0 ? 0 : round(((week - previous) / previous) * 100)
}

/** The live count format (digits, "," between thousands; the page shows "--" for 0 itself). */
export function formatCount(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// --- engagement (BR-M10-09, PROPOSED) -----------------------------------------------------------

export const ENGAGEMENT_BANDS = [
  'champion',
  'consistent',
  'developing',
  'minimum',
  'disengaged',
] as const
export type EngagementBand = (typeof ENGAGEMENT_BANDS)[number]

/**
 * BR-M10-09: by distinct answer days in the last 7 days, Champion ≥ 5, Konsisten 3–4, Berkembang 1–2;
 * Minimum = none in 7 days but at least one answer in 30; Disengaged = none in 30 days.
 */
export function engagementBand(daysIn7: number, daysIn30: number): EngagementBand {
  if (daysIn7 >= 5) return 'champion'
  if (daysIn7 >= 3) return 'consistent'
  if (daysIn7 >= 1) return 'developing'
  return daysIn30 >= 1 ? 'minimum' : 'disengaged'
}

// --- prediction (BR-M10-14) -----------------------------------------------------------------------

/** BR-M10-14: a student needs this many answers to be predicted. */
export const PREDICT_MIN_ANSWERS = 10

export type PredictionRisk = 'kritikal' | 'tinggi' | 'sederhana' | 'rendah'
export type TrendLabel = 'Naik' | 'Turun' | 'Stabil'

/** BR-M10-14: risk from the predicted grade (kritikal E/G, tinggi D, sederhana C/C+, else rendah). */
export function predictionRisk(grade: SpmGrade): PredictionRisk {
  if (grade === 'E' || grade === 'G') return 'kritikal'
  if (grade === 'D') return 'tinggi'
  if (grade === 'C' || grade === 'C+') return 'sederhana'
  return 'rendah'
}

/** BR-M10-14 (PROPOSED COPY): "Naik" above +5, "Turun" below −5, else "Stabil". */
export function trendLabel(trend: number): TrendLabel {
  if (trend > 5) return 'Naik'
  if (trend < -5) return 'Turun'
  return 'Stabil'
}

// --- evaluation (BR-M10-15, PROPOSED COPY) ---------------------------------------------------------

export type EvaluationRisk = 'critical' | 'high' | 'medium'

/** BR-M10-15: 3 or more alerts critical, 2 high, 1 medium; `null` without an alert. */
export function evaluationRisk(alertCount: number): EvaluationRisk | null {
  if (alertCount >= 3) return 'critical'
  if (alertCount === 2) return 'high'
  return alertCount === 1 ? 'medium' : null
}

export const EVALUATION_MSG = {
  inactive: (days: number): string => `Tiada aktiviti ${String(days)} hari`,
  inactiveTip: 'Hubungi pelajar dan ingatkan untuk menjawab soalan setiap hari.',
  lowAccuracy: (accuracy: number): string => `Ketepatan rendah (${String(accuracy)}%)`,
  lowAccuracyTip: 'Jana ujian remedial untuk topik yang lemah.',
  declining: 'Prestasi menurun',
  decliningTip: 'Semak jawapan salah terkini dan beri bimbingan tambahan.',
} as const

// --- badges (BR-M10-16, FN-M10-2.2.13) ---------------------------------------------------------------

/** FN-M10-2.2.13 rarity by holders: Common ≥ 20, Uncommon ≥ 10, Rare ≥ 5, Epic ≥ 1, Legendary 0. */
export function rarityOfHolders(
  holders: number,
): 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' {
  if (holders >= 20) return 'Common'
  if (holders >= 10) return 'Uncommon'
  if (holders >= 5) return 'Rare'
  return holders >= 1 ? 'Epic' : 'Legendary'
}

/** The chip colour of a rarity (PROPOSED; the contract carries a `color` per badge). */
export const RARITY_COLOR = {
  Common: '#94a3b8',
  Uncommon: '#22c55e',
  Rare: '#3b82f6',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
} as const

// --- remedial (BR-M10-11, BR-M10-12) ------------------------------------------------------------------

/** BR-M10-11: a topic needs at least this many answers to be judged. */
export const WEAK_MIN_ANSWERS = 2
/** BR-M10-11: weak below this accuracy (percent). */
export const WEAK_BELOW = 50
/** BR-M10-12: a remedial test holds at most this many questions. */
export const REMEDIAL_MAX_QUESTIONS = 10

export const REMEDIAL_MSG = {
  noQuestions: 'Tiada soalan untuk topik lemah',
  noSubject: 'Subjek tidak sah.',
  alreadyOpen: 'Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu.',
  notYourStudent: 'Pelajar ini bukan murid anda.',
  testNotFound: 'Ujian remedial tidak dijumpai.',
  testNotActive: 'Ujian remedial ini tidak aktif.',
  studentId: 'ID pelajar tidak sah.',
  subject: 'Sila pilih subjek.',
  quizId: 'ID ujian tidak sah.',
} as const

export const DRILL_MSG = {
  type: 'Jenis drill tidak sah.',
  filter: 'Penapis tidak sah.',
  badge: 'Lencana tidak sah.',
  badgeNotFound: 'Lencana tidak dijumpai.',
} as const
