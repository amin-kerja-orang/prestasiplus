import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { identitySeed } from '../../../prisma/seed/core/identity'
import { populationSeed } from '../../../prisma/seed/core/population'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { schoolsSeed } from '../../../prisma/seed/core/schools'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { gamesSeed } from '../../../prisma/seed/games'
import { createTestDatabase, type TestDatabase } from '../../support/db'

const TABLES = [
  'game_standings', 'personal_bests', 'jutawan_stats', 'spin_stats', 'game_rooms', 'game_room_players', 'game_sessions',
  'leagues', 'league_class_levels', 'league_schools', 'league_standings', 'sekolah_bersaing_weeks',
] as const
const BASE = [identitySeed, schoolsSeed, schoolPackagesSeed, populationSeed, curriculumSeed]

async function fingerprint(db: TestDatabase): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const table of TABLES) {
    // Row content without the generated ids or uuids, in a content order.
    out[table] = await db.query(`select (to_jsonb(t) - 'id') as r from ${table} t order by 1::text`.replace('1::text', '(to_jsonb(t) - \'id\')::text'))
  }
  return out
}

describe('games demo seed (BE-45)', () => {
  let db: TestDatabase
  let first: Record<string, unknown>
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([...BASE, gamesSeed], { prisma: db.prisma })
    first = await fingerprint(db)
  }, 180_000)
  afterAll(async () => {
    await db.drop()
  })

  it('seeds the observed leagues, standings and weekly boards with fictitious demo data only', async () => {
    const leagues = await db.query<{ name: string; invite_code: string; status: string }>('select name, invite_code, status from leagues order by id')
    expect(leagues).toEqual([
      { name: 'Liga Sejarah 2026 5ST', invite_code: 'RMU4VCBS', status: 'upcoming' },
      { name: 'Liga Matematik Sprint Test', invite_code: 'TEST2026', status: 'ended' },
    ])
    const schools = await db.query<{ n: string }>('select count(*)::text as n from league_schools')
    expect(schools[0]!.n).toBe('5')
    const st = await db.query<{ n: string }>('select count(*)::text as n from league_standings')
    expect(st[0]!.n).toBe('4')
    const weeks = await db.query<{ week_start: string; n: string }>(`select week_start::text, count(*)::text as n from sekolah_bersaing_weeks group by 1 order by 1`)
    expect(weeks.map((w) => [w.week_start, w.n])).toEqual([['2026-08-31', '4'], ['2026-09-07', '4'], ['2026-09-14', '4'], ['2026-09-21', '4']])
    const standings = await db.query<{ n: string }>('select count(*)::text as n from game_standings')
    expect(Number(standings[0]!.n)).toBeGreaterThan(0)
    const legacy = await db.query<{ n: string }>(`select (select count(*) from game_rooms where legacy_source is not null) + (select count(*) from game_sessions where legacy_source is not null) as n`)
    expect(Number(legacy[0]!.n)).toBe(0)
    const settings = await db.query<{ boardgame_quiz_tiles: number }>('select boardgame_quiz_tiles from game_settings')
    expect(settings).toEqual([{ boardgame_quiz_tiles: 35 }])
  })

  it('is idempotent: a second run changes nothing', async () => {
    await runSeeds([...BASE, gamesSeed], { prisma: db.prisma })
    expect(await fingerprint(db)).toEqual(first)
  })

  it('is deterministic: a fresh database gets identical rows', async () => {
    const other = await createTestDatabase()
    try {
      await runSeeds([...BASE, gamesSeed], { prisma: other.prisma })
      expect(await fingerprint(other)).toEqual(first)
    } finally {
      await other.drop()
    }
  }, 120_000)

  it('skips what it cannot find (no population: the seed still runs)', async () => {
    const other = await createTestDatabase()
    try {
      await runSeeds([identitySeed, schoolsSeed, curriculumSeed, gamesSeed], { prisma: other.prisma })
      const leagues = await other.query<{ n: string }>('select count(*)::text as n from leagues')
      expect(leagues[0]!.n).toBe('2')
    } finally {
      await other.drop()
    }
  }, 120_000)

  it('keeps the seed folder rules: no Math.random, Date.now or new Date()', () => {
    const file = fileURLToPath(new URL('../../../prisma/seed/games.ts', import.meta.url))
    expect(readFileSync(file, 'utf8')).not.toMatch(/Math\.random|Date\.now\(|new Date\(\)/)
  })
})
