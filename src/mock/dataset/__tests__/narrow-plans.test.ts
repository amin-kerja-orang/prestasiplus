/**
 * F09-7: narrow plans (candidates ≤ N/32) skip the row bitmap and visit only their candidate
 * positions; wide plans still use the bitmap. Differential check of both against a materialised
 * table: where shapes (facets, id windows, cheap conditions), searches, edits (including facet
 * moves), inserts, deletes and `absentIds`.
 */

import { describe, expect, it } from 'vitest'

import { floor } from '../../db/id-strategies'
import { defineTable } from '../../db/table'
import { createDb } from '../../db/transaction'
import { defineVirtualDataset, hashKey, planStats } from '../dataset'
import type { VirtualDataset } from '../types'

interface A {
  id: number
  userId: number
  week: number
  score: number
  note: string
}
type F = 'userId' | 'week'

const N = 4_000
const USERS = 250
const WEEKS = 4
const ABSENT = [7, 8, 1_234, 3_999]

function build(name: string): VirtualDataset<A, F> {
  const nCells = USERS * WEEKS
  const base = Math.floor(N / nCells)
  const extra = N - base * nCells
  const distribution = Array.from({ length: nCells }, (_, c) => ({
    facets: { userId: 1 + Math.floor(c / WEEKS), week: 1 + (c % WEEKS) },
    count: base + (c < extra ? 1 : 0),
  }))
  return defineVirtualDataset<A, F, 'score' | 'note'>({
    name,
    total: N,
    idRange: { min: 1, max: N + ABSENT.length },
    absentIds: ABSENT,
    runtimeIds: floor({ start: 9_000_001 }),
    facets: ['userId', 'week'],
    distribution,
    fields: {
      score: (key) => hashKey(key, 1) % 101,
      note: (key, f) => `n${String(key)} u${String(f.userId)}`,
    },
    derive: () => ({}),
    searchFields: ['note'],
  })
}

function reference(ds: VirtualDataset<A, F>) {
  const table = defineTable<A>({ name: `${ds.name}.ref`, ids: floor({ start: 9_000_001 }) })
  for (const row of ds.query().rows) table.insert(row)
  return table
}

describe('narrow plans (F09-7) agree with a materialised table', () => {
  it('where shapes, searches and pages, before and after writes', () => {
    const db = createDb()
    const ds = db.register(build('narrow.answers'))
    db.baseline()

    const wheres = [
      { userId: 42 },
      { userId: 42, score: { gte: 50 } },
      { userId: [3, 4, 5], score: { gte: 20, lte: 60 } },
      { userId: 42, week: 2, score: { lte: 10 } },
      { week: 3, score: { gte: 90 } },
      { id: { gte: 1_000, lte: 1_100 }, score: { gte: 50 } },
      { id: { gte: 1_200, lte: 1_240 } },
      { id: 1_234, score: { gte: 0 } },
      { id: { gte: 1, lte: 40 }, userId: [1, 2, 3], score: { gte: 30 } },
      { score: { gte: 50 } },
      { userId: 9_999 },
    ]
    const searches = [
      undefined,
      { term: 'u42', fields: ['note' as const] },
      { term: 'N10', fields: ['note' as const, 'id' as const] },
    ]

    const check = () => {
      const ref = reference(ds)
      for (const where of wheres) {
        for (const search of searches) {
          const opts = search ? { search } : undefined
          const pred = search
            ? (row: A) =>
                row.note.toLowerCase().includes(search.term.toLowerCase()) ||
                ((search.fields as string[]).includes('id') && String(row.id).includes(search.term))
            : undefined
          expect(ds.count(where, undefined, opts), JSON.stringify([where, search])).toBe(
            ref.count(where, pred),
          )
          for (const dir of ['asc', 'desc'] as const) {
            for (const page of [1, 2]) {
              const sort = { field: 'id' as const, dir }
              expect(
                ds.query({ where, ...opts, sort, page, pageSize: 7 }),
                JSON.stringify([where, search, dir, page]),
              ).toEqual(ref.query({ where, match: pred, sort, page, pageSize: 7 }))
            }
          }
        }
      }
    }

    check()

    // Writes: a cheap edit, a facet move (moves a row between cells), a delete, inserts (one into a
    // hole id), and an insert into a narrow user's cell.
    const rows = ds.query({ where: { userId: 42 } }).rows
    const [a, b, c] = rows as [A, A, A]
    ds.update(a.id, { score: 99, note: 'u42 edited N10' })
    ds.update(b.id, { userId: 43, week: 1 })
    ds.remove(c.id)
    ds.insert({ userId: 42, week: 2, score: 77, note: 'runtime u42' })
    ds.insert({ id: 1_234, userId: 5, week: 1, score: 55, note: 'hole u5' })
    check()

    // Edit an unrelated row after plans were cached (the narrow set must not go stale).
    const other = ds.query({ where: { userId: 200 } }).rows[0] as A
    ds.update(other.id, { userId: 42, score: 88 })
    check()
    ds.remove(other.id)
    check()
  })
})

/** Runs `fn` and returns how many bitmaps / narrow gathers / position lists it built. */
function work(fn: () => void) {
  const before = { ...planStats }
  fn()
  return {
    bitmaps: planStats.bitmapBuilds - before.bitmapBuilds,
    gathers: planStats.narrowGathers - before.narrowGathers,
    lists: planStats.csrBuilds - before.csrBuilds,
  }
}

describe('narrow vs wide path is taken (work counters)', () => {
  it('narrow plans gather candidates and build no bitmap; wide plans build the bitmap', () => {
    const ds = build('narrow.counters')
    ds.compile()
    const narrowCount = work(() => ds.count({ userId: 42, score: { gte: 50 } }))
    expect(narrowCount).toEqual({ bitmaps: 0, gathers: 1, lists: 1 })
    // The per-cell position list is built once, then reused.
    const narrowQuery = work(() =>
      ds.query({ where: { userId: 43, score: { gte: 50 } }, page: 1, pageSize: 5 }),
    )
    expect(narrowQuery).toEqual({ bitmaps: 0, gathers: 1, lists: 0 })
    const window = work(() =>
      ds.query({ where: { id: { gte: 1_000, lte: 1_100 }, score: { gte: 50 } } }),
    )
    expect(window.bitmaps).toBe(0)
    const wide = work(() => ds.count({ score: { gte: 50 } }))
    expect(wide).toEqual({ bitmaps: 1, gathers: 0, lists: 0 })
    // Facet-only plans need neither.
    expect(work(() => ds.count({ userId: 44 }))).toEqual({ bitmaps: 0, gathers: 0, lists: 0 })
  })

  it('the boundary is exactly N/32 candidates: equal is narrow, one more is wide', () => {
    const total = 3_200 // N/32 = 100
    const mk = (small: number) =>
      defineVirtualDataset<{ id: number; g: string; score: number }, 'g', 'score'>({
        name: `narrow.boundary.${String(small)}`,
        total,
        idRange: { min: 1, max: total },
        runtimeIds: floor({ start: 9_000_001 }),
        facets: ['g'],
        distribution: [
          { facets: { g: 'a' }, count: small },
          { facets: { g: 'b' }, count: total - small },
        ],
        fields: { score: (key) => hashKey(key, 1) % 101 },
        derive: () => ({}),
      })
    const atLimit = mk(100)
    const over = mk(101)
    atLimit.compile()
    over.compile()
    const q = { g: 'a', score: { gte: 50 } }
    expect(work(() => atLimit.count(q))).toMatchObject({ bitmaps: 0, gathers: 1 })
    expect(work(() => over.count(q))).toMatchObject({ bitmaps: 1, gathers: 0 })
  })
})

describe('narrow plans after the position list exists: loadDiff, reset, rollback', () => {
  const where = { userId: 42, score: { gte: 30 } }
  const others = { userId: 43, score: { gte: 30 } }
  const agree = (ds: VirtualDataset<A, F>) => {
    const ref = reference(ds)
    for (const w of [where, others, { userId: 44 }, { userId: 42, week: 1 }]) {
      expect(ds.count(w)).toBe(ref.count(w))
      expect(ds.query({ where: w, sort: { field: 'id', dir: 'desc' } })).toEqual(
        ref.query({ where: w, sort: { field: 'id', dir: 'desc' } }),
      )
    }
  }

  it('loadDiff, db.reset and a throwing transaction keep narrow results exact', () => {
    const db = createDb()
    const ds = db.register(build('narrow.lifecycle'))
    db.baseline()
    // The first narrow plan builds the per-cell position list; later ones reuse it.
    expect(work(() => ds.count(where)).lists).toBe(1)
    const pristine = ds.count(where)
    expect(work(() => agree(ds)).lists).toBe(0)
    const [a, b] = ds.query({ where: { userId: 42 } }).rows as [A, A]
    const moved = ds.query({ where: { userId: 100 } }).rows[0] as A

    // loadDiff: an edit, a facet move into user 42, a delete and an insert.
    ds.loadDiff({
      kind: 'dataset',
      overrides: [
        { id: a.id, patch: { score: 100 } },
        { id: moved.id, patch: { userId: 42, score: 90 } },
      ],
      deletes: [b.id],
      inserts: [{ id: 9_000_001, userId: 42, week: 1, score: 77, note: 'diff u42' }],
      ids: null,
    })
    expect(work(() => agree(ds)).lists).toBe(0)
    expect(ds.count(where)).not.toBe(pristine)

    // Rollback of a throwing transaction after the list exists.
    const before = ds.count(where)
    expect(() =>
      db.transaction(() => {
        ds.update(a.id, { userId: 43 })
        ds.insert({ userId: 42, week: 2, score: 50, note: 'tx' })
        ds.remove(moved.id)
        agree(ds)
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(ds.count(where)).toBe(before)
    agree(ds)

    // Reset back to the baseline.
    db.reset()
    expect(ds.count(where)).toBe(pristine)
    agree(ds)
  })
})
