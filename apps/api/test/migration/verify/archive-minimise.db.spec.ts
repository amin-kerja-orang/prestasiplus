/**
 * `migrate:archive-minimise` (AM-09, LEAD decision 18 / Q12) against a real PostgreSQL on the `cloud-tiny` fixture with a
 * few synthetic rows (fictitious text only): dry-run changes nothing; apply nulls exactly user_id (five tables) and
 * question_reports.reason; a second apply changes 0 rows; refused without the Q9 export summary and without each gate;
 * refused (exit 4) while the source lock is held; output holds counts only.
 */
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { exportOpenQuestionReports } from '../../../src/migration/export/question-reports'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, createStagingDb, FIXTURE_DIR, REPO_ROOT, stagingEnv, type StagingDb } from '../staging/helpers'
import '../../../src/migration/orchestrate'

const outRoot = join(REPO_ROOT, '.migration-out', `am09-minimise-${process.pid}`)
const MARK = 'ZQXJ-pelapor-penanda-9137'
const TABLES = ['question_reports', 'question_submissions', 'question_imports', 'spm_sets', 'teacher_reference_documents']
let env: StagingDb
let summary: string

const gates = (extra: Record<string, string> = {}) => ({ NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1', PP_MIGRATE_TARGET_DB: env.db.name, ...extra })

async function run(argv: string[], envOverride?: Record<string, string | undefined>) {
  const log = capture()
  const code = await runCli(argv, { pool: env.pool, env: envOverride ?? gates(), out: log.out, err: log.err })
  return { code, text: log.text() }
}
const base = (extra: string[] = []) => ['migrate:archive-minimise', '--confirm', env.db.name, '--export-summary', summary, ...extra]

/** Every column except user_id / reason, as JSON per row, per table. */
async function others(pool: pg.Pool): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const t of TABLES) {
    const r = await pool.query<{ j: string }>(`select (to_jsonb(x) - 'user_id' - 'reason' - '_row_hash')::text as j from archive_cloud."${t}" x order by id`)
    out[t] = r.rows.map((x) => x.j)
  }
  return out
}
async function notNull(pool: pg.Pool): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const t of TABLES) out[`${t}.user_id`] = Number((await pool.query<{ n: string }>(`select count(user_id)::text n from archive_cloud."${t}"`)).rows[0]?.n)
  out['question_reports.reason'] = Number((await pool.query<{ n: string }>(`select count(reason)::text n from archive_cloud.question_reports`)).rows[0]?.n)
  return out
}

/** Per table of staging_cloud and public: row count and a digest of every row (all columns). */
async function untouched(pool: pg.Pool): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const tables = await pool.query<{ s: string; t: string }>(
    `select table_schema s, table_name t from information_schema.tables where table_schema in ('staging_cloud', 'public') and table_type = 'BASE TABLE' order by 1, 2`,
  )
  for (const { s, t } of tables.rows) {
    const r = await pool.query<{ n: string; h: string }>(`select count(*)::text n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') h from "${s}"."${t}" x`)
    out[`${s}.${t}`] = `${r.rows[0]?.n}:${r.rows[0]?.h}`
  }
  return out
}
/** `_row_hash` per row, per table (the loader's hash; the fixture has none, so every row gets a stand-in). */
async function hashes(pool: pg.Pool): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const t of TABLES) {
    const r = await pool.query<{ j: string }>(`select id || '=' || coalesce("_row_hash", '<null>') as j from archive_cloud."${t}" order by id`)
    out[t] = r.rows.map((x) => x.j)
  }
  return out
}
/** Ids whose user_id or reason is still set (the rows the apply touches). */
async function touchedIds(pool: pg.Pool): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  for (const t of TABLES) {
    const cond = t === 'question_reports' ? 'user_id is not null or reason is not null' : 'user_id is not null'
    out[t] = (await pool.query<{ id: string }>(`select id::text from archive_cloud."${t}" where ${cond} order by id`)).rows.map((x) => x.id)
  }
  return out
}

beforeAll(async () => {
  mkdirSync(outRoot, { recursive: true })
  env = await createStagingDb()
  env.pool.on('error', () => undefined)
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  const ts = `'2026-03-01T17:15:00Z', '2026-03-02T00:00:00Z'`
  for (const [id, u, status, reason] of [[9001, 1, 'baru', `${MARK} satu`], [9002, 2, 'selesai', `${MARK} dua`], [9003, 3, 'menunggu', null]] as const) {
    await env.pool.query(`insert into archive_cloud.question_reports (id, question_id, user_id, status, reason, created_at, updated_at) values ($1, 1, $2, $3, $4, ${ts})`, [id, u, status, reason])
  }
  for (const [id, u, status] of [[9001, 1, 'menunggu'], [9002, 2, 'diluluskan']] as const) {
    await env.pool.query(`insert into archive_cloud.question_submissions (id, user_id, status, created_at, updated_at) values ($1, $2, $3, ${ts})`, [id, u, status])
  }
  await env.pool.query(`insert into archive_cloud.question_imports (id, user_id, status, created_at, updated_at) values (9001, 3, 'selesai', ${ts}), (9002, null, 'selesai', ${ts})`)
  await env.pool.query(`insert into archive_cloud.spm_sets (id, user_id, title, created_at, updated_at) values (9001, 4, 'Set contoh', ${ts})`)
  await env.pool.query(`insert into archive_cloud.teacher_reference_documents (id, user_id, path, created_at, updated_at) values (9001, 5, 'rujukan/contoh.pdf', ${ts})`)
  for (const t of TABLES) await env.pool.query(`update archive_cloud."${t}" set "_row_hash" = 'hash-' || id`)
  summary = (await exportOpenQuestionReports({ pool: env.pool, outDir: join(outRoot, 'export') })).summary
}, 300_000)
afterAll(async () => {
  // Every client must be back in the pool before it is ended (a leaked client would be cut by the database drop: 57P01).
  const leaked = env === undefined ? 0 : env.pool.totalCount - env.pool.idleCount
  await env?.close()
  rmSync(outRoot, { recursive: true, force: true })
  expect(leaked).toBe(0)
})

describe('migrate:archive-minimise', () => {
  it('dry-run reports counts and changes nothing', async () => {
    const before = { nn: await notNull(env.pool), other: await others(env.pool), hash: await hashes(env.pool) }
    const r = await run(base())
    expect(r.code).toBe(0)
    expect(r.text).toMatch(/dry-run \(rolled back\)/)
    expect(r.text).toMatch(/^\s*question_reports \| reason \| 2$/m)
    expect(r.text).toMatch(/^\s*question_submissions \| user_id \| 2$/m)
    expect(await notNull(env.pool)).toEqual(before.nn)
    expect(await others(env.pool)).toEqual(before.other)
    expect(await hashes(env.pool)).toEqual(before.hash)
    expect(before.nn['question_reports.reason']).toBeGreaterThanOrEqual(2)
  })

  it('refuses without the export summary, with a wrong one, and with a summary of other counts (exit 2)', async () => {
    const nn = await notNull(env.pool)
    const noFlag = await run(['migrate:archive-minimise', '--confirm', env.db.name, '--apply'])
    expect(noFlag.code).toBe(2)
    expect(noFlag.text).toMatch(/--export-summary/)
    const missing = await run(base(['--apply']).map((a) => (a === summary ? join(outRoot, 'question-reports-open-x.summary.json') : a)))
    expect(missing.code).toBe(2)
    const badName = join(outRoot, 'other.json')
    writeFileSync(badName, '{}')
    expect((await run(base(['--apply']).map((a) => (a === summary ? badName : a)))).code).toBe(2)
    const garbage = join(outRoot, 'question-reports-open-garbage.summary.json')
    writeFileSync(garbage, '{"source":"cloud"}')
    expect((await run(base(['--apply']).map((a) => (a === summary ? garbage : a)))).code).toBe(2)
    const link = join(outRoot, 'question-reports-open-link.summary.json')
    symlinkSync(summary, link)
    const linked = await run(base(['--apply']).map((a) => (a === summary ? link : a)))
    expect(linked.code).toBe(2)
    expect(linked.text).toMatch(/cannot be read|not a regular file/)
    const folder = join(outRoot, 'question-reports-open-dir.summary.json')
    mkdirSync(folder)
    expect((await run(base(['--apply']).map((a) => (a === summary ? folder : a)))).code).toBe(2)
    const stale = join(outRoot, 'question-reports-open-stale.summary.json')
    writeFileSync(stale, JSON.stringify({ source: 'cloud', total: 1, exported: 1, byStatus: [], submissions: { total: 1, exported: 1, byStatus: [] } }))
    const s = await run(base(['--apply']).map((a) => (a === summary ? stale : a)))
    expect(s.code).toBe(2)
    expect(s.text).toMatch(/does not match the archive now/)
    expect(await notNull(env.pool)).toEqual(nn)
  })

  it('refuses without each gate (exit 2) and changes nothing', async () => {
    const nn = await notNull(env.pool)
    expect((await run(base(['--apply']), gates({ PP_ALLOW_MIGRATE_APPLY: '0' }))).code).toBe(2)
    expect((await run(base(['--apply']), { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' })).code).toBe(2)
    expect((await run(base(['--apply']), gates({ PP_MIGRATE_TARGET_DB: 'another_db' }))).code).toBe(2)
    expect((await run(base(['--apply']).map((a) => (a === env.db.name ? 'another_db' : a)))).code).toBe(2)
    expect((await run(['migrate:archive-minimise', '--export-summary', summary, '--apply'])).code).toBe(2)
    // The dry-run is gated too.
    expect((await run(base(), gates({ PP_ALLOW_MIGRATE_APPLY: '' }))).code).toBe(2)
    expect(await notNull(env.pool)).toEqual(nn)
  })

  it('refuses (exit 2, nothing changed, no value printed) when a table is missing or a target column is NOT NULL', async () => {
    const before = { nn: await notNull(env.pool), hash: await hashes(env.pool) }
    try {
      await env.pool.query('alter table archive_cloud.teacher_reference_documents rename to trd_away')
      const missing = await run(base(['--apply']))
      expect(missing.code).toBe(2)
      expect(missing.text).toMatch(/table\(s\) missing: teacher_reference_documents/)
      expect(missing.text).not.toContain(MARK)
    } finally {
      await env.pool.query('alter table if exists archive_cloud.trd_away rename to teacher_reference_documents')
    }
    // spm_sets holds only the synthetic row above (user_id set), so the constraint can be added without touching any row.
    await env.pool.query('alter table archive_cloud.spm_sets alter column user_id set not null')
    try {
      const notNullCol = await run(base(['--apply']))
      expect(notNullCol.code).toBe(2)
      expect(notNullCol.text).toMatch(/spm_sets\.user_id is NOT NULL/)
      expect(notNullCol.text).not.toContain(MARK)
    } finally {
      await env.pool.query('alter table archive_cloud.spm_sets alter column user_id drop not null')
    }
    expect(await notNull(env.pool)).toEqual(before.nn)
    expect(await hashes(env.pool)).toEqual(before.hash)
  })

  it('is refused (exit 4) while the source lock is held', async () => {
    const holder = await env.pool.connect()
    try {
      await holder.query(`select pg_advisory_lock(hashtextextended('etl:source:cloud', 0))`)
      const r = await run(base(['--apply']))
      expect(r.code).toBe(4)
    } finally {
      await holder.query(`select pg_advisory_unlock(hashtextextended('etl:source:cloud', 0))`)
      holder.release()
    }
    expect((await notNull(env.pool))['question_reports.reason']).toBeGreaterThan(0)
  })

  it('apply nulls exactly user_id and question_reports.reason; a second apply changes 0 rows; no value is printed', async () => {
    const before = await others(env.pool)
    const outside = await untouched(env.pool)
    const touched = await touchedIds(env.pool)
    const hashBefore = await hashes(env.pool)
    const first = await run(base(['--apply']))
    expect(first.code).toBe(0)
    expect(first.text).toMatch(/apply on/)
    expect(first.text).not.toContain(MARK)
    expect(first.text).not.toMatch(/contoh|rujukan/)
    const after = await notNull(env.pool)
    for (const v of Object.values(after)) expect(v).toBe(0)
    expect(await others(env.pool)).toEqual(before)
    expect(await untouched(env.pool)).toEqual(outside)
    // `_row_hash` is NULL on every touched row; the rows that held nothing personal keep theirs.
    const hashAfter = await hashes(env.pool)
    for (const t of TABLES) {
      expect(touched[t]?.length).toBeGreaterThan(0)
      expect(hashAfter[t]).toEqual((hashBefore[t] ?? []).map((h) => (touched[t]?.includes(h.split('=')[0] as string) ? `${h.split('=')[0]}=<null>` : h)))
    }
    expect(await hashes(env.pool)).toEqual(hashAfter)
    // Rows are kept, the free text is gone.
    expect(Number((await env.pool.query<{ n: string }>(`select count(*)::text n from archive_cloud.question_reports where reason like $1`, [`%${MARK}%`])).rows[0]?.n)).toBe(0)

    const second = await run(base(['--apply']))
    expect(second.code).toBe(0)
    expect(second.text).toMatch(/total \| 0$/)
    expect(second.text).not.toContain(MARK)
    expect(await others(env.pool)).toEqual(before)
    expect(await hashes(env.pool)).toEqual(hashAfter)
    expect(await untouched(env.pool)).toEqual(outside)
  })
})
