/**
 * `scaleCellsForPoc` (D45 PoC profile) and its per-cell `cellScale` hook (`VirtualDatasetDef.pocScale`,
 * D54): a cell may keep a larger share than the dataset scale, never a smaller one, never below its
 * anchors and never more than the observed count.
 */

import { describe, expect, it } from 'vitest'

import { scaleCellsForPoc } from '../data-profile'

interface F extends Record<string, unknown> {
  kind: string
}

const NAMES = ['kind']
const cells = [
  { facets: { kind: 'a' }, count: 1000 },
  { facets: { kind: 'b' }, count: 400 },
  { facets: { kind: 'c' }, count: 3 },
]
const countOf = (out: { facets: F; count: number }[], kind: string) =>
  out.find((c) => c.facets.kind === kind)?.count

describe('scaleCellsForPoc', () => {
  it('without a hook every cell keeps round(count * scale)', () => {
    const out = scaleCellsForPoc<F>(cells, NAMES, [], 0.05)
    expect(out.map((c) => c.count)).toEqual([Math.round(1000 * 0.05), Math.round(400 * 0.05), 0])
    // An undefined answer from the hook is the same as no hook.
    expect(scaleCellsForPoc<F>(cells, NAMES, [], 0.05, () => undefined)).toEqual(out)
  })

  it('a larger cellScale keeps a larger share of that cell only', () => {
    const out = scaleCellsForPoc<F>(cells, NAMES, [], 0.05, (f) =>
      f.kind === 'a' ? 0.5 : undefined,
    )
    expect(countOf(out, 'a')).toBe(500)
    expect(countOf(out, 'b')).toBe(Math.round(400 * 0.05))
  })

  it('never goes below the dataset scale', () => {
    const out = scaleCellsForPoc<F>(cells, NAMES, [], 0.2, () => 0.01)
    expect(out.map((c) => c.count)).toEqual([200, 80, Math.round(3 * 0.2)])
    const zero = scaleCellsForPoc<F>(cells, NAMES, [], 0.2, () => 0)
    expect(zero).toEqual(out)
  })

  it('is capped at 1: a cell never grows past its observed count', () => {
    const out = scaleCellsForPoc<F>(cells, NAMES, [], 0.05, () => 7)
    expect(out.map((c) => c.count)).toEqual([1000, 400, 3])
  })

  it('never goes below the anchors of a cell, with or without a hook', () => {
    const anchors = Array.from({ length: 80 }, () => ({ kind: 'a' }))
    const plain = scaleCellsForPoc<F>(cells, NAMES, anchors, 0.05)
    expect(countOf(plain, 'a')).toBe(80) // round(1000 * 0.05) = 50 < 80 anchors
    const hooked = scaleCellsForPoc<F>(cells, NAMES, anchors, 0.05, (f) =>
      f.kind === 'a' ? 0.01 : undefined,
    )
    expect(countOf(hooked, 'a')).toBe(80)
    const larger = scaleCellsForPoc<F>(cells, NAMES, anchors, 0.05, () => 0.5)
    expect(countOf(larger, 'a')).toBe(500)
  })

  it('a cell that already has no more rows than anchors is left as it is', () => {
    const out = scaleCellsForPoc<F>(
      cells,
      NAMES,
      [{ kind: 'c' }, { kind: 'c' }, { kind: 'c' }],
      0.05,
      () => 1,
    )
    expect(countOf(out, 'c')).toBe(3)
    const fewer = scaleCellsForPoc<F>(
      [{ facets: { kind: 'c' }, count: 2 }],
      NAMES,
      [{ kind: 'c' }, { kind: 'c' }, { kind: 'c' }],
      0.05,
      () => 1,
    )
    expect(fewer).toEqual([{ facets: { kind: 'c' }, count: 2 }])
  })

  it('keeps the facets and the order of the cells', () => {
    const out = scaleCellsForPoc<F>(cells, NAMES, [], 0.5, () => 0.9)
    expect(out.map((c) => c.facets)).toEqual(cells.map((c) => c.facets))
  })
})
