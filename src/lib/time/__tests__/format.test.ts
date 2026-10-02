import { describe, expect, it } from 'vitest'

import {
  formatDate,
  formatDateCompact,
  formatDateEn,
  formatDateEnUnpadded,
  formatDateKey,
  formatDateLong,
  formatDateShortMs,
  formatDateTime,
  formatDateTimeEn,
  formatDateTimeEn12,
  formatDateTimeEnCompact12,
  formatDateTimeRaw,
  formatDayMonth,
  formatMonthYear,
  formatMyt,
  formatTime,
  formatTime12,
} from '../format'
import { MONTHS_MS, MONTHS_MS_SHORT, monthName } from '../months'

const ANCHOR = '2026-09-25T15:40:00+08:00'

describe('numeric formats', () => {
  it('dd/mm/yyyy (M02 BR-33, M07 BR-M07-22, M09 S1/S9)', () => {
    expect(formatDate(ANCHOR)).toBe('25/09/2026')
    expect(formatDate('2026-03-05 08:00:00')).toBe('05/03/2026')
  })

  it('dd/mm/yyyy HH:mm, 24 h (M02 BR-33, M04, M11 BR-M11-11)', () => {
    expect(formatDateTime(ANCHOR)).toBe('25/09/2026 15:40')
    expect(formatDateTime('2026-01-02T00:05:00+08:00')).toBe('02/01/2026 00:05')
  })

  it('HH:mm (M01 push times "05:30", M04 S10)', () => {
    expect(formatTime('2026-09-25 05:30:00')).toBe('05:30')
    expect(formatTime(ANCHOR)).toBe('15:40')
  })

  it('dd/mm chart labels (M05 S8 "19/02", "11/05")', () => {
    expect(formatDayMonth('2026-02-19 10:00')).toBe('19/02')
    expect(formatDayMonth('2026-05-11 10:00')).toBe('11/05')
  })

  it('raw, key and compact forms (M11 modal, M02 invoice ref)', () => {
    expect(formatDateTimeRaw('2026-09-25T15:40:07+08:00')).toBe('2026-09-25 15:40:07')
    expect(formatDateKey(ANCHOR)).toBe('2026-09-25')
    expect(formatDateCompact(ANCHOR)).toBe('20260925')
  })

  it('uses Malaysian time, not UTC or the browser zone', () => {
    // 16:30 UTC on the 24th is 00:30 on the 25th in Malaysia.
    expect(formatDateTime('2026-09-24T16:30:00Z')).toBe('25/09/2026 00:30')
    expect(formatDateTime(new Date(Date.UTC(2026, 11, 31, 16, 0)))).toBe('01/01/2027 00:00')
  })
})

describe('BM month names', () => {
  it('d MMMM yyyy (M01 "Ahli sejak", M08 BR-M08-25, SRS §7.4 "25 September 2026")', () => {
    expect(formatDateLong(ANCHOR)).toBe('25 September 2026')
    expect(formatDateLong('2026-03-17 23:23')).toBe('17 Mac 2026')
    expect(formatDateLong('2026-01-05')).toBe('5 Januari 2026')
  })

  it('has the full BM month table', () => {
    expect(MONTHS_MS).toEqual([
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
    ])
    expect(MONTHS_MS_SHORT.join(' ')).toBe('Jan Feb Mac Apr Mei Jun Jul Ogs Sep Okt Nov Dis')
    expect(() => monthName(13)).toThrow(RangeError)
  })

  it('{BM month} {yyyy} (M05 BR-03 S11, "Mei 2026")', () => {
    expect(formatMonthYear('2026-05-19 03:49')).toBe('Mei 2026')
    expect(formatMonthYear('2026-12-01')).toBe('Disember 2026')
  })

  it('M09 S28: "17 Mac 2026" · "11:23 PM"', () => {
    const at = '2026-03-17 23:23:00'
    expect(formatDateShortMs(at)).toBe('17 Mac 2026')
    expect(formatTime12(at)).toBe('11:23 PM')
    expect(formatDateShortMs('2026-08-03')).toBe('3 Ogs 2026')
  })
})

describe('English month abbreviations', () => {
  it('dd Mon yyyy (M04 "08 Apr 2026", "20 May 2026"; M09 "22 Feb 2026")', () => {
    expect(formatDateEn('2026-04-08 09:00')).toBe('08 Apr 2026')
    expect(formatDateEn('2026-05-20 09:00')).toBe('20 May 2026')
    expect(formatDateEn('2026-02-22')).toBe('22 Feb 2026')
  })

  it('d MMM yyyy (M08 "Direkod", M11 "12 May 2027"; M05 "19 May 2026")', () => {
    expect(formatDateEnUnpadded('2027-05-12')).toBe('12 May 2027')
    expect(formatDateEnUnpadded('2026-05-19')).toBe('19 May 2026')
    expect(formatDateEnUnpadded('2026-04-08')).toBe('8 Apr 2026')
  })

  it('Laravel d M Y, H:i (M05 BR-03 S9 "19 May 2026, 03:49")', () => {
    expect(formatDateTimeEn('2026-05-19 03:49:12')).toBe('19 May 2026, 03:49')
  })

  it('d MMM yyyy, hh:mm A (M06 history)', () => {
    expect(formatDateTimeEn12('2026-05-19 15:49')).toBe('19 May 2026, 03:49 PM')
    expect(formatDateTimeEn12('2026-05-09 03:49')).toBe('9 May 2026, 03:49 AM')
  })

  it('dd Mon yyyy, h:mmAM (M09 S23 "17 Mar 2026, 11:23PM")', () => {
    expect(formatDateTimeEnCompact12('2026-03-17 23:23:00')).toBe('17 Mar 2026, 11:23PM')
    expect(formatDateTimeEnCompact12('2026-03-07 09:05:00')).toBe('07 Mar 2026, 9:05AM')
  })
})

describe('formatMyt token engine', () => {
  it('handles 12-hour midnight and noon', () => {
    expect(formatMyt('2026-09-25 00:05', 'h:mm A')).toBe('12:05 AM')
    expect(formatMyt('2026-09-25 12:00', 'hh:mm A')).toBe('12:00 PM')
    expect(formatMyt('2026-09-25 13:00', 'H h')).toBe('13 1')
  })

  it('keeps [literal] text', () => {
    expect(formatMyt(ANCHOR, '[Tarikh:] dd/MM/yyyy [pada] HH:mm')).toBe(
      'Tarikh: 25/09/2026 pada 15:40',
    )
  })

  it('supports numeric months and seconds', () => {
    expect(formatMyt('2026-03-05 08:09:07', 'd/M/yyyy ss')).toBe('5/3/2026 07')
  })
})
