/**
 * DATA-M12-03 SchoolEngagementScore seed (SRS M12 v1.6 §6.4): per table school the S4 "Skor" (0-100, 1 dp) and
 * the S3 "Subjek" count. Live's formulas are unobservable (Q-M12-3), so the values are stored. Source: the
 * discovery top-up `TU-M12-02_schoolTables` (26-Sep reference values; the app never imports from docs/).
 * `observed: true` for 8080 and the schools without answers (adopted in URS 9.2); the other rows are 26-Sep
 * reference values (`observed: false`). Only school ids and numbers appear (no names).
 */

export type SchoolScoreSeed = readonly [
  schoolId: number,
  score: number,
  subjectCount: number,
  observed: boolean,
]

export const SCHOOL_SCORE_SEED: readonly SchoolScoreSeed[] = [
  [940, 2, 1, true],
  [987, 0, 0, true],
  [995, 0, 0, true],
  [1014, 22.4, 0, false],
  [7780, 57.7, 0, false],
  [8030, 63.6, 0, false],
  [8078, 72.5, 5, false],
  [8080, 62.4, 3, true],
  [8082, 70.6, 6, false],
  [8087, 3.9, 5, false],
  [8090, 31.6, 6, false],
  [8098, 96, 0, false],
  [8102, 40.9, 7, false],
  [8106, 69.9, 6, false],
  [8107, 0.4, 1, false],
  [8198, 0, 0, true],
  [8228, 37.2, 0, false],
  [8277, 10.1, 5, false],
  [8284, 0, 0, true],
  [8298, 80, 0, false],
  [8300, 72, 0, false],
  [8302, 0, 0, true],
  [8308, 0, 0, true],
  [8765, 33.4, 4, false],
  [8767, 87.5, 0, false],
  [8772, 63.7, 0, false],
  [8880, 81.9, 5, false],
  [8965, 88.9, 0, false],
  [9167, 83, 0, false],
  [9681, 100, 0, false],
  [9801, 0, 0, true],
  [9806, 92, 1, false],
  [10220, 0, 0, true],
]
