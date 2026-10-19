/**
 * Streak anchors for M18 and M17 (SRS M14 v1.7 §6.11.7, XL3-15; M18 §6.11 F). Rows are
 * `[current, best, totalDays]`, placed on the school's students in ascending id order (INFERRED:
 * the SRS names the schools and figures, not the pupils). Observed rows are exact; "designed" rows
 * are INFERRED values that give the stated Σ (best ≥ current). Every other pupil of these schools
 * has no row (0 / 0 / 0). KLUANG = 18 + 14 + 12 + 12 + 11 + 10 + 4 = 81; BATANG PADANG = 15 + 14
 * = 29. `lastActivityDate` of the anchors: 2026-09-24 (INFERRED; reads never decay).
 */

type Row = readonly [current: number, best: number, totalDays: number]

const even = (n: number, sum: number, bestPlus = 2): Row[] => {
  const base = Math.floor(sum / n)
  const extra = sum - base * n
  return Array.from({ length: n }, (_, i) => {
    const current = base + (i < extra ? 1 : 0)
    return [current, current + (i % (bestPlus + 1)), 0] as const
  })
}

const ones = (n: number): Row[] => Array.from({ length: n }, () => [1, 1, 0] as const)

export const STREAK_ANCHOR_LAST_ACTIVITY = '2026-09-24'

export const STREAK_ANCHOR_SCHOOLS: readonly { schoolId: number; rows: readonly Row[] }[] = [
  // KLUANG
  { schoolId: 8765, rows: even(18, 148) },
  {
    schoolId: 8880,
    rows: [
      [13, 16, 0],
      [13, 13, 0],
      [12, 20, 0],
      [11, 16, 0],
      [8, 14, 0],
      [8, 10, 0],
      [7, 16, 0],
      [6, 16, 0],
      [6, 12, 0],
      [4, 8, 0],
      ...ones(4),
    ],
  },
  { schoolId: 2700, rows: even(12, 82) },
  { schoolId: 3160, rows: even(12, 112) },
  { schoolId: 8767, rows: even(11, 58) },
  { schoolId: 8772, rows: even(10, 64) },
  {
    schoolId: 2710,
    rows: [
      [10, 10, 13],
      [9, 9, 4],
      [7, 7, 0],
      [4, 4, 0],
    ],
  },
  // BATANG PADANG
  {
    schoolId: 7780,
    rows: [
      [15, 16, 0],
      [14, 23, 0],
      [12, 18, 0],
      [12, 14, 0],
      [10, 20, 0],
      [9, 18, 0],
      [8, 16, 0],
      [8, 9, 0],
      [7, 15, 0],
      [7, 11, 0],
      ...ones(5),
    ],
  },
  {
    schoolId: 1,
    rows: [
      [10, 19, 0],
      [8, 11, 0],
      [7, 10, 0],
      [7, 10, 0],
      [6, 9, 0],
      [6, 9, 0],
      [6, 9, 0],
      [6, 9, 0],
      [5, 8, 0],
      [4, 9, 0],
      ...ones(4),
    ],
  },
]

/** M17 S7: pupil 2022 streak 1 (best and date INFERRED). */
export const STREAK_PUPIL_2022 = {
  userId: 2022,
  streak: { current: 1, best: 1, lastActivityDate: '2026-09-24', totalDays: 0 },
} as const
