import { describe, expect, it } from 'vitest'

import { MockDbError } from '../../db/errors'
import { floor, maxPlusOne, opaque } from '../../db/id-strategies'
import { createDb, type CommitEvent } from '../../db/transaction'
import { mulberry32 } from '../../determinism/prng'
import { defineVirtualDataset } from '../dataset'
import { DatasetSpecError } from '../errors'
import { assertFeasible, checkFeasibility } from '../feasibility'
import { defineNamedQueries } from '../named-queries'
import { exact, marginal } from '../spec'
import type { DatasetChanges } from '../types'
import {
  anchor,
  buildQuestions,
  createdAtOf,
  materialise,
  questionCells,
  T0,
  type Q,
} from './fixtures'

const TOTAL = 5_000
const ID_MAX = 6_200

function ids(rows: readonly { id: unknown }[]) {
  return rows.map((r) => r.id)
}

describe('totals and facet counts', () => {
  const cells = questionCells(TOTAL)
  const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX })

  it('reports the exact total and every cell count of the spec', () => {
    expect(ds.count()).toBe(TOTAL)
    expect(ds.query({ page: 1, pageSize: 1 }).total).toBe(TOTAL)
    for (const cell of cells) expect(ds.count(cell.facets)).toBe(cell.count)
  })

  it('reports exact marginals (single facets and combinations)', () => {
    for (const s of [1, 5, 21, 27]) {
      expect(ds.count({ subjectId: s })).toBe(marginal(cells, (f) => f.subjectId === s))
    }
    expect(ds.count({ status: 'approved', isActive: true })).toBe(
      marginal(cells, (f) => f.status === 'approved' && f.isActive),
    )
    expect(ds.count({ difficulty: { gte: 2, lte: 3 } })).toBe(
      marginal(cells, (f) => f.difficulty >= 2 && f.difficulty <= 3),
    )
    expect(ds.count({ subjectId: [1, 2, 3], levelId: { ne: 1 } })).toBe(
      marginal(cells, (f) => [1, 2, 3].includes(f.subjectId) && f.levelId !== 1),
    )
  })

  it('groupCount aggregates cells and matches a scan of the rows', () => {
    const bySubject = ds.groupCount('subjectId', { status: 'approved' })
    const ref = materialise(ds).groupCount('subjectId', { status: 'approved' })
    expect(bySubject).toEqual(ref)
    expect([...bySubject.values()].reduce((a, b) => a + b, 0)).toBe(
      ds.count({ status: 'approved' }),
    )
  })

  it('counts every generated row once, with strictly increasing ids inside the range', () => {
    const all = ds.query().rows
    expect(all).toHaveLength(TOTAL)
    for (let i = 1; i < all.length; i++) expect(all[i]!.id).toBeGreaterThan(all[i - 1]!.id)
    expect(all[0]!.id).toBeGreaterThanOrEqual(1)
    expect(all.at(-1)!.id).toBeLessThanOrEqual(ID_MAX)
  })

  it('interleaves cells across ids (not one block per subject)', () => {
    const first = ds.query({ page: 1, pageSize: 200 }).rows
    expect(new Set(first.map((r) => r.subjectId)).size).toBeGreaterThan(10)
  })
})

describe('derivation and determinism', () => {
  it('two instances produce identical rows and fingerprints', () => {
    const a = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    const b = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    expect(a.fingerprint()).toBe(b.fingerprint())
    expect(a.query({ page: 7, pageSize: 50 })).toEqual(b.query({ page: 7, pageSize: 50 }))
    const probe = a.query({ page: 3, pageSize: 5 }).rows.map((r) => r.id)
    expect(b.getMany(probe)).toEqual(a.getMany(probe))
  })

  it('facets always win over derived fields and rows are frozen', () => {
    const ds = buildQuestions({ total: 100, idMax: 120 })
    const row = ds.query({ page: 1, pageSize: 1 }).rows[0]!
    expect(Object.isFrozen(row)).toBe(true)
    expect(row.createdAt).toBe(createdAtOf(row.id))
  })

  it('golden rows stay stable (seed base 1)', () => {
    const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    const golden = ds
      .query({ page: 1, pageSize: 20 })
      .rows.map(
        (r) =>
          `${String(r.id)}|${String(r.subjectId)}|${String(r.levelId)}|${r.status}|${String(r.isActive)}|${String(r.difficulty)}|${String(r.score)}|${r.text}`,
      )
    expect(golden).toMatchSnapshot()
  })
})

describe('anchors', () => {
  const inRange = anchor({
    id: 1_234,
    subjectId: 3,
    levelId: 4,
    status: 'approved',
    isActive: true,
    difficulty: 2,
    text: 'Anchor A',
    createdAt: T0 - 1,
  })
  const reserved = anchor({
    id: 900_001,
    subjectId: 1,
    levelId: 1,
    status: 'approved',
    isActive: true,
    difficulty: 1,
    text: 'SMK DEMO-like anchor',
    createdAt: T0 - 2,
  })

  it('anchors appear at their ids with their literal attributes; totals do not change', () => {
    const plain = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [inRange, reserved] })
    expect(ds.get(1_234)).toEqual(inRange)
    expect(ds.get(900_001)).toEqual(reserved)
    expect(ds.isAnchor(1_234)).toBe(true)
    expect(ds.isAnchor(ds.query({ page: 1, pageSize: 1 }).rows[0]!.id)).toBe(false)
    expect(ds.count()).toBe(TOTAL)
    for (const cell of questionCells(TOTAL)) expect(ds.count(cell.facets)).toBe(cell.count)
    expect(ds.query({ sort: { field: 'id', dir: 'desc' }, page: 1, pageSize: 1 }).rows[0]).toEqual(
      reserved,
    )
    expect(plain.count()).toBe(ds.count())
  })

  it('adding an anchor changes at most 2 other rows', () => {
    const before = buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [reserved] })
    const after = buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [reserved, inRange] })
    const map = (rows: Q[]) => new Map(rows.map((r) => [r.id, JSON.stringify(r)]))
    const a = map(before.query().rows)
    const b = map(after.query().rows)
    const changed = new Set<number>()
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      if (id === inRange.id) continue
      if (a.get(id) !== b.get(id)) changed.add(id)
    }
    expect(changed.size).toBeLessThanOrEqual(2)
  })

  it('contributed anchors (seed phase) count as anchors, not additions', () => {
    const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    ds.addAnchors([anchor({ id: 900_050, subjectId: 2, levelId: 3, difficulty: 3 })], 'M05')
    expect(ds.count()).toBe(TOTAL)
    expect(ds.get(900_050)?.text).toBe('Anchor 900050')
    expect(ds.contributions().get('M05')).toEqual([900_050])
    expect(() => ds.addAnchors([anchor({ id: 900_051 })], 'M08')).toThrow(MockDbError)
  })
})

describe('paging', () => {
  const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [anchor({ id: 900_002 })] })
  const ref = materialise(ds)
  const where = { status: 'approved' as const, isActive: true }

  it('matches a materialised table at the boundaries (asc and desc)', () => {
    const total = ds.count(where)
    const lastPage = Math.ceil(total / 20)
    for (const sort of [undefined, { field: 'id' as const, dir: 'desc' as const }]) {
      for (const page of [1, 2, lastPage - 1, lastPage, lastPage + 1]) {
        expect(ds.query({ where, sort, page, pageSize: 20 })).toEqual(
          ref.query({ where, sort, page, pageSize: 20 }),
        )
      }
    }
    const last = ds.query({ where, page: lastPage, pageSize: 20 })
    expect(last.rows).toHaveLength(total - (lastPage - 1) * 20)
    expect(ds.query({ where, page: lastPage + 1, pageSize: 20 }).rows).toEqual([])
    expect(ds.query({ where, page: lastPage + 1, pageSize: 20 }).total).toBe(total)
  })

  it('validates page and pageSize like tables', () => {
    expect(() => ds.query({ page: 0, pageSize: 20 })).toThrow(MockDbError)
    expect(() => ds.query({ page: 1 })).toThrow(MockDbError)
    expect(ds.query({ pageSize: 3 }).rows).toHaveLength(3)
  })

  it('id conditions, derived-field conditions and match agree with the table', () => {
    const cases = [
      { where: { id: { gte: 1_000, lte: 1_500 } } },
      { where: { score: { gte: 90 } } },
      {
        where: { subjectId: 4 },
        match: (r: Q) => r.text.startsWith('Apakah'),
        cacheKey: 'text^=Apakah',
      },
    ]
    for (const { cacheKey, ...q } of cases) {
      expect(ds.count(q.where, q.match, { cacheKey })).toBe(ref.count(q.where, q.match))
      expect(ds.query({ ...q, cacheKey, page: 2, pageSize: 10 })).toEqual(
        ref.query({ ...q, page: 2, pageSize: 10 }),
      )
    }
  })

  it('requires cacheKey for a full-row match (dev/Vitest), not for matchFields', () => {
    const match = (r: Q) => r.score > 50
    expect(() => ds.count({}, match)).toThrow(/pass `cacheKey`/)
    expect(() => ds.query({ match, page: 1, pageSize: 5 })).toThrow(MockDbError)
    const withKey = ds.count({}, match, { cacheKey: 'score>50' })
    expect(withKey).toBe(ref.count({}, match))
    // A match that only reads facets needs no cacheKey (partial rows, no derivation).
    const facetOnly = (r: Q) => r.subjectId === 4 && r.difficulty === 2
    expect(ds.count({}, facetOnly, { matchFields: ['subjectId', 'difficulty'] })).toBe(
      ds.count({ subjectId: 4, difficulty: 2 }),
    )
  })

  it('facet sorts, order-field sorts and generic sorts agree with the table', () => {
    const sorts = [
      [{ field: 'subjectId' as const, dir: 'desc' as const }, { field: 'difficulty' as const }],
      [{ field: 'levelId' as const }, { field: 'id' as const, dir: 'desc' as const }],
      { field: 'createdAt' as const, dir: 'desc' as const },
      'createdAt' as const,
      [{ field: 'score' as const, dir: 'desc' as const }],
    ]
    for (const sort of sorts) {
      for (const page of [1, 5, 60]) {
        expect(ds.query({ where: { isActive: true }, sort, page, pageSize: 25 })).toEqual(
          ref.query({ where: { isActive: true }, sort, page, pageSize: 25 }),
        )
      }
    }
  })

  it('merges anchors into "newest first" by their own createdAt', () => {
    const late = anchor({
      id: 10,
      subjectId: 1,
      levelId: 1,
      createdAt: createdAtOf(3_000) + 30_000,
    })
    const d2 = buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [late] })
    const rows = d2.query({ sort: { field: 'createdAt', dir: 'desc' } }).rows
    const i = rows.findIndex((r) => r.id === 10)
    expect(rows[i - 1]!.createdAt).toBeGreaterThanOrEqual(late.createdAt)
    expect(rows[i + 1]!.createdAt).toBeLessThanOrEqual(late.createdAt)
    expect(d2.query({ sort: { field: 'createdAt', dir: 'desc' }, page: 3, pageSize: 40 })).toEqual(
      materialise(d2).query({ sort: { field: 'createdAt', dir: 'desc' }, page: 3, pageSize: 40 }),
    )
  })
})

describe('sample', () => {
  const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX })
  const ref = materialise(ds)

  it('draws distinct matching rows, identical to defineTable().sample with the same rng', () => {
    const where = { subjectId: [1, 2], isActive: true }
    const got = ds.sample(where, 15, mulberry32(42))
    expect(got).toEqual(ref.sample(where, 15, mulberry32(42)))
    expect(new Set(ids(got)).size).toBe(15)
    expect(got.every((r) => [1, 2].includes(r.subjectId) && r.isActive)).toBe(true)
  })

  it('returns every match when fewer than n', () => {
    const where = {
      subjectId: 1,
      levelId: 1,
      difficulty: 4,
      status: 'approved' as const,
      isActive: true,
    }
    const m = ds.count(where)
    expect(ds.sample(where, m + 10, mulberry32(1))).toHaveLength(m)
    expect(ds.sample(where, 0, mulberry32(1))).toEqual([])
  })
})

describe('overlay (runtime diff)', () => {
  function live() {
    const db = createDb()
    const ds = db.register(
      buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [anchor({ id: 900_003 })] }),
    )
    db.baseline()
    const events: CommitEvent[] = []
    db.onCommit((e) => void events.push(e))
    return { db, ds, events }
  }

  it('facet edits move counts exactly', () => {
    const { ds } = live()
    const target = ds.query({ where: { status: 'approved', subjectId: 2 }, page: 1, pageSize: 1 })
      .rows[0]!
    const approved = ds.count({ status: 'approved' })
    const archived = ds.count({ status: 'archived' })
    const sub2 = ds.groupCount('subjectId').get(2)!
    const v0 = ds.version
    const updated = ds.update(target.id, { status: 'archived', isActive: false, text: 'edited' })
    expect(updated).toMatchObject({ id: target.id, status: 'archived', text: 'edited' })
    expect(ds.version).toBeGreaterThan(v0)
    expect(ds.count({ status: 'approved' })).toBe(approved - 1)
    expect(ds.count({ status: 'archived' })).toBe(archived + 1)
    expect(ds.groupCount('subjectId').get(2)).toBe(sub2)
    expect(ds.count()).toBe(TOTAL)
    expect(
      ds
        .query({ where: { status: 'archived', subjectId: 2 } })
        .rows.some((r) => r.id === target.id),
    ).toBe(true)
  })

  it('deletes and inserts move the total; new facet combinations get a runtime cell', () => {
    const { ds } = live()
    const victim = ds.query({ page: 1, pageSize: 1 }).rows[0]!
    ds.remove(victim.id)
    expect(ds.get(victim.id)).toBeUndefined()
    expect(ds.count()).toBe(TOTAL - 1)
    const created = ds.insert({
      subjectId: 99,
      levelId: null,
      status: 'approved',
      isActive: true,
      difficulty: 5,
      text: 'new',
      score: 1,
      createdAt: createdAtOf(99_999),
    })
    expect(created.id).toBe(9_000_001)
    expect(ds.insert({ ...created, id: undefined }).id).toBe(9_000_002)
    expect(ds.count()).toBe(TOTAL + 1)
    expect(ds.count({ subjectId: 99 })).toBe(2)
    expect(ds.runtimeCellCount).toBe(1)
    expect(ds.query({ sort: { field: 'id', dir: 'desc' }, page: 1, pageSize: 1 }).rows[0]!.id).toBe(
      9_000_002,
    )
    expect(
      ds.query({ sort: { field: 'createdAt', dir: 'desc' }, page: 1, pageSize: 1 }).rows[0]!.id,
    ).toBe(9_000_001)
    expect(() => ds.insert({ ...created })).toThrow(MockDbError)
    expect(() => ds.update(424_242, { text: 'x' })).toThrow(MockDbError)
    expect(() => ds.remove(victim.id)).toThrow(MockDbError)
    expect(() => ds.update(created.id, { id: 5 })).toThrow(MockDbError)
  })

  it('diff / loadDiff / applyChanges reproduce the same state in another instance', () => {
    const { db, ds, events } = live()
    const [a, b] = ds.query({ page: 1, pageSize: 2 }).rows
    db.transaction(() => {
      ds.update(a!.id, { difficulty: 5 })
      ds.remove(b!.id)
      ds.insert({
        subjectId: 1,
        levelId: 1,
        status: 'approved',
        isActive: true,
        difficulty: 1,
        text: 'rt',
        score: 5,
        createdAt: 1,
      })
    })
    expect(events).toHaveLength(1)
    const changes = events[0]!.changes['test.questions'] as DatasetChanges<Q>
    expect(changes.overrides).toEqual([{ id: a!.id, patch: { difficulty: 5 } }])
    expect(changes.deletes).toEqual([b!.id])
    expect(changes.inserts.map((r) => r.id)).toEqual([9_000_001])

    const diff = ds.diff()
    expect(JSON.parse(JSON.stringify(diff))).toEqual(diff)

    const other = createDb()
    const ds2 = other.register(
      buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [anchor({ id: 900_003 })] }),
    )
    other.baseline()
    ds2.loadDiff(diff)
    expect(ds2.count({ difficulty: 5 })).toBe(ds.count({ difficulty: 5 }))
    expect(ds2.count()).toBe(ds.count())
    expect(ds2.get(a!.id)).toEqual(ds.get(a!.id))
    expect(
      ds2.insert({
        subjectId: 1,
        levelId: 1,
        status: 'approved',
        isActive: true,
        difficulty: 1,
        text: 'x',
        score: 0,
        createdAt: 2,
      }).id,
    ).toBe(9_000_002)

    const third = createDb()
    const ds3 = third.register(
      buildQuestions({ total: TOTAL, idMax: ID_MAX, anchors: [anchor({ id: 900_003 })] }),
    )
    third.baseline()
    ds3.applyChanges(changes)
    expect(ds3.diff()).toEqual(diff)
  })

  it('rollback restores rows, counts, cells and the id counter', () => {
    const { db, ds, events } = live()
    const row = ds.query({ where: { status: 'approved' }, page: 1, pageSize: 1 }).rows[0]!
    const before = {
      approved: ds.count({ status: 'approved' }),
      total: ds.count(),
      diff: ds.diff(),
    }
    expect(() =>
      db.transaction(() => {
        ds.update(row.id, { status: 'archived' })
        ds.remove(ds.query({ page: 2, pageSize: 1 }).rows[0]!.id)
        ds.insert({
          subjectId: 42,
          levelId: 1,
          status: 'approved',
          isActive: true,
          difficulty: 1,
          text: 'rt',
          score: 5,
          createdAt: 1,
        })
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(ds.get(row.id)).toEqual(row)
    expect(ds.count({ status: 'approved' })).toBe(before.approved)
    expect(ds.count()).toBe(before.total)
    expect(ds.count({ subjectId: 42 })).toBe(0)
    expect(ds.diff()).toEqual(before.diff)
    expect(events).toHaveLength(0)
    expect(
      ds.insert({
        subjectId: 1,
        levelId: 1,
        status: 'approved',
        isActive: true,
        difficulty: 1,
        text: 'ok',
        score: 5,
        createdAt: 1,
      }).id,
    ).toBe(9_000_001)
  })

  it('rejects writes in the seed phase and reset (clear) restores the spec', () => {
    const db = createDb()
    const ds = db.register(buildQuestions({ total: 500, idMax: 600 }))
    expect(() =>
      ds.insert({
        subjectId: 1,
        levelId: 1,
        status: 'approved',
        isActive: true,
        difficulty: 1,
        text: 'x',
        score: 0,
        createdAt: 0,
      }),
    ).toThrow(/seeded by its spec/)
    db.baseline()
    ds.remove(ds.query({ page: 1, pageSize: 1 }).rows[0]!.id)
    expect(ds.count()).toBe(499)
    db.reset()
    expect(ds.compiled).toBe(false)
    db.baseline()
    expect(ds.count()).toBe(500)
    expect(ds.diff()).toEqual({
      kind: 'dataset',
      overrides: [],
      deletes: [],
      inserts: [],
      ids: null,
    })
  })

  it('every query mode still agrees with a materialised table after mutations', () => {
    const { ds } = live()
    const rows = ds.query({ where: { subjectId: 5 }, page: 1, pageSize: 6 }).rows
    ds.update(rows[0]!.id, { subjectId: 6, createdAt: createdAtOf(10) })
    ds.update(rows[1]!.id, { text: 'Apakah diedit', score: 100 })
    ds.remove(rows[2]!.id)
    ds.insert({
      id: 900_050,
      subjectId: 6,
      levelId: 2,
      status: 'approved',
      isActive: true,
      difficulty: 2,
      text: 'reserved insert',
      score: 3,
      createdAt: createdAtOf(20),
    })
    ds.insert({
      subjectId: 5,
      levelId: null,
      status: 'approved',
      isActive: true,
      difficulty: 1,
      text: 'runtime',
      score: 50,
      createdAt: createdAtOf(1),
    })
    const ref = materialise(ds)
    const queries = [
      { where: { subjectId: [5, 6] } },
      { where: { subjectId: [5, 6] }, sort: { field: 'id' as const, dir: 'desc' as const } },
      { where: { isActive: true }, sort: { field: 'createdAt' as const, dir: 'desc' as const } },
      {
        where: { isActive: true },
        sort: [{ field: 'subjectId' as const }, { field: 'id' as const, dir: 'desc' as const }],
      },
      { where: { id: { gte: 800_000 } } },
      { where: { score: { gte: 99 } }, sort: { field: 'score' as const, dir: 'desc' as const } },
    ]
    for (const q of queries) {
      for (const page of [1, 2, 3]) {
        expect(ds.query({ ...q, page, pageSize: 7 })).toEqual(
          ref.query({ ...q, page, pageSize: 7 }),
        )
      }
      expect(ds.count(q.where)).toBe(ref.count(q.where))
    }
    expect(ds.groupCount('subjectId')).toEqual(ref.groupCount('subjectId'))
    expect(ds.groupCount('score', { subjectId: 6 })).toEqual(
      ref.groupCount('score', { subjectId: 6 }),
    )
    expect(ds.sample({ subjectId: 6 }, 5, mulberry32(3))).toEqual(
      ref.sample({ subjectId: 6 }, 5, mulberry32(3)),
    )
  })

  it('caches slow-path results per version', () => {
    const calls = { n: 0 }
    const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX, deriveCalls: calls })
    const match = (r: Q) => r.score > 50
    const first = ds.count({}, match, { cacheKey: 'score>50' })
    const after = calls.n
    // A new closure with the same cacheKey (the next request) hits the cache.
    expect(ds.count({}, (r: Q) => r.score > 50, { cacheKey: 'score>50' })).toBe(first)
    expect(calls.n).toBe(after)
    expect(ds.query({ match, cacheKey: 'score>50', page: 2, pageSize: 10 }).total).toBe(first)
  })
})

describe('spec overrides, feasibility and named queries', () => {
  it('overrideSpec changes every dependent count together', () => {
    const ds = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    ds.overrideSpec((cells) => [
      ...cells,
      {
        facets: { subjectId: 3, levelId: 10, status: 'approved', isActive: true, difficulty: 4 },
        count: 10,
      },
    ])
    expect(ds.feasibility().issues.map((i) => i.code)).toEqual(['TOTAL'])
    const ok = buildQuestions({ total: TOTAL, idMax: ID_MAX })
    const sub3 = ok.count({ subjectId: 3 })
    const ds2 = defineVirtualDataset<
      Q,
      'subjectId' | 'levelId' | 'status' | 'isActive' | 'difficulty'
    >({
      name: 'q2',
      idRange: { min: 1, max: ID_MAX },
      runtimeIds: floor({ start: 9_000_001 }),
      facets: ['subjectId', 'levelId', 'status', 'isActive', 'difficulty'],
      distribution: () => questionCells(TOTAL),
      derive: () => ({ text: '', score: 0, createdAt: 0 }),
    })
    ds2.overrideSpec((cells) => [
      ...cells,
      {
        facets: { subjectId: 3, levelId: 10, status: 'approved', isActive: true, difficulty: 4 },
        count: 10,
      },
    ])
    expect(ds2.count()).toBe(TOTAL + 10)
    expect(ds2.count({ subjectId: 3 })).toBe(sub3 + 10)
    expect(() => ds2.overrideSpec((c) => c)).toThrow(MockDbError)
  })

  const base = () =>
    defineVirtualDataset<Q, 'subjectId' | 'levelId' | 'status' | 'isActive' | 'difficulty'>({
      name: 'bad',
      total: 30,
      idRange: { min: 1, max: 100 },
      reservedAnchorRanges: [[1_000, 1_099]],
      runtimeIds: floor({ start: 2_000 }),
      facets: ['subjectId', 'levelId', 'status', 'isActive', 'difficulty'],
      distribution: exact([
        {
          facets: { subjectId: 1, levelId: 1, status: 'approved', isActive: true, difficulty: 1 },
          count: 20,
        },
        {
          facets: { subjectId: 2, levelId: 1, status: 'approved', isActive: true, difficulty: 1 },
          count: 1,
        },
        {
          facets: {
            subjectId: 3,
            levelId: null,
            status: 'archived',
            isActive: false,
            difficulty: 2,
          },
          count: 9,
        },
      ]),
      derive: () => ({ text: '', score: 0, createdAt: 0 }),
    })

  it('passes a feasible spec', () => {
    const ds = base()
    expect(assertFeasible(ds)).toMatchObject({ ok: true, total: 30, cells: 3 })
  })

  it('fails on a total mismatch, bad cells, overflowing or homeless anchors, and bad ranges', () => {
    const cases: [string, (ds: ReturnType<typeof base>) => void][] = [
      ['TOTAL', (ds) => ds.overrideSpec((c) => c.slice(1))],
      [
        'CELL',
        (ds) => ds.overrideSpec((c) => [...c, { facets: { subjectId: 9 } as never, count: 0 }]),
      ],
      [
        'ANCHOR_OVERFLOW',
        (ds) =>
          ds.addAnchors([anchor({ id: 5, subjectId: 2 }), anchor({ id: 6, subjectId: 2 })], 'T'),
      ],
      ['ANCHOR_NO_CELL', (ds) => ds.addAnchors([anchor({ id: 5, subjectId: 7 })], 'T')],
      ['ANCHOR_ID', (ds) => ds.addAnchors([anchor({ id: 500 })], 'T')],
      ['ANCHOR_ID', (ds) => ds.addAnchors([anchor({ id: 5 }), anchor({ id: 5 })], 'T')],
    ]
    for (const [code, mutate] of cases) {
      const ds = base()
      mutate(ds)
      const report = checkFeasibility(ds)
      expect(report.ok, code).toBe(false)
      expect(report.issues.map((i) => i.code)).toContain(code)
      expect(() => ds.compile()).toThrow(DatasetSpecError)
    }
  })

  it('fails when the id range cannot hold the slots or the runtime floor is not above the anchors', () => {
    const mk = (idMax: number, start: number, strategy = floor({ start })) =>
      defineVirtualDataset<Q, 'subjectId'>({
        name: 'r',
        idRange: { min: 1, max: idMax },
        reservedAnchorRanges: [[1_000, 1_099]],
        runtimeIds: strategy,
        facets: ['subjectId'],
        distribution: [{ facets: { subjectId: 1 }, count: 50 }],
        derive: () => ({
          levelId: 1,
          status: 'approved',
          isActive: true,
          difficulty: 1,
          text: '',
          score: 0,
          createdAt: 0,
        }),
      })
    expect(
      mk(40, 2_000)
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['RANGE'])
    expect(
      mk(100, 1_050)
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['RANGE'])
    expect(
      mk(100, 2_000, maxPlusOne())
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['RANGE'])
    expect(mk(100, 2_000).feasibility().ok).toBe(true)
  })

  it('surfaces fit2d infeasibility from a distribution thunk', () => {
    const ds = defineVirtualDataset<Q, 'subjectId'>({
      name: 'thunk',
      idRange: { min: 1, max: 100 },
      runtimeIds: floor({ start: 1_000 }),
      facets: ['subjectId'],
      distribution: () => {
        throw new DatasetSpecError('fit2d', [{ code: 'INFEASIBLE', message: 'no' }])
      },
      derive: () => ({
        levelId: 1,
        status: 'approved',
        isActive: true,
        difficulty: 1,
        text: '',
        score: 0,
        createdAt: 0,
      }),
    })
    expect(ds.feasibility().issues[0]?.code).toBe('INFEASIBLE')
  })

  it('named queries compute counts and check documented values', () => {
    const ds = base()
    const Q = defineNamedQueries(ds, {
      'Q-ALL': { expected: 30, source: 'test' },
      'Q-ELIGIBLE': { where: { status: 'approved', isActive: true }, expected: 21 },
      'Q-SUBJECT': {
        where: (subjectId: number) => ({ subjectId }),
        expected: [
          { args: [1], value: 20 },
          { args: [3], value: 9 },
        ],
      },
    })
    expect(Q['Q-ALL'].count()).toBe(30)
    expect(Q['Q-SUBJECT'].count(2)).toBe(1)
    expect(Q['Q-SUBJECT'].query({ page: 1, pageSize: 5 }, 3).total).toBe(9)
    expect(Q['Q-ELIGIBLE'].groupCount('subjectId')).toEqual(
      new Map([
        [1, 20],
        [2, 1],
      ]),
    )
    expect(assertFeasible(ds, Q).ok).toBe(true)

    const wrong = defineNamedQueries(ds, { 'Q-ALL': { expected: 31, source: 'M04 §4.1' } })
    const report = checkFeasibility(ds, wrong)
    expect(report.ok).toBe(false)
    expect(report.issues[0]?.message).toMatch(/Q-ALL\(\) = 30, documented 31/)
  })
})

describe('layout blocks', () => {
  interface U {
    id: number
    createdBy: number
    subjectId: number
  }
  const make = (fromId: number) =>
    defineVirtualDataset<U, 'createdBy' | 'subjectId'>({
      name: 'blocks',
      idRange: { min: 1, max: 2_000 },
      runtimeIds: floor({ start: 10_000 }),
      facets: ['createdBy', 'subjectId'],
      distribution: [
        { facets: { createdBy: 1, subjectId: 1 }, count: 60 },
        { facets: { createdBy: 1, subjectId: 2 }, count: 40 },
        { facets: { createdBy: 7, subjectId: 1 }, count: 900 },
        { facets: { createdBy: 7, subjectId: 2 }, count: 500 },
      ],
      derive: () => ({}),
      layout: {
        blocks: [{ cells: (f) => f.createdBy === 1, fromId, contiguous: true, label: 'user-1' }],
      },
    })

  it('places a contiguous block from its first id, in ascending order', () => {
    const ds = make(1_000)
    const mine = ds.query({ where: { createdBy: 1 } }).rows.map((r) => r.id)
    expect(mine).toHaveLength(100)
    expect(mine[0]).toBeGreaterThanOrEqual(1_000)
    const all = ds.query().rows.map((r) => r.id)
    const start = all.indexOf(mine[0]!)
    expect(all.slice(start, start + 100)).toEqual(mine)
    expect(ds.count({ createdBy: 1, subjectId: 2 })).toBe(40)
  })

  it('fails when the block does not fit', () => {
    expect(
      make(1_990)
        .feasibility()
        .issues.map((i) => i.code),
    ).toEqual(['LAYOUT'])
  })
})

describe('string ids (codec)', () => {
  interface S {
    id: string
    mode: string
    userId: number
  }
  const RESERVED = 900_000
  const make = () =>
    defineVirtualDataset<S, 'mode'>({
      name: 'practice.sessions',
      idRange: { min: 1, max: 1_000 },
      reservedAnchorRanges: [[RESERVED, RESERVED + 99]],
      runtimeIds: opaque('s_', 'sessions', 12),
      idCodec: {
        encode: (k) => (k >= RESERVED ? `A${String(k - RESERVED)}` : `g${String(k)}`),
        decode: (id) => {
          const m = /^(g|A)(\d+)$/.exec(id)
          if (!m) return undefined
          return m[1] === 'g' ? Number(m[2]) : RESERVED + Number(m[2])
        },
      },
      facets: ['mode'],
      distribution: [
        { facets: { mode: 'random' }, count: 990 },
        { facets: { mode: 'latih_tubi' }, count: 10 },
      ],
      derive: (_id, _f, rng) => ({ userId: rng.int(1, 6_000) }),
      anchors: [
        { id: 'A2', mode: 'latih_tubi', userId: 1 },
        { id: 'A3', mode: 'latih_tubi', userId: 1 },
      ],
    })

  it('supports string ids, anchors in a reserved key range and opaque runtime ids', () => {
    const db = createDb()
    const ds = db.register(make())
    db.baseline()
    expect(ds.count()).toBe(1_000)
    expect(ds.get('A2')).toEqual({ id: 'A2', mode: 'latih_tubi', userId: 1 })
    expect(ds.get('g1')?.id).toBe('g1')
    expect(ds.count({ mode: 'latih_tubi' })).toBe(10)
    const created = ds.insert({ mode: 'random', userId: 5 })
    expect(created.id).toMatch(/^s_/)
    expect(ds.query({ sort: { field: 'id', dir: 'desc' }, page: 1, pageSize: 1 }).rows[0]).toEqual(
      created,
    )
    expect(ds.count({ mode: 'random' })).toBe(991)
    expect(ds.diff().inserts).toEqual([created])
  })
})
