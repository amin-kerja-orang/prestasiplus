/**
 * Own month tables (ADR-0006 §4): formatting never depends on ICU data.
 * Index 0 = January.
 */

export type MonthLocale = 'ms' | 'en'

/** BM full month names (M01 "Ahli sejak {d MMMM yyyy}", M05 S11 "{BM month} {yyyy}"). */
export const MONTHS_MS = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
] as const

/**
 * BM short month names. Only "Mac" is OBSERVED (M09 BR-M09-10); the others are
 * INFERRED from the Carbon/moment `ms` locale (August = "Ogs").
 */
export const MONTHS_MS_SHORT = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogs',
  'Sep',
  'Okt',
  'Nov',
  'Dis',
] as const

export const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** English short month names (Laravel `M`: "08 Apr 2026", "19 May 2026"). */
export const MONTHS_EN_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Month name for `month` 1–12. */
export function monthName(month: number, locale: MonthLocale = 'ms', short = false): string {
  const table =
    locale === 'ms' ? (short ? MONTHS_MS_SHORT : MONTHS_MS) : short ? MONTHS_EN_SHORT : MONTHS_EN
  const name = table[month - 1]
  if (name === undefined) throw new RangeError(`Invalid month: ${month}`)
  return name
}
