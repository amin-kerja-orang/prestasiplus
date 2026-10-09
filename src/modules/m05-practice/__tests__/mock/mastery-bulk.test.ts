/**
 * Additive M05 exports for M18: `practice.storedMastery(userIds)` (bulk read of the stored BR-20
 * counters, no log scan) and the exported BR-20 thresholds / `masteryLevel`.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { MASTERY_THRESHOLDS, masteryLevel, practice } from '../../mock'
import { bootAll, MemoryStorage } from './boot-all'

vi.setConfig({ testTimeout: 180_000 })

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  await bootAll()
}, 600_000)

describe('BR-20 thresholds export', () => {
  it('masteryLevel maps correct answers onto the ladder L0..L10', () => {
    expect(MASTERY_THRESHOLDS).toHaveLength(11)
    expect(masteryLevel(0)).toBe(0)
    expect(masteryLevel(9)).toBe(0)
    expect(masteryLevel(10)).toBe(1)
    expect(masteryLevel(99)).toBe(3)
    expect(masteryLevel(100)).toBe(4)
    expect(masteryLevel(1500)).toBe(10)
    expect(masteryLevel(99999)).toBe(10)
  })
})

describe('practice.storedMastery', () => {
  it('returns, per user, exactly the rows practice.mastery returns when stored rows exist', () => {
    const stored = practice.storedMastery([1, 2, 3, 4, 5])
    expect([...stored.keys()]).toEqual([1, 2, 3, 4, 5])
    const withRows = [...stored.entries()].filter(([, rows]) => rows.length > 0)
    for (const [id, rows] of withRows) expect(practice.mastery(id)).toEqual(rows)
  })

  it('a write to the store is visible and users without stored rows map to an empty list', () => {
    const uid = 987_654_321
    expect(practice.storedMastery([uid]).get(uid)).toEqual([])
    practice.storeMastery([{ userId: uid, subjectId: 1, correct: 12, answered: 20, lastAnsweredAt: null }])
    expect(practice.storedMastery([uid]).get(uid)).toEqual([
      { subjectId: 1, correct: 12, answered: 20, lastAnsweredAt: null },
    ])
    expect(practice.mastery(uid)).toEqual(practice.storedMastery([uid]).get(uid))
  })
})
