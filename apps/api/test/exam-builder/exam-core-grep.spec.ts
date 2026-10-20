import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const EXAM = resolve(__dirname, '../../src/modules/exam')
const ADAPTER = 'exam-core.adapter.ts'

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })

/** Imports of the shared exam domain (prototype folder or the future package). */
const DOMAIN_IMPORT = /from\s+['"][^'"]*(?:m28-bijak-spm\/domain|@pp\/exam-core)[^'"]*['"]|import\(\s*['"][^'"]*(?:m28-bijak-spm\/domain|@pp\/exam-core)/

/** Own marks-budget / choose-N rule: a re-implementation of effectiveMarks or "sort descending, take N". */
const OWN_RULES: RegExp[] = [
  /function\s+effectiveMarks\b/,
  /\b(?:const|let|var)\s+effectiveMarks\s*=/,
  /\.sort\(\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*=>\s*\2\s*-\s*\1\s*\)[\s\S]{0,120}?\.slice\(\s*0\s*,/,
]

const violations = (name: string, src: string): string[] => {
  const out: string[] = []
  if (name !== ADAPTER && DOMAIN_IMPORT.test(src)) out.push('imports the exam domain')
  if (OWN_RULES.some((r) => r.test(src))) out.push('defines its own marks-budget / choose-N rule')
  return out
}

describe('exam module imports the shared domain only through the adapter (AC 7)', () => {
  const files = walk(EXAM)

  it('finds the builder files', () => {
    expect(files.some((f) => f.endsWith(join('builder', ADAPTER)))).toBe(true)
    expect(files.some((f) => f.endsWith('paper-check.ts'))).toBe(true)
  })

  it.each(files.map((f) => [f.slice(EXAM.length + 1), f] as const))('%s', (rel, file) => {
    const name = file.split(/[\\/]/).pop()!
    expect(violations(name, readFileSync(file, 'utf8')), rel).toEqual([])
  })

  it('paper-check.ts imports effectiveMarks from ./exam-core.adapter', () => {
    const src = readFileSync(join(EXAM, 'builder/paper-check.ts'), 'utf8')
    expect(src).toMatch(/import\s*\{[^}]*\beffectiveMarks\b[^}]*\}\s*from\s*'\.\/exam-core\.adapter'/)
  })

  it('the adapter is the one that imports the domain', () => {
    expect(DOMAIN_IMPORT.test(readFileSync(join(EXAM, 'builder', ADAPTER), 'utf8'))).toBe(true)
  })
})

describe('the patterns catch a planted re-implementation', () => {
  it.each([
    ["import { x } from '../../../../../../src/modules/m28-bijak-spm/domain/paper-model'", 'imports the exam domain'],
    ["import { effectiveMarks } from '@pp/exam-core'", 'imports the exam domain'],
    ['export function effectiveMarks(rule, marks) { return 0 }', 'defines its own marks-budget / choose-N rule'],
    ['const effectiveMarks = (m: number[]) => m.length', 'defines its own marks-budget / choose-N rule'],
    ['const top = [...marks].sort((a, b) => b - a).slice(0, rule.n)', 'defines its own marks-budget / choose-N rule'],
  ])('%s', (src, expected) => {
    expect(violations('other.ts', src)).toContain(expected)
  })

  it('does not flag harmless code', () => {
    expect(violations('other.ts', "import { effectiveMarks } from './exam-core.adapter'\nids.sort((a, b) => a - b)")).toEqual([])
  })
})
