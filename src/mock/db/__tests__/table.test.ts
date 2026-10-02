import { describe, expect, it } from 'vitest'

import { mulberry32 } from '../../determinism/prng'
import { MockDbError } from '../errors'
import { maxPlusOne, opaque, sequence } from '../id-strategies'
import { defineTable } from '../table'

interface Session {
  id: number
  userId: number
  status: 'in_progress' | 'completed'
  subjectId: number | null
  correct: number
  createdAt: string
}

function sessions() {
  const t = defineTable<Session>({
    name: 'practice.sessions',
    ids: maxPlusOne(),
    indexes: ['userId', 'status', 'subjectId'],
  })
  const rows: Omit<Session, 'id'>[] = [
    {
      userId: 7,
      status: 'completed',
      subjectId: 1,
      correct: 8,
      createdAt: '2026-09-20T10:00:00+08:00',
    },
    {
      userId: 7,
      status: 'completed',
      subjectId: 2,
      correct: 3,
      createdAt: '2026-09-22T10:00:00+08:00',
    },
    {
      userId: 7,
      status: 'in_progress',
      subjectId: 1,
      correct: 0,
      createdAt: '2026-09-25T09:00:00+08:00',
    },
    {
      userId: 8,
      status: 'completed',
      subjectId: null,
      correct: 5,
      createdAt: '2026-09-21T10:00:00+08:00',
    },
    {
      userId: 8,
      status: 'completed',
      subjectId: 1,
      correct: 5,
      createdAt: '2026-09-23T10:00:00+08:00',
    },
  ]
  for (const row of rows) t.insert(row)
  return t
}

describe('defineTable: reads', () => {
  it('get / getMany / has / size', () => {
    const t = sessions()
    expect(t.size).toBe(5)
    expect(t.get(2)?.subjectId).toBe(2)
    expect(t.get(99)).toBeUndefined()
    expect(t.has(5)).toBe(true)
    expect(t.getMany([5, 99, 1]).map((r) => r.id)).toEqual([5, 1])
  })

  it('query: default ascending id; where through indexes and scans agree', () => {
    const t = sessions()
    expect(t.query().rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5])
    expect(t.query({ where: { userId: 7, status: 'completed' } }).rows.map((r) => r.id)).toEqual([
      1, 2,
    ])
    expect(t.query({ where: { subjectId: { isNull: true } } }).rows.map((r) => r.id)).toEqual([4])
    expect(t.query({ where: { subjectId: [2, null] } }).rows.map((r) => r.id)).toEqual([2, 4])
    // Non-indexed field → scan.
    expect(t.query({ where: { correct: { gte: 5 } } }).rows.map((r) => r.id)).toEqual([1, 4, 5])
    expect(t.query({ match: (r) => r.createdAt >= '2026-09-22' }).total).toBe(3)
  })

  it('query: sort (multi-key, desc, stable) and Laravel-style paging', () => {
    const t = sessions()
    const newest = t.query({ sort: { field: 'createdAt', dir: 'desc' } })
    expect(newest.rows.map((r) => r.id)).toEqual([3, 5, 2, 4, 1])
    const byCorrect = t.query({ sort: [{ field: 'correct', dir: 'desc' }] })
    expect(byCorrect.rows.map((r) => r.id)).toEqual([1, 4, 5, 2, 3]) // 4 and 5 tie → id order
    const page2 = t.query({ sort: 'createdAt', page: 2, pageSize: 2 })
    expect(page2).toEqual({ rows: [t.get(2), t.get(5)], total: 5 })
    expect(t.query({ page: 9, pageSize: 2 })).toEqual({ rows: [], total: 5 })
    expect(t.query({ pageSize: 3 }).rows).toHaveLength(3)
    expect(() => t.query({ page: 1 })).toThrow(MockDbError)
    expect(() => t.query({ page: 0, pageSize: 2 })).toThrow(MockDbError)
  })

  it('count and groupCount', () => {
    const t = sessions()
    expect(t.count()).toBe(5)
    expect(t.count({ status: 'completed' })).toBe(4)
    expect(t.count({ userId: 8 }, (r) => r.correct > 4)).toBe(2)
    expect(t.groupCount('subjectId')).toEqual(
      new Map<number | null, number>([
        [1, 3],
        [2, 1],
        [null, 1],
      ]),
    )
    expect(t.groupCount('userId', { status: 'completed' })).toEqual(
      new Map([
        [7, 2],
        [8, 2],
      ]),
    )
  })

  it('sample: n distinct matches, deterministic for a seeded rng', () => {
    const t = sessions()
    const a = t.sample({ status: 'completed' }, 3, mulberry32(1))
    const b = t.sample({ status: 'completed' }, 3, mulberry32(1))
    expect(a).toEqual(b)
    expect(new Set(a.map((r) => r.id)).size).toBe(3)
    expect(a.every((r) => r.status === 'completed')).toBe(true)
    expect(t.sample({ userId: 8 }, 10, mulberry32(2))).toHaveLength(2)
    expect(t.sample({ userId: 99 }, 3, mulberry32(2))).toEqual([])
    expect(() => t.sample({}, -1, mulberry32(2))).toThrow(MockDbError)
  })
})

describe('defineTable: writes', () => {
  it('insert allocates ids by strategy or keeps an explicit id', () => {
    const t = defineTable<{ id: number; name: string }>({
      name: 'links',
      ids: sequence({ runtimeStart: 1000 }),
    })
    expect(t.insert({ id: 3, name: 'seeded' }).id).toBe(3)
    expect(t.insert({ name: 'runtime' }).id).toBe(1000)
    expect(t.insert({ name: 'runtime 2' }).id).toBe(1001)
    expect(() => t.insert({ id: 3, name: 'dup' })).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_ID' }),
    )
    expect(() => t.insert({ id: 1.5, name: 'bad' })).toThrow(MockDbError)
  })

  it('string ids through opaque()', () => {
    const t = defineTable<{ id: string; userId: number }>({
      name: 'auth.sessions',
      ids: opaque('tok_', 'auth:tokens'),
    })
    const row = t.insert({ userId: 1 })
    expect(row.id).toMatch(/^tok_[0-9A-Za-z]{40}$/)
    expect(t.get(row.id)).toBe(row)
  })

  it('update merges, keeps indexes in sync, refuses id changes and unknown ids', () => {
    const t = sessions()
    const updated = t.update(3, { status: 'completed', correct: 6 })
    expect(updated).toMatchObject({ id: 3, status: 'completed', correct: 6, userId: 7 })
    expect(t.count({ status: 'in_progress' })).toBe(0)
    expect(t.query({ where: { status: 'completed', userId: 7 } }).total).toBe(3)
    expect(() => t.update(3, { id: 4 })).toThrow(expect.objectContaining({ code: 'ID_CHANGE' }))
    expect(() => t.update(99, { correct: 1 })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('remove deletes the row and its index entries; unknown id throws', () => {
    const t = sessions()
    t.remove(1)
    expect(t.get(1)).toBeUndefined()
    expect(t.count({ subjectId: 1 })).toBe(2)
    expect(t.query().rows.map((r) => r.id)).toEqual([2, 3, 4, 5])
    expect(() => t.remove(1)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    // maxPlusOne does not reuse the deleted id.
    expect(
      t.insert({ userId: 1, status: 'completed', subjectId: 1, correct: 1, createdAt: 'x' }).id,
    ).toBe(6)
  })

  it('stored rows are frozen copies', () => {
    const t = sessions()
    const input = {
      userId: 1,
      status: 'completed' as const,
      subjectId: 1,
      correct: 1,
      createdAt: 'x',
    }
    const row = t.insert(input)
    expect(row).not.toBe(input)
    expect(Object.isFrozen(row)).toBe(true)
    expect(() => {
      ;(row as { correct: number }).correct = 9
    }).toThrow(TypeError)
  })

  it('rejects indexing the primary key', () => {
    expect(() =>
      defineTable<{ id: number }>({ name: 'x', ids: maxPlusOne(), indexes: ['id'] }),
    ).toThrow(MockDbError)
  })
})

describe('defineTable: change tracking (F-07 diff)', () => {
  it('seed writes are not tracked; live writes are a diff against the baseline', () => {
    const t = sessions()
    t.markBaseline()
    expect(t.diff()).toEqual({ kind: 'table', upserts: [], deletes: [], ids: null })

    t.update(1, { correct: 9 })
    t.remove(2)
    const created = t.insert({
      userId: 9,
      status: 'in_progress',
      subjectId: 1,
      correct: 0,
      createdAt: 'y',
    })
    const temp = t.insert({
      userId: 9,
      status: 'in_progress',
      subjectId: 1,
      correct: 0,
      createdAt: 'z',
    })
    t.remove(temp.id) // runtime insert + delete leaves no trace

    expect(t.diff()).toEqual({
      kind: 'table',
      upserts: [t.get(1), created],
      deletes: [2],
      ids: { kind: 'maxPlusOne', hw: 7 },
    })
  })

  it('loadDiff on a fresh seed rebuilds the same state (write → rebuild → identical)', () => {
    const a = sessions()
    a.markBaseline()
    a.update(4, { correct: 1 })
    a.remove(5)
    a.insert({ userId: 1, status: 'completed', subjectId: 2, correct: 2, createdAt: 'q' })
    const stored = structuredClone(a.diff())

    const b = sessions()
    b.markBaseline()
    b.loadDiff(stored)
    expect(b.query().rows).toEqual(a.query().rows)
    expect(b.diff()).toEqual(a.diff())
    expect(
      b.insert({ userId: 1, status: 'completed', subjectId: 2, correct: 2, createdAt: 'r' }).id,
    ).toBe(7)
  })

  it('loadDiff / applyChanges need the baseline', () => {
    const t = sessions()
    expect(() => t.loadDiff({ kind: 'table', upserts: [], deletes: [], ids: null })).toThrow(
      expect.objectContaining({ code: 'PHASE' }),
    )
  })

  it('clear() empties the table and returns to the seed phase', () => {
    const t = sessions()
    t.markBaseline()
    t.update(1, { correct: 0 })
    t.clear()
    expect(t.size).toBe(0)
    expect(t.count({ userId: 7 })).toBe(0)
    expect(t.diff()).toEqual({ kind: 'table', upserts: [], deletes: [], ids: null })
    expect(
      t.insert({ userId: 1, status: 'completed', subjectId: 1, correct: 1, createdAt: 'x' }).id,
    ).toBe(1)
  })
})

describe('review fixes', () => {
  it('groupCount normalises keys like where: null/undefined one group, Dates by epoch ms', () => {
    interface G {
      id: number
      tag?: string | null
      at?: Date
    }
    const t = defineTable<G>({ name: 'g', ids: maxPlusOne(), indexes: ['tag'] })
    t.insert({ tag: null, at: new Date(1000) })
    t.insert({ at: new Date(1000) })
    t.insert({ tag: 'a', at: new Date(2000) })
    expect(t.groupCount('tag')).toEqual(
      new Map<string | null, number>([
        [null, 2],
        ['a', 1],
      ]),
    )
    expect(t.count({ tag: null })).toBe(2)
    expect(t.groupCount('at')).toEqual(
      new Map<unknown, number>([
        [1000, 2],
        [2000, 1],
      ]),
    )
  })

  it('applyChanges merges the id counter monotonically; loadDiff overwrites', () => {
    const t = sessions()
    t.markBaseline()
    const row = {
      userId: 1,
      status: 'completed' as const,
      subjectId: 1,
      correct: 1,
      createdAt: 'x',
    }
    t.insert(row) // 6
    t.insert(row) // 7
    t.remove(7)
    // A stale broadcast from another tab with a lower counter must not rewind this tab.
    t.applyChanges({ kind: 'table', upserts: [], deletes: [], ids: { kind: 'maxPlusOne', hw: 6 } })
    expect(t.insert(row).id).toBe(8)
    // A higher counter from another tab moves it forward.
    t.applyChanges({ kind: 'table', upserts: [], deletes: [], ids: { kind: 'maxPlusOne', hw: 20 } })
    expect(t.insert(row).id).toBe(21)
    // Hydrate replaces the counter as stored.
    t.loadDiff({ kind: 'table', upserts: [], deletes: [], ids: { kind: 'maxPlusOne', hw: 10 } })
    expect(t.diff().ids).toEqual({ kind: 'maxPlusOne', hw: 10 })
  })
})
