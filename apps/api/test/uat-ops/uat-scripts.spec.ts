import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * S4-T08: the `uat:*` npm scripts, the files of `scripts/uat-ops/` and the U-OP table of `docs/ops/r1-runbook.md` agree.
 * Pure file reads: no database, no network.
 */
const API = resolve(__dirname, '../..')
const REPO = resolve(API, '../..')
const SCRIPTS_DIR = join(API, 'scripts/uat-ops')
const pkg = JSON.parse(readFileSync(join(API, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const rootPkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const runbook = readFileSync(join(REPO, 'docs/ops/r1-runbook.md'), 'utf8')

const uatEntries = Object.entries(pkg.scripts).filter(([name]) => name.startsWith('uat:'))

/** Files of `scripts/uat-ops/` that have no `uat:*` entry, with the reason. */
const ALLOW_LIST: Record<string, string> = {
  'lib.ts': 'shared helper imported by the scripts, not a script',
  'group-integrity.sql': 'read-only SQL run with psql (U-OP-18), not tsx',
  'paper-group-integrity.sql': 'read-only SQL run with psql (DM-26, S3-T02), not tsx',
  'tracking-sibling-duplicates.sql': 'read-only SQL run with psql before migration 0162 (DM-24, S3-T05), not tsx',
  'tag-integrity.sql': 'read-only SQL run with psql, no U-OP number',
  // U-OP-06 (#715): the script lands with S4-T04; its `uat:trim-duplicate-stem` entry and runbook row follow in S4-T08 once the PO picks the 45:444 option.
  'trim-duplicate-stem.ts': 'U-OP-06 (S4-T04, #715): npm entry and runbook row wait for the PO decision on 45:444',
}

describe('uat:* npm scripts', () => {
  it('has uat:* entries', () => {
    expect(uatEntries.length).toBeGreaterThan(0)
  })

  it.each(uatEntries)('%s points to an existing file', (_name, cmd) => {
    const m = /^tsx (scripts\/uat-ops\/[\w.-]+\.ts)$/.exec(cmd)
    expect(m, `unexpected command shape: ${cmd}`).not.toBeNull()
    expect(existsSync(join(API, m![1] ?? ""))).toBe(true)
  })

  it('trim-duplicate-stem (U-OP-06, #715) has no npm entry yet', () => {
    expect(pkg.scripts['uat:trim-duplicate-stem']).toBeUndefined()
  })

  it('every uat-ops script file has an entry or is on the allow-list', () => {
    const wired = new Set(uatEntries.map(([, cmd]) => cmd.replace(/^tsx scripts\/uat-ops\//, '')))
    const missing = readdirSync(SCRIPTS_DIR).filter((f) => !wired.has(f) && !(f in ALLOW_LIST))
    expect(missing).toEqual([])
  })

  it('the allow-list names only files that exist', () => {
    for (const f of Object.keys(ALLOW_LIST)) expect(existsSync(join(SCRIPTS_DIR, f)), f).toBe(true)
  })
})

describe('runbook U-OP table', () => {
  const section = runbook.slice(runbook.indexOf('## 10. UAT data operations (U-OP)'))
  const rows = section.split('\n').filter((l) => /^\| (\d+|-) \| /.test(l))

  it('has the section and its rows', () => {
    expect(section.startsWith('## 10.')).toBe(true)
    expect(rows.length).toBeGreaterThanOrEqual(15)
  })

  it('marks U-OP-06 as not available and never names an npm script for it', () => {
    const row = rows.find((r) => r.includes('| U-OP-06 |'))
    expect(row).toBeDefined()
    expect(row).toContain('not available: #715 blocked pending a PO decision')
    expect(row).not.toMatch(/uat:trim-duplicate-stem/)
  })

  it('every uat: / npm command named in the table exists in package.json', () => {
    const named = new Set<string>()
    for (const r of rows) for (const m of r.matchAll(/`((?:be:)?uat:[\w-]+|dskp:load)[^`]*`/g)) named.add(m[1] ?? "")
    expect(named.size).toBeGreaterThan(5)
    for (const n of named) {
      const exists = n.startsWith('be:') ? n in rootPkg.scripts : n in pkg.scripts
      expect(exists, `${n} is named in the runbook but is not in package.json`).toBe(true)
    }
  })

  it('every uat:* script is named in the runbook table', () => {
    const tableText = rows.join('\n')
    const unnamed = uatEntries.map(([n]) => n).filter((n) => !tableText.includes(n))
    expect(unnamed).toEqual([])
  })

  it('carries no server address or credential', () => {
    expect(section).not.toMatch(/https?:\/\/(?!<url>)/)
    expect(section).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
  })
})
