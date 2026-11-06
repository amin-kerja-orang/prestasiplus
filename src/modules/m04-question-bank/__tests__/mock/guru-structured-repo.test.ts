/** The in-memory own-submission store behind API-GUR-26 / API-GUR-17 (S6-T17). */

import { beforeEach, describe, expect, it } from 'vitest'

import { guruSubmissions, type GuruSubmissionInput } from '../../mock/repository/guru-structured'

const input = (text: string): GuruSubmissionInput => ({
  subjectId: 1,
  educationLevelId: 2,
  chapterId: null,
  spIds: [],
  tp: null,
  cognitiveLevel: null,
  difficultyLevel: 3,
  stimulus: '',
  stimulusImageId: null,
  parts: [{ text, marks: 4, scheme: 'Skema', cognitiveLevel: null }],
})

beforeEach(() => guruSubmissions.reset())

describe('guruSubmissions', () => {
  it('ids are g{n}, an owner sees only their own, newest first', () => {
    const a = guruSubmissions.add(5, input('A'), 1000)
    const b = guruSubmissions.add(5, input('B'), 2000)
    guruSubmissions.add(6, input('C'), 3000)
    expect([a.id, b.id]).toEqual(['g1', 'g2'])
    expect(guruSubmissions.listOwn(5).map((r) => r.id)).toEqual(['g2', 'g1'])
    expect(guruSubmissions.getOwn(6, 'g1')).toBeNull()
    expect(guruSubmissions.listOwn(5, { subjectId: 9 })).toEqual([])
  })

  it('an update clears the rejection reason; a removed row is gone', () => {
    const row = guruSubmissions.seed({
      ...input('X'),
      ownerId: 5,
      createdAtMs: 1,
      rejectionReason: 'Tidak lengkap.',
      editable: true,
    })
    guruSubmissions.update(row, input('Y'))
    expect(row.rejectionReason).toBeNull()
    expect(row.parts[0]?.text).toBe('Y')
    guruSubmissions.remove(row)
    expect(guruSubmissions.getOwn(5, row.id)).toBeNull()
  })
})
