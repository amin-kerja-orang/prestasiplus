/**
 * The risk read model over the real owner data at the project clock (2026-09-25T15:40+08:00): which
 * observed anchors of SRS M18 Q-M18-RISK / C25 the current owner data reproduces, which it does not
 * (documented as `it.todo`, never tuned), cache behaviour and the warm-up performance budget.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_MS } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'

import { MASTERY_THRESHOLDS, masteryLevel } from '@/modules/m05-practice/mock'

import { risk } from '../../mock'
import { MASTERY_LADDER, masteryLevelOf } from '../../mock/repository/risk'
import { MemoryStorage, bootM18 } from './boot'

vi.setConfig({ testTimeout: 180_000 })

const now = CLOCK_ANCHOR_MS
const avg = (schoolIds: number[]): number => {
  const rows = schoolIds.flatMap((id) => risk.pupilsForSchool(id, { now }))
  return Math.round((rows.reduce((a, r) => a + r.score, 0) / rows.length) * 10) / 10
}

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  await bootM18()
}, 600_000)

describe('observed anchors reproduced by the current owner data', () => {
  it('class 1156 pupil (user 4627): 44.7 at the clock, 45.7 one day later', () => {
    const [p] = risk.pupilsForClass(1156, { now })
    expect(p?.userId).toBe(4627)
    expect(p?.score).toBe(44.7)
    expect(p?.status).toBe('watch')
    expect(p?.accuracy).toBeCloseTo(58.6, 1)
    expect(p?.masteryMean).toBeCloseTo(3.947, 3)
    expect(risk.pupilsForClass(1156, { now: now + 86_400_000 })[0]?.score).toBe(45.7)
    expect(risk.forClass(1156, { now })).toEqual({ total: 1, onTrack: 0, watch: 1, high: 0 })
  })

  it('PPD BATANG PADANG: 33 pupils, all red; 7780 97.6, school 1 97.5, district 97.6', () => {
    expect(risk.forSchool(7780, { now })).toEqual({ total: 17, onTrack: 0, watch: 0, high: 17 })
    expect(risk.forSchool(1, { now })).toEqual({ total: 16, onTrack: 0, watch: 0, high: 16 })
    expect(avg([7780])).toBe(97.6)
    expect(avg([1])).toBe(97.5)
    expect(avg([7780, 1])).toBe(97.6)
    // 29 x 100 then 4 x 80 (AC-M18-28.3)
    const rows = risk.pupilsForScope(
      { kind: 'district', district: 'PPD BATANG PADANG', state: 'Perak' },
      { now },
    )
    expect(rows.map((r) => r.score)).toEqual([...Array(29).fill(100), ...Array(4).fill(80)])
  })

  it('PPD KLUANG: 135 pupils, all red (S1 "Pelajar Berisiko Merah" 135)', () => {
    const t = risk.forScope({ kind: 'district', district: 'PPD KLUANG', state: 'Johor' }, { now })
    expect(t.total).toBe(135)
    expect(t.high).toBe(135)
  })

  it('8880 TINGGI KLUANG: 59 pupils, all red (S28 tiles 59 / 0 / 0 / 59)', () => {
    expect(risk.forSchool(8880, { now })).toEqual({ total: 59, onTrack: 0, watch: 0, high: 59 })
  })

  it('7780 and school 1 hold exactly two score-80 pupils each', () => {
    for (const id of [7780, 1]) {
      expect(risk.pupilsForSchool(id, { now }).filter((r) => r.score === 80)).toHaveLength(2)
    }
  })
})

describe('observed anchors NOT reproduced (owner data gaps, never tuned)', () => {
  it.todo(
    'KLUANG score-80 "belum mula latih" = 49 (8880 42, 8767 2, 8772 2, 2700 2, 8765 1): with the single stored-mastery source now: 135 red, 26 score-80 (8880 19, 8767 2, 8772 2, 2700 2, 8765 1): 8880 is 19 not 42 until M05 seeds change (XL-R10-01)',
  )
  it.todo(
    '8880 average 84.0 and its 42 "Tiada aktiviti" score-80 pupils: with the single source 8880 averages 87.6 (not 84.0) and has 19 such pupils: M05 seed gap (XL-R10-01)',
  )
  it.todo(
    '8765 scores 72.2 / 67 and 2700 88.6: sessions are M18 display values (DATA-M18-07), not yet mapped to pupils',
  )
})

describe('behaviour of the read model', () => {
  it('pupils are ordered score descending (BR-M18-22) and ranked consistently', () => {
    const rows = risk.pupilsForSchool(8880, { now })
    for (let i = 1; i < rows.length; i++)
      expect((rows[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
        (rows[i] as { score: number }).score,
      )
  })

  it('the tingkatan filter keeps only class members of that level (FN-M18-4.6.1)', () => {
    const all = risk.forSchool(8880, { now })
    const t4 = risk.pupilsForSchool(8880, { now, tingkatan: 4 })
    const t5 = risk.pupilsForSchool(8880, { now, tingkatan: 5 })
    expect(t4.length).toBeLessThanOrEqual(all.total)
    expect(t4.every((r) => r.classTingkatan.includes(4))).toBe(true)
    expect(t5.every((r) => r.classTingkatan.includes(5))).toBe(true)
    expect(risk.forSchool(8880, { now, tingkatan: 4 }).total).toBe(t4.length)
  })

  it('a school without pupils (or an unknown one) has an all-zero tally', () => {
    expect(risk.forSchool(999_999_999, { now })).toEqual({
      total: 0,
      onTrack: 0,
      watch: 0,
      high: 0,
    })
  })

  it('pupilsForClass of an unknown class is empty', () => {
    expect(risk.pupilsForClass(987_654_321, { now })).toEqual([])
  })

  it('tallies add up to the total for every observed school', () => {
    for (const id of [8880, 8765, 2700, 2710, 3160, 8767, 8772, 7780, 1]) {
      const t = risk.forSchool(id, { now })
      expect(t.onTrack + t.watch + t.high).toBe(t.total)
      expect(t.total).toBe(users.countWhere({ role: 'student', schoolId: id }))
    }
  })

  it('the result follows the clock (the same pupils score lower earlier)', () => {
    const early = risk.pupilsForClass(1156, { now: Date.parse('2026-09-16T12:00:00+08:00') })[0]
    expect(early?.score).toBeLessThan(44.7)
  })
})

describe('one mastery source for every path', () => {
  it('the class-row score equals the school-row score for every pupil (class 1156 school and a large school)', () => {
    const cls = risk.pupilsForClass(1156, { now })
    expect(cls.length).toBeGreaterThan(0)
    const schoolIds = new Set<number>([8880, ...cls.map((r) => r.schoolId)])
    for (const sid of schoolIds) {
      const bySchool = new Map(risk.pupilsForSchool(sid, { now }).map((r) => [r.userId, r]))
      expect(bySchool.size).toBeGreaterThan(0)
      for (const r of cls.filter((c) => c.schoolId === sid))
        expect(bySchool.get(r.userId)?.score).toBe(r.score)
    }
    // a large school: every class of it, pupil by pupil
    const rows = risk.pupilsForSchool(8880, { now })
    const classIds = new Set(rows.flatMap((r) => r.classes.filter((c) => c.kind === 'classroom').map((c) => c.id)))
    for (const id of [...classIds].slice(0, 6))
      for (const r of risk.pupilsForClass(id, { now }))
        expect(rows.find((x) => x.userId === r.userId)?.score).toBe(r.score)
  })

  it('the mastery ladder is the M05 own export', () => {
    expect(MASTERY_LADDER).toBe(MASTERY_THRESHOLDS)
    for (let c = 0; c <= 1600; c += 7) expect(masteryLevelOf(c)).toBe(masteryLevel(c))
  })
})
