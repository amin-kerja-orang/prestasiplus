import { describe, expect, it } from 'vitest'

import { floor } from '../../db/id-strategies'
import { defineVirtualDataset } from '../dataset'
import type { CellSpec } from '../spec'

interface U {
  id: number
  createdBy: number
  subject: string
}
type UFacets = Pick<U, 'createdBy' | 'subject'>

function build(opts: {
  idRange: { min: number; max: number }
  cells: CellSpec<UFacets>[]
  fromId: number
  anchors: U[]
}) {
  return defineVirtualDataset<U, 'createdBy' | 'subject'>({
    name: 'layout.users',
    idRange: opts.idRange,
    runtimeIds: floor({ start: opts.idRange.max + 1 }),
    facets: ['createdBy', 'subject'],
    distribution: opts.cells,
    derive: () => ({}),
    anchors: opts.anchors,
    layout: {
      blocks: [
        { cells: (f) => f.createdBy === 1, fromId: opts.fromId, contiguous: true, label: 'user-1' },
      ],
    },
  })
}

const run = (from: number, to: number, subject: string): U[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, createdBy: 1, subject }))

function checkBlock(ds: ReturnType<typeof build>, start: number, anchorsEnd: number) {
  const mine = ds.query({ where: { createdBy: 1 } }).rows.map((r) => r.id)
  // No user-1 row below the block start; the anchor run comes first, in ascending order.
  expect(mine[0]).toBe(start)
  expect(mine.slice(0, anchorsEnd - start + 1)).toEqual(
    Array.from({ length: anchorsEnd - start + 1 }, (_, i) => start + i),
  )
  // The block stays contiguous: every row between its first and last id is a user-1 row.
  const last = mine.at(-1) as number
  expect(ds.count({ id: { gte: start, lte: last } })).toBe(mine.length)
  return mine
}

describe('layout blocks with anchors (displaced slots stay inside the block)', () => {
  it('reviewer probe: block from 700, anchors 700–722 → no user-1 row below 700', () => {
    const ds = build({
      idRange: { min: 1, max: 2_000 },
      cells: [
        { facets: { createdBy: 1, subject: 'A' }, count: 60 },
        { facets: { createdBy: 1, subject: 'B' }, count: 40 },
        { facets: { createdBy: 7, subject: 'A' }, count: 900 },
        { facets: { createdBy: 7, subject: 'B' }, count: 500 },
      ],
      fromId: 700,
      anchors: run(700, 722, 'A'),
    })
    const mine = checkBlock(ds, 700, 722)
    expect(mine).toHaveLength(100)
    expect(ds.count()).toBe(1_500)
  })

  it('M04 user-1 / M10 layout: block from 522425, anchors 522425–522447, S21 page 2 starts at 522445', () => {
    // Same slot density as the M04 questions dataset (≈ 1.21 ids per slot, M04 §6.13.1).
    const total = 24_793
    const ds = build({
      idRange: { min: 500_001, max: 530_000 },
      cells: [
        { facets: { createdBy: 1, subject: 'BM-D6' }, count: 297 },
        { facets: { createdBy: 1, subject: 'BM-T1' }, count: 1_200 },
        { facets: { createdBy: 1, subject: 'MATH' }, count: 3_503 },
        { facets: { createdBy: 7, subject: 'BM-D6' }, count: 9_000 },
        { facets: { createdBy: 7, subject: 'MATH' }, count: total - 5_000 - 9_000 },
      ],
      fromId: 522_425,
      anchors: run(522_425, 522_447, 'BM-D6'),
    })
    expect(ds.feasibility().ok).toBe(true)
    const mine = checkBlock(ds, 522_425, 522_447)
    expect(mine).toHaveLength(5_000)
    expect(ds.count()).toBe(total)
    // S21 lists the teacher's questions 20 per page in ascending id order.
    const page1 = ds.query({ where: { createdBy: 1 }, page: 1, pageSize: 20 }).rows
    const page2 = ds.query({ where: { createdBy: 1 }, page: 2, pageSize: 20 }).rows
    expect(page1[0]?.id).toBe(522_425)
    expect(page2[0]?.id).toBe(522_445)
    expect(page2.slice(0, 3).map((r) => r.id)).toEqual([522_445, 522_446, 522_447])
    expect(ds.count({ createdBy: 1, id: { lte: 522_424 } })).toBe(0)
  })
})

describe('dense blocks (LayoutBlock.dense: consecutive ids from fromId)', () => {
  interface Opts {
    dense?: boolean
    contiguous?: boolean
    absent?: number[]
    anchors?: U[]
    second?: boolean
  }
  const cells: CellSpec<UFacets>[] = [
    { facets: { createdBy: 1, subject: 'A' }, count: 60 },
    { facets: { createdBy: 1, subject: 'B' }, count: 40 },
    { facets: { createdBy: 7, subject: 'A' }, count: 1_300 },
    { facets: { createdBy: 7, subject: 'B' }, count: 500 },
    { facets: { createdBy: 9, subject: 'A' }, count: 50 },
  ]
  const dsOf = (o: Opts = {}) =>
    defineVirtualDataset<U, 'createdBy' | 'subject'>({
      name: 'dense.users',
      idRange: { min: 1, max: 3_000 },
      runtimeIds: floor({ start: 3_001 }),
      facets: ['createdBy', 'subject'],
      distribution: cells,
      derive: () => ({}),
      anchors: o.anchors ?? [],
      ...(o.absent ? { absentIds: o.absent } : {}),
      layout: {
        blocks: [
          {
            cells: (f) => f.createdBy === 1,
            fromId: 1_000,
            ...((o.contiguous ?? true) ? {} : { toId: 1_900 }),
            contiguous: o.contiguous ?? true,
            ...(o.dense === undefined ? {} : { dense: o.dense }),
            label: 'user-1',
          },
          { cells: (f) => f.createdBy === 9, fromId: 2_000, contiguous: true, label: 'user-9' },
        ],
      },
    })
  const ids = (ds: ReturnType<typeof dsOf>, by: number) =>
    ds.query({ where: { createdBy: by }, sort: 'id' }).rows.map((r) => r.id)
  const allIds = (ds: ReturnType<typeof dsOf>) => ds.query({ sort: 'id' }).rows.map((r) => r.id)
  const consecutive = (from: number, n: number, skip: number[] = []) => {
    const out: number[] = []
    for (let id = from; out.length < n; id++) if (!skip.includes(id)) out.push(id)
    return out
  }
  const foreign = (id: number): U => ({ id, createdBy: 7, subject: 'A' })

  it('the block takes consecutive ids from fromId; keys ascending and unique; cell counts unchanged', () => {
    const dense = dsOf({ dense: true })
    const plain = dsOf()
    expect(ids(dense, 1)).toEqual(consecutive(1_000, 100))
    const all = allIds(dense)
    expect(all.every((id, i) => i === 0 || id > (all[i - 1] as number))).toBe(true)
    expect(all).toHaveLength(1_950)
    for (const by of [1, 7, 9]) expect(ids(dense, by)).toHaveLength(ids(plain, by).length)
    for (const subject of ['A', 'B']) {
      expect(dense.count({ createdBy: 1, subject })).toBe(plain.count({ createdBy: 1, subject }))
    }
  })

  it('a hole and a foreign-cell anchor inside the run are skipped', () => {
    const ds = dsOf({ dense: true, absent: [1_010], anchors: [foreign(1_020)] })
    expect(ids(ds, 1)).toEqual(consecutive(1_000, 100, [1_010, 1_020]))
    expect(ds.get(1_010)).toBeUndefined()
    expect(ds.get(1_020)?.createdBy).toBe(7)
    expect(ds.count()).toBe(1_950)
  })

  it.each(['anchor', 'hole'])(
    'a %s at the block’s last slot leaves no gap (the displaced row is renumbered too)',
    (kind) => {
      const last = Math.max(...ids(dsOf(), 1))
      const ds =
        kind === 'anchor'
          ? dsOf({ dense: true, anchors: [foreign(last)] })
          : dsOf({ dense: true, absent: [last] })
      expect(ids(ds, 1)).toEqual(consecutive(1_000, 100))
      expect(ds.count()).toBe(1_950)
    },
  )

  it('an adjacent contiguous block is unaffected', () => {
    expect(ids(dsOf({ dense: true }), 9)).toEqual(ids(dsOf(), 9))
  })

  it('specHash: unchanged without dense, different with it, unaffected on a non-contiguous block', () => {
    const base = dsOf().specHash()
    expect(dsOf({ dense: false }).specHash()).toBe(base)
    expect(dsOf({ dense: true }).specHash()).not.toBe(base)
    expect(dsOf({ dense: true, contiguous: false }).specHash()).toBe(
      dsOf({ contiguous: false }).specHash(),
    )
  })

  it('dense has no effect on a non-contiguous block', () => {
    expect(allIds(dsOf({ dense: true, contiguous: false }))).toEqual(
      allIds(dsOf({ contiguous: false })),
    )
    expect(ids(dsOf({ dense: true, contiguous: false }), 1)).toEqual(
      ids(dsOf({ contiguous: false }), 1),
    )
  })
})
