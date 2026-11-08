import { describe, expect, it } from 'vitest'

import {
  accuracyPct,
  buildStandings,
  compareStanding,
  gradeOfLevel,
  hourStart,
  leagueStatus,
  leagueWindow,
  parseLevelQuery,
  pupilPoints,
  type PupilFacts,
} from '../../../src/modules/games/leagues/leagues.rules'

/** Pure rules of the league standings (S7-T06 part 3): no database. */
describe('league standings rules', () => {
  describe('leagueStatus (derived by date, MYT boundaries)', () => {
    const status = (at: string) => leagueStatus('2026-10-20', '2026-10-21', new Date(at))
    it('upcoming before start 00:00 MYT, active through end 23:59:59 MYT, ended from the next midnight', () => {
      expect(status('2026-10-19T23:59:59.999+08:00')).toBe('upcoming')
      expect(status('2026-10-20T00:00:00+08:00')).toBe('active')
      expect(status('2026-10-21T23:59:59+08:00')).toBe('active')
      expect(status('2026-10-21T23:59:59.999+08:00')).toBe('active')
      expect(status('2026-10-22T00:00:00+08:00')).toBe('ended')
    })
    it('reads the instant, not the UTC date (16:00Z is already the next MYT day)', () => {
      expect(status('2026-10-19T16:00:00Z')).toBe('active')
      expect(status('2026-10-21T16:00:00Z')).toBe('ended')
    })
    it('a one-day league is active for that whole MYT day', () => {
      expect(leagueStatus('2026-10-20', '2026-10-20', new Date('2026-10-20T23:59:59+08:00'))).toBe('active')
    })
  })

  it('leagueWindow is [start 00:00 MYT, midnight after end MYT)', () => {
    const w = leagueWindow('2026-10-01', '2026-10-31')
    expect(w.from.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    expect(w.to.toISOString()).toBe('2026-10-31T16:00:00.000Z')
  })

  it('hourStart floors to the clock hour', () => {
    expect(hourStart(new Date('2026-10-19T14:59:59.999+08:00')).toISOString()).toBe('2026-10-19T06:00:00.000Z')
  })

  it('accuracyPct has one decimal, 0 without answers', () => {
    expect(accuracyPct(21, 30)).toBe(70)
    expect(accuracyPct(20, 30)).toBe(66.7)
    expect(accuracyPct(0, 0)).toBe(0)
  })

  describe('pupilPoints', () => {
    const f = { correct: 7, battlePoints: 4, wins: 2 }
    it('quiz = correct answers only; multiplayer = Battle points and wins only; mixed = both', () => {
      expect(pupilPoints('quiz', f)).toEqual({ points: 7, wins: 0 })
      expect(pupilPoints('multiplayer', f)).toEqual({ points: 4, wins: 2 })
      expect(pupilPoints('mixed', f)).toEqual({ points: 11, wins: 2 })
    })
  })

  describe('compareStanding', () => {
    it('score desc, participants desc, name asc (Malay collation)', () => {
      const rows = [
        { skor: 5, peserta: 1, name: 'SMK Bukit' },
        { skor: 9, peserta: 1, name: 'SMK Zaitun' },
        { skor: 5, peserta: 3, name: 'SMK Cemara' },
        { skor: 5, peserta: 1, name: 'SMK Anggerik' },
      ]
      expect([...rows].sort(compareStanding).map((r) => r.name)).toEqual(['SMK Zaitun', 'SMK Cemara', 'SMK Anggerik', 'SMK Bukit'])
    })
  })

  describe('buildStandings', () => {
    const schools = [
      { id: '1', name: 'SMK Alpha' },
      { id: '2', name: 'SMK Beta' },
    ]
    const p = (userId: string, schoolId: string, level: string, o: Partial<PupilFacts>): PupilFacts => ({ userId, schoolId, level, points: 0, wins: 0, answered: 0, correct: 0, ...o })

    it('total_score sums points per level and school; participants = pupils with points; empty schools keep a zero row', () => {
      const rows = buildStandings('total_score', ['T4', 'T5'], schools, [
        p('a', '1', 'T4', { points: 3, answered: 4, correct: 3 }),
        p('b', '1', 'T4', { points: 4, answered: 4, correct: 4 }),
        p('c', '1', 'T4', { points: 0, answered: 2, correct: 0 }),
        p('d', '2', 'T5', { points: 1, answered: 1, correct: 1 }),
      ])
      expect(rows).toEqual([
        { level: 'T4', schoolId: '1', peserta: 2, skor: 7, purata: 70 },
        { level: 'T4', schoolId: '2', peserta: 0, skor: 0, purata: 0 },
        { level: 'T5', schoolId: '2', peserta: 1, skor: 1, purata: 100 },
        { level: 'T5', schoolId: '1', peserta: 0, skor: 0, purata: 0 },
      ])
    })

    it('avg_accuracy: 29 answers are not ranked, 30 are (per school and level)', () => {
      expect(buildStandings('avg_accuracy', ['T4'], schools, [p('a', '1', 'T4', { points: 20, answered: 29, correct: 20 })])).toEqual([])
      const ranked = buildStandings('avg_accuracy', ['T4'], schools, [
        p('a', '1', 'T4', { points: 21, answered: 15, correct: 11 }),
        p('b', '1', 'T4', { points: 10, answered: 15, correct: 10 }),
        p('c', '2', 'T4', { points: 5, answered: 29, correct: 29 }),
      ])
      expect(ranked).toEqual([{ level: 'T4', schoolId: '1', peserta: 2, skor: 70, purata: 70 }])
    })

    it('wins scoring ranks by won Battles', () => {
      const rows = buildStandings('wins', ['T4'], schools, [p('a', '1', 'T4', { points: 3, wins: 1 }), p('b', '2', 'T4', { points: 1, wins: 4 })])
      expect(rows.map((r) => [r.schoolId, r.skor])).toEqual([
        ['2', 4],
        ['1', 1],
      ])
    })
  })

  describe('parseLevelQuery', () => {
    it('absent = default (null), 1..5 = T1..T5, anything else = invalid (undefined)', () => {
      expect(parseLevelQuery(undefined)).toBeNull()
      expect(parseLevelQuery('')).toBeNull()
      expect(parseLevelQuery('1')).toBe('T1')
      expect(parseLevelQuery('5')).toBe('T5')
      for (const bad of ['0', '6', 'T4', '4.5', '-1', '01', ' 4', {}]) expect(parseLevelQuery(bad)).toBeUndefined()
      expect(parseLevelQuery(['4', '5'])).toBe('T4')
    })
  })

  it('gradeOfLevel inverts levelCodeOfGrade (D1..D6 = 1..6, T1..T5 = 7..11)', () => {
    expect(['D1', 'D6', 'T1', 'T5'].map(gradeOfLevel)).toEqual([1, 6, 7, 11])
    expect(['T6', 'D7', 'X1', 'T'].map(gradeOfLevel)).toEqual([null, null, null, null])
  })
})
