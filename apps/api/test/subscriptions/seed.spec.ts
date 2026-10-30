import { SubscriptionDetailSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { schoolPackagesSeed } from '../../prisma/seed/core/school-packages'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { ADMIN, apiOf, bootSubApp, login, schoolIdOf, type SubTestApp } from './sub-helpers'

const rowsOf = (db: TestDatabase) =>
  db.query(`select code, name, slug, education_level, form_level, price_annual::text, max_renewals, is_active, legacy_source, legacy_id from school_packages order by id`)

describe('school packages catalogue seed', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('seeds the 4 mock rows, stable on re-run, with no legacy values', async () => {
    await runSeeds([schoolPackagesSeed], { prisma: db.prisma })
    const first = await rowsOf(db)
    expect(first.map((r) => [r.code, r.slug, r.price_annual, r.max_renewals])).toEqual([
      ['T4', 'spm-t4', '30.00', 1],
      ['T5', 'spm-t5', '30.00', 0],
      ['D1_D6', 'primary-d1-d6', '30.00', 5],
      ['T1_T3', 'lower-sec-t1-t3', '30.00', 2],
    ])
    // D1_D6 is seeded inactive (secondary-only, 2026-10-29): hidden from the lists, kept for migrated subscriptions.
    expect(first.every((r) => r.legacy_source === null && r.legacy_id === null && r.is_active === (r.code !== 'D1_D6'))).toBe(true)
    await runSeeds([schoolPackagesSeed], { prisma: db.prisma })
    expect(await rowsOf(db)).toEqual(first)
  })
})

describe('on a freshly seeded database', () => {
  let t: SubTestApp
  beforeAll(async () => {
    t = await bootSubApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('a subscription can be created with a seeded package', async () => {
    const admin = apiOf(await login(t, ADMIN))
    const pkg = (await admin.get('/admin/school-packages')).body.data[2] as { id: string }
    const res = await admin.post('/admin/school-subscriptions', {
      schoolId: await schoolIdOf(t.db, 'DEMO001'),
      packageTier: 'full',
      schoolPackageId: pkg.id,
      studentQuota: 10,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(SubscriptionDetailSchema.parse(res.body.data).formLevel).toBe('t1_t3')
  })
})
