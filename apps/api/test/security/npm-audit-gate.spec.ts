import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/** BE-33 AC6: scripts/npm-audit-gate.mjs fails on unlisted high/critical advisories and on bad or expired allow-list entries. */
const REPO = fileURLToPath(new URL('../../../../', import.meta.url))
const GATE = join(REPO, 'scripts/npm-audit-gate.mjs')
const TODAY = '2026-10-20'

function advisory(name: string, severity: string, ghsa: string) {
  return { source: 1, name, dependency: name, title: `${name} problem`, url: `https://github.com/advisories/${ghsa}`, severity, range: '*' }
}
function report(vulns: Record<string, { severity: string; via: unknown[] }>) {
  const counts: Record<string, number> = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }
  for (const v of Object.values(vulns)) counts[v.severity] = (counts[v.severity] ?? 0) + 1
  return { auditReportVersion: 2, vulnerabilities: vulns, metadata: { vulnerabilities: { ...counts, total: Object.keys(vulns).length } } }
}
const HIGH = report({ leftpad: { severity: 'high', via: [advisory('leftpad', 'high', 'GHSA-aaaa-bbbb-cccc')] } })
const CRITICAL = report({ evil: { severity: 'critical', via: [advisory('evil', 'critical', 'GHSA-dddd-eeee-ffff')] } })
const MODERATE = report({ meh: { severity: 'moderate', via: [advisory('meh', 'moderate', 'GHSA-1111-2222-3333')] } })
// A package that is high only because of a transitive dependency lists the other package as a string in `via`.
const TRANSITIVE = report({
  leftpad: { severity: 'high', via: [advisory('leftpad', 'high', 'GHSA-aaaa-bbbb-cccc')] },
  parent: { severity: 'high', via: ['leftpad'] },
})
const entry = (over: Record<string, unknown> = {}) => ({
  id: 'GHSA-aaaa-bbbb-cccc', package: 'leftpad', reason: 'not reachable in this app', expires: '2026-11-19', ...over,
})

let dir: string
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'pp-audit-gate-')) })
afterAll(() => rmSync(dir, { recursive: true, force: true }))

let n = 0
function gate(rep: unknown, list: unknown, today = TODAY) {
  const id = ++n
  const f = join(dir, `audit-${id}.json`)
  const a = join(dir, `allow-${id}.json`)
  writeFileSync(f, JSON.stringify(rep))
  writeFileSync(a, JSON.stringify(list))
  const r = spawnSync(process.execPath, [GATE, '--file', f, '--allowlist', a, '--today', today], { encoding: 'utf8' })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('npm-audit-gate', () => {
  it('fails (exit 1) on a high advisory that is not allow-listed', () => {
    const r = gate(HIGH, { entries: [] })
    expect(r.code).toBe(1)
    expect(r.out).toContain('BLOCKED  GHSA-aaaa-bbbb-cccc leftpad (high)')
  })

  it('fails on a critical advisory', () => {
    expect(gate(CRITICAL, { entries: [entry()] }).code).toBe(1)
  })

  it('passes when the same high advisory is allow-listed (id matched case-insensitively)', () => {
    const r = gate(HIGH, { entries: [entry({ id: 'ghsa-AAAA-bbbb-cccc' })] })
    expect(r.code).toBe(0)
    expect(r.out).toContain('allowed  GHSA-aaaa-bbbb-cccc')
  })

  it('fails when the allow-list entry is expired, even though the advisory is listed', () => {
    const r = gate(HIGH, { entries: [entry({ expires: '2026-10-19' })] }, TODAY)
    expect(r.code).toBe(1)
    expect(r.out).toContain('expired on 2026-10-19')
  })

  it('fails on an expired entry that no advisory uses (stale exceptions cannot linger)', () => {
    expect(gate(MODERATE, { entries: [entry({ expires: '2026-01-01' })] }).code).toBe(1)
  })

  it('an entry that expires today is still valid', () => {
    expect(gate(HIGH, { entries: [entry({ expires: TODAY })] }).code).toBe(0)
  })

  it.each(['id', 'package', 'reason', 'expires'])('fails when an entry lacks %s', (key) => {
    const e: Record<string, unknown> = entry()
    delete e[key]
    const r = gate(HIGH, { entries: [e] })
    expect(r.code).toBe(1)
    expect(r.out).toContain(`missing ${key}`)
  })

  it('fails on an entry that expires more than 30 days ahead (31 fails, 30 passes) (G4 minor 5)', () => {
    const r = gate(HIGH, { entries: [entry({ expires: '2099-01-01' })] })
    expect(r.code).toBe(1)
    expect(r.out).toContain('more than 30 days ahead')
    expect(gate(HIGH, { entries: [entry({ expires: '2026-11-20' })] }).code).toBe(1)
    expect(gate(HIGH, { entries: [entry({ expires: '2026-11-19' })] }).code).toBe(0)
  })

  it('an entry covers the advisory only on the package it names (G4 minor 5)', () => {
    const r = gate(HIGH, { entries: [entry({ package: 'other-pkg' })] })
    expect(r.code).toBe(1)
    expect(r.out).toContain('BLOCKED  GHSA-aaaa-bbbb-cccc leftpad (high)')
    expect(r.out).toContain('names package "other-pkg"')
    expect(gate(HIGH, { entries: [entry({ package: 'LeftPad' })] }).code).toBe(0)
  })

  it('fails on a malformed expires date', () => {
    expect(gate(HIGH, { entries: [entry({ expires: '19/11/2026' })] }).code).toBe(1)
  })

  it('passes on moderate and low advisories only', () => {
    const r = gate(MODERATE, { entries: [] })
    expect(r.code).toBe(0)
    expect(r.out).toContain('npm-audit-gate: passed')
  })

  it('judges the advisory, not the rolled-up package severity, and does not double count transitive links', () => {
    const r = gate(TRANSITIVE, { entries: [entry()] })
    expect(r.code).toBe(0)
    expect(gate(TRANSITIVE, { entries: [] }).out.match(/BLOCKED/g)).toHaveLength(1)
  })

  it('exits 2 on input that is not an npm audit report or is an npm error', () => {
    expect(gate({ nope: true }, { entries: [] }).code).toBe(2)
    expect(gate({ error: { code: 'ENOAUDIT', summary: 'registry down' } }, { entries: [] }).code).toBe(2)
  })
})

describe('repository allow-list file', () => {
  const list = JSON.parse(readFileSync(join(REPO, '.github/security/npm-audit-allowlist.json'), 'utf8')) as {
    entries: { id: string; package: string; reason: string; expires: string }[]
  }

  it('is well formed (id, package, reason, ISO expires)', () => {
    expect(Array.isArray(list.entries)).toBe(true)
    for (const e of list.entries) {
      expect(e.id).toMatch(/^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/)
      expect(e.package.length).toBeGreaterThan(0)
      expect(e.reason.length).toBeGreaterThan(20)
      expect(e.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
