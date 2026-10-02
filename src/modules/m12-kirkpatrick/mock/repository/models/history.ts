/**
 * The M08 SchoolSpmHistory reads of M12 (BR-M12-16 ... BR-M12-20), through the M08 repository contract only.
 *
 * - platform scope: the latest platform row (2025: GPS 4.30, 180 candidates);
 * - `school_id`: that school's latest row (8080: 2026, GPS 4.00, one B+); no row = "Belum Ada Data";
 * - the subject rows of "GPS Mengikut Subjek" are the platform subject rows of the latest subject year (M08
 *   stores them at school 8880, XL3-07) and are shown in every scope (DV-M12-26);
 * - the "Trend GPS" subject series and the "Trend" arrow come from M08's `schoolSpmHistory.subjectTrend()`.
 */

import { schoolSpmHistory, type SpmHistoryRow } from '@/modules/m08-student-performance/mock'

import { SPM_GRADES, type SpmGrade } from '../../data/rules-data'
import { gradeOfGps } from '../rules'

/** The history row of a scope (`null` = platform), or `null` when it has none. */
export function historyRow(schoolId: number | null): SpmHistoryRow | null {
  const rows =
    schoolId === null ? schoolSpmHistory.platform() : schoolSpmHistory.forSchool(schoolId)
  return rows.length === 0 ? null : (rows[rows.length - 1] as SpmHistoryRow)
}

/** Grade counts A+ ... G of a row, or `null` when the row stores none (INFERRED: the card is not rendered). */
export function gradeCountsOf(row: SpmHistoryRow | null): number[] | null {
  if (!row?.gradeCounts || row.gradeCounts.length !== SPM_GRADES.length) return null
  return row.gradeCounts
}

export interface SubjectGpsRow {
  name: string
  gps: number
  grade: SpmGrade
  candidates: number
  prev: number | null
}

/** BR-M12-19: the platform subject rows of the latest subject year, by GPS ascending (ties by name). */
export function subjectGps(): { year: number; rows: SubjectGpsRow[] } {
  const withSubjects = schoolSpmHistory.all().filter((r) => r.subjects.length > 0)
  const year = withSubjects.reduce((y, r) => Math.max(y, r.year), 0)
  const source = withSubjects.find((r) => r.year === year)
  if (!source) return { year, rows: [] }
  const trendOf = schoolSpmHistory.subjectTrend()
  const prevIndex = trendOf.years.indexOf(year - 1)
  const rows = source.subjects.map((s): SubjectGpsRow => {
    const trend = trendOf.subjects.find((t) => t.name === s.subjectName)
    return {
      name: s.subjectName,
      gps: s.gps,
      grade: gradeOfGps(s.gps),
      candidates: s.candidates,
      prev: prevIndex < 0 ? null : (trend?.data[prevIndex] ?? null),
    }
  })
  rows.sort((a, b) => a.gps - b.gps || a.name.localeCompare(b.name))
  return { year, rows }
}

/** The live row order of the trend table (BR-M12-20, "history order"); M08's series order differs. */
const TREND_ORDER = [
  'Bahasa Melayu',
  'Bahasa Inggeris',
  'Matematik',
  'Sains',
  'Sejarah',
  'Pendidikan Islam',
] as const

/** BR-M12-20: the platform trend table (M08 `subjectTrend()`), "Keseluruhan" first, then the live order. */
export function trendTable(): {
  years: number[]
  rows: { name: string; values: (number | null)[] }[]
} {
  const trend = schoolSpmHistory.subjectTrend()
  const platform = schoolSpmHistory.platform()
  const years = [...trend.years]
  const series = (name: string): (number | null)[] => [
    ...(trend.subjects.find((x) => x.name === name)?.data ?? years.map(() => null)),
  ]
  return {
    years,
    rows: [
      {
        name: 'Keseluruhan',
        values: years.map((y) => platform.find((r) => r.year === y)?.gps ?? null),
      },
      ...TREND_ORDER.map((name) => ({ name, values: series(name) })),
    ],
  }
}
