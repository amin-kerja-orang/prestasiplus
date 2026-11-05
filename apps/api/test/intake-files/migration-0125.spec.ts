import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T03, migration 0125 (DM-09, D2): the level, paper code and Set label of an intake batch. */
describe('migration 0125 intake level, paper code, set label', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const insert = (extra: { level?: string | null; code?: string | null; set?: string | null }) =>
    db.query<{ id: string }>(
      `insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status, education_level_id, paper_code, set_label) values ('trial', 'MAT', 2, 2025, 'x', 'own', $1, $2, $3) returning id::text`,
      [extra.level ?? null, extra.code ?? null, extra.set ?? null],
    )
  const level = async (code: string): Promise<string> =>
    (await db.query<{ id: string }>(`insert into education_levels (code, name, name_en, stage, curriculum, sort_order) values ($1, 'Tingkatan', 'Form', 'upper_secondary', 'KSSM', 5) returning id::text`, [code]))[0]!.id

  it('leaves the three columns null for a batch that declares none', async () => {
    const id = (await insert({}))[0]!.id
    const row = (await db.query<{ l: string | null; c: string | null; s: string | null }>(`select education_level_id::text l, paper_code c, set_label s from intake_batches where id = $1`, [id]))[0]
    expect(row).toEqual({ l: null, c: null, s: null })
  })

  it('stores a level, a paper code of the form 1449/2 and a Set up to 20 characters', async () => {
    const l = await level('T5')
    const id = (await insert({ level: l, code: '1449/2', set: 'Set 1' }))[0]!.id
    const row = (await db.query<{ l: string; c: string; s: string }>(`select education_level_id::text l, paper_code c, set_label s from intake_batches where id = $1`, [id]))[0]
    expect(row).toEqual({ l, c: '1449/2', s: 'Set 1' })
    await insert({ set: 'x'.repeat(20) })
  })

  it.each(['1449', '144/2', '1449/22', 'K2', '1449/a', ' 1449/2'])('refuses the paper code %j', async (code) => {
    await expect(insert({ code })).rejects.toThrow(/ck_intake_batches_paper_code/)
  })

  it('refuses an empty or over-long Set', async () => {
    await expect(insert({ set: '' })).rejects.toThrow(/ck_intake_batches_set_label/)
    await expect(insert({ set: 'x'.repeat(21) })).rejects.toThrow(/ck_intake_batches_set_label/)
  })

  it('refuses an unknown level and a level that is still used by a batch (RESTRICT)', async () => {
    await expect(insert({ level: '999999' })).rejects.toThrow(/fk_intake_batches_education_level_id/)
    const l = await level('T4')
    await insert({ level: l })
    await expect(db.query(`delete from education_levels where id = $1`, [l])).rejects.toThrow(/fk_intake_batches_education_level_id/)
  })
})
