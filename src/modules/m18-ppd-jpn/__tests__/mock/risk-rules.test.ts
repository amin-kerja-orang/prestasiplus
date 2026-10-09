/**
 * BR-M18-13 / BR-M18-14 unit tests (no boot): the formula, the A = 100 / A = 50 branches (v1.7), the
 * whole-day engagement rule and the status bands, plus the CSV helpers.
 */

import { describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_MS } from '@/lib/time'

import { csvCell, parseTingkatan, tallyView } from '../../mock/repository/amaran'
import { computeRisk, masteryLevelOf, statusOf } from '../../mock/repository/risk'

const NOW = CLOCK_ANCHOR_MS // 2026-09-25T15:40+08:00
const none = {
  accuracy: null,
  sessions: 0,
  lastActiveAt: null,
  masteryMean: null,
  masteryRecords: 0,
}

describe('BR-M18-13 risk score', () => {
  it('never active (no session, no activity, no mastery): A = 50, E = 100, M = 100 -> 80', () => {
    const r = computeRisk(none, NOW)
    expect(r).toMatchObject({ a: 50, e: 100, m: 100, score: 80, status: 'high', neverActive: true })
    expect(r.daysSinceActive).toBeNull()
  })

  it('an activity date without session or mastery: A = 100 -> 100 ("Tiada data")', () => {
    // 2026-02-26 is more than 30 days before the clock, so E = 100.
    const r = computeRisk({ ...none, lastActiveAt: '2026-02-26T12:00:00+08:00' }, NOW)
    expect(r).toMatchObject({ a: 100, e: 100, m: 100, score: 100, neverActive: false })
  })

  it('mastery only (no session, no activity): A = 100 by the mastery branch, M from the level -> 97 for L1', () => {
    const r = computeRisk({ ...none, masteryMean: 1, masteryRecords: 2 }, NOW)
    expect(r).toMatchObject({ a: 100, e: 100, m: 90, score: 97, neverActive: false })
  })

  it('the class-1156 pupil: 58.6 %, active 2026-09-15 (10 whole days), mastery 3.95 -> 44.7 (watch)', () => {
    const r = computeRisk(
      {
        accuracy: 58.611111111111114,
        sessions: 3,
        lastActiveAt: '2026-09-15T12:00:00+08:00',
        masteryMean: 75 / 19,
        masteryRecords: 19,
      },
      NOW,
    )
    expect(r.daysSinceActive).toBe(10)
    expect(r.score).toBe(44.7)
    expect(r.status).toBe('watch')
  })

  it('one day later (26 Sep, 11 whole days) the same pupil scores 45.7 as observed live', () => {
    const r = computeRisk(
      {
        accuracy: 58.611111111111114,
        sessions: 3,
        lastActiveAt: '2026-09-15T12:00:00+08:00',
        masteryMean: 75 / 19,
        masteryRecords: 19,
      },
      NOW + 86_400_000,
    )
    expect(r.score).toBe(45.7)
  })

  it('E caps at 100 after 30 days and is 0 on the day of activity', () => {
    expect(computeRisk({ ...none, lastActiveAt: '2026-08-01T00:00:00+08:00' }, NOW).e).toBe(100)
    expect(computeRisk({ ...none, lastActiveAt: '2026-09-25T09:00:00+08:00' }, NOW).e).toBe(0)
  })

  it('an activity date in the future counts as 0 days', () => {
    expect(computeRisk({ ...none, lastActiveAt: '2026-10-01T00:00:00+08:00' }, NOW).e).toBe(0)
  })

  it('a perfect, recent, expert pupil scores low (on track)', () => {
    const r = computeRisk(
      {
        accuracy: 95,
        sessions: 20,
        lastActiveAt: '2026-09-25T10:00:00+08:00',
        masteryMean: 8,
        masteryRecords: 5,
      },
      NOW,
    )
    expect(r.score).toBe(0.4 * 5 + 0.3 * 0 + 0.3 * 20)
    expect(r.status).toBe('on_track')
  })

  it('a session with accuracy 0 is A = 100 (a session counts even with no correct answer)', () => {
    const r = computeRisk({ ...none, accuracy: 0, sessions: 1 }, NOW)
    expect(r.a).toBe(100)
    expect(r.neverActive).toBe(false)
  })

  it('rounds to one decimal', () => {
    const r = computeRisk(
      {
        accuracy: 33.333,
        sessions: 3,
        lastActiveAt: '2026-09-20T10:00:00+08:00',
        masteryMean: 2.5,
        masteryRecords: 2,
      },
      NOW,
    )
    expect(Number.isInteger(r.score * 10)).toBe(true)
  })
})

describe('BR-M18-14 status bands', () => {
  it.each([
    [0, 'on_track'],
    [39.9, 'on_track'],
    [40, 'watch'],
    [59.9, 'watch'],
    [60, 'high'],
    [100, 'high'],
  ] as const)('score %s -> %s', (score, status) => {
    expect(statusOf(score)).toBe(status)
  })
})

describe('mastery ladder (M05 BR-20)', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [25, 2],
    [50, 3],
    [100, 4],
    [200, 5],
    [1500, 10],
    [99999, 10],
  ])('%s correct -> L%s', (correct, level) => {
    expect(masteryLevelOf(correct)).toBe(level)
  })
})

describe('read-model helpers', () => {
  it('tallyView maps onTrack / watch / high to Hijau / Kuning / Merah with integer percentages', () => {
    expect(tallyView({ total: 3, onTrack: 1, watch: 1, high: 1 })).toEqual({
      green: 1,
      yellow: 1,
      red: 1,
      total: 3,
      pct: { green: 33, yellow: 33, red: 33 },
    })
    expect(tallyView({ total: 0, onTrack: 0, watch: 0, high: 0 }).pct).toEqual({
      green: 0,
      yellow: 0,
      red: 0,
    })
  })

  it('parseTingkatan accepts T4 / T5 / 4 / 5 and ignores anything else', () => {
    expect(parseTingkatan('T4')).toBe(4)
    expect(parseTingkatan('t5')).toBe(5)
    expect(parseTingkatan('4')).toBe(4)
    expect(parseTingkatan('T3')).toBeUndefined()
    expect(parseTingkatan(undefined)).toBeUndefined()
  })

  it('csvCell guards formula injection and quotes separators (SEC-M18-03)', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@x')).toBe("'@x")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
    expect(csvCell(12)).toBe('12')
  })
})
