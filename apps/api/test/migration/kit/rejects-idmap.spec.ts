import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  IdMap,
  Rejects,
  Runner,
  REJECT_REASONS,
  hashInput,
  resolveSelfReferences,
  upsertByLegacy,
} from '../../../src/migration/kit'
import { createKitDb, DEMO_DDL, demoRows, demoStep, type DemoSource, type KitDb } from './helpers'

let kit: KitDb
beforeAll(async () => {
  kit = await createKitDb()
  await kit.db.query(DEMO_DDL)
})
afterAll(async () => {
  await kit.close()
})

describe('Rejects', () => {
  it('AC4: a reject keeps entity, legacy_id, reason code and column, and never the row values', async () => {
    const email = 'someone.fictitious@example.test'
    const name = 'Fictitious Person Name'
    const secretRow: DemoSource = { id: 99, code: email, name, qty: 5, status: name }
    const rows = [...demoRows(2), secretRow]
    const runner = new Runner({ pool: kit.pool })
    const hash = hashInput(['ac4'])
    const dry = await runner.run({ steps: [demoStep(rows)], inputHash: hash })
    expect(dry.recon[0]).toMatchObject({ sourceCount: 3, loaded: 2, rejected: 1, status: 'ok' })

    const stored = await kit.db.query(`select * from etl_rejects`)
    expect(stored).toHaveLength(1)
    const reject = stored[0] as Record<string, unknown>
    expect(reject).toMatchObject({ entity: 'demo_items', legacy_id: '99', reason: 'UNKNOWN_ENUM', column_name: 'status' })
    // every column of the table, serialised: none of the row's values appears
    const dump = JSON.stringify(stored)
    for (const secret of [email, name, 'Fictitious', 'someone']) expect(dump).not.toContain(secret)
    // a non code-like "enum" value is stored as a hash only
    expect(String(reject.offending)).toMatch(/^hmac:[0-9a-f]{16}$/)
  })

  it('stores a code-like enum value as is, hashes anything else, and validates reason codes', async () => {
    const r = new Rejects()
    r.add({ entity: 'e', legacyId: '1', reason: 'UNKNOWN_ENUM', column: 'role', enumValue: 'principal_x' })
    r.add({ entity: 'e', legacyId: '2', reason: 'INVALID_VALUE', column: 'phone', valueToHash: '0123456789' })
    r.add({ entity: 'e', legacyId: null, reason: 'DUPLICATE_KEY' })
    expect(() => r.add({ entity: 'e', legacyId: '3', reason: 'NOPE' as 'UNSUPPORTED' })).toThrow(/Unknown reject reason/)
    const run = (await kit.db.query<{ id: string }>(`insert into etl_runs (mode) values ('dry-run') returning id::text id`))[0]
    expect(await r.flush(kit.pool, run?.id ?? '0')).toBe(3)
    expect(r.size).toBe(0)
    expect(r.counts('e')).toEqual({ UNKNOWN_ENUM: 1, INVALID_VALUE: 1, DUPLICATE_KEY: 1 })
    const rows = await kit.db.query<{ legacy_id: string | null; offending: string | null }>(
      `select legacy_id, offending from etl_rejects where run_id = $1 order by id`, [run?.id],
    )
    expect(rows.map((x) => x.offending)).toEqual(['principal_x', expect.stringMatching(/^hmac:[0-9a-f]{16}$/), null])
    expect(REJECT_REASONS).toEqual(['UNKNOWN_ENUM', 'ORPHAN_PARENT', 'DUPLICATE_KEY', 'INVALID_VALUE', 'UNSUPPORTED'])
  })

  it('M2: IC-like, phone-like and digit-heavy enum values are hashed; known codes and short codes stay raw', async () => {
    const r = new Rejects()
    const add = (enumValue: string, allowedCodes?: readonly string[]) =>
      r.add({ entity: 'e', legacyId: '1', reason: 'UNKNOWN_ENUM', column: 'c', enumValue, allowedCodes })
    add('900101145555') // IC shape: digits only
    add('0123456789') // phone shape
    add('ic_900101145555') // a letter, but more than 4 digits
    add('990101-14-5555') // IC with dashes
    add('teacher_x') // code-like
    add('grade_12') // a letter and 2 digits
    add('12345', ['12345']) // allow-listed for the column
    const run = (await kit.db.query<{ id: string }>(`insert into etl_runs (mode) values ('dry-run') returning id::text id`))[0]
    await r.flush(kit.pool, run?.id ?? '0')
    const rows = await kit.db.query<{ offending: string }>(`select offending from etl_rejects where run_id = $1 order by id`, [run?.id])
    const hashed = /^hmac:[0-9a-f]{16}$/
    expect(rows.slice(0, 4).every((x) => hashed.test(x.offending))).toBe(true)
    expect(rows.slice(4).map((x) => x.offending)).toEqual(['teacher_x', 'grade_12', '12345'])
  })

  it('M2: the hash is keyed per run (same value, same hash within a run; different hash in another run)', async () => {
    const stored = async (r: Rejects) => {
      const run = (await kit.db.query<{ id: string }>(`insert into etl_runs (mode) values ('dry-run') returning id::text id`))[0]
      await r.flush(kit.pool, run?.id ?? '0')
      return (await kit.db.query<{ offending: string }>(`select offending from etl_rejects where run_id = $1 order by id`, [run?.id])).map((x) => x.offending)
    }
    const a = new Rejects()
    const b = new Rejects()
    const value = '0123456789'
    a.add({ entity: 'e', legacyId: '1', reason: 'INVALID_VALUE', valueToHash: value })
    a.add({ entity: 'e', legacyId: '2', reason: 'INVALID_VALUE', valueToHash: value })
    b.add({ entity: 'e', legacyId: '1', reason: 'INVALID_VALUE', valueToHash: value })
    const [a1, a2] = await stored(a)
    const [b1] = await stored(b)
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b1)
  })

  it('M2: a legacyId that is an e-mail, an IC or a phone number is refused, without echoing it', async () => {
    const r = new Rejects()
    const map = new IdMap(kit.pool, 'cloud')
    for (const bad of ['someone@example.test', '900101145555', '0123456789', 'u-0123456789-x']) {
      let msg = ''
      try {
        r.add({ entity: 'e', legacyId: bad, reason: 'UNSUPPORTED' })
      } catch (e) {
        msg = (e as Error).message
      }
      expect(msg).toMatch(/looks like personal data/)
      expect(msg).not.toContain(bad)
      await expect(map.register('e', bad, '1')).rejects.toThrow(/looks like personal data/)
    }
    expect(() => r.add({ entity: 'e', legacyId: '123456789', reason: 'UNSUPPORTED' })).not.toThrow()
    expect(() => r.add({ entity: 'e', legacyId: '12:34', reason: 'UNSUPPORTED' })).not.toThrow()
  })

  it('the database refuses a reason outside the five codes and a mode outside dry-run/apply', async () => {
    const run = (await kit.db.query<{ id: string }>(`insert into etl_runs (mode) values ('apply') returning id::text id`))[0]
    await expect(kit.db.query(`insert into etl_rejects (run_id, entity, reason) values ($1, 'e', 'WHATEVER')`, [run?.id])).rejects.toThrow(/ck_etl_rejects_reason/)
    await expect(kit.db.query(`insert into etl_runs (mode) values ('dry_run')`)).rejects.toThrow(/ck_etl_runs_mode/)
  })
})

describe('IdMap', () => {
  it('registers, resolves (cached and from the table), and refuses a conflicting remap', async () => {
    const map = new IdMap(kit.pool, 'cloud')
    await map.register('school', '7', 700n)
    await map.registerMany('school', [['8', 800], ['9', '900']])
    await map.register('school', '7', '700') // same pair again: no-op
    expect(await map.resolve('school', '7')).toBe('700')
    expect([...(await new IdMap(kit.pool, 'cloud').resolveMany('school', ['7', '8', '9', '10'])).entries()].sort()).toEqual([
      ['7', '700'], ['8', '800'], ['9', '900'],
    ])
    expect(await new IdMap(kit.pool, 'cloud').resolve('school', '10')).toBeNull()
    expect(await new IdMap(kit.pool, 'my').resolve('school', '7')).toBeNull() // per source
    await expect(map.register('school', '7', '701')).rejects.toThrow(/already mapped to a different id/)
  })
})

describe('resolveSelfReferences (two-pass load, AC6)', () => {
  it('pass 1 inserts with NULL, pass 2 sets the FK through the IdMap; unknown parents become ORPHAN_PARENT', async () => {
    // children come before their parents; the FK is DEFERRABLE INITIALLY DEFERRED
    const src = [
      { id: 'c1', parent: 'p1' },
      { id: 'c2', parent: 'p1' },
      { id: 'p1', parent: 'root' },
      { id: 'root', parent: null },
      { id: 'lost', parent: 'missing' },
    ]
    const rejects = new Rejects()
    const c = await kit.pool.connect()
    try {
      await c.query('BEGIN')
      const pass1 = await upsertByLegacy(c, {
        table: 'demo_items',
        source: 'cloud',
        columns: ['code', 'parent_id'], // NULL in pass 1
        rows: src.map((r) => ({ legacyId: r.id, values: { code: r.id, parent_id: null } })),
      })
      const idMap = new IdMap(c, 'cloud')
      await idMap.registerMany('tree', pass1.ids)
      const updated = await resolveSelfReferences(c, idMap, rejects, {
        table: 'demo_items',
        entity: 'tree',
        source: 'cloud',
        column: 'parent_id',
        refs: src.filter((r) => r.parent !== null).map((r) => ({ legacyId: r.id, parentLegacyId: r.parent as string })),
      })
      expect(updated).toBe(3) // c1, c2, p1; "lost" has no parent to point at
      await c.query('COMMIT')
    } finally {
      c.release()
    }
    expect(rejects.size).toBe(1)
    const run = (await kit.db.query<{ id: string }>(`insert into etl_runs (mode) values ('dry-run') returning id::text id`))[0]
    await rejects.flush(kit.pool, run?.id ?? '0')
    expect((await kit.db.query(`select legacy_id, reason, column_name from etl_rejects where run_id=$1`, [run?.id]))).toEqual([
      { legacy_id: 'lost', reason: 'ORPHAN_PARENT', column_name: 'parent_id' },
    ])

    const tree = await kit.db.query<{ code: string; parent: string | null }>(
      `select c.code, p.code as parent from demo_items c left join demo_items p on p.id = c.parent_id
       where c.code in ('c1','c2','p1','root','lost') order by c.code`,
    )
    expect(tree).toEqual([
      { code: 'c1', parent: 'p1' },
      { code: 'c2', parent: 'p1' },
      { code: 'lost', parent: null },
      { code: 'p1', parent: 'root' },
      { code: 'root', parent: null },
    ])
  })

  it('the FK is deferrable in the test table: a child may point at a parent inserted later in the same transaction', async () => {
    const c = await kit.pool.connect()
    try {
      await c.query('BEGIN')
      await c.query(`insert into demo_items (id, code, parent_id) overriding system value values (9001, 'early-child', 9002)`)
      await c.query(`insert into demo_items (id, code) overriding system value values (9002, 'late-parent')`)
      await c.query('COMMIT')
    } finally {
      c.release()
    }
    expect((await kit.db.query(`select parent_id::text from demo_items where id = 9001`))[0]).toEqual({ parent_id: '9002' })
  })
})
