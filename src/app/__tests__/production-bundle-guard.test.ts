import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = fileURLToPath(new URL('../../../scripts/check-demo-bundle.mjs', import.meta.url))

const dirs: string[] = []

function dist(assets: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pp-bundle-guard-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html>')
  for (const [name, text] of Object.entries(assets)) writeFileSync(join(dir, 'assets', name), text)
  return dir
}

const guard = (dir: string, ...flags: string[]) => spawnSync(process.execPath, [SCRIPT, dir, ...flags], { encoding: 'utf8' })

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('check-demo-bundle --production (B3 N1)', () => {
  it('passes a clean http build; mock-lib is the Mock Exam screens, not the mock', () => {
    const res = guard(dist({ 'index-a.js': 'console.log(1)', 'mock-lib-a.js': 'var e=1', 'MockExamPage-a.js': 'var e=1' }), '--production')
    expect(res.stderr).toBe('')
    expect(res.status).toBe(0)
  })

  it.each([
    ['the seed password', { 'x-a.js': 'const p=`Demo1234`' }],
    ['a demo account', { 'x-a.js': 'const e=`pelajar@demo.test`' }],
    ['the fictitious default password', { 'x-a.js': 'const p=`ContohAdm01`' }],
    ['the mock boot hook', { 'index-a.js': 'window.__MOCK_INIT__' }],
    ['a mock chunk', { 'mock-a1B2.js': 'var e=1' }],
    ['a source map', { 'index-a.js.map': '{}' }],
    ['a test-hook marker', { 'x-a.js': 'pp-test-hooks-sentinel-5c1f0e7a' }],
  ])('fails on %s', (_name, assets) => {
    const res = guard(dist(assets), '--production')
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('FAIL')
  })

  it('a demo build keeps its mock: without the flag the mock is not refused', () => {
    expect(guard(dist({ 'mock-a1B2.js': 'const p=`Demo1234`' })).status).toBe(0)
  })
})
