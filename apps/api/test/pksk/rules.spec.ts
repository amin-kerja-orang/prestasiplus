import { describe, expect, it } from 'vitest'

import { bahagianPct, displayStatusOf, examScore, gradeOf, isAnswerCorrect, isLevel, isRealDay, levelsOfPackage, notExpired } from '../../src/modules/pksk/rules'

describe('PKSK pure rules', () => {
  it('level is case sensitive T1 or T4', () => {
    expect(['T1', 'T4'].every(isLevel)).toBe(true)
    expect(['t1', 'T9', 'ALL', '', null].some(isLevel)).toBe(false)
  })

  it('grades at the boundaries', () => {
    expect([100, 80, 79.9, 65, 64.9, 50, 49.9, 40, 39.9, 0].map(gradeOf)).toEqual(['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E'])
  })

  it('exam score weights 20 / 70 / 10 to one decimal', () => {
    expect(examScore(46.6, 52.4, 0)).toBe(46)
    expect(examScore(80, 67, 11)).toBe(64)
    expect(bahagianPct(1, 3)).toBe(33.3)
    expect(bahagianPct(0, 1)).toBe(0)
  })

  it('a Kombo unlocks both levels', () => {
    expect(levelsOfPackage('ALL')).toEqual(['T1', 'T4'])
    expect(levelsOfPackage('T4')).toEqual(['T4'])
  })

  it('expiry is valid through the end of that day in Malaysia time', () => {
    // 2026-10-21T16:30Z is already 2026-10-22 00:30 in Malaysia.
    const lateUtc = new Date('2026-10-21T16:30:00Z')
    expect(notExpired('2026-10-21', lateUtc)).toBe(false)
    expect(notExpired('2026-10-22', lateUtc)).toBe(true)
    expect(notExpired(null, lateUtc)).toBe(true)
    const noon = new Date('2026-10-21T04:00:00Z')
    expect(notExpired('2026-10-21', noon)).toBe(true)
  })

  it('display status: revoked beats expired beats active', () => {
    const now = new Date('2026-10-21T04:00:00Z')
    expect(displayStatusOf({ status: 'revoked', expiresAt: '2020-01-01' }, now)).toBe('revoked')
    expect(displayStatusOf({ status: 'active', expiresAt: '2026-10-20' }, now)).toBe('expired')
    expect(displayStatusOf({ status: 'active', expiresAt: null }, now)).toBe('active')
  })

  it('real calendar dates only', () => {
    expect(isRealDay('2026-02-28')).toBe(true)
    expect(['2026-02-30', '2026-13-01', '26-01-01', '2026-1-1'].some(isRealDay)).toBe(false)
  })

  it('scoring: chosen option must be flagged; essay needs 50 trimmed characters; several or no correct options allowed', () => {
    const key = { optionCount: 3, correctIndexes: [0, 2] }
    expect(isAnswerCorrect(key, { optionIndex: 2 })).toBe(true)
    expect(isAnswerCorrect(key, { optionIndex: 1 })).toBe(false)
    expect(isAnswerCorrect(key, { optionIndex: null })).toBe(false)
    expect(isAnswerCorrect({ optionCount: 3, correctIndexes: [] }, { optionIndex: 0 })).toBe(false)
    const essay = { optionCount: 0, correctIndexes: [] }
    expect(isAnswerCorrect(essay, { text: `  ${'x'.repeat(50)}  ` })).toBe(true)
    expect(isAnswerCorrect(essay, { text: 'x'.repeat(49) })).toBe(false)
    expect(isAnswerCorrect(essay, {})).toBe(false)
  })
})
