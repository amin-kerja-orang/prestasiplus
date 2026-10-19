import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseProfile, runSeeds, type SeedModule } from '../../prisma/seed'
import { createTestDatabase, type TestDatabase } from '../support/db'

const SEED_DIR = fileURLToPath(new URL('../../prisma/seed/', import.meta.url))
const DDL = 'create table seeded (code text primary key, score int not null, at text not null)'
const SELECT = 'select code, score, at from seeded order by code'

describe('seed runner', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(DDL)
  })
  afterAll(async () => {
    await db.drop()
  })

  const dummy: SeedModule = {
    name: 'dummy',
    async run(ctx) {
      const prng = ctx.prng('dummy:scores')
      for (const code of ['a', 'b', 'c']) {
        const score = prng.int(1, 1000)
        const at = ctx.clock.now().toISOString()
        await ctx.prisma.$executeRaw`insert into seeded (code, score, at) values (${code}, ${score}, ${at})
          on conflict (code) do update set score = excluded.score, at = excluded.at`
      }
    },
  }

  it('is idempotent: running twice gives identical rows and counts', async () => {
    await runSeeds([dummy], { prisma: db.prisma })
    const first = await db.query(SELECT)
    await runSeeds([dummy], { prisma: db.prisma })
    expect(await db.query(SELECT)).toEqual(first)
    expect(first).toHaveLength(3)
    expect(first[0]?.at).toBe('2026-09-25T07:40:00.000Z')
  })

  it('is deterministic across databases: same seed base, same values; other base differs', async () => {
    const other = await createTestDatabase()
    try {
      await other.query(DDL)
      await runSeeds([dummy], { prisma: other.prisma })
      expect(await other.query(SELECT)).toEqual(await db.query(SELECT))
      await runSeeds([dummy], { prisma: other.prisma, seedBase: 2 })
      expect(await other.query(SELECT)).not.toEqual(await db.query(SELECT))
    } finally {
      await other.drop()
    }
  })

  it('runs in declared order and honours profiles (no profile = every profile)', async () => {
    const calls: string[] = []
    const mk = (name: string, profiles?: string[]): SeedModule => ({
      name,
      ...(profiles ? { profiles } : {}),
      run: async () => void calls.push(name),
    })
    const modules = [mk('first'), mk('poc-only', ['poc']), mk('test-only', ['test']), mk('last')]
    expect(await runSeeds(modules)).toEqual(['first', 'poc-only', 'last']) // default profile = poc
    expect(await runSeeds(modules, { profile: 'test' })).toEqual(['first', 'test-only', 'last'])
    expect(calls).toEqual(['first', 'poc-only', 'last', 'first', 'test-only', 'last'])
  })

  it('parses --profile and rejects odd values', () => {
    expect(parseProfile([])).toBe('poc')
    expect(parseProfile(['--profile=test'])).toBe('test')
    expect(() => parseProfile(['--profile=Bad Value'])).toThrow()
  })

  it('seed code takes randomness and time only from the context', () => {
    const files = readdirSync(SEED_DIR, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    )
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const code = readFileSync(join(SEED_DIR, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code, f).not.toMatch(/Math\.random|Date\.now|new Date\(\s*\)|randomUUID|randomBytes/)
    }
  })
})
