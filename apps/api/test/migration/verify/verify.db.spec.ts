/**
 * `migrate:verify` against a real PostgreSQL (card BE-30 AC1, AC6): core and activity applied from the `cloud-tiny`
 * fixture, then the reconciliation. The mismatch cases come last because they change the data.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ENTITY_MATRIX, runVerify, writeVerifyReport, type VerifyReport } from '../../../src/migration/verify'
import { bootActivity, migrateAll, tempOutDir } from './helpers-verify'
import { PII_COLUMNS, type ActivityHarness } from '../activity/helpers'

let h: ActivityHarness
let runIds: string[] = []
const out = tempOutDir()

beforeAll(async () => {
  h = await bootActivity({ core: false })
  // Give every teacher profile data, so the profile rule has rows to lose (synthetic text).
  await h.q(`update staging_cloud.users set teaching_subject = 'Subjek Ujian' where role = 'guru'`)
  runIds = await migrateAll(h)
}, 300_000)
afterAll(async () => {
  out.cleanup()
  await h?.close()
})

const verify = (extra: object = {}): Promise<VerifyReport> =>
  runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud', ...extra })

describe('pass on the fixture', () => {
  let report: VerifyReport
  it('is green with one row per registered entity', async () => {
    report = await verify()
    const bad = report.entities.filter((e) => e.status !== 'ok').map((e) => `${e.entity}: ${e.status} ${e.note ?? ''}`)
    const badChecks = report.checks.filter((c) => c.status === 'mismatch').map((c) => `${c.name}: ${c.detail ?? ''}`)
    expect({ bad, badChecks }).toEqual({ bad: [], badChecks: [] })
    expect(report.status).toBe('pass')
    expect(report.entities.map((e) => e.entity)).toEqual(ENTITY_MATRIX.map((m) => m.entity))
    expect(report.runIds.length).toBeGreaterThan(0)
    for (const e of report.entities.filter((x) => x.entity !== 'wallet_ledger_drift')) expect(e.targetCount, e.entity).toBe(e.loaded)
  })

  it('uses the runs it is given, and the dry-runs never count', async () => {
    const given = await verify({ runIds })
    expect(given.status).toBe('pass')
    expect(given.runIds.sort()).toEqual([...runIds].sort())
  })

  it('writes the json and the markdown into a .migration-out folder, without personal data', async () => {
    const files = writeVerifyReport(report, out.path)
    expect(report.files).toEqual(files)
    expect(readdirSync(out.path).sort()).toHaveLength(2)
    const name = files.json.split('/').pop() as string
    expect(name).toMatch(/^recon-[\d-]+-\d{14}\.json$/)
    const json = readFileSync(files.json, 'utf8')
    const md = readFileSync(files.md, 'utf8')
    expect(md).toContain('| Entity | Staging table | Target |')
    expect(JSON.parse(json).status).toBe('pass')

    const values: string[] = []
    for (const [table, columns] of Object.entries(PII_COLUMNS)) {
      for (const c of columns) {
        const rows = await h.q<{ v: string | null }>(`select ${c}::text as v from staging_cloud.${table} where ${c} is not null`)
        for (const r of rows) if (r.v && r.v.trim().length >= 4) values.push(r.v.trim())
      }
    }
    expect(values.length).toBeGreaterThan(10)
    for (const v of new Set(values)) {
      expect(json.includes(v), 'json leaks a staged personal value').toBe(false)
      expect(md.includes(v), 'markdown leaks a staged personal value').toBe(false)
    }
  })

  it('refuses a folder that is not a .migration-out folder', () => {
    expect(() => writeVerifyReport(report, '/tmp/not-allowed-out')).toThrow(/migration-out/)
  })
})

describe('detects a mismatch', () => {
  it('a target row deleted after the load fails that entity', async () => {
    const before = await h.count('enrolments', `legacy_source = 'cloud'`)
    expect(before).toBeGreaterThan(0)
    await h.q(`delete from enrolments where id = (select min(id) from enrolments where legacy_source = 'cloud')`)
    const report = await verify()
    expect(report.status).toBe('fail')
    const e = report.entities.find((x) => x.entity === 'enrolments')
    expect(e?.status).toBe('mismatch')
    expect(e?.targetCount).toBe(before - 1)
    expect(report.entities.filter((x) => x.status === 'mismatch').map((x) => x.entity)).toEqual(['enrolments'])
  })

  it('a ledger amount changed after the load fails the sum check but not the entity table', async () => {
    const rows = await h.count('coin_ledger', `legacy_source = 'cloud'`)
    expect(rows, 'the fixture must give migrated ledger rows').toBeGreaterThan(0)
    await h.q(`update coin_ledger set amount = amount + 1 where id = (select min(id) from coin_ledger where legacy_source = 'cloud')`)
    const report = await verify()
    const sum = report.checks.find((c) => c.name === 'ledger amount sum, staging versus v2')
    expect(sum?.status).toBe('mismatch')
    expect(report.status).toBe('fail')
  })

  it('an entity that never ran is not-run and fails the gate (it is required)', async () => {
    await h.q(`delete from etl_recon where entity = 'banners'`)
    const report = await verify()
    expect(report.entities.find((x) => x.entity === 'banners')?.status).toBe('not-run')
    expect(report.status).toBe('fail')
  })

  it('an entity that is not in the matrix fails the gate', async () => {
    await h.q(`insert into etl_recon (run_id, entity, source_count, eligible_count, loaded, rejected, expected_delta, status)
               select max(run_id), 'zz_unknown', 1, 1, 1, 0, 0, 'ok' from etl_recon`)
    const report = await verify()
    expect(report.entities.find((x) => x.entity === 'zz_unknown')?.status).toBe('mismatch')
  })

  it('a staging table that changed since the run is a mismatch', async () => {
    await h.q(`delete from staging_cloud.support_tickets where id = (select min(id) from staging_cloud.support_tickets)`)
    const report = await verify()
    const e = report.entities.find((x) => x.entity === 'support_tickets')
    expect(e?.status).toBe('mismatch')
    expect(e?.note).toContain('staging changed since the run')
    expect(report.status).toBe('fail')
  })

  // The derived rows must have a lower bound too: deleting every one of them may not pass.
  for (const [table, check, entity] of [
    ['user_scopes', 'user_scopes rows versus admins and scoped officers', 'users'],
    ['teacher_profiles', 'teacher_profiles rows versus teachers with profile data', 'users'],
    ['attempt_results', 'attempt_results rows versus scored exam attempts', 'exam_attempts'],
  ] as const) {
    it(`all ${table} rows deleted after the load fail the derived count (entity ${entity} stays ok)`, async () => {
      const where = table === 'attempt_results' ? 'true' : `legacy_source = 'cloud'`
      const n = await h.count(table, where)
      expect(n, `the fixture must give ${table} rows`).toBeGreaterThan(0)
      await h.q(`delete from ${table} where ${where}`)
      const report = await verify()
      const c = report.checks.find((x) => x.name === check)
      expect(c?.status).toBe('mismatch')
      expect(c?.actual).toBe(0)
      expect(c?.expected).toBe(n)
      expect(report.status).toBe('fail')
      expect(report.entities.find((x) => x.entity === entity)?.status).toBe('ok')
    })
  }
})
