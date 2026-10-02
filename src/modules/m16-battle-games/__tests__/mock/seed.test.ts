/**
 * M16-T1 seed: the documented figures of SRS M16 v1.6 §6.10, §6.11 against the computed stores
 * (battles 168 / 0 / 66, windows, standings, leagues, Sekolah Bersaing, the M11 port).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { registerM16Reads } from '@/modules/m11-teacher-analytics/mock'

import {
  battleStandings,
  battles,
  gameResults,
  leagues,
  sekolahBersaing,
  standings,
  tournaments,
} from '../../mock'
import { bootM16, MemoryStorage, type Booted } from './helpers'

// M11's reader port is a module-level registration: spy on it to see what the M16 seed registers.
vi.mock('@/modules/m11-teacher-analytics/mock', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/m11-teacher-analytics/mock')>()
  return { ...original, registerM16Reads: vi.fn(original.registerM16Reads) }
})

let booted: Booted
/** What the seed registered (captured before the config's `clearMocks` runs between tests). */
let registered: Parameters<typeof registerM16Reads>[0] | undefined

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
  registered = vi.mocked(registerM16Reads).mock.calls.at(-1)?.[0]
}, 180_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
})

describe('battles (Q-M16-BATTLES, M17 XR-M17-15)', () => {
  it('holds 168 battles: 0 active, 66 finished, 5 forfeited, 97 abandoned', () => {
    expect(battles.m17Counts()).toEqual({ total: 168, active: 0, finished: 66 })
    expect(battles.count('Q-BAT-STATUS', 'forfeited')).toBe(5)
    expect(battles.count('Q-BAT-STATUS', 'abandoned')).toBe(97)
  })

  it.each([
    [7, { battles: 0, games: 0 }],
    [30, { battles: 4, games: 5 }],
    [90, { battles: 23, games: 47 }],
  ])('windowCounts(%i days)', (days, expected) => {
    expect(battles.windowCounts(days)).toEqual(expected)
  })

  it('has 47 submitted game results', () => {
    expect(gameResults.count('Q-GAME-SUBMITTED')).toBe(47)
  })

  it('serves the 47 observed rows with fixed uuids', () => {
    const first = battles.get('00000000-0000-4000-8000-000000000001')
    expect(first).toMatchObject({
      playerA: 4301,
      playerB: 4302,
      scoreA: 9445,
      scoreB: 9763,
      winner: 'B',
    })
    expect(battles.get('00000000-0000-4000-8000-000000000002')).toMatchObject({ winner: null })
    expect(battles.get('00000000-0000-4000-8000-000000000018')).toMatchObject({
      scoreA: 0,
      scoreB: 0,
      winner: 'B',
    })
  })

  it('lists the observed recent battles of each school (Q-BAT-RECENT)', () => {
    const counts = Object.fromEntries(
      [8106, 8090, 8078, 8082, 8880, 2710, 8080, 900].map((id) => [
        id,
        battles.recentForSchool(id).length,
      ]),
    )
    expect(counts).toEqual({
      8106: 10,
      8090: 9,
      8078: 10,
      8082: 5,
      8880: 3,
      2710: 3,
      8080: 10,
      900: 0,
    })
  })

  it('S4 text of the newest 8082 row is "1 minggu yang lepas" (createdAt 2026-09-16)', () => {
    const rows = battles.recentForSchool(8082)
    expect(rows[0]?.createdAt).toBe('2026-09-16T21:58:00+08:00')
  })
})

describe('school standings (§6.11.2)', () => {
  it('all time: 7 schools equal to live, except 8082 (DV-M16-36)', () => {
    const rows = battleStandings.schools('all_time')
    expect(
      rows.map((r) => [
        r.rank,
        r.schoolId,
        r.battles,
        r.menang,
        r.seri,
        r.kalah,
        r.ketepatan,
        r.pelajar,
        r.skor,
      ]),
    ).toEqual([
      [1, 8106, 19, 12, 1, 6, 69, 7, 738],
      [2, 8090, 18, 9, 0, 9, 48, 2, 519],
      [3, 8078, 40, 20, 0, 20, 29, 18, 367],
      [4, 8082, 10, 5, 0, 5, 29, 4, 367],
      [5, 8880, 3, 2, 0, 1, 33, 1, 340],
      [6, 8080, 30, 15, 0, 15, 24, 10, 303],
      [7, 2710, 3, 1, 0, 2, 8, 1, 87],
    ])
  })

  it('monthly (2026-09) lists 8082 only; weekly is empty', () => {
    const month = battleStandings.schools('monthly')
    expect(
      month.map((r) => [
        r.schoolId,
        r.battles,
        r.menang,
        r.seri,
        r.kalah,
        r.ketepatan,
        r.pelajar,
        r.skor,
      ]),
    ).toEqual([[8082, 8, 4, 0, 4, 58, 2, 591]])
    expect(battleStandings.schools('weekly')).toEqual([])
  })

  it('a state filter keeps the national rank', () => {
    const johor = battleStandings.schools('all_time', 'Johor')
    expect(johor.map((r) => [r.schoolId, r.rank])).toEqual([
      [8880, 5],
      [2710, 7],
    ])
  })

  it('standings.school (§7.2)', () => {
    expect(standings.school(8106, 'all_time')?.skor).toBe(738)
    expect(standings.school(900, 'all_time')).toBeNull()
  })

  it('student standings: weekly none, monthly 4316 and 4317 with 2 / 0 / 2 each', () => {
    expect(battleStandings.students('weekly')).toEqual([])
    const month = battleStandings.students('monthly')
    expect(month.map((r) => [r.userId, r.menang, r.seri, r.kalah])).toEqual(
      expect.arrayContaining([
        [4316, 2, 0, 2],
        [4317, 2, 0, 2],
      ]),
    )
    expect(month).toHaveLength(2)
  })
})

describe('leagues, tournaments and Sekolah Bersaing seeds', () => {
  it('has no tournament (as live)', () => {
    expect(tournaments.active()).toEqual([])
    expect(tournaments.count('Q-TOURN-ACTIVE')).toBe(0)
  })

  it('has liga 1 and liga 2 with 3 and 2 schools', () => {
    expect(leagues.schoolCount(1)).toBe(3)
    expect(leagues.schoolCount(2)).toBe(2)
    expect(leagues.count('Q-LEAGUE-OPEN')).toBe(1)
    expect(leagues.list(900002)).toMatchObject({ mine: [], open: [{ id: 1 }] })
    expect(leagues.get(2, 900002)?.standings.T4?.[0]).toMatchObject({
      schoolId: 8090,
      peserta: 8,
      skor: 2935,
      purata: 77.2,
    })
  })

  it.each([
    ['2026-09-21', 49],
    ['2026-09-14', 48],
    ['2026-09-07', 48],
    ['2026-08-31', 48],
    ['2025-01-06', 0],
  ])('Q-SB-WEEK(%s) = %i', (week, count) => {
    expect(sekolahBersaing.view(week).count).toBe(count)
  })
})

describe('M11 reader port (XR-M16-05)', () => {
  it('is registered by the seed and counts finished and forfeited battles per user', () => {
    const reader = registered
    expect(reader).toBeDefined()
    const range = { from: 0, to: Date.now() + 10 ** 12 }
    const map = reader?.battles.countFor([4316, 4317, 1], range)
    expect(map?.get(4316)).toMatchObject({ count: 4 })
    expect(map?.has(1)).toBe(false)
    const games = reader?.gameResults.countFor(
      Array.from({ length: 30 }, (_, i) => 4302 + i),
      range,
    )
    expect([...(games?.values() ?? [])].reduce((n, g) => n + g.count, 0)).toBe(47)
  })

  it('counts per user inside [from, to): finished and forfeited battles, both sides', () => {
    const at = Date.parse('2026-09-16T21:58:00+08:00')
    // Battles 30-33 (16 Sep 21:55-21:58): `to` is exclusive.
    expect(battles.countFor([4316], { from: at, to: at }).size).toBe(0)
    expect(battles.countFor([4316], { from: at, to: at + 1 }).get(4316)).toEqual({
      count: 1,
      correct: 10, // floor(8313 / 500) = 16, capped at 10 (PROPOSED seed rule)
      answered: 10,
    })
    const all = battles.countFor([4316, 4317], { from: 0, to: at + 1 })
    expect(all.get(4316)).toMatchObject({ count: 4, answered: 40 })
    expect(all.get(4317)).toMatchObject({ count: 4, answered: 40 })
  })
})
