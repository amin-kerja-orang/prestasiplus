import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const SCRIPT = fileURLToPath(new URL('../../../../scripts/ops/reward-catalogue-dry-run.mjs', import.meta.url))
const run = promisify(execFile)

interface DryRunModule {
  withReadOnlyClient(url: string, work: (client: { query(sql: string): Promise<unknown> }) => Promise<unknown>): Promise<unknown>
}

/** S7-T05, DM-77: the dry run of the deferred merge, on a throw-away test database only. */
describe('scripts/ops/reward-catalogue-dry-run.mjs', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    const syiling = async (name: string, cost: number) => (await db.query<{ id: string }>(`insert into syiling_rewards (name, type, price_syiling, cost_value_sen) values ($1, 'voucher', 100, $2) returning id::text`, [name, cost]))[0]!.id
    const reward = (title: string, cost: number) => db.query(`insert into rewards (category, vendor, title, denomination_rm, token_cost, cost_value_sen) values ('telco', 'V', $1, 10, 10, $2)`, [title, cost])
    const [same, differs, alone] = [await syiling('Baucar Sama', 1000), await syiling(' baucar BEZA ', 500), await syiling('Tiada Pasangan', 200)]
    await syiling('Dua Pasangan', 0)
    await reward('Baucar Sama', 1000)
    await reward('Baucar Beza', 750)
    await reward('Hanya Hadiah', 0)
    await reward('Dua Pasangan', 0)
    await reward('dua pasangan', 0)
    const user = (await db.query<{ id: string }>(`insert into users (name, email) values ('Nama Rahsia', 'rahsia@contoh.test') returning id::text`))[0]!.id
    for (const r of [same, same, differs, alone]) await db.query(`insert into reward_claims (user_id, reward_id, cost_value_sen) values ($1, $2, 100)`, [user, r])
  })
  afterAll(async () => {
    await db.drop()
  })

  const snapshot = async () => db.query(`select (select count(*) from syiling_rewards) s, (select count(*) from rewards) r, (select count(*) from reward_claims) c, (select count(*) from reward_redemptions) d, (select max(updated_at) from rewards) u`)

  it('prints the matched and unmatched rows, the cost differences and the claim counts, and writes nothing', async () => {
    const before = await snapshot()
    const { stdout } = await run(process.execPath, [SCRIPT], { env: { ...process.env, DATABASE_URL: db.url } })
    expect(stdout).toContain('Read-only transaction, nothing was written.')
    expect(stdout).toMatch(/syiling_rewards: 4\n\s+rewards: 5\n\s+reward_claims: 4\n\s+reward_redemptions: 0/)
    expect(stdout).toContain('Matched syiling_rewards (same trimmed lower-case title): 3')
    expect(stdout).toMatch(/Matching more than one reward: 1\n\s+syiling_rewards #\d+ "Dua Pasangan": 2 rewards/)
    expect(stdout).toMatch(/Unmatched syiling_rewards: 1\n\s+#\d+ "Tiada Pasangan"/)
    expect(stdout).toMatch(/Unmatched rewards: 1\n\s+#\d+ "Hanya Hadiah"/)
    expect(stdout).toMatch(/keeps the rewards value\): 1\n\s+"Baucar Beza": syiling_rewards 500, rewards 750/)
    expect(stdout).toMatch(/matched: 3\n\s+unmatched: 1/)
    expect(await snapshot()).toEqual(before)
  })

  it('prints no personal data and not the connection string', async () => {
    const { stdout, stderr } = await run(process.execPath, [SCRIPT], { env: { ...process.env, DATABASE_URL: db.url } })
    for (const secret of ['Nama Rahsia', 'rahsia@contoh.test', db.url]) expect(stdout + stderr).not.toContain(secret)
  })

  it('refuses a write by construction: the server answers read_only_sql_transaction inside its transaction', async () => {
    const mod = (await import(/* @vite-ignore */ SCRIPT)) as DryRunModule
    await expect(mod.withReadOnlyClient(db.url, (client) => client.query(`update rewards set title = 'Ubah'`))).rejects.toMatchObject({ code: '25006' })
    await expect(mod.withReadOnlyClient(db.url, (client) => client.query(`delete from syiling_rewards`))).rejects.toMatchObject({ code: '25006' })
    expect((await db.query(`select 1 from rewards where title = 'Ubah'`)).length).toBe(0)
  })

  it('without DATABASE_URL it exits 2 and reads nothing', async () => {
    const env = { ...process.env }
    delete env.DATABASE_URL
    await expect(run(process.execPath, [SCRIPT], { env })).rejects.toMatchObject({ code: 2 })
  })
})
