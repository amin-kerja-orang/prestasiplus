import { describe, expect, it } from 'vitest'

import type { SubjectConfig } from '../../api/types'
import {
  availableQuestions,
  currentTotal,
  diffCount,
  levelName,
  parseQuizQuery,
  quizUrl,
} from '../../components/quiz/practice-config'

/** Matematik as captured on live (discovery §2.3). */
const MATH: SubjectConfig = {
  subject: {
    id: 3,
    code: 'MATH',
    name: 'Matematik',
    nameEn: 'Mathematics',
    icon: 'fa-calculator',
    color: '#EF4444',
    isCore: true,
    approvedCount: 13872,
    bankCount: 13872,
  },
  total: 6538,
  levels: [
    { id: 1, code: 'D1', name: 'Darjah 1', count: 2734 },
    { id: 2, code: 'D2', name: 'Darjah 2', count: 2129 },
    { id: 3, code: 'D3', name: 'Darjah 3', count: 682 },
    { id: 4, code: 'D4', name: 'Darjah 4', count: 993 },
  ],
  difficultyStats: { '1': 1340, '2': 2130, '3': 2511, '4': 557, '5': 0 },
  difficultyByLevel: {
    '1': { '1': 558, '2': 695, '3': 1402, '4': 79, '5': 0 },
    '2': { '1': 278, '2': 635, '3': 780, '4': 436, '5': 0 },
    '3': { '1': 316, '2': 326, '3': 27, '4': 13, '5': 0 },
    '4': { '1': 188, '2': 474, '3': 302, '4': 29, '5': 0 },
  },
  subjectiveCounts: {},
  trial: { active: false, used: 0, limit: 50, remaining: 50 },
}

describe('availableQuestions (BR-12)', () => {
  it('uses the subject total with no level and no difficulty', () => {
    expect(availableQuestions(MATH, null, null)).toBe(6538)
  })
  it('uses the level count with a level only', () => {
    expect(availableQuestions(MATH, 2, null)).toBe(2129)
  })
  it('uses the subject-wide difficulty count with a difficulty only', () => {
    expect(availableQuestions(MATH, null, 3)).toBe(2511)
  })
  it('uses the cell with both', () => {
    expect(availableQuestions(MATH, 2, 3)).toBe(780)
    expect(availableQuestions(MATH, 1, 5)).toBe(0)
  })
  it('gives the "Campuran" total of the level or the subject', () => {
    expect(currentTotal(MATH, null)).toBe(6538)
    expect(currentTotal(MATH, 3)).toBe(682)
  })
  it('counts a difficulty within the level when one is chosen', () => {
    expect(diffCount(MATH, null, 2)).toBe(2130)
    expect(diffCount(MATH, 4, 2)).toBe(474)
  })
})

describe('levelName and quizUrl', () => {
  it('names the level (FR-M05-43)', () => {
    expect(levelName(MATH, null)).toBe('Semua Tahap')
    expect(levelName(MATH, 2)).toBe('Darjah 2')
    expect(levelName(MATH, 99)).toBe('Tahap 99')
  })

  it('orders the href parameters level, difficulty, count (FR-M05-46)', () => {
    expect(quizUrl('MATH', 2, 3, 20)).toBe('/practice/MATH/quiz?level=2&difficulty=3&count=20')
    expect(quizUrl('MATH', null, null, 10)).toBe('/practice/MATH/quiz?count=10')
    expect(quizUrl('MATH', 1, null, 5)).toBe('/practice/MATH/quiz?level=1&count=5')
    expect(quizUrl('MATH', null, 5, 15)).toBe('/practice/MATH/quiz?difficulty=5&count=15')
  })
})

describe('parseQuizQuery', () => {
  it('reads valid values', () => {
    expect(parseQuizQuery({ level: '2', difficulty: '3', count: '20' })).toEqual({
      levelId: 2,
      difficulty: 3,
      count: 20,
    })
  })
  it('ignores invalid values and defaults the count to 10', () => {
    expect(parseQuizQuery({ level: 'x', difficulty: '9', count: '7' })).toEqual({
      levelId: null,
      difficulty: null,
      count: 10,
    })
    expect(parseQuizQuery({})).toEqual({ levelId: null, difficulty: null, count: 10 })
    expect(parseQuizQuery({ level: '0', difficulty: '0' }).levelId).toBeNull()
  })
})
