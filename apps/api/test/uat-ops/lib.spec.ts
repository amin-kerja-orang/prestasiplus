import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  exitCodeOf,
  formatLine,
  line,
  openDb,
  parseUatArgs,
  reportPath,
  scrubSecrets,
  timestampForFile,
  UsageError,
  writeReport,
} from '../../scripts/uat-ops/lib'

/** S4-T03 shared helper of the UAT scripts: pure parts only (no database). */
const spec = { name: 'demo', allowApply: false, flags: { subject: { type: 'string' as const }, verbose: { type: 'boolean' as const } } }
const roots: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'uat-ops-'))
  roots.push(d)
  return d
}
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true })
})

describe('parseUatArgs', () => {
  it('defaults to a dry run and accepts --dry-run', () => {
    expect(parseUatArgs([], spec)).toEqual({ dryRun: true, apply: false, values: {} })
    expect(parseUatArgs(['--dry-run'], spec).dryRun).toBe(true)
  })

  it('reads named flags as --flag value and --flag=value, and boolean flags', () => {
    expect(parseUatArgs(['--subject', 'MAT', '--verbose'], spec).values).toEqual({ subject: 'MAT', verbose: true })
    expect(parseUatArgs(['--subject=SEJ'], spec).values).toEqual({ subject: 'SEJ' })
  })

  it('--apply works only when the script allows it, and not together with --dry-run', () => {
    expect(() => parseUatArgs(['--apply'], spec)).toThrow('demo is read-only: there is no --apply')
    const writer = { ...spec, allowApply: true }
    expect(parseUatArgs(['--apply'], writer)).toMatchObject({ dryRun: false, apply: true })
    expect(() => parseUatArgs(['--apply', '--dry-run'], writer)).toThrow(UsageError)
  })

  it('refuses unknown flags, positional arguments, missing values and values on boolean flags', () => {
    expect(() => parseUatArgs(['--nope'], spec)).toThrow('unknown argument --nope')
    expect(() => parseUatArgs(['--constructor'], spec)).toThrow('unknown argument --constructor')
    expect(() => parseUatArgs(['MAT'], spec)).toThrow('unexpected argument MAT')
    expect(() => parseUatArgs(['--subject'], spec)).toThrow('--subject needs a value')
    expect(() => parseUatArgs(['--subject', '--verbose'], spec)).toThrow('--subject needs a value')
    expect(() => parseUatArgs(['--verbose=1'], spec)).toThrow('--verbose takes no value')
    expect(() => parseUatArgs(['--dry-run=1'], spec)).toThrow('--dry-run takes no value')
  })
})

describe('lines and exit code', () => {
  it('formats STATUS text and fails the exit code only on FAIL', () => {
    expect(formatLine(line('PASS', 'ok'))).toBe('PASS ok')
    expect(exitCodeOf([line('PASS', 'a'), line('INFO', 'b'), line('SKIP', 'c')])).toBe(0)
    expect(exitCodeOf([line('PASS', 'a'), line('FAIL', 'b')])).toBe(1)
  })
})

describe('reports', () => {
  const now = new Date('2026-11-05T10:20:30.123Z')

  it('names the file <name>-<ISO timestamp> under .evidence/uat-ops with no colon', () => {
    expect(timestampForFile(now)).toBe('2026-11-05T10-20-30-123Z')
    expect(reportPath('demo', 'txt', { root: '/r', now })).toBe(join('/r', '.evidence', 'uat-ops', 'demo-2026-11-05T10-20-30-123Z.txt'))
    expect(() => reportPath('../evil', 'txt')).toThrow(UsageError)
  })

  it('writes lines as .txt and an object as .json, creating the folders', () => {
    const root = tmp()
    const txt = writeReport('demo', [line('INFO', 'one'), line('PASS', 'two')], { root, now })
    expect(txt.endsWith('.txt')).toBe(true)
    expect(readFileSync(txt, 'utf8')).toBe('INFO one\nPASS two\n')
    const json = writeReport('demo', { total: 3 }, { root, now })
    expect(json.endsWith('.json')).toBe(true)
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual({ total: 3 })
  })

  it('never writes the connection string', () => {
    const env = { DATABASE_URL: 'postgres://user:s3cret@db.example:5432/app' } as NodeJS.ProcessEnv
    expect(scrubSecrets(`connected to ${env.DATABASE_URL!}`, env)).toBe('connected to [redacted]')
    expect(scrubSecrets('x postgresql://a:b@host/db y', {})).toBe('x [redacted] y')
    const root = tmp()
    const prev = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://user:s3cret@db.example:5432/app'
    try {
      const path = writeReport('demo', [line('INFO', 'url postgres://user:s3cret@db.example:5432/app')], { root, now })
      expect(readFileSync(path, 'utf8')).not.toContain('s3cret')
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prev
    }
  })
})

describe('openDb', () => {
  it('needs DATABASE_URL and does not echo anything else', async () => {
    await expect(openDb({})).rejects.toThrow('DATABASE_URL is not set.')
  })
})
