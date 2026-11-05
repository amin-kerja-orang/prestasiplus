import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T04, DM-79, migration 0231: `coin_ledger.client_uuid` and its partial unique index. The test database already ran
 * every migration (on empty tables), so the no-backfill case takes the two objects off and runs the file again on real rows.
 */
const MIGRATION_0231 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0231_s7_ledger_idempotency/migration.sql', import.meta.url)), 'utf8')
const KEY = '7f3c2a10-5b1e-4c6d-9a2f-1e8b7c6d5a40'
const OTHER_KEY = '0b9d6c1e-3f2a-4e7b-8c5d-2a1f0e9d8c7b'

describe('migration 0231 coin_ledger.client_uuid', () => {
  let db: TestDatabase

  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pelajar Contoh') returning id::text`))[0]!.id
  const ledger = (userId: string, key: string | null) =>
    db.query(`insert into coin_ledger (user_id, type, source, amount, balance_after, description, client_uuid) values ($1::bigint, 'earn', 's', 1, 1, 'd', $2::uuid)`, [userId, key])
  const rejects = async (run: () => Promise<unknown>): Promise<string> => {
    try {
      await run()
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error('Expected the statement to be rejected')
  }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('adds a nullable uuid column and a unique index on (user_id, client_uuid) for keyed rows only', async () => {
    const [column] = await db.query<{ data_type: string; is_nullable: string; column_default: string | null }>(
      `select data_type, is_nullable, column_default from information_schema.columns where table_name = 'coin_ledger' and column_name = 'client_uuid'`,
    )
    expect(column).toEqual({ data_type: 'uuid', is_nullable: 'YES', column_default: null })
    const [index] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'uq_coin_ledger_user_id_client_uuid'`)
    expect(index?.indexdef).toMatch(/UNIQUE INDEX .* ON public\.coin_ledger .*\(user_id, client_uuid\) WHERE \(client_uuid IS NOT NULL\)/)
  })

  it('refuses a second row with one key from one user, in either letter case, and keeps the first', async () => {
    const u = await user()
    await ledger(u, KEY)
    expect(await rejects(() => ledger(u, KEY))).toMatch(/uq_coin_ledger_user_id_client_uuid/)
    expect(await rejects(() => ledger(u, KEY.toUpperCase()))).toMatch(/uq_coin_ledger_user_id_client_uuid/)
    expect(await db.query(`select 1 from coin_ledger where user_id = $1::bigint`, [u])).toHaveLength(1)
  })

  it('lets another user use the same key and one user use another key', async () => {
    const [a, b] = [await user(), await user()]
    await ledger(a, KEY)
    await ledger(b, KEY)
    await ledger(a, OTHER_KEY)
    expect(await db.query(`select 1 from coin_ledger where client_uuid = $1::uuid and user_id = any($2::bigint[])`, [KEY, [a, b]])).toHaveLength(2)
  })

  it('allows any number of rows with no key', async () => {
    const u = await user()
    await ledger(u, null)
    await ledger(u, null)
    expect(await db.query(`select 1 from coin_ledger where user_id = $1::bigint and client_uuid is null`, [u])).toHaveLength(2)
  })

  it('refuses a value that is not a uuid', async () => {
    const u = await user()
    expect(await rejects(() => ledger(u, 'not-a-uuid'))).toMatch(/invalid input syntax for type uuid/)
  })

  it('leaves the rows of an existing ledger NULL (no backfill), and the reversal in the file header is enough to run it again', async () => {
    const u = await user()
    await ledger(u, null)
    await db.query(`drop index "uq_coin_ledger_user_id_client_uuid"`)
    await db.query(`alter table "coin_ledger" drop column "client_uuid"`)
    await db.query(`insert into coin_ledger (user_id, type, source, amount, balance_after, description) values ($1::bigint, 'earn', 's', 1, 2, 'd')`, [u])
    await db.query(MIGRATION_0231)
    const rows = await db.query<{ client_uuid: string | null }>(`select client_uuid from coin_ledger where user_id = $1::bigint`, [u])
    expect(rows).toEqual([{ client_uuid: null }, { client_uuid: null }])
    await ledger(u, KEY)
    expect(await rejects(() => ledger(u, KEY))).toMatch(/uq_coin_ledger_user_id_client_uuid/)
  })
})
