import { describe, expect, it } from 'vitest'

import { countedIds } from '../src/choose-n'
import { effectiveMarks } from '../src/paper-model'

/** 45 section 5.4 rule 4 (FR-QA-41): in "Pilih N" a stimulus group is ONE choice unit. */
describe('Pilih N choice units', () => {
  const marks = [4, 3, 3, 1]
  const groups = ['G', 'G', undefined, undefined] as const

  it('[CI] Pilih 2 of 3 units (one 2-member group): the group counts as one unit and the best 2 units count', () => {
    // units: G (g1+g2 = 7 marks, one unit), s1 (3), s2 (1)
    const cands = [
      { id: 'g1', attempted: true, awarded: 2, groupId: 'G' },
      { id: 'g2', attempted: true, awarded: 1, groupId: 'G' },
      { id: 's1', attempted: true, awarded: 1 },
      { id: 's2', attempted: true, awarded: 3 },
    ]
    // G = 3, s1 = 1, s2 = 3: G (lower position on the tie) and s2 count; s1 does not.
    expect(countedIds(cands, 2)).toEqual(['g1', 'g2', 's2'])
    expect(countedIds(cands, 1)).toEqual(['g1', 'g2'])
  })

  it('[CI] effectiveMarks sums a group as one unit and keeps the best N units', () => {
    expect(effectiveMarks({ type: 'choose', n: 2 }, marks, groups)).toBe(7 + 3)
    // without group info every question is its own unit (unchanged)
    expect(effectiveMarks({ type: 'choose', n: 2 }, marks)).toBe(4 + 3)
  })

  it('[CI] a group is attempted when any member is, and a ticked member fills a free slot with the whole unit', () => {
    const cands = [
      { id: 'g1', attempted: false, awarded: 0, groupId: 'G' },
      { id: 'g2', attempted: true, awarded: 2, groupId: 'G' },
      { id: 's1', attempted: false, awarded: 0 },
    ]
    expect(countedIds(cands, 1)).toEqual(['g1', 'g2'])
    expect(countedIds(cands, 2, ['s1'])).toEqual(['g1', 'g2', 's1'])
  })

  it('[CI] "semua" is unchanged: every question counts whatever the groups', () => {
    expect(effectiveMarks({ type: 'all' }, marks, groups)).toBe(11)
    expect(effectiveMarks({ type: 'all' }, marks)).toBe(11)
  })
})
