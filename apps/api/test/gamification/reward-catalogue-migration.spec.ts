import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T05, DM-77, migration 0229 (columns only; the merge is deferred, #501). The test database already ran every
 * migration on empty tables, so the case drops the three columns, sets up rows and runs the file again.
 */
const MIGRATION_0229 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0229_s7_reward_catalogue_merge/migration.sql', import.meta.url)), 'utf8')

describe('migration 0229 reward catalogue columns', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const count = async (table: string) => Number((await db.query<{ n: string }>(`select count(*)::text n from ${table}`))[0]!.n)

  it('fills the existing redemptions, gives existing rewards cost 0, leaves both old tables alone and creates no row', async () => {
    await db.query(`alter table reward_redemptions drop column token_cost_snapshot, drop column cost_value_sen_snapshot`)
    await db.query(`alter table rewards drop column cost_value_sen`)
    const u = (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Ujian') returning id::text`))[0]!.id
    const r = (await db.query<{ id: string }>(`insert into rewards (category, vendor, title, denomination_rm, token_cost) values ('telco', 'V', 'Baucar Ujian', 10, 25) returning id::text`))[0]!.id
    await db.query(`insert into reward_redemptions (user_id, reward_id, reward_title, reward_vendor, denomination_rm, token_cost, status) values ($1, $2, 'Baucar Ujian', 'V', 10, 25, 'pending_admin'), ($1, $2, 'Baucar Ujian', 'V', 10, 7, 'cancelled')`, [u, r])
    const s = (await db.query<{ id: string }>(`insert into syiling_rewards (name, type, price_syiling, cost_value_sen) values ('Baucar Ujian', 'voucher', 500, 1000) returning id::text`))[0]!.id
    await db.query(`insert into reward_claims (user_id, reward_id, cost_value_sen) values ($1, $2, 1000)`, [u, s])

    await db.query(MIGRATION_0229)

    expect(await db.query(`select token_cost, token_cost_snapshot, cost_value_sen_snapshot from reward_redemptions order by id`)).toEqual([
      { token_cost: 25, token_cost_snapshot: 25, cost_value_sen_snapshot: 0 },
      { token_cost: 7, token_cost_snapshot: 7, cost_value_sen_snapshot: 0 },
    ])
    expect(await db.query(`select cost_value_sen from rewards`)).toEqual([{ cost_value_sen: 0 }])
    expect([await count('rewards'), await count('reward_redemptions'), await count('syiling_rewards'), await count('reward_claims')]).toEqual([1, 2, 1, 1])
    expect(await db.query(`select cost_value_sen from syiling_rewards`)).toEqual([{ cost_value_sen: 1000 }])
  })

  it('a new redemption must name both snapshots; a new reward defaults to cost 0', async () => {
    const u = (await db.query<{ id: string }>(`select id::text from users limit 1`))[0]!.id
    const insert = `insert into reward_redemptions (user_id, reward_title, reward_vendor, denomination_rm, token_cost, status) values ($1, 'T', 'V', 1, 1, 'pending_admin')`
    await expect(db.query(insert, [u])).rejects.toThrow(/token_cost_snapshot/)
    expect((await db.query(`insert into rewards (category, vendor, title, denomination_rm, token_cost) values ('telco', 'V', 'Baru', 1, 1) returning cost_value_sen`))[0]).toEqual({ cost_value_sen: 0 })
  })
})
