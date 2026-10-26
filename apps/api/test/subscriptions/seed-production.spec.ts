import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { createTestDatabase, type TestDatabase } from '../support/db'

const counts = async (db: TestDatabase) => ({
  packages: Number((await db.query<{ n: string }>(`select count(*)::text n from school_packages`))[0]?.n),
  tiers: Number((await db.query<{ n: string }>(`select count(*)::text n from tiers`))[0]?.n),
  wallets: Number((await db.query<{ n: string }>(`select count(*)::text n from wallets`))[0]?.n),
  categories: Number((await db.query<{ n: string }>(`select count(*)::text n from marketplace_categories`))[0]?.n),
  achievements: Number((await db.query<{ n: string }>(`select count(*)::text n from achievements`))[0]?.n),
  challenges: Number((await db.query<{ n: string }>(`select count(*)::text n from challenges`))[0]?.n),
  settings: Number((await db.query<{ n: string }>(`select count(*)::text n from gamification_settings`))[0]?.n),
  demoUsers: Number((await db.query<{ n: string }>(`select count(*)::text n from users where email like '%@demo.test'`))[0]?.n),
  demoSchools: Number((await db.query<{ n: string }>(`select count(*)::text n from schools where code like 'DEMO%'`))[0]?.n),
})

describe('reference seeds in production', () => {
  let a: TestDatabase
  let b: TestDatabase
  beforeAll(async () => {
    a = await createTestDatabase()
    b = await createTestDatabase()
  })
  afterAll(async () => {
    await a.drop()
    await b.drop()
  })

  it('only school-packages, the wallet tiers, the SPM subject configs, marketplace categories and the gamification catalogue are reference modules', () => {
    expect(seedModules.filter((m) => m.kind === 'reference').map((m) => m.name)).toEqual(['core-school-packages', 'core-wallet-tiers', 'spm-subject-configs', 'core-marketplace-categories', 'core-gamification-catalogue'])
  })

  it('production without the flag loads the 4 catalogue rows, the 4 wallet tiers, the 6 marketplace categories, the 25 achievements, the 10 challenges, the 10 gamification settings and no demo rows', async () => {
    const ran = await runSeeds(seedModules, { prisma: a.prisma, env: { NODE_ENV: 'production' } })
    expect(ran).toEqual(['core-school-packages', 'core-wallet-tiers', 'spm-subject-configs', 'core-marketplace-categories', 'core-gamification-catalogue'])
    expect(await counts(a)).toEqual({ packages: 4, tiers: 4, wallets: 0, categories: 6, achievements: 25, challenges: 10, settings: 10, demoUsers: 0, demoSchools: 0 })
    await runSeeds(seedModules, { prisma: a.prisma, env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'false' } })
    expect((await counts(a)).packages).toBe(4)
    expect((await counts(a)).tiers).toBe(4)
    expect(await counts(a)).toMatchObject({ achievements: 25, challenges: 10, settings: 10 })
    expect(await a.query(`select tier_name, min_syiling, conversion_rate::int as conversion_rate, is_active, legacy_source from tiers order by sort_order`)).toEqual([
      { tier_name: 'bronze', min_syiling: 0, conversion_rate: 50, is_active: true, legacy_source: null },
      { tier_name: 'silver', min_syiling: 500, conversion_rate: 40, is_active: true, legacy_source: null },
      { tier_name: 'gold', min_syiling: 2000, conversion_rate: 30, is_active: true, legacy_source: null },
      { tier_name: 'platinum', min_syiling: 5000, conversion_rate: 20, is_active: true, legacy_source: null },
    ])
  })

  it('production with ALLOW_DEMO_SEED loads both', async () => {
    const ran = await runSeeds(seedModules, { prisma: b.prisma, env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' } })
    expect(ran).toContain('core-school-packages')
    expect(ran).toContain('core-identity')
    const c = await counts(b)
    expect(c.packages).toBe(4)
    expect(c.categories).toBe(6)
    // the demo `gamification` module finds the reference rows by name/key: no twin, still 25 and 10
    expect([c.achievements, c.challenges, c.settings]).toEqual([25, 10, 10])
    expect(c.tiers).toBe(4) // the demo wallet seed upserts the same 4 rows by tier_name: no duplicate
    expect(c.wallets).toBeGreaterThan(0)
    expect(c.demoUsers).toBeGreaterThan(0)
    expect(c.demoSchools).toBeGreaterThan(0)
  })
})
