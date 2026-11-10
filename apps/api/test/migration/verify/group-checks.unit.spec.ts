/** M-D: the pure comparison of the stimulus groups against the V2 plan (member count, order, positions, no split, no ungrouped member). */
import { describe, expect, it } from 'vitest'

import { compareGroups, findingsTotal, positionsAreContiguous, type ActualMember } from '../../../src/migration/verify/group-checks'

const expected = [{ key: 'g:1:approved', members: ['1', '2', '3'] }]
const members = (...x: [string, number][]): ActualMember[] => x.map(([legacyId, position]) => ({ legacyId, position }))
const make = (over: { loaded?: [string, string | null][]; groupIdOf?: [string, string][]; actual?: ActualMember[] }) =>
  compareGroups({
    expected,
    loaded: new Map(over.loaded ?? [['1', '10'], ['2', '10'], ['3', '10']]),
    groupIdOf: new Map(over.groupIdOf ?? [['g:1:approved', '10']]),
    actual: new Map([['10', over.actual ?? members(['1', 1], ['2', 2], ['3', 3])]]),
  })

describe('compareGroups', () => {
  it('passes a complete group in V2 order at positions 1..n', () => {
    const f = make({})
    expect(findingsTotal(f)).toBe(0)
    expect(f).toMatchObject({ groups: 1, members: 3 })
  })

  it('compares the loaded members only (a quarantined planned member is absent on both sides)', () => {
    const f = make({ loaded: [['1', '10'], ['3', '10']], actual: members(['1', 1], ['3', 2]) })
    expect(findingsTotal(f)).toBe(0)
  })

  it('flags a wrong member count (a late member never attached, or an extra one)', () => {
    expect(make({ loaded: [['1', '10'], ['2', '10'], ['3', null]], actual: members(['1', 1], ['2', 2]) }).countMismatch).toEqual(['g:1:approved (2 of 3)'])
    expect(make({ actual: members(['1', 1], ['2', 2], ['3', 3], ['9', 4]) }).countMismatch).toEqual(['g:1:approved (4 of 3)'])
  })

  it('flags a split group (a member in no group or in another group)', () => {
    expect(make({ loaded: [['1', '10'], ['2', null], ['3', '10']] }).split).toEqual(['g:1:approved'])
    expect(make({ loaded: [['1', '10'], ['2', '11'], ['3', '10']] }).split).toEqual(['g:1:approved'])
  })

  it('flags a gap or a duplicate in group_position, and members out of V2 order', () => {
    expect(make({ actual: members(['1', 1], ['2', 2], ['3', 4]) }).positionGaps).toEqual(['g:1:approved'])
    expect(make({ actual: members(['1', 1], ['2', 2], ['3', 2]) }).positionGaps).toEqual(['g:1:approved'])
    expect(make({ actual: members(['2', 1], ['1', 2], ['3', 3]) }).orderMismatch).toEqual(['g:1:approved'])
  })

  it('flags a planned group that has no group row', () => {
    expect(make({ groupIdOf: [] }).missingGroup).toEqual(['g:1:approved'])
  })

  it('positionsAreContiguous', () => {
    expect(positionsAreContiguous([3, 1, 2])).toBe(true)
    expect(positionsAreContiguous([])).toBe(true)
    expect(positionsAreContiguous([1, 3])).toBe(false)
  })
})
