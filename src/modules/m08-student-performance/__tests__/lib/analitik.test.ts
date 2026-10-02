import { describe, expect, it } from 'vitest'

import {
  RING_LENGTH,
  accuracyText,
  cut,
  dayLabel,
  focusHref,
  heatClass,
  masteryTone,
  ringDash,
  studyTime,
  weakTitle,
} from '../../lib/analitik'

describe('cut', () => {
  it('keeps text up to the limit and cuts longer text with "..."', () => {
    expect(cut('a'.repeat(70), 70)).toBe('a'.repeat(70))
    expect(cut('a'.repeat(71), 70)).toBe(`${'a'.repeat(70)}...`)
  })

  it('does not leave a space before the dots', () => {
    expect(cut(`${'a'.repeat(69)} bcd`, 70)).toBe(`${'a'.repeat(69)}...`)
  })

  it('builds the "{code} — {title}" label with the 70 / 100 limits', () => {
    const sp = { code: '5.1.2', title: 'x'.repeat(200) }
    expect(weakTitle(sp, 70)).toHaveLength(70 + 3)
    expect(weakTitle(sp, 100)).toHaveLength(100 + 3)
    expect(weakTitle({ code: '1.1', title: 'Pendek' }, 70)).toBe('1.1 — Pendek')
  })
})

describe('focusHref (BR-M08-16)', () => {
  it('puts level, dskp_sp_id and count in the observed order', () => {
    expect(focusHref({ subjectCode: 'BM', spId: 221, count: 16, levelId: 4 })).toBe(
      '/practice/BM/quiz?level=4&dskp_sp_id=221&count=16',
    )
  })

  it('leaves level out when the SP record has none (S6)', () => {
    expect(focusHref({ subjectCode: 'MATH', spId: 34, count: 4, levelId: null })).toBe(
      '/practice/MATH/quiz?dskp_sp_id=34&count=4',
    )
  })
})

describe('ringDash (FR-M08-49)', () => {
  it('is 314 × ratio and 314 × (1 − ratio)', () => {
    expect(ringDash(3, 3)).toBe('314 0')
    expect(ringDash(0, 4)).toBe('0 314')
    expect(ringDash(8, 23)).toBe(
      `${String(RING_LENGTH * (8 / 23))} ${String(RING_LENGTH * (1 - 8 / 23))}`,
    )
  })

  it('has no arc for 0 SP and never exceeds the circle', () => {
    expect(ringDash(0, 0)).toBe('0 314')
    expect(ringDash(8, 2)).toBe('314 0')
  })
})

describe('colour and format rules', () => {
  it('colours the KPI accuracy red < 50, amber 50–74.9, green ≥ 75', () => {
    expect(accuracyText(40.5)).toBe('text-red-600')
    expect(accuracyText(50)).toBe('text-amber-600')
    expect(accuracyText(74.9)).toBe('text-amber-600')
    expect(accuracyText(75)).toBe('text-green-600')
  })

  it('buckets the heatmap by BR-M08-11', () => {
    expect([0, 1, 2, 3, 4, 9].map(heatClass)).toEqual([
      'bg-slate-100',
      'bg-green-200',
      'bg-green-400',
      'bg-green-600',
      'bg-green-700',
      'bg-green-700',
    ])
  })

  it('colours the mastery bar ≥ 80, 60–79.9, < 60', () => {
    expect(masteryTone(89).bar).toBe('bg-emerald-500')
    expect(masteryTone(65).bar).toBe('bg-amber-500')
    expect(masteryTone(53).bar).toBe('bg-red-500')
  })

  it('formats the study time as "{h}j {m}m" from 60 minutes else "{m}m"', () => {
    expect(studyTime(0)).toBe('0m')
    expect(studyTime(840)).toBe('14m')
    expect(studyTime(3540)).toBe('59m')
    expect(studyTime(7740)).toBe('2j 9m')
  })

  it('writes the day tooltip with the Malay weekday', () => {
    // 28 June 2026 is a Sunday, 24 September 2026 a Thursday (observed live: "28/06 (Ahad)").
    expect(dayLabel('2026-06-28', 0)).toBe('28/06 (Ahad) — Tiada aktiviti')
    expect(dayLabel('2026-09-24', 1)).toBe('24/09 (Khamis) — 1 sesi')
  })
})
