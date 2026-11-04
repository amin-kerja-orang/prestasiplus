// Unit tests of the lint ratchet helpers (card S0-T04): `scripts/lib/lint-ratchet.mjs`.
import { describe, expect, it } from 'vitest'

import {
  compare, countsOf, entryCount, eslintFindings, makeBaseline, stylelintFindings, updateCounts,
} from '../lib/lint-ratchet.mjs'

const f = (file, rule, line = 1) => ({ file, line, rule, message: 'm' })
const base = { 'src/a.ts': { 'no-unused-vars': 2 }, 'src/b.ts': { 'no-console': 1 } }
const same = [f('src/a.ts', 'no-unused-vars', 3), f('src/a.ts', 'no-unused-vars', 9), f('src/b.ts', 'no-console')]

describe('lint ratchet compare', () => {
  it('passes when counts equal the baseline', () => {
    const r = compare(base, same)
    expect(r.ok).toBe(true)
    expect(r.shrinks).toEqual([])
  })

  it('fails on one new error in a known file+rule and lists it', () => {
    const r = compare(base, [...same, f('src/a.ts', 'no-unused-vars', 40)])
    expect(r.ok).toBe(false)
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0]).toMatchObject({ file: 'src/a.ts', rule: 'no-unused-vars', count: 3, base: 2 })
    expect(r.failures[0].items.map((i) => i.line)).toContain(40)
  })

  it('fails on a new rule in a known file', () => {
    const r = compare(base, [...same, f('src/a.ts', 'eqeqeq', 5)])
    expect(r.ok).toBe(false)
    expect(r.failures[0]).toMatchObject({ file: 'src/a.ts', rule: 'eqeqeq', base: 0 })
  })

  it('fails on a brand-new file', () => {
    expect(compare(base, [...same, f('src/new.ts', 'no-unused-vars')]).ok).toBe(false)
  })

  it('passes with a shrink hint entry when a count drops', () => {
    const r = compare(base, [f('src/a.ts', 'no-unused-vars'), f('src/b.ts', 'no-console')])
    expect(r.ok).toBe(true)
    expect(r.shrinks).toEqual([{ file: 'src/a.ts', rule: 'no-unused-vars', count: 1, base: 2 }])
  })

  it('treats a vanished pair as a shrink', () => {
    const r = compare(base, [f('src/a.ts', 'no-unused-vars'), f('src/a.ts', 'no-unused-vars')])
    expect(r.ok).toBe(true)
    expect(r.shrinks).toEqual([{ file: 'src/b.ts', rule: 'no-console', count: 0, base: 1 }])
  })
})

describe('lint ratchet update', () => {
  it('refuses growth without allowGrow and keeps the old baseline', () => {
    const u = updateCounts(base, [...same, f('src/a.ts', 'no-unused-vars', 40)])
    expect(u.refused).toHaveLength(1)
    expect(u.counts).toBe(base)
  })

  it('refuses a new pair without allowGrow', () => {
    expect(updateCounts(base, [...same, f('src/x.ts', 'eqeqeq')]).refused).toHaveLength(1)
  })

  it('allows growth with allowGrow', () => {
    const u = updateCounts(base, [...same, f('src/x.ts', 'eqeqeq')], { allowGrow: true })
    expect(u.refused).toEqual([])
    expect(u.counts['src/x.ts']).toEqual({ eqeqeq: 1 })
  })

  it('shrinks and drops fixed entries', () => {
    const u = updateCounts(base, [f('src/a.ts', 'no-unused-vars'), f('src/a.ts', 'no-unused-vars')])
    expect(u.refused).toEqual([])
    expect(u.counts).toEqual({ 'src/a.ts': { 'no-unused-vars': 2 } })
  })
})

describe('lint ratchet helpers', () => {
  it('sorts keys and counts entries', () => {
    const c = countsOf([f('z.ts', 'b'), f('a.ts', 'z'), f('a.ts', 'a'), f('a.ts', 'a')])
    expect(JSON.stringify(c)).toBe('{"a.ts":{"a":2,"z":1},"z.ts":{"b":1}}')
    expect(entryCount(c)).toBe(3)
  })

  it('reads eslint output (errors only, repo-relative paths) and stylelint output', () => {
    const root = '/repo/'
    const e = eslintFindings(
      [{ filePath: '/repo/src/a.ts', messages: [
        { ruleId: 'x', severity: 2, line: 4, message: 'bad' },
        { ruleId: 'w', severity: 1, line: 5, message: 'warn' },
        { ruleId: null, severity: 2, fatal: true, line: 1, message: 'parse' },
      ] }],
      root,
    )
    expect(e.map((x) => `${x.file}:${x.line}:${x.rule}`)).toEqual(['src/a.ts:4:x', 'src/a.ts:1:(fatal)'])
    const s = stylelintFindings(
      [{ source: '/repo/src/ds/a.css', warnings: [{ severity: 'error', rule: 'r', line: 2, text: 't' }, { severity: 'warning', rule: 'q', line: 3, text: 'u' }] }],
      root,
    )
    expect(s).toEqual([{ file: 'src/ds/a.css', line: 2, rule: 'r', message: 't' }])
  })

  it('builds a baseline with a note first', () => {
    const b = makeBaseline({ eslint: { 'a.ts': { x: 1 } } })
    expect(Object.keys(b)).toEqual(['note', 'eslint', 'stylelint'])
    expect(b.stylelint).toEqual({})
  })
})
