import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { offeredLevels } from '../../src/modules/practice/rules'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S4-T06 (DM-20): `offeredLevels(db)` is the one definition of the practice levels: active, `stage <> 'primary'`, ordered.
 * On the seed that is T1..T5; primary (Darjah, inactive) is never offered; a level deactivated by the admin drops out.
 */
let db: TestDatabase

beforeAll(async () => {
  db = await createTestDatabase()
}, 120_000)

afterAll(async () => {
  await db.drop()
})

describe('offeredLevels(db)', () => {
  it('returns T1 to T5 in level order with TINGKATAN_<digit of code> grade keys', async () => {
    const levels = await offeredLevels(db.prisma)
    expect(levels.map((l) => l.code)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
    expect(levels.map((l) => l.gradeKey)).toEqual(['TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4', 'TINGKATAN_5'])
    expect(levels.map((l) => l.order)).toEqual([...levels.map((l) => l.order)].sort((a, b) => a - b))
    for (const l of levels) {
      expect(typeof l.id).toBe('string')
      expect(l.id).toMatch(/^\d+$/)
    }
  })

  it('excludes every primary level (Darjah)', async () => {
    const primary = await db.query<{ id: string }>(`select id::text id from education_levels where stage = 'primary'`)
    expect(primary.length).toBeGreaterThan(0)
    const ids = new Set((await offeredLevels(db.prisma)).map((l) => l.id))
    for (const p of primary) expect(ids.has(p.id)).toBe(false)
  })

  it('excludes an inactive secondary level and an active primary one that slipped through', async () => {
    await db.query(`update education_levels set is_active = false where code = 'T2'`)
    await db.query(`update education_levels set is_active = true where code = 'D1'`)
    try {
      expect((await offeredLevels(db.prisma)).map((l) => l.code)).toEqual(['T1', 'T3', 'T4', 'T5'])
    } finally {
      await db.query(`update education_levels set is_active = true where code = 'T2'`)
      await db.query(`update education_levels set is_active = false where code = 'D1'`)
    }
  })
})
