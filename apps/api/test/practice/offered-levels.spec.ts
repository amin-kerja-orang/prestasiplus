import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { offeredLevels } from '../../src/modules/practice/rules'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S4-T06 (DM-20): `offeredLevels(db)` is the one definition of the practice levels: active, `stage <> 'primary'`, ordered.
 * On the seeded levels that is T1..T5; primary (Darjah, inactive) is never offered; a level deactivated by the admin drops out.
 */
let db: TestDatabase

/** The levels of `prisma/seed/curriculum-data/levels.json`. The template database has migrations only, so the spec seeds them. */
const LEVELS: [code: string, name: string, nameEn: string, stage: string, curriculum: string, order: number, active: boolean][] = [
  ['D1', 'Darjah 1', 'Year 1', 'primary', 'KSSR', 1, false],
  ['D2', 'Darjah 2', 'Year 2', 'primary', 'KSSR', 2, false],
  ['T1', 'Tingkatan 1', 'Form 1', 'lower_secondary', 'KSSM', 7, true],
  ['T2', 'Tingkatan 2', 'Form 2', 'lower_secondary', 'KSSM', 8, true],
  ['T3', 'Tingkatan 3', 'Form 3', 'lower_secondary', 'KSSM', 9, true],
  ['T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10, true],
  ['T5', 'Tingkatan 5', 'Form 5', 'upper_secondary', 'KSSM', 11, true],
]

beforeAll(async () => {
  db = await createTestDatabase()
  for (const [code, name, nameEn, stage, curriculum, order, active] of LEVELS) {
    await db.query(
      `insert into education_levels (code, name, name_en, stage, curriculum, sort_order, is_active, grade) values ($1, $2, $3, $4, $5, $6::int, $7::boolean, $6::int)`,
      [code, name, nameEn, stage, curriculum, order, active],
    )
  }
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

  it('excludes a secondary level the admin deactivated', async () => {
    await db.query(`update education_levels set is_active = false where code = 'T2'`)
    try {
      expect((await offeredLevels(db.prisma)).map((l) => l.code)).toEqual(['T1', 'T3', 'T4', 'T5'])
    } finally {
      await db.query(`update education_levels set is_active = true where code = 'T2'`)
    }
  })

  it('cannot be given an active primary level: the database refuses it (ck_education_levels_no_active_primary)', async () => {
    await expect(db.query(`update education_levels set is_active = true where code = 'D1'`)).rejects.toThrow(/ck_education_levels_no_active_primary/)
    expect((await offeredLevels(db.prisma)).map((l) => l.code)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
  })
})
