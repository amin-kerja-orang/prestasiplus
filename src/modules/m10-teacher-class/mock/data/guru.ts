/**
 * The designed "{n} GURU" enrolments (SRS M10 §6.2.1 A "{n} GURU" row, XR to M17 R2-06; M17 §6.4 / §6.7 B,
 * BR-M17-11, Q-M17-SCH-TEACHERS).
 *
 * Q-M17-SCH-TEACHERS(window, school) = distinct owners of a classroom with an active enrolment of a pupil of the
 * school who answered in the window. The figures are OBSERVED on the live Command Center S3 (week and month rows);
 * the today figures are the PROPOSED enrolments of the today pupils (8106 2, 8082 1, 8080 1). The design adds and
 * moves ENROLMENTS only (never classes, owners, levels or ids), so the class counts, the 310 owners, the T5 set
 * (3,911) and every pinned class and teacher card are unchanged (`build/guru.ts`).
 *
 * The pupils of each window are the answering pupils of M05 at the project clock (`CLOCK_ANCHOR_ISO`), split into
 * the narrowest window they answer in (a pupil of "today" also answered in the week and the month). They are
 * designated ids, as the M17 anchors are: M10 cannot read M05 while it builds (M05 reads the M10 placement), so
 * `__tests__/mock/guru-enrolments.test.ts` asserts them against M05's own windows and a drift fails loudly.
 */

export interface GuruTargets {
  today: number
  week: number
  month: number
}

export interface GuruPlan {
  school: number
  /** Pupils answering today. */
  today: readonly number[]
  /** Pupils answering this week but not today. */
  week: readonly number[]
  /** Pupils answering this month but not this week. */
  month: readonly number[]
  /** The "{n} GURU" of the three windows. */
  targets: GuruTargets
  /** Schools whose class owners may also take the pupils (after the owners of `school` itself). */
  pool: readonly number[]
}

export const GURU_PLANS: readonly GuruPlan[] = [
  {
    // M17 §6.7 B: today 2, week 17, month 18 (the owners are generated teachers of the school itself).
    school: 8106,
    today: [2018, 2019],
    week: [42, 47, 53, 75, 89, 91, 2017],
    month: [135, 161, 192, 206, 240, 241, 253, 287, 304, 312, 345, 2023],
    targets: { today: 2, week: 17, month: 18 },
    pool: [],
  },
  {
    // today 1 (pupil 2016, class 813 only), week 50, month 61: its 14 own owners plus cross-school owners of
    // 8078 and 8090 (M10 §6.2.1 A).
    school: 8082,
    today: [2016],
    week: [26, 35, 2013, 2014, 2015],
    month: [14, 60, 71, 76, 181, 185, 198, 217, 223, 231, 235, 291, 299, 310, 311, 2020, 4627],
    targets: { today: 1, week: 50, month: 61 },
    pool: [8078, 8090],
  },
  {
    // today 1 (pupil 2022, class 370 only), week 6, month 8: teacher 1919 plus cross-school owners of 8106.
    school: 8080,
    today: [2022],
    week: [16, 83, 110, 125, 254, 356, 378],
    month: [389, 405, 2021, 2024, 2025, 2026, 2027, 2028, 2029],
    targets: { today: 1, week: 6, month: 8 },
    pool: [8106],
  },
  {
    school: 8078,
    today: [],
    week: [158, 162, 191, 195],
    month: [238, 298, 301, 323, 370, 381, 388, 396, 444, 447],
    targets: { today: 0, week: 22, month: 37 },
    pool: [],
  },
  {
    school: 8090,
    today: [],
    week: [15, 21],
    month: [63, 68, 73],
    targets: { today: 0, week: 9, month: 23 },
    pool: [],
  },
]
