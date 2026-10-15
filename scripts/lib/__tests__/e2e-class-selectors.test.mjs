// Unit tests of the E2E class-selector finder (scripts/lib/e2e-class-selectors.mjs).
import { describe, expect, it } from 'vitest'

import {
  buildReport,
  classSelectorKind,
  findClassSelectors,
  moduleOf,
} from '../e2e-class-selectors.mjs'

describe('classSelectorKind', () => {
  it.each([
    ['.admin-shell', 'class'],
    ['a.active', 'class'],
    ['svg.animate-spin', 'class'],
    ['[data-testid=x] .grid', 'class'],
    ['[class*="btn"]', 'attr-class'],
    ['.fa-star, svg, i', 'class'],
  ])('flags %s', (sel, kind) => expect(classSelectorKind(sel)).toBe(kind))

  it.each([
    '[data-testid="user-row"]',
    'button',
    'text=Versi 1.5',
    'role=button[name="a.b"]',
    '[href="/a.b"]',
    'button:has-text("Tambah 0.5")',
    '#main',
  ])('ignores %s', (sel) => expect(classSelectorKind(sel)).toBeNull())
})

describe('findClassSelectors', () => {
  const src = [
    `await page.locator('.admin-shell').click()`,
    `await page.getByTestId('x').click()`,
    `const a = row.locator("a.active")`,
    `table.closest('.overflow-x-auto')`,
    `await expect(el).toHaveClass(/on/)`,
    `page.locator('[role="tab"].is-on')`,
  ].join('\n')

  it('reports line, kind and structural flag', () => {
    const hits = findClassSelectors(src)
    expect(hits.map((h) => [h.line, h.kind])).toEqual([
      [1, 'class'],
      [3, 'class'],
      [4, 'class'],
      [5, 'class-assertion'],
      [6, 'class'],
    ])
    expect(hits[4]?.structural).toBe(true)
  })
})

describe('buildReport', () => {
  it('groups by module', () => {
    expect(moduleOf('e2e/m05-practice/a.spec.ts')).toBe('m05-practice')
    expect(moduleOf('e2e/x.spec.ts')).toBe('other')
    const r = buildReport([
      { file: 'e2e/m01-a/a.spec.ts', source: `page.locator('.x')` },
      { file: 'e2e/m01-a/b.spec.ts', source: `page.getByTestId('x')` },
      { file: 'e2e/m02-b/c.spec.ts', source: `page.locator('i.y')\npage.locator('.z')` },
    ])
    expect(r.modules['m01-a']).toMatchObject({ specs: 2, specsWithClassSelectors: 1, hits: 1 })
    expect(r.modules['m02-b']).toMatchObject({ specs: 1, hits: 2 })
    expect(r.totals).toEqual({ specs: 3, specsWithClassSelectors: 2, hits: 3 })
  })
})
