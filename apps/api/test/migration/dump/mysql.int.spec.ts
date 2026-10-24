/**
 * OPTIONAL real-server check (AM-10). Skipped unless PP_TEST_MYSQL_DEFAULTS_FILE names the option file of a READ-ONLY account
 * on a synthetic MySQL/MariaDB database (PP_TEST_MYSQL_CLIENT optionally names the client binary). It runs dump:cloud
 * against it and checks what the fake-client specs cannot: that the generated SQL runs and its output is what the loader takes.
 *
 * Expected data (the synthetic database `pp_cloud_synth`): users.secret_extra_note exists in the source only,
 * users.remember_token is a redact column holding values, exam_attempts.section_scores is a text column with one invalid
 * JSON value (id 230).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { DUMP_EXIT, runDumpCli } from '../../../src/migration/dump/cli'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, scratch } from './helpers'

const defaultsFile = process.env.PP_TEST_MYSQL_DEFAULTS_FILE
const work = scratch()
afterAll(() => work.cleanup())

const rows = (path: string): Record<string, unknown>[] => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)

describe.skipIf(!defaultsFile)('dump:cloud against a real MySQL/MariaDB server', () => {
  const out = work.out('int-dump')
  const env = {
    CLOUD_MYSQL_DEFAULTS_FILE: defaultsFile,
    ...(process.env.PP_TEST_MYSQL_CLIENT ? { CLOUD_MYSQL_CLIENT: process.env.PP_TEST_MYSQL_CLIENT } : { PATH: process.env.PATH }),
  }
  const log = capture()
  let code: number

  it('exports users and exam_attempts', async () => {
    code = await runDumpCli(['dump:cloud', '--out', out, '--tables', 'users,exam_attempts'], { env, out: log.out, err: log.err })
    expect(code, log.text()).toBe(DUMP_EXIT.ok)
    expect(readdirSync(out).sort()).toEqual(['exam_attempts.ndjson', 'manifest.json', 'schema-report.json', 'schema-report.md', 'users.ndjson'])
    expect(existsSync(`${out}.partial`)).toBe(false)
  }, 120_000)

  it('counts in the manifest match the lines and the snapshot counts, and DirReader accepts the directory', () => {
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')) as { tables: Record<string, { rows: number }>; raw: boolean }
    expect(manifest.raw).toBe(true)
    for (const table of ['users', 'exam_attempts']) {
      expect(manifest.tables[table]?.rows).toBeGreaterThan(0)
      expect(rows(join(out, `${table}.ndjson`)).length).toBe(manifest.tables[table]?.rows)
    }
    const report = JSON.parse(readFileSync(join(out, 'schema-report.json'), 'utf8')) as { tables: { table: string; row_count: number }[] }
    for (const t of report.tables.filter((x) => x.table === 'users' || x.table === 'exam_attempts')) expect(t.row_count).toBe(manifest.tables[t.table]?.rows)
    expect(new DirReader(out).syntheticMarker()).toBe(false)
  })

  it('the redact column is NULL in every row and the source-only column is absent', () => {
    const users = rows(join(out, 'users.ndjson'))
    expect(users.length).toBeGreaterThan(0)
    for (const u of users) {
      expect('remember_token' in u).toBe(true)
      expect(u.remember_token).toBeNull()
      expect('secret_extra_note' in u).toBe(false)
    }
  })

  it('invalid JSON text becomes NULL (and is counted); valid JSON stays JSON', () => {
    const attempts = rows(join(out, 'exam_attempts.ndjson'))
    const bad = attempts.find((a) => a.id === 230)
    expect(bad).toBeDefined()
    expect(bad?.section_scores).toBeNull()
    const report = JSON.parse(readFileSync(join(out, 'schema-report.json'), 'utf8')) as { tables: { table: string; invalid_json: Record<string, number | null> }[] }
    expect(report.tables.find((t) => t.table === 'exam_attempts')?.invalid_json.section_scores).toBe(1)
    for (const a of attempts) expect(typeof a.section_scores === 'string').toBe(false)
  })
})
