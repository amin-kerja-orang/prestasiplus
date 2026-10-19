import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { batches, hashRow, MigrationDbError, upsertByLegacy } from '../../../src/migration/kit'
import { createKitDb, DEMO_DDL, type KitDb } from './helpers'

let kit: KitDb
beforeAll(async () => {
  kit = await createKitDb()
  await kit.db.query(DEMO_DDL)
})
afterAll(async () => {
  await kit.close()
})

/** Runs `fn` on one connection inside a transaction (what the runner gives a loader). */
async function inTx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await kit.pool.connect()
  try {
    await c.query('BEGIN')
    const out = await fn(c)
    await c.query('COMMIT')
    return out
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    c.release()
  }
}

const spec = (rows: { id: string; code: string; name: string | null; qty: number }[], source: 'cloud' | 'my' = 'cloud') => ({
  table: 'demo_items',
  source,
  columns: ['code', 'name', 'qty'] as const,
  rows: rows.map((r) => ({ legacyId: r.id, values: { code: r.code, name: r.name, qty: r.qty } })),
})
const rowsOf = async (source: string | null) =>
  kit.db.query<{ legacy_id: string; code: string; name: string | null; qty: number; legacy_hash: string }>(
    source === null
      ? 'select * from demo_items where legacy_source is null order by id'
      : 'select * from demo_items where legacy_source = $1 order by legacy_id',
    source === null ? [] : [source],
  )

describe('upsertByLegacy', () => {
  it('AC1: a second run with the same rows changes nothing; a changed hash updates only that row', async () => {
    const a = [
      { id: '1', code: 'A1', name: 'One', qty: 1 },
      { id: '2', code: 'A2', name: 'Two', qty: 2 },
      { id: '3', code: 'A3', name: 'Three', qty: 3 },
    ]
    const first = await inTx((c) => upsertByLegacy(c, spec(a)))
    expect(first).toMatchObject({ inserted: 3, updated: 0, unchanged: 0 })
    const before = await rowsOf('cloud')
    expect(before.map((r) => r.legacy_id)).toEqual(['1', '2', '3'])

    const second = await inTx((c) => upsertByLegacy(c, spec(a)))
    expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 3 })
    const after = await rowsOf('cloud')
    expect(after).toEqual(before) // same ids, same values, same hashes

    const changed = a.map((r) => (r.id === '2' ? { ...r, name: 'Two!' } : r))
    const third = await inTx((c) => upsertByLegacy(c, spec(changed)))
    expect(third).toMatchObject({ inserted: 0, updated: 1, unchanged: 2 })
    const final = await rowsOf('cloud')
    expect(final.find((r) => r.legacy_id === '2')?.name).toBe('Two!')
    expect(final.find((r) => r.legacy_id === '2')?.legacy_hash).toBe(
      hashRow({ code: 'A2', name: 'Two!', qty: 2 }),
    )
    // untouched rows keep their primary keys and values
    for (const id of ['1', '3']) expect(final.find((r) => r.legacy_id === id)).toEqual(before.find((r) => r.legacy_id === id))
    expect(final).toHaveLength(3)
  })

  it('returns primary keys for every row of the batch (inserted, updated and unchanged)', async () => {
    const res = await inTx((c) => upsertByLegacy(c, spec([{ id: '1', code: 'A1', name: 'One', qty: 1 }])))
    const stored = await rowsOf('cloud')
    const row1 = (await kit.db.query<{ id: string }>(`select id::text from demo_items where legacy_source='cloud' and legacy_id='1'`))[0]
    expect(res.ids.get('1')).toBe(row1?.id)
    expect(stored.length).toBeGreaterThan(0)
  })

  it('AC2: rows born in v2 (legacy_source NULL) are never touched, even with the same legacy_id text or code', async () => {
    await kit.db.query(`insert into demo_items (code, name, qty, legacy_id) values ('V2-1', 'born in v2', 7, '1'), ('V2-2', 'born in v2', 8, null)`)
    const mine = await kit.db.query(`select * from demo_items where legacy_source is null order by id`)

    await inTx((c) => upsertByLegacy(c, spec([{ id: '1', code: 'CHANGED', name: 'Changed', qty: 99 }])))
    const again = await kit.db.query(`select * from demo_items where legacy_source is null order by id`)
    expect(again).toEqual(mine)
    expect(again).toHaveLength(2)
    expect((await rowsOf('cloud')).find((r) => r.legacy_id === '1')?.code).toBe('CHANGED')
  })

  it('keeps sources apart: the same legacy_id under "my" is a different row', async () => {
    await inTx((c) => upsertByLegacy(c, spec([{ id: '1', code: 'M1', name: 'My', qty: 1 }], 'my')))
    expect((await rowsOf('my')).map((r) => r.code)).toEqual(['M1'])
    expect((await rowsOf('cloud')).find((r) => r.legacy_id === '1')?.code).toBe('CHANGED')
  })

  it('a repeated legacy id inside one batch is applied once and reported as a duplicate', async () => {
    const res = await inTx((c) =>
      upsertByLegacy(c, spec([
        { id: 'd1', code: 'D1', name: 'first', qty: 1 },
        { id: 'd1', code: 'D1x', name: 'second', qty: 2 },
      ])),
    )
    expect(res.duplicates).toEqual(['d1'])
    expect(res).toMatchObject({ inserted: 1, updated: 0, unchanged: 0 })
    expect((await rowsOf('cloud')).find((r) => r.legacy_id === 'd1')?.code).toBe('D1')
  })

  it('writes typed values (arrays, timestamps, nulls) and rolls back with the transaction', async () => {
    const bornAt = new Date('2026-01-02T03:04:05.000Z')
    await expect(
      inTx(async (c) => {
        await upsertByLegacy(c, {
          table: 'demo_items',
          source: 'cloud',
          columns: ['code', 'tags', 'born_at'],
          rows: [{ legacyId: 't1', values: { code: 'T1', tags: ['x', 'y'], born_at: bornAt } }],
        })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await kit.db.query(`select 1 from demo_items where legacy_id='t1'`)).toHaveLength(0)

    await inTx((c) =>
      upsertByLegacy(c, {
        table: 'demo_items',
        source: 'cloud',
        columns: ['code', 'tags', 'born_at'],
        rows: [{ legacyId: 't1', values: { code: 'T1', tags: ['x', 'y'], born_at: bornAt } }],
      }),
    )
    const row = (await kit.db.query<{ tags: string[]; born_at: Date; name: string | null }>(`select tags, born_at, name from demo_items where legacy_id='t1'`))[0]
    expect(row?.tags).toEqual(['x', 'y'])
    expect(row?.born_at.toISOString()).toBe(bornAt.toISOString())
    expect(row?.name).toBeNull()
  })

  it('rejects reserved columns, bad identifiers and unknown sources before touching the database', async () => {
    const base = spec([{ id: 'z', code: 'Z', name: null, qty: 1 }])
    await expect(inTx((c) => upsertByLegacy(c, { ...base, columns: ['code', 'legacy_id'] }))).rejects.toThrow(/managed by the kit/)
    await expect(inTx((c) => upsertByLegacy(c, { ...base, columns: ['id'] }))).rejects.toThrow(/managed by the kit/)
    await expect(inTx((c) => upsertByLegacy(c, { ...base, table: 'demo_items; drop table x' }))).rejects.toThrow(/Invalid SQL identifier/)
    await expect(inTx((c) => upsertByLegacy(c, { ...base, source: 'nope' as 'cloud' }))).rejects.toThrow(/Unknown legacy source/)
  })

  it('M1: a table without legacy_hash: changed value updates, NULL to value updates, same values are unchanged', async () => {
    await kit.db.query(`create table demo_plain (
      id bigint generated always as identity primary key, code text not null, note text,
      legacy_source text, legacy_id text, constraint uq_demo_plain_legacy unique (legacy_source, legacy_id))`)
    const run = (note: string | null) =>
      inTx((c) =>
        upsertByLegacy(c, {
          table: 'demo_plain',
          source: 'cloud',
          columns: ['code', 'note'],
          rows: [{ legacyId: 'p1', values: { code: 'P1', note } }],
        }),
      )
    expect(await run(null)).toMatchObject({ inserted: 1, updated: 0, unchanged: 0 })
    expect(await run(null)).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 })
    expect(await run('first')).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 }) // NULL -> value
    expect(await run('first')).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 })
    expect(await run('second')).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 }) // changed value
    expect(await run(null)).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 }) // value -> NULL
    expect(await run(null)).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 })
  })

  it('a bad value never appears in the error: only SQLSTATE, table, column and constraint', async () => {
    const secret = 'IC-900101-14-5555'
    for (const column of ['born_at', 'qty']) {
      const bad = {
        table: 'demo_items',
        source: 'cloud' as const,
        columns: ['code', column],
        rows: [{ legacyId: 'bad1', values: { code: 'B1', [column]: secret } }],
      }
      const err: unknown = await inTx((c) => upsertByLegacy(c, bad)).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(MigrationDbError)
      const e = err as MigrationDbError
      expect(e.code).toMatch(/^[0-9A-Z]{5}$/)
      expect(e.table).toBe('demo_items')
      expect(JSON.stringify({ message: e.message, stack: e.stack, own: { ...e } })).not.toContain(secret)
      expect(e.message).not.toMatch(/invalid input syntax/i)
    }
  })
})

describe('batches', () => {
  it('groups an async iterable lazily and keeps the remainder', async () => {
    async function* gen() {
      for (let i = 1; i <= 7; i++) yield i
    }
    const out: number[][] = []
    for await (const b of batches(gen(), 3)) out.push(b)
    expect(out).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    await expect(batches([1], 0).next()).rejects.toThrow(RangeError)
  })
})
