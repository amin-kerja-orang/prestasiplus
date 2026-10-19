import { describe, expect, it } from 'vitest'

import { anchorUserIds, isAnchorUser } from '../../mock'
import { USER_ANCHOR_BLOCKS, USER_ANCHOR_ROWS } from '../../mock/datasets/users-anchors'

describe('isAnchorUser / anchorUserIds', () => {
  it('list exactly the ids of USER_ANCHOR_ROWS, ascending and unique', () => {
    const ids = anchorUserIds()
    expect(ids).toEqual(USER_ANCHOR_ROWS.map((row) => row.id))
    expect(ids.length).toBeGreaterThan(11)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort((a, b) => a - b)).toEqual([...ids])
    expect(anchorUserIds()).toBe(ids)
  })

  it('isAnchorUser is true for every anchor block and for no other id', () => {
    for (const id of USER_ANCHOR_BLOCKS.canonical) expect(isAnchorUser(id)).toBe(true)
    for (const id of USER_ANCHOR_BLOCKS.m11) expect(isAnchorUser(id)).toBe(true)
    for (const id of anchorUserIds()) expect(isAnchorUser(id)).toBe(true)
    // Generated users of the live range, runtime users and nonsense are not anchors.
    for (const id of [12, 6000, 9_000_001, 0, -1, 1.5, Number.NaN]) {
      expect(isAnchorUser(id)).toBe(false)
    }
  })
})
