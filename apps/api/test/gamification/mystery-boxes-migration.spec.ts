import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T07 part P7, migration 0222, DM-37: `mystery_boxes`, `mystery_box_prizes` and the new `mystery_box_openings` columns.
 * The test database already ran every migration, so the re-run cases first apply the reversal written in the file's header
 * comment, on openings that were made before the migration (box_id 1 to 4).
 */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0222_s7_mystery_boxes/migration.sql', import.meta.url)), 'utf8')
const REVERSE = `
  ALTER TABLE mystery_box_openings DROP CONSTRAINT ck_mystery_box_openings_prize;
  ALTER TABLE mystery_box_openings DROP CONSTRAINT fk_mystery_box_openings_box_id;
  DROP INDEX uq_mystery_box_openings_user_id_client_uuid;
  DROP INDEX ix_mystery_box_openings_box_id;
  ALTER TABLE mystery_box_openings DROP COLUMN prize_label, DROP COLUMN prize_kind, DROP COLUMN prize_amount, DROP COLUMN client_uuid;
  DROP TABLE mystery_box_prizes;
  DROP TABLE mystery_boxes;
`

describe('migration 0222 mystery boxes (DM-37)', () => {
  let db: TestDatabase
  let userId: string

  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Uji') returning id::text`))[0]!.id

  beforeAll(async () => {
    db = await createTestDatabase()
    userId = await user()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('seeds the four old boxes inactive without prizes and one active 50-syiling box with the seven rows of 48 GAME-23, weights 100', async () => {
    const boxes = await db.query<{ id: number; label: string; cost_syiling: number; is_active: boolean }>(`select id, label, cost_syiling, is_active from mystery_boxes order by id`)
    expect(boxes.map((b) => [b.id, b.label, b.cost_syiling, b.is_active])).toEqual([
      [1, 'Kotak Gangsa', 50, false],
      [2, 'Kotak Perak', 50, false],
      [3, 'Kotak Emas', 50, false],
      [4, 'Kotak Legenda', 50, false],
      [5, 'Kotak Misteri', 50, true],
    ])
    const prizes = await db.query<{ box_id: number; label: string; kind: string; amount: number; weight: number; stock: number | null }>(
      `select box_id, label, kind, amount, weight, stock from mystery_box_prizes order by id`,
    )
    expect(prizes.every((p) => p.box_id === 5 && p.stock === null)).toBe(true)
    expect(prizes.map((p) => [p.label, p.kind, p.amount, p.weight])).toEqual([
      ['10 syiling', 'syiling', 10, 40],
      ['25 syiling', 'syiling', 25, 25],
      ['60 syiling', 'syiling', 60, 15],
      ['1 token', 'token', 1, 10],
      ['150 syiling', 'syiling', 150, 6],
      ['3 token', 'token', 3, 3],
      ['500 syiling — jackpot!', 'syiling', 500, 1],
    ])
    expect(prizes.reduce((n, p) => n + p.weight, 0)).toBe(100)
  })

  it('the box id sequence continues after the seeded ids: the next row is 6', async () => {
    const [row] = await db.query<{ id: number }>(`insert into mystery_boxes (label, cost_syiling, is_active) values ('Uji', 10, false) returning id`)
    expect(row!.id).toBe(6)
    await db.query(`delete from mystery_boxes where id = 6`)
  })

  it('checks: cost >= 1, prize kind syiling or token (no xp), amount >= 1, weight 0..100, stock null or >= 0, prize kind/amount of an opening', async () => {
    expect(await rejects(`insert into mystery_boxes (label, cost_syiling) values ('Uji', 0)`)).toMatch(/ck_mystery_boxes_amounts/)
    expect(await rejects(`insert into mystery_box_prizes (box_id, label, kind, amount, weight) values (5, 'x', 'xp', 5, 10)`)).toMatch(/ck_mystery_box_prizes_kind/)
    expect(await rejects(`insert into mystery_box_prizes (box_id, label, kind, amount, weight) values (5, 'x', 'syiling', 0, 10)`)).toMatch(/ck_mystery_box_prizes_amounts/)
    expect(await rejects(`insert into mystery_box_prizes (box_id, label, kind, amount, weight) values (5, 'x', 'syiling', 5, 101)`)).toMatch(/ck_mystery_box_prizes_amounts/)
    expect(await rejects(`insert into mystery_box_prizes (box_id, label, kind, amount, weight, stock) values (5, 'x', 'syiling', 5, 1, -1)`)).toMatch(/ck_mystery_box_prizes_amounts/)
    expect(await rejects(`insert into mystery_box_openings (user_id, box_id, coins, xp, prize_kind) values ($1, 5, 1, 0, 'xp')`, [userId])).toMatch(/ck_mystery_box_openings_prize/)
    expect(await rejects(`insert into mystery_box_openings (user_id, box_id, coins, xp, prize_amount) values ($1, 5, 1, 0, 0)`, [userId])).toMatch(/ck_mystery_box_openings_prize/)
  })

  it('foreign keys: a prize needs its box and goes with it; an opening needs its box and blocks its deletion', async () => {
    expect(await rejects(`insert into mystery_box_prizes (box_id, label, kind, amount, weight) values (99, 'x', 'syiling', 5, 1)`)).toMatch(/fk_mystery_box_prizes_box_id/)
    expect(await rejects(`insert into mystery_box_openings (user_id, box_id, coins, xp) values ($1, 99, 1, 0)`, [userId])).toMatch(/fk_mystery_box_openings_box_id/)
    await db.query(`insert into mystery_boxes (id, label, cost_syiling, is_active) values (50, 'Uji', 10, false)`)
    await db.query(`insert into mystery_box_prizes (box_id, label, kind, amount, weight) values (50, 'x', 'syiling', 5, 100)`)
    await db.query(`delete from mystery_boxes where id = 50`)
    expect(await db.query(`select 1 from mystery_box_prizes where box_id = 50`)).toHaveLength(0)
    await db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp) values ($1, 2, 3, 0)`, [userId])
    expect(await rejects(`delete from mystery_boxes where id = 2`)).toMatch(/fk_mystery_box_openings_box_id/)
    await db.query(`delete from mystery_box_openings where user_id = $1`, [userId])
  })

  it('one opening per (user, client_uuid); openings without a key are not limited (DM-78 pattern)', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111'
    await db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp, client_uuid, prize_label, prize_kind, prize_amount) values ($1, 5, 10, 0, $2, '10 syiling', 'syiling', 10)`, [userId, uuid])
    expect(await rejects(`insert into mystery_box_openings (user_id, box_id, coins, xp, client_uuid) values ($1, 5, 10, 0, $2)`, [userId, uuid])).toMatch(/uq_mystery_box_openings_user_id_client_uuid/)
    await db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp) values ($1, 5, 1, 0), ($1, 5, 1, 0)`, [userId])
    await db.query(`delete from mystery_box_openings where user_id = $1`, [userId])
  })

  it('reversal then the file again: openings made before it (box 1 to 4) stay valid, the new columns read NULL, the seed is back', async () => {
    await db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp) values ($1, 1, 5, 2), ($1, 4, 120, 40)`, [userId])
    await db.query(REVERSE)
    expect(await db.query(`select column_name from information_schema.columns where table_name = 'mystery_box_openings' and column_name in ('prize_label', 'client_uuid')`)).toHaveLength(0)
    await db.query(MIGRATION)
    const rows = await db.query<{ box_id: number; prize_label: string | null; client_uuid: string | null }>(`select box_id, prize_label, client_uuid from mystery_box_openings where user_id = $1 order by id`, [userId])
    expect(rows).toEqual([{ box_id: 1, prize_label: null, client_uuid: null }, { box_id: 4, prize_label: null, client_uuid: null }])
    expect(Number((await db.query<{ n: string }>(`select count(*)::text n from mystery_boxes`))[0]!.n)).toBe(5)
    expect(Number((await db.query<{ n: string }>(`select count(*)::text n from mystery_box_prizes`))[0]!.n)).toBe(7)
    await db.query(`delete from mystery_box_openings where user_id = $1`, [userId])
  })
})
