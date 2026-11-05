import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T07, DM-65, migration 0227: `draws.status` gains `drawn` and `cancelled`, and `draws.cancelled_at` records a cancel.
 * The test database already ran every migration. The "existing rows" case undoes 0227 with the rollback of its header, writes rows in
 * the old shape, runs the file again and checks that nothing was changed or lost.
 */
const MIGRATION_0227 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0227_s7_draw_status/migration.sql', import.meta.url)), 'utf8')

const ROLLBACK = `
  UPDATE "draws" SET "status" = 'closed' WHERE "status" IN ('drawn', 'cancelled');
  ALTER TABLE "draws" DROP CONSTRAINT "ck_draws_status";
  ALTER TABLE "draws" ADD CONSTRAINT "ck_draws_status" CHECK ("status" IN ('draft', 'open', 'closed'));
  ALTER TABLE "draws" DROP COLUMN "cancelled_at";
`

describe('migration 0227 draw status', () => {
  let db: TestDatabase
  let n = 0

  const draw = async (status: string): Promise<string> =>
    (await db.query<{ id: string }>(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, status) values ($1, 10, 5, $2) returning id::text`, [`Cabutan ${String(n++)}`, status]))[0]!.id
  const rejects = async (sql: string, params?: unknown[]): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('adds cancelled_at as a nullable timestamptz, empty on a new draw', async () => {
    const [c] = await db.query<{ data_type: string; is_nullable: string }>(`select data_type, is_nullable from information_schema.columns where table_name = 'draws' and column_name = 'cancelled_at'`)
    expect(c).toEqual({ data_type: 'timestamp with time zone', is_nullable: 'YES' })
    const id = await draw('draft')
    expect((await db.query<{ cancelled_at: Date | null }>(`select cancelled_at from draws where id = $1`, [id]))[0]).toEqual({ cancelled_at: null })
  })

  it('ck_draws_status lists the five statuses, is validated, and refuses any other', async () => {
    for (const status of ['draft', 'open', 'closed', 'drawn', 'cancelled']) await draw(status)
    expect(await rejects(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, status) values ('X', 1, 1, 'finished')`)).toContain('ck_draws_status')
    const [k] = await db.query<{ def: string; validated: boolean }>(`select pg_get_constraintdef(oid) def, convalidated validated from pg_constraint where conname = 'ck_draws_status'`)
    expect(k!.validated).toBe(true)
    for (const status of ['draft', 'open', 'closed', 'drawn', 'cancelled']) expect(k!.def).toContain(`'${status}'`)
  })

  it('a cancelled draw keeps its cancel time; the other checks of the table are unchanged', async () => {
    const id = await draw('open')
    await db.query(`update draws set status = 'cancelled', cancelled_at = '2026-11-05T10:00:00+08:00' where id = $1`, [id])
    expect((await db.query<{ status: string; cancelled_at: Date }>(`select status, cancelled_at from draws where id = $1`, [id]))[0]).toMatchObject({ status: 'cancelled', cancelled_at: new Date('2026-11-05T10:00:00+08:00') })
    expect(await rejects(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student) values ('X', -1, 1)`)).toContain('ck_draws_amounts')
  })

  it('the rollback of the header restores the old three statuses', async () => {
    await db.query(ROLLBACK)
    expect(await rejects(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, status) values ('X', 1, 1, 'drawn')`)).toContain('ck_draws_status')
    expect(await rejects(`update draws set cancelled_at = now()`)).toContain('cancelled_at')
    await db.query(MIGRATION_0227)
    await draw('drawn')
  })

  it('runs again on rows written before it: nothing is dropped or rewritten', async () => {
    await db.query(ROLLBACK)
    const ids = [await draw('draft'), await draw('open'), await draw('closed')]
    await db.query(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Hadiah', 100, 2, 0)`, [ids[1]])
    const snapshot = async () => ({
      d: await db.query(`select id::text, title, description, ticket_cost_syiling, max_tickets_per_student, closes_at, status, winner_user_id, drawn_at, created_at, updated_at from draws where id = any($1::bigint[]) order by id`, [ids]),
      p: await db.query(`select draw_id::text, label, value_sen, qty, position from draw_prizes where draw_id = any($1::bigint[])`, [ids]),
    })
    const before = await snapshot()
    await db.query(MIGRATION_0227)
    expect(await snapshot()).toEqual(before)
    expect(await db.query(`select 1 from draws where id = any($1::bigint[]) and cancelled_at is not null`, [ids])).toHaveLength(0)
    await db.query(`update draws set status = 'drawn' where id = $1`, [ids[2]])
    await db.query(`update draws set status = 'cancelled', cancelled_at = now() where id = $1`, [ids[0]])
  })
})
