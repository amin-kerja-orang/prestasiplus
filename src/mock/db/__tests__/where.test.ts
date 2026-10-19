import { describe, expect, it } from 'vitest'

import { MockDbError } from '../errors'
import { compareValues, compileSort, matchesWhere } from '../where'

interface R {
  id: number
  status: string | null
  n?: number | null
  at?: string
  d?: Date
}

describe('matchesWhere', () => {
  const row: R = { id: 1, status: 'approved', n: 5, at: '2026-09-25T10:00:00+08:00' }

  it('value and value[]', () => {
    expect(matchesWhere(row, { status: 'approved' })).toBe(true)
    expect(matchesWhere(row, { status: 'draft' })).toBe(false)
    expect(matchesWhere(row, { status: ['draft', 'approved'] })).toBe(true)
    expect(matchesWhere(row, { status: [] })).toBe(false)
  })

  it('{ne} uses JS semantics (nullish values match unless ne is null)', () => {
    expect(matchesWhere(row, { status: { ne: 'draft' } })).toBe(true)
    expect(matchesWhere(row, { status: { ne: 'approved' } })).toBe(false)
    const nullRow: R = { id: 2, status: null }
    expect(matchesWhere(nullRow, { status: { ne: 'draft' } })).toBe(true)
    expect(matchesWhere(nullRow, { status: { ne: null } })).toBe(false)
  })

  it('{gte, lte} inclusive, on numbers and ISO strings; nullish never matches', () => {
    expect(matchesWhere(row, { n: { gte: 5, lte: 5 } })).toBe(true)
    expect(matchesWhere(row, { n: { gte: 6 } })).toBe(false)
    expect(matchesWhere(row, { n: { lte: 4 } })).toBe(false)
    expect(matchesWhere(row, { at: { gte: '2026-09-25T00:00:00+08:00' } })).toBe(true)
    expect(matchesWhere<R>({ id: 3, status: 'x', n: null }, { n: { gte: 0 } })).toBe(false)
  })

  it('a range with no defined bound is no condition (null rows are kept)', () => {
    expect(
      matchesWhere<R>({ id: 3, status: 'x', n: null }, { n: { gte: undefined, lte: undefined } }),
    ).toBe(true)
    expect(matchesWhere<R>({ id: 3, status: 'x' }, { n: { gte: undefined } })).toBe(true)
  })

  it('{isNull} and null equality cover null and undefined', () => {
    expect(matchesWhere<R>({ id: 3, status: 'x' }, { n: { isNull: true } })).toBe(true)
    expect(matchesWhere<R>({ id: 3, status: 'x', n: null }, { n: null })).toBe(true)
    expect(matchesWhere(row, { n: { isNull: false } })).toBe(true)
    expect(matchesWhere(row, { n: { isNull: true } })).toBe(false)
  })

  it('Dates compare by time; undefined conditions are ignored; match is ANDed', () => {
    const d = { id: 4, status: 'x', d: new Date(1000) }
    expect(matchesWhere(d, { d: new Date(1000) })).toBe(true)
    expect(matchesWhere(d, { d: { gte: new Date(999) } })).toBe(true)
    expect(matchesWhere(row, { status: undefined })).toBe(true)
    expect(matchesWhere(row, {}, (r) => r.n === 5)).toBe(true)
    expect(matchesWhere(row, { status: 'approved' }, () => false)).toBe(false)
  })

  it('rejects malformed conditions', () => {
    const bad = { status: { foo: 1 } } as unknown as Parameters<typeof matchesWhere<R>>[1]
    expect(() => matchesWhere(row, bad)).toThrow(MockDbError)
    const mixed = { n: { ne: 1, gte: 0 } } as unknown as Parameters<typeof matchesWhere<R>>[1]
    expect(() => matchesWhere(row, mixed)).toThrow(/ne stands alone/)
  })
})

describe('sorting', () => {
  it('compareValues: nullish first, numbers numeric, strings by code unit', () => {
    expect([3, null, 10, 2].sort(compareValues)).toEqual([null, 2, 3, 10])
    expect(['b', 'a', 'B'].sort(compareValues)).toEqual(['B', 'a', 'b'])
  })

  it('compileSort: multi-key, desc puts nulls last, ties keep input order (stable)', () => {
    const rows: R[] = [
      { id: 1, status: 'b', n: 1 },
      { id: 2, status: 'a', n: null },
      { id: 3, status: 'a', n: 2 },
      { id: 4, status: 'b', n: 1 },
    ]
    const byStatusThenNDesc = rows
      .slice()
      .sort(compileSort<R>(['status', { field: 'n', dir: 'desc' }]))
    expect(byStatusThenNDesc.map((r) => r.id)).toEqual([3, 2, 1, 4])
  })
})
