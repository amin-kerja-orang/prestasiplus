/**
 * Date/time formatters in fixed UTC+8 with own month tables (overview §8/§6.12, ADR-0006).
 *
 * `formatMyt(input, pattern)` is the token engine; the named presets below are
 * the formats observed on live, one per SRS rule. Prefer the presets in UI code.
 *
 * Tokens: `yyyy` year · `MMMM` full month name · `MMM` short month name ·
 * `MM` / `M` month number · `dd` / `d` day · `HH` / `H` 24-hour ·
 * `hh` / `h` 12-hour · `mm` minute · `ss` second · `A` AM/PM.
 * Text inside `[...]` is literal.
 */

import { type MonthLocale, monthName } from './months'
import { type DateInput, mytParts } from './zone'

export interface FormatOptions {
  /** Month-name table for `MMMM` / `MMM`. Default `ms`. */
  months?: MonthLocale
}

const TOKEN = /\[([^\]]*)\]|yyyy|MMMM|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|A/g

const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatMyt(input: DateInput, pattern: string, options: FormatOptions = {}): string {
  const p = mytParts(input)
  const locale = options.months ?? 'ms'
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12
  return pattern.replace(TOKEN, (token, literal: string | undefined) => {
    if (literal !== undefined) return literal
    switch (token) {
      case 'yyyy':
        return String(p.year).padStart(4, '0')
      case 'MMMM':
        return monthName(p.month, locale)
      case 'MMM':
        return monthName(p.month, locale, true)
      case 'MM':
        return pad2(p.month)
      case 'M':
        return String(p.month)
      case 'dd':
        return pad2(p.day)
      case 'd':
        return String(p.day)
      case 'HH':
        return pad2(p.hour)
      case 'H':
        return String(p.hour)
      case 'hh':
        return pad2(hour12)
      case 'h':
        return String(hour12)
      case 'mm':
        return pad2(p.minute)
      case 'ss':
        return pad2(p.second)
      default:
        // 'A'
        return p.hour < 12 ? 'AM' : 'PM'
    }
  })
}

// ---------------------------------------------------------------------------
// Numeric formats
// ---------------------------------------------------------------------------

/** `dd/mm/yyyy` → "25/09/2026" (M02 BR-33, M07 BR-M07-22, M09 BR-M09-10 S1/S9). */
export const formatDate = (input: DateInput) => formatMyt(input, 'dd/MM/yyyy')

/** `dd/mm/yyyy HH:mm` (24 h) → "25/09/2026 15:40" (M02 BR-33, M04 list and import history, M11 BR-M11-11). */
export const formatDateTime = (input: DateInput) => formatMyt(input, 'dd/MM/yyyy HH:mm')

/** `HH:mm` → "15:40" (M01 push times, M04 S10 time line). */
export const formatTime = (input: DateInput) => formatMyt(input, 'HH:mm')

/** `dd/mm` → "19/02" (M05 S8 chart labels). */
export const formatDayMonth = (input: DateInput) => formatMyt(input, 'dd/MM')

/** `yyyy-mm-dd` local date key → "2026-09-25" (grouping by local day). */
export const formatDateKey = (input: DateInput) => formatMyt(input, 'yyyy-MM-dd')

/** `yyyymmdd` → "20260925" (M02 invoice "Ref: INV-{id}-{yyyymmdd}"). */
export const formatDateCompact = (input: DateInput) => formatMyt(input, 'yyyyMMdd')

/** Raw `yyyy-mm-dd HH:mm:ss` → "2026-09-25 15:40:00" (M11 BR-M11-11 modal time). */
export const formatDateTimeRaw = (input: DateInput) => formatMyt(input, 'yyyy-MM-dd HH:mm:ss')

// ---------------------------------------------------------------------------
// BM month names
// ---------------------------------------------------------------------------

/** `d MMMM yyyy` in BM → "25 September 2026", "17 Mac 2026" (M01 "Ahli sejak", M08 BR-M08-25, SRS §7.4). */
export const formatDateLong = (input: DateInput) => formatMyt(input, 'd MMMM yyyy')

/** `{BM month} {yyyy}` → "Mei 2026" (M05 BR-03 S11). */
export const formatMonthYear = (input: DateInput) => formatMyt(input, 'MMMM yyyy')

/** `d MMM yyyy` with BM short months → "17 Mac 2026" (M09 BR-M09-10 S28). */
export const formatDateShortMs = (input: DateInput) => formatMyt(input, 'd MMM yyyy')

/** `h:mm AM` → "11:23 PM" (M09 BR-M09-10 S28 time). */
export const formatTime12 = (input: DateInput) => formatMyt(input, 'h:mm A')

// ---------------------------------------------------------------------------
// English month abbreviations (Laravel `M`)
// ---------------------------------------------------------------------------

/** `dd Mon yyyy` → "08 Apr 2026" (M04 FR-M04-88/93, M09 BR-M09-10 S4/S8/S16/S18). */
export const formatDateEn = (input: DateInput) => formatMyt(input, 'dd MMM yyyy', { months: 'en' })

/** `d MMM yyyy` → "8 Apr 2026", "12 May 2027" (M08 "Direkod: …", M11 BR-M11-11/33). */
export const formatDateEnUnpadded = (input: DateInput) =>
  formatMyt(input, 'd MMM yyyy', { months: 'en' })

/** Laravel `d M Y, H:i` → "19 May 2026, 03:49" (M05 BR-03 S9). */
export const formatDateTimeEn = (input: DateInput) =>
  formatMyt(input, 'dd MMM yyyy, HH:mm', { months: 'en' })

/** `d MMM yyyy, hh:mm A` → "19 May 2026, 03:49 PM" (M06 FR-M06-64, BR-M06 history). */
export const formatDateTimeEn12 = (input: DateInput) =>
  formatMyt(input, 'd MMM yyyy, hh:mm A', { months: 'en' })

/** `dd Mon yyyy, h:mmAM` → "17 Mar 2026, 11:23PM" (M09 BR-M09-10 S23). */
export const formatDateTimeEnCompact12 = (input: DateInput) =>
  formatMyt(input, 'dd MMM yyyy, h:mmA', { months: 'en' })
