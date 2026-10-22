/**
 * Command line of the BE-30 orchestrator (no database): usage errors exit 2 before any work, the apply guard still
 * applies, and the rollback / link-questions commands hand the right options to Parts B and C (their modules are
 * mocked here; their own specs cover the behaviour).
 */
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type pg from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { findMigrateCommand } from '../../../src/migration/kit'
import { RollbackRefusedError } from '../../../src/migration/verify/rollback'
import { AS_OF_UNVERIFIED, malaysiaDate, parseSince, writeDeltaReport, type DeltaReport } from '../../../src/migration/orchestrate'
import { capture } from '../staging/helpers'
import { tempOutDir } from './helpers-verify'

const mocks = vi.hoisted(() => ({
  runVerify: vi.fn(),
  writeVerifyReport: vi.fn(),
  rollbackLegacy: vi.fn(),
  linkQuestions: vi.fn(),
}))
vi.mock('../../../src/migration/verify', () => ({
  runVerify: mocks.runVerify,
  writeVerifyReport: mocks.writeVerifyReport,
  rollbackLegacy: mocks.rollbackLegacy,
}))
vi.mock('../../../src/migration/backfill/link-questions', async (importOriginal) => ({
  LinkQuestionsBusyError: (await importOriginal<typeof import('../../../src/migration/backfill/link-questions')>()).LinkQuestionsBusyError,
  linkQuestions: mocks.linkQuestions,
}))

/** A pool that must not be used for work: `current_database()` is all the apply guard asks. */
const fakePool = {
  query: vi.fn(async () => ({ rows: [{ db: 'pp_rehearsal' }], rowCount: 1 })),
} as unknown as pg.Pool
const env = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }

const run = async (argv: string[], e: Record<string, string> = env) => {
  const log = capture()
  const code = await runCli(argv, { pool: fakePool, env: e, out: log.out, err: log.err })
  return { code, text: log.text() }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registration', () => {
  it('registers the six commands', () => {
    for (const n of ['all', 'delta', 'verify', 'rollback', 'link-questions', 'export-question-reports']) {
      expect(findMigrateCommand(`migrate:${n}`), n).toBeDefined()
    }
  })
})

describe('default --as-of (migrate:all)', () => {
  it('is the Malaysia calendar date, not the UTC date', () => {
    // 17:30 UTC on 29 October is 01:30 on 30 October in Asia/Kuala_Lumpur (UTC+8).
    expect(malaysiaDate(new Date('2026-10-29T17:30:00Z'))).toBe('2026-10-30')
    expect(malaysiaDate(new Date('2026-10-29T15:59:59Z'))).toBe('2026-10-29')
    expect(malaysiaDate(new Date('2026-10-29T16:00:00Z'))).toBe('2026-10-30')
    expect(malaysiaDate(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01')
  })
})

describe('usage errors exit 2', () => {
  it('rejects --dry-run together with --apply', async () => {
    for (const c of ['all', 'delta', 'rollback', 'link-questions']) {
      const r = await run([`migrate:${c}`, '--dry-run', '--apply'])
      expect(r.code, c).toBe(2)
      expect(r.text).toMatch(/either --dry-run or --apply/)
    }
  })

  it('migrate:delta needs a valid --since', async () => {
    const missing = await run(['migrate:delta'])
    expect(missing.code).toBe(2)
    expect(missing.text).toMatch(/--since is required/)
    for (const bad of ['yesterday', '2026-06-02', '2026-06-02T10:00:00', '2026-13-02T00:00:00Z', '2026-02-30T00:00:00Z', '2026-06-02T24:00:00Z', '2026-06-02T00:60:00Z', '2026-06-02T00:00:00+24:00', '']) {
      const r = await run(['migrate:delta', `--since=${bad}`])
      expect(r.code, bad).toBe(2)
      expect(r.text).toMatch(/--since must be an ISO-8601 timestamp/)
    }
    expect((await run(['migrate:delta', '--since'])).code).toBe(2)
    expect(fakePool.query).not.toHaveBeenCalled()
  })

  it('migrate:delta needs --as-of (the first load\'s value), also on a dry-run', async () => {
    const r = await run(['migrate:delta', '--since=2026-06-02T00:00:00Z'])
    expect(r.code).toBe(2)
    expect(r.text).toMatch(/--as-of is required: reuse the --as-of of the first load/)
    expect(fakePool.query).not.toHaveBeenCalled()
  })

  it('migrate:rollback needs --confirm, also on a dry-run', async () => {
    const r = await run(['migrate:rollback'])
    expect(r.code).toBe(2)
    expect(r.text).toMatch(/--confirm/)
    expect(mocks.rollbackLegacy).not.toHaveBeenCalled()
  })

  it('rejects bad common flags before any work', async () => {
    expect((await run(['migrate:all', '--as-of=2026-6-1'])).code).toBe(2)
    expect((await run(['migrate:all', '--batch-size=0'])).code).toBe(2)
    expect((await run(['migrate:all', '--content-owner=abc'])).code).toBe(2)
    expect((await run(['migrate:all', '--out-dir=/tmp/not-a-migration-folder'])).code).toBe(2)
    expect((await run(['migrate:link-questions', '--batch-size=x'])).code).toBe(2)
    expect(fakePool.query).not.toHaveBeenCalled()
  })

  it('keeps the kit apply guard: --apply needs PP_ALLOW_MIGRATE_APPLY', async () => {
    for (const c of ['migrate:all --since=2026-06-02T00:00:00Z', 'migrate:rollback --confirm=pp_rehearsal', 'migrate:link-questions']) {
      const [name, ...flags] = c.split(' ') as [string, ...string[]]
      const r = await run([name, '--apply', ...flags], { NODE_ENV: 'test' })
      expect(r.code, c).toBe(2)
      expect(r.text).toMatch(/PP_ALLOW_MIGRATE_APPLY/)
    }
  })
})

describe('parseSince', () => {
  it('accepts an instant with a zone and normalises it to UTC', () => {
    expect(parseSince('2026-06-02T08:00:00+08:00')).toBe('2026-06-02T00:00:00.000Z')
    expect(parseSince('2026-06-02T00:00Z')).toBe('2026-06-02T00:00:00.000Z')
    expect(parseSince('2026-06-02T00:00:00.5Z')).toBe('2026-06-02T00:00:00.500Z')
    expect(parseSince('2028-02-29T23:59:59Z')).toBe('2028-02-29T23:59:59.000Z')
  })

  it('rejects impossible dates and times instead of rolling them over', () => {
    for (const bad of ['2026-02-30T00:00:00Z', '2027-02-29T00:00:00Z', '2026-06-02T24:00:00Z', '2026-06-02T00:60:00Z', '2026-06-02T00:00:60Z', '2026-04-31T00:00:00Z']) {
      expect(() => parseSince(bad), bad).toThrow(/--since must be an ISO-8601/)
    }
  })
})

describe('migrate:rollback', () => {
  const report = (dryRun: boolean) => ({
    database: 'pp_rehearsal',
    dryRun,
    tables: [{ table: 'practice_answers', deleted: 7 }, { table: 'users', deleted: 3 }],
    idMapDeleted: 10,
    status: 'succeeded' as const,
  })

  it('is a dry-run by default and prints per-table counts', async () => {
    mocks.rollbackLegacy.mockResolvedValue(report(true))
    const r = await run(['migrate:rollback', '--confirm=pp_rehearsal'])
    expect(r.code).toBe(0)
    expect(mocks.rollbackLegacy).toHaveBeenCalledWith(expect.objectContaining({ source: 'cloud', confirmDb: 'pp_rehearsal', dryRun: true }))
    expect(r.text).toMatch(/practice_answers \| 7/)
    expect(r.text).toMatch(/etl_id_map \| 10/)
  })

  it('prints the released adopted rows and the warnings', async () => {
    mocks.rollbackLegacy.mockResolvedValue({
      ...report(false),
      released: [{ table: 'schools', rows: 2 }],
      warnings: ['unfinished runs keep their checkpoints'],
    })
    const r = await run(['migrate:rollback', '--apply', '--confirm=pp_rehearsal'])
    expect(r.code).toBe(0)
    expect(r.text).toMatch(/released schools: 2/)
    expect(r.text).toMatch(/warning: unfinished runs keep their checkpoints/)
  })

  it('maps a refusal (RollbackRefusedError) to exit 2', async () => {
    mocks.rollbackLegacy.mockRejectedValue(new RollbackRefusedError('Refusing rollback: table users is used by rows that are not migrated.'))
    const r = await run(['migrate:rollback', '--confirm=pp_rehearsal'])
    expect(r.code).toBe(2)
    expect(r.text).toMatch(/Refusing rollback/)
  })

  it('--apply makes it real; a failed report exits 1', async () => {
    mocks.rollbackLegacy.mockResolvedValue({ ...report(false), status: 'failed' })
    const r = await run(['migrate:rollback', '--apply', '--confirm=pp_rehearsal'])
    expect(mocks.rollbackLegacy).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }))
    expect(r.code).toBe(1)
  })
})

describe('migrate:link-questions', () => {
  it('passes mode and batch size, prints counts and capped surrogate ids', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => String(i + 1))
    mocks.linkQuestions.mockResolvedValue({
      mode: 'dry-run', examined: 300, linked: 40, ambiguous: 250, unmatched: 10, alreadyLinked: 5, ambiguousIds: ids, unmatchedIds: ['9'],
    })
    const r = await run(['migrate:link-questions', '--batch-size=50'])
    expect(r.code).toBe(0)
    expect(mocks.linkQuestions).toHaveBeenCalledWith(expect.objectContaining({ source: 'cloud', mode: 'dry-run', batchSize: 50 }))
    expect(r.text).toMatch(/300 \| 40 \| 250 \| 10 \| 5/)
    expect(r.text).toMatch(/ids ambiguous: 1,2,/)
    expect(r.text).toMatch(/,200,\.\.\./)
    expect(r.text).toMatch(/ids unmatched: 9/)
  })

  it('--apply is passed through', async () => {
    mocks.linkQuestions.mockResolvedValue({
      mode: 'apply', examined: 0, linked: 0, ambiguous: 0, unmatched: 0, alreadyLinked: 0, ambiguousIds: [], unmatchedIds: [],
    })
    expect((await run(['migrate:link-questions', '--apply'])).code).toBe(0)
    expect(mocks.linkQuestions).toHaveBeenCalledWith(expect.objectContaining({ mode: 'apply' }))
  })

  it('maps a busy refusal (lock held or an ETL apply running) to exit 4', async () => {
    const { LinkQuestionsBusyError } = await import('../../../src/migration/backfill/link-questions')
    mocks.linkQuestions.mockRejectedValue(new LinkQuestionsBusyError('Refusing --apply: another link-questions run holds the lock.'))
    expect((await run(['migrate:link-questions', '--apply'])).code).toBe(4)
  })
})

describe('migrate:verify', () => {
  const report = (status: 'pass' | 'fail') => ({
    generatedAt: '2026-06-01T00:00:00.000Z', source: 'cloud', runIds: ['1'], status, entities: [], checks: [],
  })

  it('exits 0 on pass and 1 on fail, and writes the report', async () => {
    mocks.writeVerifyReport.mockReturnValue({ json: '/x/.migration-out/recon.json', md: '/x/.migration-out/recon.md' })
    mocks.runVerify.mockResolvedValue(report('pass'))
    const ok = await run(['migrate:verify'])
    expect(ok.code).toBe(0)
    expect(ok.text).toMatch(/verify pass/)
    expect(ok.text).toMatch(/recon\.json/)
    mocks.runVerify.mockResolvedValue(report('fail'))
    expect((await run(['migrate:verify'])).code).toBe(1)
  })
})

describe('writeDeltaReport', () => {
  const delta: DeltaReport = {
    source: 'cloud', mode: 'apply', generatedAt: '2026-06-03T01:02:03.456Z', since: '2026-06-02T00:00:00.000Z',
    staged: [{ table: 'users', changedRows: 1 }], entities: [], warnings: [AS_OF_UNVERIFIED],
  }

  it('creates a new file each time (random suffix) and never replaces an existing one', () => {
    const out = tempOutDir()
    try {
      const a = writeDeltaReport(delta, out.path)
      const b = writeDeltaReport(delta, out.path)
      expect(a).not.toBe(b)
      expect(JSON.parse(readFileSync(a, 'utf8')).warnings).toEqual([AS_OF_UNVERIFIED])

      const fixed = writeDeltaReport(delta, out.path, 'fixed1')
      writeFileSync(fixed, 'keep me')
      expect(() => writeDeltaReport(delta, out.path, 'fixed1')).toThrow(/EEXIST/)
      expect(readFileSync(fixed, 'utf8')).toBe('keep me')
      // A symbolic link at the target is not written through either.
      const target = join(out.path, 'elsewhere.txt')
      writeFileSync(target, 'untouched')
      symlinkSync(target, join(out.path, 'delta-20260603T010203Z-link01.json'))
      expect(() => writeDeltaReport(delta, out.path, 'link01')).toThrow(/EEXIST/)
      expect(readFileSync(target, 'utf8')).toBe('untouched')
    } finally {
      out.cleanup()
    }
  })
})
