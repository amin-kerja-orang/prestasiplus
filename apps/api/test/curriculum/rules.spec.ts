import { describe, expect, it } from 'vitest'

import {
  GRADE_CODES,
  MAP_SUBJECTS,
  NO_PROGRESS,
  PRACTICE_CODE,
  byOrderThenId,
  chapterOrder,
  compareTopicNumbers,
  deriveSubjectLevelPairs,
  gradeOfCode,
  islandStates,
  mapSubjectLabel,
  subjectLabelOf,
  topicOrder,
} from '../../src/modules/curriculum/rules'

const p = (progress: number, sessions: number, questionsAnswered: number) => ({ progress, sessions, questionsAnswered })

describe('subject-level derivation rule (AC5, data migration 4.2)', () => {
  it('is the distinct (subject, level) pairs of the in-tree chapters, in first-seen order', () => {
    const pairs = deriveSubjectLevelPairs([
      { subjectId: 1n, educationLevelId: 10n },
      { subjectId: 1n, educationLevelId: 10n },
      { subjectId: 1n, educationLevelId: 11n },
      { subjectId: 2n, educationLevelId: 10n },
      { subjectId: 1n, educationLevelId: 10n, inTree: true },
    ])
    expect(pairs).toEqual([
      [1n, 10n],
      [1n, 11n],
      [2n, 10n],
    ])
  })

  it('ignores out-of-tree chapters and chapters without a level', () => {
    expect(
      deriveSubjectLevelPairs([
        { subjectId: 3n, educationLevelId: null, inTree: false },
        { subjectId: 3n, educationLevelId: 5n, inTree: false },
        { subjectId: 4n, educationLevelId: null },
      ]),
    ).toEqual([])
    expect(deriveSubjectLevelPairs([])).toEqual([])
  })
})

describe('ordering (BR-08)', () => {
  it('subjects and levels: sortOrder, then id', () => {
    const rows = [
      { id: 3n, sortOrder: 1 },
      { id: 2n, sortOrder: 2 },
      { id: 1n, sortOrder: 2 },
    ]
    expect(rows.sort(byOrderThenId).map((r) => r.id)).toEqual([3n, 1n, 2n])
  })

  it('chapters: number ascending, null last, then id', () => {
    const rows = [
      { id: 1n, chapterNumber: null },
      { id: 2n, chapterNumber: 2 },
      { id: 3n, chapterNumber: 1 },
      { id: 4n, chapterNumber: 2 },
    ]
    expect(rows.sort(chapterOrder).map((r) => r.id)).toEqual([3n, 2n, 4n, 1n])
  })

  it('topic numbers compare naturally: 1 < 1.1 < 1.2 < 2 < 10, text after numbers', () => {
    const order = ['10', '2', '1.2', '1', '1.10', '1.1', 'A', '2.a']
    expect(order.sort(compareTopicNumbers)).toEqual(['1', '1.1', '1.2', '1.10', '2', '2.a', '10', 'A'])
    expect(compareTopicNumbers('12345678901234567890', '12345678901234567891')).toBeLessThan(0)
  })

  it('topics: natural number, null last, then id', () => {
    const rows = [
      { id: 1n, topicNumber: null },
      { id: 2n, topicNumber: '1.2' },
      { id: 3n, topicNumber: '1.1' },
      { id: 4n, topicNumber: '1.1' },
    ]
    expect(rows.sort(topicOrder).map((r) => r.id)).toEqual([3n, 4n, 2n, 1n])
  })
})

describe('grade and practice codes (BR-13, BR-16, BR-17)', () => {
  it('maps DARJAH_n to n and TINGKATAN_n to n + 6; anything else is null', () => {
    expect(GRADE_CODES).toHaveLength(11)
    expect(gradeOfCode('DARJAH_1')).toBe(1)
    expect(gradeOfCode('TINGKATAN_1')).toBe(7)
    expect(gradeOfCode('TINGKATAN_5')).toBe(11)
    expect(gradeOfCode('darjah_1')).toBeNull()
    expect(gradeOfCode('x')).toBeNull()
  })

  it('has a practice code for all 8 learner subjects', () => {
    expect(PRACTICE_CODE).toEqual({
      MATEMATIK: 'MATH',
      BAHASA_MELAYU: 'BM',
      BAHASA_INGGERIS: 'BI',
      SAINS: 'SCI',
      PENDIDIKAN_ISLAM: 'PI',
      PENDIDIKAN_MORAL: 'PM',
      SEJARAH: 'SEJ',
      GEOGRAFI: 'GEO',
    })
    expect(subjectLabelOf('BAHASA_MELAYU')).toBe('BAHASA MELAYU')
  })
})

describe('Peta Belajar rules (BR-14, BR-15)', () => {
  it('BR-14: mastered from 80, started on any history, unlocked after started or mastered, else locked', () => {
    expect(islandStates([p(80, 1, 20), p(79, 1, 5), p(0, 0, 0), p(0, 0, 0)])).toEqual(['mastered', 'started', 'unlocked', 'locked'])
    expect(islandStates([p(0, 0, 0), p(0, 0, 0), p(0, 0, 0), p(10, 0, 3)])).toEqual(['unlocked', 'unlocked', 'locked', 'started'])
    expect(islandStates([])).toEqual([])
  })

  it('with no progress the first two topics are open and the rest locked (default provider state)', () => {
    expect(islandStates([NO_PROGRESS, NO_PROGRESS, NO_PROGRESS, NO_PROGRESS])).toEqual(['unlocked', 'unlocked', 'locked', 'locked'])
  })

  it('BR-15: pill labels, Geografi and unknown codes title-cased', () => {
    expect(MAP_SUBJECTS).toHaveLength(7)
    expect(mapSubjectLabel('MATEMATIK')).toBe('Matematik')
    expect(mapSubjectLabel('PENDIDIKAN_MORAL')).toBe('Pend. Moral')
    expect(mapSubjectLabel('GEOGRAFI')).toBe('Geografi')
    expect(mapSubjectLabel('ZZZ')).toBe('Zzz')
    expect(mapSubjectLabel('ILMU_BARU')).toBe('Ilmu baru')
  })
})
