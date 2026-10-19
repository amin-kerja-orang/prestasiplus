/**
 * The 336 seeded FeedbackResponse rows (SRS M12 v1.6 §6.6 "Designed split"; `observed: false` except the displayed
 * means and the admin responses). Only the means are observed: NPS by role 8.4 / 6.5 / 9.6 (S2), overall 8.3
 * (S6), satisfaction 4.6 (S1, S2, S6), "336 respon". The split is designed:
 *
 * - `student`: 311 responses, NPS sum 2,612 (8.399), satisfaction sum 1,431;
 * - `teacher`: 20 responses, NPS sum 130 (6.5), satisfaction sum 90;
 * - `admin`: 5 responses, NPS 10, 10, 9, 10, 9 = 48 (9.6), satisfaction 5 each; user 1 in 2026-07, 08, 09 and user
 *   5801 in 2026-08, 09 (the observed admin thank-you state is user 1 in 2026-09).
 *
 * Overall: NPS (2,612 + 130 + 48) / 336 = 8.304; satisfaction (1,431 + 90 + 25) / 336 = 4.601. Months 2026-02 ...
 * 2026-09, at most one response per user per month. The respondents are generated users of the M02 dataset
 * (the canonical accounts 1-11 never respond, except the two admins above) and are picked by the seed.
 */

import type { FeedbackRow } from '../types'

export const FEEDBACK_MONTHS = [
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
] as const

/** Students and teachers per month (same order as `FEEDBACK_MONTHS`); sums 311 and 20. */
const STUDENTS_PER_MONTH = [30, 35, 38, 40, 42, 44, 45, 37] as const
const TEACHERS_PER_MONTH = [2, 2, 2, 3, 3, 3, 3, 2] as const

/** Respondent pool sizes the seed must supply (>= the largest month). */
export const STUDENT_POOL = 60
export const TEACHER_POOL = 6

/** Admin responses: [userId, month, nps]. */
const ADMIN_RESPONSES: readonly (readonly [number, string, number])[] = [
  [1, '2026-07', 10],
  [1, '2026-08', 10],
  [5801, '2026-08', 10],
  [1, '2026-09', 9],
  [5801, '2026-09', 9],
]

/**
 * `count` integers in `[lo, hi]` with total `sum`, starting from a repeating pattern and nudging entries on a
 * fixed stride until the sum is exact (deterministic, no randomness).
 */
export function fitSeries(
  count: number,
  sum: number,
  lo: number,
  hi: number,
  pattern: readonly number[],
): number[] {
  const out = Array.from({ length: count }, (_, i) => pattern[i % pattern.length] as number)
  let diff = sum - out.reduce((a, b) => a + b, 0)
  if (diff > (hi - lo) * count || diff < -(hi - lo) * count)
    throw new RangeError('fitSeries: sum out of reach')
  for (let i = 0; diff !== 0; i++) {
    const at = (i * 7 + 3) % count
    const v = out[at] as number
    if (diff > 0 && v < hi) {
      out[at] = v + 1
      diff--
    } else if (diff < 0 && v > lo) {
      out[at] = v - 1
      diff++
    }
    if (i > 1_000_000) throw new RangeError('fitSeries: no fit')
  }
  return out
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** The 336 rows (ids 1-336), given the respondent pools (ids of generated students and teachers). */
export function buildFeedbackRows(
  studentPool: readonly number[],
  teacherPool: readonly number[],
  schoolOf: (userId: number) => number | null,
): FeedbackRow[] {
  if (studentPool.length < STUDENT_POOL || teacherPool.length < TEACHER_POOL) {
    throw new RangeError('buildFeedbackRows: respondent pools are too small')
  }
  const studentNps = fitSeries(
    311,
    2612,
    0,
    10,
    [9, 10, 8, 7, 9, 10, 6, 8, 9, 10, 5, 8, 9, 10, 7, 3],
  )
  const studentSat = fitSeries(311, 1431, 1, 5, [5, 5, 4, 5, 5, 5, 4, 5, 3, 5])
  const teacherNps = fitSeries(20, 130, 0, 10, [7, 6, 8, 5, 7, 6, 4, 7])
  const teacherSat = fitSeries(20, 90, 1, 5, [5, 4, 5, 4])

  const rows: Omit<FeedbackRow, 'id' | 'createdAt' | 'schoolId'>[] = []
  let s = 0
  let t = 0
  FEEDBACK_MONTHS.forEach((month, k) => {
    for (let j = 0; j < (STUDENTS_PER_MONTH[k] as number); j++, s++) {
      rows.push({
        userId: studentPool[(k * 13 + j) % STUDENT_POOL] as number,
        role: 'student',
        month,
        nps: studentNps[s] as number,
        satisfaction: studentSat[s] as number,
      })
    }
    for (let j = 0; j < (TEACHERS_PER_MONTH[k] as number); j++, t++) {
      rows.push({
        userId: teacherPool[(k + j) % TEACHER_POOL] as number,
        role: 'teacher',
        month,
        nps: teacherNps[t] as number,
        satisfaction: teacherSat[t] as number,
      })
    }
    for (const [userId, m, nps] of ADMIN_RESPONSES) {
      if (m === month) rows.push({ userId, role: 'admin', month, nps, satisfaction: 5 })
    }
  })

  return rows.map((r, i) => ({
    ...r,
    schoolId: schoolOf(r.userId),
    id: i + 1,
    // Day 1-24 and a morning time, so every row of the current month (25 Sep) is in the past.
    createdAt: `${r.month}-${pad2(1 + (i % 24))}T${pad2(8 + (i % 8))}:${pad2((i * 7) % 60)}:00+08:00`,
  }))
}
