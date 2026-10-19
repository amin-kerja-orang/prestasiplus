/**
 * F-09 G4 follow-ups: specHash (seed version input), the relaxed runtime floor rule, cheap derived
 * fields (fast slow path), runtime cells dropped on reset, fit2d duplicate labels.
 */

import { describe, expect, it, vi } from 'vitest'

import { floor } from '../../db/id-strategies'
import { createDb } from '../../db/transaction'
import { createPrngRegistry, mulberry32 } from '../../determinism/prng'
import { defineVirtualDataset, rowStreamSeed } from '../dataset'
import { DatasetSpecError } from '../errors'
import { fit2d } from '../fit2d'
import {
  anchor,
  buildCheapQuestions,
  buildQuestions,
  createdAtOf,
  materialise,
  type Q,
} from './fixtures'

describe('specHash (seed version input)', () => {
  const mk = (over: { total?: number; floorStart?: number; anchors?: Q[]; fromId?: number } = {}) =>
    buildQuestions({
      total: over.total ?? 2_000,
      idMax: 2_500,
      anchors: over.anchors ?? [anchor({ id: 900_010 })],
      runtimeFloor: over.floorStart,
      blocks:
        over.fromId === undefined
          ? undefined
          : [{ cells: (f) => f.subjectId === 1, fromId: over.fromId, label: 's1' }],
    })

  it('is stable, computable before compilation, and ignores overrides and contributions', () => {
    const a = mk()
    const h = a.specHash()
    expect(h).toMatch(/^[0-9a-f]{16}$/)
    expect(a.compiled).toBe(false)
    a.overrideSpec((cells) => cells.map((c) => ({ ...c })))
    a.addAnchors([anchor({ id: 900_011 })], 'M05')
    expect(a.specHash()).toBe(h)
    expect(mk().specHash()).toBe(h)
  })

  it('changes with the distribution, own anchors, runtime strategy and layout blocks', () => {
    const h = mk().specHash()
    const variants = [
      mk({ total: 2_001 }),
      mk({ anchors: [anchor({ id: 900_010, text: 'changed' })] }),
      mk({ floorStart: 9_000_002 }),
      mk({ fromId: 100 }),
    ].map((d) => d.specHash())
    for (const v of variants) expect(v).not.toBe(h)
    expect(new Set(variants).size).toBe(variants.length)
    expect(mk({ fromId: 100 }).specHash()).not.toBe(mk({ fromId: 101 }).specHash())
  })
})

describe('runtime floor vs reserved ranges (Delivery Lead decision)', () => {
  interface S {
    id: number
    state: string
  }
  const schools = (start: number, reserved: [number, number][] = [[900_001, 900_099]]) =>
    defineVirtualDataset<S, 'state'>({
      name: 'schools',
      idRange: { min: 1, max: 10_300 },
      reservedAnchorRanges: reserved,
      runtimeIds: floor({ start }),
      facets: ['state'],
      distribution: [{ facets: { state: 'Selangor' }, count: 10_220 }],
      derive: () => ({}),
      anchors: [{ id: 900_001, state: 'Selangor' }],
    })

  it('allows reserved ranges above the floor (M02 schools: 10,301+ and 900001–900099)', () => {
    expect(schools(10_301).feasibility()).toMatchObject({ ok: true })
  })

  it('rejects a floor inside idRange or inside a reserved range', () => {
    expect(
      schools(10_300)
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['RANGE'])
    expect(
      schools(900_050)
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['RANGE'])
  })

  it('the allocator skips reserved ranges when it reaches them', () => {
    const db = createDb()
    const ds = db.register(schools(10_301))
    db.baseline()
    expect(ds.insert({ state: 'Johor' }).id).toBe(10_301)
    // An explicit id just below the reserved range moves the counter up to it.
    expect(ds.insert({ id: 900_000, state: 'Johor' }).id).toBe(900_000)
    expect(ds.insert({ state: 'Johor' }).id).toBe(900_100)
    expect(ds.insert({ state: 'Johor' }).id).toBe(900_101)
    // Explicit reserved ids stay allowed (e.g. M10 `questions.createFixture` 700301).
    expect(ds.insert({ id: 900_050, state: 'Johor' }).id).toBe(900_050)
  })
})

describe('cheap derived fields', () => {
  const ds = buildCheapQuestions({
    total: 5_000,
    idMax: 6_200,
    anchors: [anchor({ id: 900_003, score: 95, text: 'Apakah anchor' })],
  })
  const ref = materialise(ds)

  it('filters, searches, sorts and groups on cheap fields exactly like a table', () => {
    const search = (r: Q) => r.text.includes('Mengapakah')
    expect(ds.count({ score: { gte: 90 } })).toBe(ref.count({ score: { gte: 90 } }))
    expect(ds.count({}, search, { matchFields: ['text'] })).toBe(ref.count({}, search))
    for (const page of [1, 7]) {
      expect(
        ds.query({ where: { score: { gte: 90 }, isActive: true }, page, pageSize: 20 }),
      ).toEqual(ref.query({ where: { score: { gte: 90 }, isActive: true }, page, pageSize: 20 }))
      expect(ds.query({ match: search, matchFields: ['text'], page, pageSize: 20 })).toEqual(
        ref.query({ match: search, page, pageSize: 20 }),
      )
      const sort = [{ field: 'score' as const, dir: 'desc' as const }]
      expect(ds.query({ sort, page, pageSize: 20 })).toEqual(
        ref.query({ sort, page, pageSize: 20 }),
      )
    }
    expect(ds.groupCount('score', { subjectId: 2 })).toEqual(
      ref.groupCount('score', { subjectId: 2 }),
    )
  })

  it('search: case-insensitive substring over cheap fields, facets and id, kept in step with writes', () => {
    const db = createDb()
    const d = db.register(buildCheapQuestions({ total: 5_000, idMax: 6_200 }))
    db.baseline()
    const r = materialise(d)
    const hit = (term: string) => (row: Q) =>
      row.text.toLowerCase().includes(term.toLowerCase()) || String(row.id).includes(term)
    for (const term of ['MENGAPAKAH', 'soalan 12', '']) {
      const search = { term, fields: ['text' as const, 'id' as const] }
      expect(d.count({}, undefined, { search })).toBe(r.count({}, hit(term)))
      expect(d.query({ where: { isActive: true }, search, page: 2, pageSize: 15 })).toEqual(
        r.query({ where: { isActive: true }, match: hit(term), page: 2, pageSize: 15 }),
      )
    }
    const search = { term: 'zz-edited', fields: ['text' as const] }
    expect(d.count({}, undefined, { search })).toBe(0)
    const row = d.query({ page: 3, pageSize: 1 }).rows[0] as Q
    d.update(row.id, { text: 'ZZ-edited text' })
    d.insert({ ...row, id: undefined, text: 'runtime zz-EDITED' })
    expect(d.count({}, undefined, { search })).toBe(2)
    d.remove(row.id)
    expect(d.count({}, undefined, { search })).toBe(1)
  })

  it('search on repetitive texts (dictionary index): pages, newest first and totals match a table', () => {
    const db = createDb()
    const d = db.register(
      buildCheapQuestions({ total: 6_000, idMax: 7_000, searchText: true, repetitiveText: true }),
    )
    db.baseline()
    const check = () => {
      const r = materialise(d)
      for (const [term, caseSensitive] of [
        ['apakah', false],
        ['Topik 12', false],
        ['Siapakah', true],
        ['zz-none', false],
      ] as const) {
        const search = { term, fields: ['text' as const], caseSensitive }
        const pred = (row: Q) =>
          caseSensitive
            ? row.text.includes(term)
            : row.text.toLowerCase().includes(term.toLowerCase())
        expect(d.count({}, undefined, { search })).toBe(r.count({}, pred))
        for (const sort of [undefined, { field: 'createdAt' as const, dir: 'desc' as const }]) {
          for (const page of [1, 3]) {
            const where = { isActive: true }
            expect(d.query({ where, search, sort, page, pageSize: 25 })).toEqual(
              r.query({ where, match: pred, sort, page, pageSize: 25 }),
            )
          }
        }
      }
    }
    check()
    // Writes after the index build: edited text, a facet move, a delete and a runtime row.
    const [a, b, c] = d.query({ page: 4, pageSize: 3 }).rows as [Q, Q, Q]
    d.update(a.id, { text: 'Apakah teks baharu' })
    d.update(b.id, { isActive: !b.isActive, subjectId: 2 })
    d.remove(c.id)
    d.insert({ ...a, id: undefined, text: 'Siapakah baris baharu' })
    check()
  })

  it('search.caseSensitive matches the exact case (index and writes)', () => {
    const db = createDb()
    const d = db.register(buildCheapQuestions({ total: 5_000, idMax: 6_200, searchText: true }))
    db.baseline()
    const r = materialise(d)
    for (const term of ['Mengapakah', 'mengapakah', 'soalan 12']) {
      const search = { term, fields: ['text' as const], caseSensitive: true }
      expect(d.count({}, undefined, { search })).toBe(r.count({}, (row) => row.text.includes(term)))
      expect(d.query({ search, page: 3, pageSize: 10 })).toEqual(
        r.query({ match: (row) => row.text.includes(term), page: 3, pageSize: 10 }),
      )
    }
    const cs = (term: string) => ({ term, fields: ['text' as const], caseSensitive: true })
    expect(d.count({}, undefined, { search: cs('mengapakah') })).toBe(0)
    const row = d.query({ page: 2, pageSize: 1 }).rows[0] as Q
    d.update(row.id, { text: 'CaseKey only' })
    expect(d.count({}, undefined, { search: cs('CaseKey') })).toBe(1)
    expect(d.count({}, undefined, { search: cs('casekey') })).toBe(0)
    expect(d.count({}, undefined, { search: { term: 'casekey', fields: ['text'] } })).toBe(1)
  })

  it('warns (once per field, no throw) when match reads a searchFields field', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const d = buildCheapQuestions({ total: 2_000, idMax: 2_500, searchText: true, name: 'w.q' })
      const n = d.count({}, (row) => row.text.includes('Apakah'), { matchFields: ['text'] })
      const viaSearch = d.count({}, undefined, {
        search: { term: 'Apakah', fields: ['text'], caseSensitive: true },
      })
      expect(n).toBe(viaSearch)
      d.count({}, (row) => row.text.includes('x'), { matchFields: ['text'] })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/use `search/)
      // A match over a cheap field that is not a search field does not warn.
      d.count({}, (row) => row.score > 50, { matchFields: ['score'] })
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('search indexes (searchFields) survive loadDiff and reflect the loaded overlay', () => {
    const db = createDb()
    const d = db.register(buildCheapQuestions({ total: 5_000, idMax: 6_200, searchText: true }))
    db.baseline()
    const [a, b] = d.query({ page: 2, pageSize: 2 }).rows as [Q, Q]
    const search = { term: 'qq-reloaded', fields: ['text' as const] }
    d.loadDiff({
      kind: 'dataset',
      overrides: [{ id: a.id, patch: { text: 'QQ-Reloaded text' } }],
      deletes: [b.id],
      inserts: [],
      ids: null,
    })
    expect(d.query({ search, page: 1, pageSize: 5 }).rows.map((r) => r.id)).toEqual([a.id])
    // b's own text is no longer found; reloading an empty diff restores a's spec text.
    expect(d.count({}, undefined, { search: { term: b.text, fields: ['text'] } })).toBe(0)
    d.loadDiff({ kind: 'dataset', overrides: [], deletes: [], inserts: [], ids: null })
    expect(d.count({}, undefined, { search })).toBe(0)
    expect(d.count({}, undefined, { search: { term: a.text, fields: ['text'] } })).toBe(1)
  })

  it('does not call derive for cheap-field queries, and honours overrides', () => {
    const calls = { n: 0 }
    const d = buildCheapQuestions({ total: 5_000, idMax: 6_200, deriveCalls: calls })
    const db = createDb()
    db.register(d)
    db.baseline()
    const before = d.count({ score: 100 })
    const row = d.query({ where: { score: { lte: 3 } }, page: 1, pageSize: 1 }).rows[0] as Q
    const n0 = calls.n
    d.count({ score: { gte: 50 } })
    d.count({}, (r) => r.text.startsWith('Apakah'), { matchFields: ['text'] })
    expect(calls.n).toBe(n0)
    d.update(row.id, { score: 100 })
    expect(d.count({ score: 100 })).toBe(before + 1)
  })

  it('row streams keep their seeds (fast seed = registry seed)', () => {
    const reg = createPrngRegistry({ seedBase: 1 })
    for (const key of [0, 1, 42, 564_161, 9_000_001]) {
      expect(rowStreamSeed(1, 'questions', key)).toBe(
        reg.seedFor(`dataset:questions:row:${String(key)}`),
      )
    }
    expect(mulberry32(rowStreamSeed(1, 'x', 5)).uint32()).toBe(
      reg.fresh('dataset:x:row:5').uint32(),
    )
  })
})

describe('nits', () => {
  it('reset of the overlay drops runtime cells', () => {
    const db = createDb()
    const ds = db.register(buildQuestions({ total: 500, idMax: 600 }))
    db.baseline()
    ds.insert({
      subjectId: 99,
      levelId: null,
      status: 'approved',
      isActive: true,
      difficulty: 5,
      text: 'x',
      score: 1,
      createdAt: createdAtOf(1),
    })
    expect(ds.runtimeCellCount).toBe(1)
    ds.loadDiff({ kind: 'dataset', overrides: [], deletes: [], inserts: [], ids: null })
    expect(ds.runtimeCellCount).toBe(0)
    expect(ds.cells()).toHaveLength(ds.cells().filter((c) => !c.runtime).length)
    expect(ds.count()).toBe(500)
  })

  it('fit2d rejects duplicate row or column labels', () => {
    expect(() =>
      fit2d({
        rows: [
          ['a', 1],
          ['a', 1],
        ],
        cols: [['x', 2]],
      }),
    ).toThrow(DatasetSpecError)
    expect(() =>
      fit2d({
        rows: [['a', 2]],
        cols: [
          ['x', 1],
          ['x', 1],
        ],
      }),
    ).toThrow(/duplicate col/)
  })
})
