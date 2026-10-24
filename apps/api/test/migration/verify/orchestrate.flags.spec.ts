/**
 * Every `migrate:*` command of the orchestrator refuses a flag it does not read (exit 2, `unknown flag --x.`) before any
 * database work, and still accepts every flag the cut-over documents pass. No database: the pool is a stub that must stay unused.
 */
import type pg from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseArgs, runCli } from '../../../src/migration/cli'
import { KNOWN_FLAGS } from '../../../src/migration/orchestrate'
import { capture } from '../staging/helpers'
import { tempOutDir } from './helpers-verify'

const mocks = vi.hoisted(() => ({
  runVerify: vi.fn(),
  writeVerifyReport: vi.fn(),
  rollbackLegacy: vi.fn(),
  linkQuestions: vi.fn(),
  exportReports: vi.fn(),
  assertMinimiseAllowed: vi.fn(),
  minimiseArchive: vi.fn(),
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
vi.mock('../../../src/migration/export/question-reports', () => ({ exportOpenQuestionReports: mocks.exportReports }))
vi.mock('../../../src/migration/export/archive-minimise', () => ({
  assertMinimiseAllowed: mocks.assertMinimiseAllowed,
  minimiseArchive: mocks.minimiseArchive,
}))

/** `current_database()` is all the kit's apply guard asks; `connect` is only used by the source lock and by real work. */
const fakePool = { query: vi.fn(async () => ({ rows: [{ db: 'pp_rehearsal' }], rowCount: 1 })), connect: vi.fn() } as unknown as pg.Pool
const env = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }

const run = async (argv: string[]) => {
  const log = capture()
  const code = await runCli(argv, { pool: fakePool, env, out: log.out, err: log.err })
  return { code, text: log.text() }
}

/** Nothing ran: no work mock, no dedicated connection and (unless `--apply` made the kit guard ask for the database name) no query. */
const untouched = (applyGuardOnly = false) => {
  if (applyGuardOnly) for (const [sql] of (fakePool.query as unknown as { mock: { calls: string[][] } }).mock.calls) expect(sql).toMatch(/current_database/)
  else expect(fakePool.query).not.toHaveBeenCalled()
  expect(fakePool.connect).not.toHaveBeenCalled()
  for (const m of Object.values(mocks)) expect(m).not.toHaveBeenCalled()
}

/** A valid value for each known flag, so the "accepted" case passes the value checks as well. */
const VALUE: Record<string, string> = {
  'as-of': '2026-10-29',
  'batch-size': '500',
  'content-owner': '12',
  'files-dir': '/srv/cloud-files',
  'out-dir': '/tmp/not-checked-here',
  since: '2026-10-28T00:00:00Z',
  confirm: 'pp_rehearsal',
  'export-summary': '/x/.migration-out/question-reports-open-1.summary.json',
}

/** The flags every command needs to get past its own required-flag checks (not part of the case under test). */
const REQUIRED: Record<string, string[]> = {
  'migrate:delta': ['--since=2026-10-28T00:00:00Z', '--as-of=2026-10-29'],
  'migrate:rollback': ['--confirm=pp_rehearsal'],
  'migrate:archive-minimise': ['--confirm=pp_rehearsal'],
}

const COMMANDS = Object.keys(KNOWN_FLAGS)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fakePool.connect).mockRejectedValue(new Error('no database in this spec'))
})

describe('migrate:* commands refuse unknown flags', () => {
  it('knows the seven orchestrator commands and the flags each one reads', () => {
    expect(COMMANDS.sort()).toEqual([
      'migrate:all', 'migrate:archive-minimise', 'migrate:delta', 'migrate:export-question-reports',
      'migrate:link-questions', 'migrate:rollback', 'migrate:verify',
    ])
    expect([...(KNOWN_FLAGS['migrate:all'] as ReadonlySet<string>)].sort()).toEqual(['as-of', 'batch-size', 'content-owner', 'files-dir', 'out-dir'])
    expect([...(KNOWN_FLAGS['migrate:delta'] as ReadonlySet<string>)].sort()).toEqual(['as-of', 'batch-size', 'content-owner', 'files-dir', 'out-dir', 'since'])
    expect([...(KNOWN_FLAGS['migrate:verify'] as ReadonlySet<string>)]).toEqual(['out-dir'])
    expect([...(KNOWN_FLAGS['migrate:rollback'] as ReadonlySet<string>)]).toEqual(['confirm'])
    expect([...(KNOWN_FLAGS['migrate:link-questions'] as ReadonlySet<string>)]).toEqual(['batch-size'])
    expect([...(KNOWN_FLAGS['migrate:export-question-reports'] as ReadonlySet<string>)]).toEqual(['out-dir'])
    expect([...(KNOWN_FLAGS['migrate:archive-minimise'] as ReadonlySet<string>)].sort()).toEqual(['confirm', 'export-summary'])
  })

  it.each(COMMANDS)('%s: a misspelt flag is exit 2 and touches nothing (= form, space form, flag without value)', async (command) => {
    const required = REQUIRED[command] ?? []
    for (const bad of [['--asof=2026-10-29'], ['--asof', '2026-10-29'], ['--asof'], ['--apply', '--asof', '2026-10-29'], ['--dry-run', '--asof=2026-10-29']]) {
      const r = await run([command, ...required, ...bad])
      expect(r.code, `${command} ${bad.join(' ')}`).toBe(2)
      expect(r.text).toContain('unknown flag --asof.')
      untouched(bad.includes('--apply'))
      vi.clearAllMocks()
    }
  })

  it.each(COMMANDS)('%s: a flag of another command is unknown here', async (command) => {
    const known = KNOWN_FLAGS[command] as ReadonlySet<string>
    const foreign = Object.keys(VALUE).find((f) => !known.has(f)) as string
    const r = await run([command, ...(REQUIRED[command] ?? []), `--${foreign}=${VALUE[foreign]}`])
    expect(r.code).toBe(2)
    expect(r.text).toContain(`unknown flag --${foreign}.`)
    untouched()
  })

  it.each(COMMANDS)('%s: a stray positional (a one-dash flag, or a value after a flag that takes none) is exit 2', async (command) => {
    const required = REQUIRED[command] ?? []
    for (const bad of [['-asof', '2026-10-29'], ['--apply', '2026-10-29'], ['asof=2026-10-29']]) {
      const r = await run([command, ...required, ...bad])
      expect(r.code, `${command} ${bad.join(' ')}`).toBe(2)
      expect(r.text).toContain('unexpected argument')
      untouched(bad.includes('--apply'))
      vi.clearAllMocks()
    }
  })

  it('names the unknown flag, not a known one next to it', async () => {
    const r = await run(['migrate:all', '--as-of=2026-10-29', '--batch-sise=10'])
    expect(r.code).toBe(2)
    expect(r.text).toBe('unknown flag --batch-sise.')
    untouched()
  })
})

describe('migrate:* commands still accept every flag they read', () => {
  beforeEach(() => {
    mocks.writeVerifyReport.mockReturnValue({ json: '/x/recon.json', md: '/x/recon.md' })
    mocks.runVerify.mockResolvedValue({ generatedAt: '2026-10-29T00:00:00.000Z', source: 'cloud', runIds: [], status: 'pass', entities: [], checks: [] })
    mocks.rollbackLegacy.mockResolvedValue({ database: 'pp_rehearsal', dryRun: true, tables: [], idMapDeleted: 0, status: 'succeeded' })
    mocks.linkQuestions.mockResolvedValue({ mode: 'dry-run', examined: 0, linked: 0, ambiguous: 0, unmatched: 0, alreadyLinked: 0, ambiguousIds: [], unmatchedIds: [] })
    const t = { total: 0, exported: 0, byStatus: [] }
    mocks.exportReports.mockResolvedValue({ ...t, csv: '/x/r.csv', summary: '/x/r.summary.json', submissions: { ...t, csv: '/x/s.csv' } })
    mocks.assertMinimiseAllowed.mockResolvedValue(undefined)
    mocks.minimiseArchive.mockResolvedValue({ dryRun: true, database: 'pp_rehearsal', changes: [], total: 0 })
    // The source lock of archive-minimise: one dedicated client that gets the advisory lock.
    vi.mocked(fakePool.connect).mockResolvedValue({ query: vi.fn(async () => ({ rows: [{ ok: true }] })), release: vi.fn() } as never)
  })

  it.each(COMMANDS)('%s: each known flag on its own, and all of them together, passes the flag check', async (command) => {
    const out = tempOutDir()
    try {
      const value = (f: string) => (f === 'out-dir' ? out.path : (VALUE[f] as string))
      const known = [...(KNOWN_FLAGS[command] as ReadonlySet<string>)]
      const withValues = (flags: string[]) => flags.map((f) => `--${f}=${value(f)}`)
      for (const flags of [...known.map((f) => [f]), known]) {
        const given = new Set(flags)
        const needed = (REQUIRED[command] ?? []).filter((a) => !given.has(a.slice(2, a.indexOf('='))))
        const r = await run([command, ...needed, ...withValues(flags)])
        expect(r.text, `${command} ${flags.join(' ')}`).not.toMatch(/unknown flag|unexpected argument/)
      }
    } finally {
      out.cleanup()
    }
  })

  it.each(['migrate:verify', 'migrate:rollback', 'migrate:link-questions', 'migrate:archive-minimise'])('%s: exit 0 with its flags in the space form too', async (command) => {
    const out = tempOutDir()
    try {
      const argv: Record<string, string[]> = {
        'migrate:verify': ['--out-dir', out.path],
        'migrate:rollback': ['--confirm', 'pp_rehearsal'],
        'migrate:link-questions': ['--batch-size', '50'],
        'migrate:archive-minimise': ['--confirm', 'pp_rehearsal', '--export-summary', '/x/s.json'],
      }
      expect((await run([command, ...(argv[command] as string[])])).code).toBe(0)
    } finally {
      out.cleanup()
    }
  })
})

describe('documented invocations (runbook, cut-over plan, slot.sh, rehearsal scripts)', () => {
  const documented: string[][] = [
    ['migrate:all', '--dry-run', '--as-of=2026-10-29', '--content-owner=1'],
    ['migrate:all', '--apply', '--as-of=2026-10-29', '--content-owner=1', '--files-dir=/files', '--batch-size=500'],
    ['migrate:all', '--apply', '--out-dir', '/app/apps/api/.migration-out'],
    ['migrate:all', '--files-dir', '/files', '--out-dir', '/app/apps/api/.migration-out'],
    ['migrate:delta', '--since=2026-10-28T00:00:00Z', '--as-of=2026-10-29'],
    ['migrate:delta', '--apply', '--since=2026-10-28T00:00:00Z', '--as-of=2026-10-29', '--out-dir', '/app/apps/api/.migration-out'],
    ['migrate:verify'],
    ['migrate:verify', '--out-dir', '/app/apps/api/.migration-out'],
    ['migrate:rollback', '--dry-run', '--confirm=pp_rehearsal'],
    ['migrate:rollback', '--apply', '--confirm=pp_rehearsal'],
    ['migrate:link-questions'],
    ['migrate:link-questions', '--apply', '--batch-size=500'],
    ['migrate:export-question-reports'],
    ['migrate:export-question-reports', '--out-dir', '/x/.migration-out'],
    ['migrate:archive-minimise', '--dry-run', '--confirm=pp_rehearsal', '--export-summary=/x/s.json'],
    ['migrate:archive-minimise', '--apply', '--confirm', 'pp_rehearsal', '--export-summary', '/x/s.json'],
  ]

  it.each(documented.map((a) => [a.join(' '), a] as const))('%s: every flag is known to its command', (_label, argv) => {
    const { command, args } = parseArgs(argv)
    const known = KNOWN_FLAGS[command as string] as ReadonlySet<string>
    expect(known).toBeDefined()
    expect([...args.flags.keys()].filter((f) => !known.has(f))).toEqual([])
    expect(args.positional).toEqual([])
  })
})
