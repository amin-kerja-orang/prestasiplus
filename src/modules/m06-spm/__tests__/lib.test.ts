import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { LatihTubiConfig } from '../api'
import { HISTORY_FILTERS, parseHistoryType, scoreColor } from '../lib/history'
import { diffCount, parseLatihTubiQuery, quizHref, targetName } from '../lib/latih-tubi'

const start = vi.hoisted(() => vi.fn())
vi.mock('@/modules/m05-practice', () => ({
  startSession: start,
  checkAnswer: vi.fn(),
  submitSession: vi.fn(),
}))

const CONFIG: LatihTubiConfig = {
  code: 'MATH',
  name: 'Matematik',
  icon: null,
  color: '#fff',
  total: 1681,
  targetType: 'spm',
  targetSize: 40,
  levelCounts: { '10': 976, '11': 705 },
  difficultyStats: { '1': 1, '2': 514, '3': 577, '4': 85, '5': 0 },
  difficultyByLevel: {
    '10': { '1': 0, '2': 309, '3': 410, '4': 58, '5': 0 },
    '11': { '1': 0, '2': 205, '3': 167, '4': 27, '5': 0 },
  },
  countOptions: [{ value: 40, label: '40 (Target SPM)', isTarget: true }],
  defaultCount: 40,
}

describe('latih tubi helpers (S4)', () => {
  it('reads difficulty counts per level or for the subject (FR-M06-28)', () => {
    expect(diffCount(CONFIG, null, 2)).toBe(514)
    expect(diffCount(CONFIG, 11, 4)).toBe(27)
    expect(diffCount(CONFIG, 10, 5)).toBe(0)
  })

  it('builds the "Mula Kuiz" href (FR-M06-31)', () => {
    expect(quizHref('MATH', 40, null, null)).toBe('/spm/latih-tubi/MATH/quiz?count=40')
    expect(quizHref('MATH', 40, 11, 4)).toBe(
      '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4',
    )
    expect(quizHref('PERNIAGA', 30, null, null)).toBe('/spm/latih-tubi/PERNIAGA/quiz?count=30')
  })

  it('names the target types', () => {
    expect([targetName('spm'), targetName('custom'), targetName('latihan')]).toEqual([
      'SPM',
      'Custom',
      'Latihan',
    ])
  })

  it('parses the Q2 query and drops unusable values', () => {
    expect(parseLatihTubiQuery({ count: '40', level: '11', difficulty: '4' })).toEqual({
      count: 40,
      levelId: 11,
      difficulty: 4,
      questionId: null,
    })
    expect(parseLatihTubiQuery({ question_id: '570024', count: '1' })).toMatchObject({
      count: 1,
      questionId: 570024,
    })
    expect(parseLatihTubiQuery({ level: '9', difficulty: '1', count: 'x' })).toEqual({
      count: null,
      levelId: null,
      difficulty: null,
      questionId: null,
    })
  })
})

describe('history helpers (S10)', () => {
  it('accepts only the three types (an unknown one means no filter)', () => {
    expect(parseHistoryType('past_year')).toBe('past_year')
    expect(parseHistoryType('zzz')).toBeNull()
    expect(parseHistoryType(undefined)).toBeNull()
    expect(HISTORY_FILTERS.map((f) => f.label)).toEqual([
      'Semua',
      'Tahun Lepas',
      'Latih Tubi',
      'Tracking A',
    ])
  })

  it('colours the score badge by band (FR-M06-66)', () => {
    expect(scoreColor(40)).toBe('error')
    expect(scoreColor(50)).toBe('warning')
    expect(scoreColor(79)).toBe('warning')
    expect(scoreColor(80)).toBe('success')
  })
})

describe('createSpmQuizApi', () => {
  it('reports the quiet 422 outcomes and never settles', async () => {
    const { createSpmQuizApi, classifyStartError } = await import('../lib/quiz-api')
    const err = (code: string, fields?: Record<string, string>) =>
      new ApiError({ status: 422, code, message: 'm', ...(fields ? { fields } : {}) })
    expect(classifyStartError(err('NOT_ENOUGH_QUESTIONS'))).toBe('no-questions')
    expect(classifyStartError(err('VALIDATION_ERROR', { targetQuestionId: 'x' }))).toBe(
      'invalid-target',
    )
    expect(classifyStartError(err('VALIDATION_ERROR', { count: 'x' }))).toBeNull()
    expect(classifyStartError(new Error('x'))).toBeNull()

    const seen: string[] = []
    const api = createSpmQuizApi((o) => seen.push(o))
    start.mockRejectedValueOnce(err('NOT_ENOUGH_QUESTIONS'))
    const settled = vi.fn()
    void api.start({ mode: 'latih_tubi', subjectCode: 'MATH' }).then(settled, settled)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toEqual(['no-questions'])
    expect(settled).not.toHaveBeenCalled()

    start.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'boom' }),
    )
    await expect(api.start({ mode: 'past_year' })).rejects.toThrow('boom')
  })
})
