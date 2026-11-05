import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T07, DM-36, migration 0221: `draw_winners`, one row per prize slot of a drawn Cabutan Bertuah draw, with `ticket_id`, `delivered_at` and
 * `delivered_by_id` (ruling 4 on #505). The test database already ran every migration. The "existing rows" case undoes 0221 with the rollback
 * written in its header, writes rows in the old shape, runs the file again and checks that nothing was changed or lost.
 */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0221_s7_draw_winners/migration.sql', import.meta.url)), 'utf8')
const ROLLBACK = MIGRATION.split('\n')
  .filter((line) => /^-- {3}DROP TABLE /.test(line))
  .map((line) => line.slice(5))
  .join('\n')

describe('migration 0221 draw winners', () => {
  let db: TestDatabase
  let n = 0

  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna') returning id::text`))[0]!.id
  const draw = async (): Promise<{ id: string; prize: string }> => {
    const id = (await db.query<{ id: string }>(`insert into draws (title, ticket_cost_syiling, max_tickets_per_student, status) values ($1, 10, 5, 'drawn') returning id::text`, [`Cabutan ${String(n++)}`]))[0]!.id
    const prize = (await db.query<{ id: string }>(`insert into draw_prizes (draw_id, label, value_sen, qty, position) values ($1, 'Hadiah', 100, 3, 0) returning id::text`, [id]))[0]!.id
    return { id, prize }
  }
  const ticket = async (drawId: string, userId: string): Promise<string> => (await db.query<{ id: string }>(`insert into draw_tickets (draw_id, user_id) values ($1, $2) returning id::text`, [drawId, userId]))[0]!.id
  const winner = async (d: { id: string; prize: string }, slot: number, userId: string, ticketId: string) =>
    (await db.query<{ id: string }>(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at) values ($1, $2, $3, $4, $5, now()) returning id::text`, [d.id, d.prize, ticketId, slot, userId]))[0]!.id
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

  it('creates draw_winners with the DM-36 columns, the ruling 4 columns, and only drawn_by_id, delivered_at and delivered_by_id nullable', async () => {
    const cols = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(`select column_name, data_type, is_nullable from information_schema.columns where table_name = 'draw_winners' order by ordinal_position`)
    expect(cols.map((c) => [c.column_name, c.data_type, c.is_nullable])).toEqual([
      ['id', 'bigint', 'NO'],
      ['draw_id', 'bigint', 'NO'],
      ['draw_prize_id', 'bigint', 'NO'],
      ['ticket_id', 'bigint', 'NO'],
      ['slot', 'smallint', 'NO'],
      ['user_id', 'bigint', 'NO'],
      ['drawn_at', 'timestamp with time zone', 'NO'],
      ['drawn_by_id', 'bigint', 'YES'],
      ['delivered_at', 'timestamp with time zone', 'YES'],
      ['delivered_by_id', 'bigint', 'YES'],
    ])
    expect(await db.query(`select 1 from draw_winners`)).toEqual([])
  })

  it('INV-28: a prize slot has one winner, a pupil wins once per draw, a ticket wins once; slots start at 0', async () => {
    const d = await draw()
    const [a, b, c] = [await user(), await user(), await user()]
    const [ta1, ta2, tb, tc] = [await ticket(d.id, a), await ticket(d.id, a), await ticket(d.id, b), await ticket(d.id, c)]
    await winner(d, 0, a, ta1)
    expect(await rejects(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at) values ($1, $2, $3, 0, $4, now())`, [d.id, d.prize, tb, b])).toContain('uq_draw_winners_draw_prize_id_slot')
    expect(await rejects(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at) values ($1, $2, $3, 1, $4, now())`, [d.id, d.prize, ta2, a])).toContain('uq_draw_winners_draw_id_user_id')
    expect(await rejects(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at) values ($1, $2, $3, 1, $4, now())`, [d.id, d.prize, ta1, b])).toContain('uq_draw_winners_ticket_id')
    expect(await rejects(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at) values ($1, $2, $3, -1, $4, now())`, [d.id, d.prize, tb, b])).toContain('ck_draw_winners_slot')
    await winner(d, 1, b, tb)
    await winner(d, 2, c, tc)
    expect(await db.query(`select 1 from draw_winners where draw_id = $1`, [d.id])).toHaveLength(3)
  })

  it('the same pupil can win in two draws', async () => {
    const [a, b] = [await draw(), await draw()]
    const u = await user()
    await winner(a, 0, u, await ticket(a.id, u))
    await winner(b, 0, u, await ticket(b.id, u))
  })

  it('delivered_by_id needs delivered_at; both may be empty', async () => {
    const d = await draw()
    const [u, admin] = [await user(), await user()]
    expect(await rejects(`insert into draw_winners (draw_id, draw_prize_id, ticket_id, slot, user_id, drawn_at, delivered_by_id) values ($1, $2, $3, 0, $4, now(), $5)`, [d.id, d.prize, await ticket(d.id, u), u, admin])).toContain('ck_draw_winners_delivered')
    const id = await winner(d, 0, u, await ticket(d.id, u))
    await db.query(`update draw_winners set delivered_at = now(), delivered_by_id = $2 where id = $1`, [id, admin])
    expect((await db.query<{ delivered_by_id: string }>(`select delivered_by_id::text from draw_winners where id = $1`, [id]))[0]).toEqual({ delivered_by_id: admin })
  })

  it('the foreign keys: draw and prize are RESTRICT, the ticket and the pupil CASCADE, the admins SET NULL', async () => {
    const d = await draw()
    const [u, admin] = [await user(), await user()]
    const t1 = await ticket(d.id, u)
    const id = await winner(d, 0, u, t1)
    await db.query(`update draw_winners set drawn_by_id = $2, delivered_at = now(), delivered_by_id = $2 where id = $1`, [id, admin])
    expect(await rejects(`delete from draw_prizes where id = $1`, [d.prize])).toContain('fk_draw_winners_draw_prize_id')
    expect(await rejects(`delete from draws where id = $1`, [d.id])).toMatch(/fk_draw_winners_draw_id|fk_draw_tickets_draw_id/)
    await db.query(`delete from users where id = $1`, [admin])
    expect((await db.query<{ drawn_by_id: string | null; delivered_by_id: string | null; delivered_at: Date | null }>(`select drawn_by_id::text, delivered_by_id::text, delivered_at from draw_winners where id = $1`, [id]))[0]).toMatchObject({ drawn_by_id: null, delivered_by_id: null })
    expect((await db.query<{ delivered_at: Date | null }>(`select delivered_at from draw_winners where id = $1`, [id]))[0]!.delivered_at).not.toBeNull()
    await db.query(`delete from users where id = $1`, [u])
    expect(await db.query(`select 1 from draw_winners where id = $1`, [id])).toEqual([])
    const [v, w] = [await user(), await user()]
    const e = await draw()
    const tv = await ticket(e.id, v)
    const idv = await winner(e, 0, v, tv)
    await db.query(`delete from draw_tickets where id = $1`, [tv])
    expect(await db.query(`select 1 from draw_winners where id = $1`, [idv])).toEqual([])
    await db.query(`delete from users where id = $1`, [w])
  })

  it('the rollback of the header drops the table, and the file creates it again', async () => {
    expect(ROLLBACK).toContain('DROP TABLE "draw_winners"')
    await db.query(ROLLBACK)
    expect(await db.query(`select 1 from information_schema.tables where table_name = 'draw_winners'`)).toEqual([])
    await db.query(MIGRATION)
    expect(await db.query(`select 1 from information_schema.tables where table_name = 'draw_winners'`)).toHaveLength(1)
  })

  it('runs again on rows written before it: no draw, prize or ticket is changed, and the first winner stored on the draw stays', async () => {
    await db.query(ROLLBACK)
    const d = await draw()
    const u = await user()
    const t1 = await ticket(d.id, u)
    await db.query(`update draws set winner_user_id = $2, drawn_at = '2026-11-01T10:00:00+08:00' where id = $1`, [d.id, u])
    const snapshot = async () => ({
      d: await db.query(`select id::text, title, description, ticket_cost_syiling, max_tickets_per_student, closes_at, status, winner_user_id::text, drawn_at, cancelled_at, created_at, updated_at from draws order by id`),
      p: await db.query(`select id::text, draw_id::text, label, value_sen, qty, position from draw_prizes order by id`),
      t: await db.query(`select id::text, draw_id::text, user_id::text, created_at from draw_tickets order by id`),
    })
    const before = await snapshot()
    await db.query(MIGRATION)
    expect(await snapshot()).toEqual(before)
    expect(await db.query(`select 1 from draw_winners`)).toEqual([])
    await winner(d, 0, u, t1)
  })
})
