import { describe, expect, it } from 'vitest'

import { DatasetSpecError } from '../errors'
import { fit2d } from '../fit2d'
import { exact, marginal, nest, nestSplit, split, totalOf } from '../spec'

describe('split (largest remainder)', () => {
  it('always sums to the total exactly', () => {
    for (const total of [0, 1, 7, 100, 465_278, 478_499]) {
      const parts = split(total, [
        ['a', 1],
        ['b', 1],
        ['c', 1],
        ['d', 0.5],
      ])
      expect(parts.reduce((s, [, n]) => s + n, 0)).toBe(total)
    }
  })

  it('is deterministic and gives ties to the earlier entry', () => {
    expect(
      split(2, [
        ['x', 1],
        ['y', 1],
        ['z', 1],
      ]),
    ).toEqual([
      ['x', 1],
      ['y', 1],
      ['z', 0],
    ])
  })

  it('gives zero weights nothing and rejects impossible input', () => {
    expect(
      split(10, [
        ['a', 0],
        ['b', 3],
      ]),
    ).toEqual([
      ['a', 0],
      ['b', 10],
    ])
    expect(() => split(5, [['a', 0]])).toThrow(DatasetSpecError)
    expect(() => split(-1, [['a', 1]])).toThrow(DatasetSpecError)
    expect(() => split(3.5, [['a', 1]])).toThrow(DatasetSpecError)
  })
})

describe('exact / nest / nestSplit', () => {
  it('exact validates counts', () => {
    expect(exact([{ facets: { s: 1 }, count: 3 }])).toEqual([{ facets: { s: 1 }, count: 3 }])
    expect(() => exact([{ facets: { s: 1 }, count: -1 }])).toThrow(DatasetSpecError)
  })

  it('nest requires the children to sum to the parent', () => {
    const parent = [{ facets: { s: 1 }, count: 10 }]
    const ok = nest(parent, () => [
      { facets: { st: 'a' }, count: 4 },
      { facets: { st: 'b' }, count: 6 },
    ])
    expect(ok).toEqual([
      { facets: { s: 1, st: 'a' }, count: 4 },
      { facets: { s: 1, st: 'b' }, count: 6 },
    ])
    expect(() => nest(parent, () => [{ facets: { st: 'a' }, count: 9 }])).toThrow(/sum to 9/)
  })

  it('nestSplit keeps marginals exact', () => {
    const cells = nestSplit(
      [
        { facets: { s: 1 }, count: 101 },
        { facets: { s: 2 }, count: 57 },
      ],
      'd',
      [
        [1, 3],
        [2, 5],
        [3, 0],
      ] as const,
    )
    expect(totalOf(cells)).toBe(158)
    expect(marginal(cells, (f) => f.s === 1)).toBe(101)
    expect(cells.some((c) => c.facets.d === 3)).toBe(false)
  })
})

describe('fit2d', () => {
  const rows = [
    ['BM', 1_000],
    ['MATH', 700],
    ['ADDMATH', 300],
  ] as const
  const cols = [
    ['D1', 500],
    ['T4', 800],
    ['T5', 700],
  ] as const
  const allowed = (r: string, c: string) => r !== 'ADDMATH' || c !== 'D1'

  it('matches both marginals exactly over the allowed pairs', () => {
    const out = fit2d({ rows, cols, allowed })
    for (const [r, t] of rows) {
      expect(out.filter((x) => x.row === r).reduce((s, x) => s + x.count, 0)).toBe(t)
    }
    for (const [c, t] of cols) {
      expect(out.filter((x) => x.col === c).reduce((s, x) => s + x.count, 0)).toBe(t)
    }
    expect(out.find((x) => x.row === 'ADDMATH' && x.col === 'D1')).toBeUndefined()
    expect(out.every((x) => Number.isInteger(x.count) && x.count >= 0)).toBe(true)
  })

  it('respects pinned cells and capacities', () => {
    const out = fit2d({
      rows,
      cols,
      allowed,
      bounds: (r, c) =>
        r === 'BM' && c === 'D1'
          ? { min: 450, max: 450 }
          : r === 'MATH' && c === 'T5'
            ? { max: 10 }
            : undefined,
    })
    expect(out.find((x) => x.row === 'BM' && x.col === 'D1')?.count).toBe(450)
    expect(out.find((x) => x.row === 'MATH' && x.col === 'T5')?.count).toBeLessThanOrEqual(10)
    expect(out.reduce((s, x) => s + x.count, 0)).toBe(2_000)
  })

  it('is exact on a large, lumpy table (27 × 11)', () => {
    const r = Array.from({ length: 27 }, (_, i) => [i, 1_000 + ((i * 7919) % 5_000)] as const)
    const total = r.reduce((s, [, n]) => s + n, 0)
    const c = split(
      total,
      Array.from({ length: 11 }, (_, j) => [j, 1 + ((j * 13) % 5)] as const),
    )
    const out = fit2d({ rows: r, cols: c, allowed: (i, j) => i < 20 || j >= 6 })
    for (const [i, t] of r)
      expect(out.filter((x) => x.row === i).reduce((s, x) => s + x.count, 0)).toBe(t)
    for (const [j, t] of c)
      expect(out.filter((x) => x.col === j).reduce((s, x) => s + x.count, 0)).toBe(t)
  })

  it('fails with INFEASIBLE when the marginals cannot be met', () => {
    // ADDMATH (300) may only sit at D1, but D1 holds 200.
    const bad = () =>
      fit2d({
        rows: [
          ['BM', 500],
          ['ADDMATH', 300],
        ],
        cols: [
          ['D1', 200],
          ['T5', 600],
        ],
        allowed: (r, c) => r === 'BM' || c === 'D1',
        label: 'bad',
      })
    expect(bad).toThrow(DatasetSpecError)
    try {
      bad()
    } catch (err) {
      expect((err as DatasetSpecError).issues[0]?.code).toBe('INFEASIBLE')
    }
  })

  it('fails when the marginal sums differ or pins exceed a total', () => {
    expect(() => fit2d({ rows: [['a', 5]], cols: [['x', 6]] })).toThrow(/sum to/)
    expect(() => fit2d({ rows: [['a', 5]], cols: [['x', 5]], bounds: () => ({ min: 6 }) })).toThrow(
      DatasetSpecError,
    )
  })
})
