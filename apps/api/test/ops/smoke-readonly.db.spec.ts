import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * docs/ops/sql/smoke-readonly.sql, block X (cutover plan section 5 criterion 2, LEAD decision D6, 29 Oct): the file is run
 * as the night runs it (one read-only transaction, BEGIN ... ROLLBACK) on a migrated test database whose etl_* tables hold
 * a small fictitious ledger. Checked here:
 *   - criterion 2 (a): the expected reject classes are 'info' rows X4.* with their count and share of eligible_count, and
 *     never FAIL on their own; X5 FAILs only when a class is above its ceiling;
 *   - criterion 2 (b): X3 FAILs on residual rejects (outside the classes) above 0.1 % (users, schools) / 0.5 % (others) of
 *     eligible_count, and X3.<entity> names each entity with a residual;
 *   - only the rejects of the run behind each entity's latest succeeded apply recon row count (not a dry-run's);
 *   - the output contract the UAT pack parses: `check_id | description | value | expected | ok`, ok in ok / FAIL / info,
 *     last row Z0 = the number of FAIL rows.
 * Every count is invented; the other blocks (A, E, ...) FAIL on this partial ledger and are not asserted.
 */
const SMOKE_SQL = readFileSync(fileURLToPath(new URL('../../../../docs/ops/sql/smoke-readonly.sql', import.meta.url)), 'utf8')

interface SmokeRow {
  check_id: string
  description: string
  value: string
  expected: string
  ok: string
}

let db: TestDatabase

/** Runs the whole file in one simple-query call (BEGIN; SELECT; ROLLBACK) and returns the SELECT's rows. */
async function runSmoke(): Promise<SmokeRow[]> {
  const client = new pg.Client({ connectionString: db.url })
  await client.connect()
  try {
    const results = (await client.query(SMOKE_SQL)) as unknown as pg.QueryResult<SmokeRow>[]
    const select = results.find((r) => r.command === 'SELECT')
    if (select === undefined) throw new Error('smoke-readonly.sql returned no SELECT result')
    return select.rows
  } finally {
    await client.end()
  }
}

function row(rows: SmokeRow[], id: string): SmokeRow {
  const r = rows.find((x) => x.check_id === id)
  if (r === undefined) throw new Error(`no row ${id}`)
  return r
}

async function recon(run: number, entity: string, eligible: number, rejected: number): Promise<void> {
  await db.query(
    `INSERT INTO etl_recon (run_id, entity, source_count, eligible_count, loaded, rejected, status) VALUES ($1::bigint, $2::text, $3::int, $3::int, $3::int - $4::int, $4::int, 'ok')
     ON CONFLICT (run_id, entity) DO UPDATE SET eligible_count = EXCLUDED.eligible_count, source_count = EXCLUDED.source_count,
       loaded = EXCLUDED.loaded, rejected = EXCLUDED.rejected`,
    [run, entity, eligible, rejected],
  )
}

/** `n` reject rows; legacy ids start at `from` so a second call for the same entity does not repeat ids. */
async function rejects(run: number, entity: string, reason: string, column: string, offending: string | null, n: number, from = 1): Promise<void> {
  await db.query(
    `INSERT INTO etl_rejects (run_id, entity, legacy_id, reason, column_name, offending)
     SELECT $1::bigint, $2::text, g::text, $3::text, $4::text, $5::text FROM generate_series($6::int, $6::int + $7::int - 1) g`,
    [run, entity, reason, column, offending, from, n],
  )
}

/**
 * Base ledger: run 1 = succeeded apply (core), run 2 = a later dry-run whose rejects must not count. Every reject of run 1 is
 * either in an expected class or a residual exactly at its threshold, so X3 and X5 are ok.
 */
async function plantBase(): Promise<void> {
  await db.query(`TRUNCATE etl_runs RESTART IDENTITY CASCADE`)
  await db.query(
    `INSERT INTO etl_runs (mode, sources, entity_set, git_sha, status) VALUES
       ('apply', ARRAY['cloud'], ARRAY['users', 'classrooms'], 'f1x7ure0', 'succeeded'),
       ('dry-run', ARRAY['cloud'], ARRAY['users', 'classrooms'], 'f1x7ure0', 'succeeded')`,
  )
  // users: 50 agent (stored raw; the case is folded like enumKey) + 10 hashed unknown roles = residual 10 of 10000 = 0.1 %.
  await recon(1, 'users', 10000, 60)
  await rejects(1, 'users', 'UNKNOWN_ENUM', 'role', 'agent', 25, 1)
  await rejects(1, 'users', 'UNKNOWN_ENUM', 'role', 'Agent', 25, 26)
  await rejects(1, 'users', 'UNKNOWN_ENUM', 'role', 'hmac:0123456789abcdef', 10, 51)
  // practice_sessions: 300 expected orphans (30 %) + residual 5 of 1000 = 0.5 %.
  await recon(1, 'practice_sessions', 1000, 305)
  await rejects(1, 'practice_sessions', 'ORPHAN_PARENT', 'user_id', null, 300, 1)
  await rejects(1, 'practice_sessions', 'INVALID_VALUE', 'correct', null, 5, 301)
  // wallets: both expected classes, nothing residual.
  await recon(1, 'wallets', 200, 40)
  await rejects(1, 'wallets', 'UNSUPPORTED', 'user_id', null, 30, 1)
  await rejects(1, 'wallets', 'ORPHAN_PARENT', 'user_id', null, 10, 31)
  // notes and support_tickets: dropped whole at go-live (D2, D3), whatever the reason.
  await recon(1, 'notes', 10, 10)
  await rejects(1, 'notes', 'INVALID_VALUE', 'subject', null, 10, 1)
  await recon(1, 'support_tickets', 3, 3)
  await rejects(1, 'support_tickets', 'INVALID_VALUE', 'body', null, 3, 1)
  // The dry-run: many unexplained user rejects that would breach the threshold if they were counted.
  await recon(2, 'users', 10000, 500)
  await rejects(2, 'users', 'UNKNOWN_ENUM', 'role', 'teacher_x', 500, 1)
}

beforeAll(async () => {
  db = await createTestDatabase()
  // Block A reads Prisma's ledger, which the raw-SQL test template does not have.
  await db.query(
    `CREATE TABLE IF NOT EXISTS _prisma_migrations (id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL DEFAULT '',
       finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
       started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0)`,
  )
})

afterAll(async () => {
  await db.drop()
})

describe('smoke-readonly.sql criterion 2 (D6)', () => {
  beforeEach(async () => {
    await plantBase()
  })

  it('reports the expected classes as info and passes X3 and X5 when only residuals at the threshold remain', async () => {
    const rows = await runSmoke()
    expect(row(rows, 'X3')).toMatchObject({ value: '0', expected: '0', ok: 'ok' })
    expect(row(rows, 'X5')).toMatchObject({ value: '0', expected: '0', ok: 'ok' })
    expect(row(rows, 'X4.users.UNKNOWN_ENUM.role.agent')).toMatchObject({ value: '50 of 10000 eligible (0.5000 %)', ok: 'info' })
    expect(row(rows, 'X4.practice_sessions.ORPHAN_PARENT.user_id')).toMatchObject({ value: '300 of 1000 eligible (30.0000 %)', ok: 'info' })
    expect(row(rows, 'X4.wallets.UNSUPPORTED.user_id').value).toBe('30 of 200 eligible (15.0000 %)')
    expect(row(rows, 'X4.wallets.ORPHAN_PARENT.user_id').value).toBe('10 of 200 eligible (5.0000 %)')
    expect(row(rows, 'X4.notes.*.*').value).toBe('10 of 10 eligible (100.0000 %)')
    expect(row(rows, 'X4.support_tickets.*.*').value).toBe('3 of 3 eligible (100.0000 %)')
    expect(row(rows, 'X4.coin_ledger.INVALID_VALUE.amount').value).toBe('0 (no recon row)')
    // Residual detail: the two entities at their threshold; none for wallets, notes, support_tickets.
    expect(row(rows, 'X3.users')).toMatchObject({ value: '10 of 10000 eligible (0.1000 %)', ok: 'info' })
    expect(row(rows, 'X3.practice_sessions')).toMatchObject({ value: '5 of 1000 eligible (0.5000 %)', ok: 'info' })
    expect(rows.filter((r) => r.check_id.startsWith('X3.')).map((r) => r.check_id).sort()).toEqual(['X3.practice_sessions', 'X3.users'])
    // Every X4 row is info, whatever its count.
    const x4 = rows.filter((r) => r.check_id.startsWith('X4.'))
    expect(x4).toHaveLength(10)
    expect(new Set(x4.map((r) => r.ok))).toEqual(new Set(['info']))
    // The dry-run's rejects are not counted (X1 sees run 1 only).
    expect(row(rows, 'X1.UNKNOWN_ENUM').value).toBe('60')
  })

  it('FAILs X3 when a residual is above the threshold, and names the entity', async () => {
    await recon(1, 'users', 10000, 61)
    await rejects(1, 'users', 'INVALID_VALUE', 'name', null, 1, 61)
    await recon(1, 'articles', 5, 5)
    await rejects(1, 'articles', 'INVALID_VALUE', 'content', null, 5, 1)
    const rows = await runSmoke()
    expect(row(rows, 'X3')).toMatchObject({ value: '2', ok: 'FAIL' })
    expect(row(rows, 'X3.users')).toMatchObject({ value: '11 of 10000 eligible (0.1100 %)', ok: 'info' })
    expect(row(rows, 'X3.articles')).toMatchObject({ value: '5 of 5 eligible (100.0000 %)', ok: 'info' })
    expect(row(rows, 'X5').ok).toBe('ok')
  })

  it('counts a hashed role as residual, not as the agent class', async () => {
    await recon(1, 'users', 10000, 70)
    await rejects(1, 'users', 'UNKNOWN_ENUM', 'role', 'hmac:fedcba9876543210', 10, 61)
    const rows = await runSmoke()
    expect(row(rows, 'X4.users.UNKNOWN_ENUM.role.agent').value).toBe('50 of 10000 eligible (0.5000 %)')
    expect(row(rows, 'X3.users').value).toBe('20 of 10000 eligible (0.2000 %)')
    expect(row(rows, 'X3').ok).toBe('FAIL')
  })

  it('FAILs X5 when an expected class is above its ceiling, while its X4 row stays info', async () => {
    await recon(1, 'practice_sessions', 1000, 455)
    await rejects(1, 'practice_sessions', 'ORPHAN_PARENT', 'user_id', null, 150, 1001)
    const rows = await runSmoke()
    expect(row(rows, 'X4.practice_sessions.ORPHAN_PARENT.user_id')).toMatchObject({ value: '450 of 1000 eligible (45.0000 %)', ok: 'info' })
    expect(row(rows, 'X5')).toMatchObject({ value: '1', ok: 'FAIL' })
    expect(row(rows, 'X3').ok).toBe('ok')
  })

  it('keeps the output contract: five text columns, ok in ok/FAIL/info, Z0 last and equal to the FAIL count', async () => {
    const rows = await runSmoke()
    for (const r of rows) {
      expect(Object.keys(r)).toEqual(['check_id', 'description', 'value', 'expected', 'ok'])
      for (const v of Object.values(r)) expect(typeof v).toBe('string')
      expect(['ok', 'FAIL', 'info']).toContain(r.ok)
      // Block X text adds no column separator (A8's `expected` quotes a shell pipe; it predates D6 and is not checked).
      if (r.check_id.startsWith('X')) {
        expect(r.description).not.toContain('|')
        expect(r.value).not.toContain('|')
        expect(r.expected).not.toContain('|')
      }
    }
    const last = rows[rows.length - 1]
    expect(last?.check_id).toBe('Z0')
    const fails = rows.slice(0, -1).filter((r) => r.ok === 'FAIL').length
    expect(last?.value).toBe(String(fails))
    expect(rows.filter((r) => r.check_id === 'Z0')).toHaveLength(1)
  })
})
