/**
 * No personal data in the output of `migrate:activity` (card AC8, BE-NFR-11): the CLI lines (stdout and
 * stderr), the report file, the process streams, and what the run leaves in the ledger tables
 * (`etl_rejects`, `etl_recon`, `etl_runs`) hold counts, codes and surrogate ids only. Every personal or free-text
 * value of the synthetic fixture is looked up in all of it, and the BE-35 leak patterns (e-mail, phone, IC) are
 * scanned over it. The scan covers whatever steps Parts A and B register, because it runs the whole pipeline.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { patternKinds } from '../../../src/migration/anonymise/leak-scan'
import { runCli } from '../../../src/migration/cli'
import '../../../src/migration/load/activity/command'
import { capture } from '../staging/helpers'
import { bootActivity, PII_COLUMNS, type ActivityHarness } from './helpers'

let h: ActivityHarness
let secrets: string[] = []
const REPORT_DIR = join('.migration-out', `activity-test-${randomBytes(4).toString('hex')}`)

beforeAll(async () => {
  h = await bootActivity()
  // Every non-trivial value of the personal / free-text columns of the fixture.
  const found = new Set<string>()
  for (const [table, columns] of Object.entries(PII_COLUMNS)) {
    for (const column of columns) {
      const exists = await h.q<{ n: string }>(
        `select count(*)::text n from information_schema.columns where table_schema = 'staging_cloud' and table_name = $1 and column_name = $2`,
        [table, column],
      )
      if (exists[0]?.n !== '1') continue
      const rows = await h.q<{ v: string | null }>(`select distinct "${column}"::text as v from staging_cloud."${table}"`)
      for (const r of rows) if (r.v && r.v.trim().length >= 4) found.add(r.v.trim().toLowerCase())
    }
  }
  secrets = [...found]
}, 300_000)
afterAll(async () => {
  rmSync(REPORT_DIR, { recursive: true, force: true })
  await h?.close()
})

describe('log hygiene (AC8)', () => {
  it('finds personal values in the fixture to look for', () => {
    expect(secrets.length).toBeGreaterThan(20)
    expect(secrets.some((s) => s.includes('@'))).toBe(true)
  })

  it('prints and stores no personal value, free text or leak pattern in a dry-run, an apply or a refusal', async () => {
    const streams: string[] = []
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      streams.push(String(chunk))
      return true
    }) as typeof process.stdout.write)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
      streams.push(String(chunk))
      return true
    }) as typeof process.stderr.write)
    const log = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void streams.push(a.map(String).join(' ')))
    const error = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void streams.push(a.map(String).join(' ')))
    const out = capture()
    const reportFile = join(REPORT_DIR, 'report.txt')
    const base = ['migrate:activity', '--as-of=2026-06-01', '--core-as-of=2026-06-01', '--batch-size=2']
    const deps = { pool: h.env.pool, env: h.runEnv, out: out.out, err: out.err }
    try {
      expect(await runCli([...base, '--apply'], deps)).toBe(3) // refused: no dry-run yet (the error text is scanned too)
      expect(await runCli([...base, '--dry-run', `--report-file=${reportFile}`], deps)).toBe(0)
      expect(await runCli([...base, '--apply'], deps)).toBe(0)
    } finally {
      stdout.mockRestore()
      stderr.mockRestore()
      log.mockRestore()
      error.mockRestore()
    }

    expect(existsSync(reportFile)).toBe(true)
    const report = readFileSync(reportFile, 'utf8')
    expect(report).toContain('migrate:activity dry-run')
    expect(report).toMatch(/not migrated mood_checkins/)

    const ledger = JSON.stringify({
      rejects: await h.q('select entity, legacy_id, reason, column_name, offending from etl_rejects'),
      recon: await h.q('select * from etl_recon'),
      runs: await h.q('select mode, sources, entity_set, git_sha, input_hash, status, counters from etl_runs'),
      checkpoints: await h.q('select * from etl_checkpoints'),
    })
    const everything = [out.text(), streams.join('\n'), report, ledger].join('\n')
    const low = everything.toLowerCase()
    for (const secret of secrets) expect(low.includes(secret), 'a personal or free-text value of the fixture is in the output').toBe(false)
    // Hex digests (input hash, keyed reject hashes) can hold a long run of decimal digits by chance: not a leak.
    expect(patternKinds(everything.replace(/[0-9a-f]{16,}/gi, '#'), { allowedEmailDomains: [] })).toEqual([])
  }, 120_000)
})
