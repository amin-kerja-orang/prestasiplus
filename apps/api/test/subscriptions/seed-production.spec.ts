import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { createTestDatabase, type TestDatabase } from '../support/db'

const counts = async (db: TestDatabase) => ({
  packages: Number((await db.query<{ n: string }>(`select count(*)::text n from school_packages`))[0]?.n),
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

  it('only school-packages is a reference module', () => {
    expect(seedModules.filter((m) => m.kind === 'reference').map((m) => m.name)).toEqual(['core-school-packages'])
  })

  it('production without the flag loads the 4 catalogue rows and no demo rows', async () => {
    const ran = await runSeeds(seedModules, { prisma: a.prisma, env: { NODE_ENV: 'production' } })
    expect(ran).toEqual(['core-school-packages'])
    expect(await counts(a)).toEqual({ packages: 4, demoUsers: 0, demoSchools: 0 })
    await runSeeds(seedModules, { prisma: a.prisma, env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'false' } })
    expect((await counts(a)).packages).toBe(4)
  })

  it('production with ALLOW_DEMO_SEED loads both', async () => {
    const ran = await runSeeds(seedModules, { prisma: b.prisma, env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' } })
    expect(ran).toContain('core-school-packages')
    expect(ran).toContain('core-identity')
    const c = await counts(b)
    expect(c.packages).toBe(4)
    expect(c.demoUsers).toBeGreaterThan(0)
    expect(c.demoSchools).toBeGreaterThan(0)
  })
})
