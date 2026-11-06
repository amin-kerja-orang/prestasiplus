import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { LatihTubiConfig } from '../api'
import {
  HISTORY_FILTERS,
  MODE_BADGES,
  formatAccuracy,
  formatHistoryDate,
  formatHistoryDuration,
  historyHref,
  pagerText,
  parseHistoryMod,
  parseHistoryPage,
  scoreColor,
} from '../lib/history'
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
    expect(parseLatihTubiQuery({ level: '9', difficulty: '0', count: 'x' })).toEqual({
      count: null,
      levelId: null,
      difficulty: null,
      questionId: null,
    })
    // the V2 scale starts at 1 (REQ-A-005, S-60)
    expect(parseLatihTubiQuery({ difficulty: '1' }).difficulty).toBe(1)
  })
})

describe('history helpers (S10)', () => {
  it('reads the chip from mod, then the old type key; legacy values map to their chips', () => {
    expect(parseHistoryMod({})).toBeNull()
    expect(parseHistoryMod({ mod: 'all' })).toBeNull()
    expect(parseHistoryMod({ mod: 'databank' })).toBe('databank')
    expect(parseHistoryMod({ type: 'past_year' })).toBe('databank')
    expect(parseHistoryMod({ type: 'ramalan' })).toBe('tracking_a')
    expect(parseHistoryMod({ mod: 'latih_tubi', type: 'ramalan' })).toBe('latih_tubi')
    expect(parseHistoryMod({ mod: ['tracking_a'] })).toBe('tracking_a')
    expect(parseHistoryMod({ mod: 'zzz' })).toBeUndefined()
    expect(HISTORY_FILTERS.map((f) => f.label)).toEqual(['Semua', 'Tahun Lepas', 'Latih Tubi', 'Tracking A'])
  })

  it('parses halaman and builds hrefs', () => {
    expect(parseHistoryPage(undefined)).toBe(1)
    expect(parseHistoryPage('3')).toBe(3)
    expect(parseHistoryPage('0')).toBe(1)
    expect(parseHistoryPage('-2')).toBe(1)
    expect(parseHistoryPage('x')).toBe(1)
    expect(historyHref(null)).toBe('/spm/history')
    expect(historyHref('databank')).toBe('/spm/history?mod=databank')
    expect(historyHref(null, 2)).toBe('/spm/history?halaman=2')
    expect(historyHref('tracking_a', 3)).toBe('/spm/history?mod=tracking_a&halaman=3')
    expect(historyHref('tracking_a', 1)).toBe('/spm/history?mod=tracking_a')
  })

  it('formats accuracy, duration, date and pager text', () => {
    expect(formatAccuracy(null)).toBe('—')
    expect(formatAccuracy(0)).toBe('0%')
    expect(formatAccuracy(31)).toBe('31%')
    expect(formatAccuracy(45.5)).toBe('46%')
    expect(formatAccuracy(Number.NaN)).toBe('—')
    expect(formatAccuracy(Number.POSITIVE_INFINITY)).toBe('—')
    expect(formatHistoryDuration(2252)).toBe('37m 32s')
    expect(formatHistoryDuration(36)).toBe('0m 36s')
    expect(formatHistoryDate('2026-10-23T20:06:00+08:00')).toBe('23 Okt 2026, 08:06 PM')
    expect(formatHistoryDate('2026-08-02T00:05:00+08:00')).toBe('2 Ogs 2026, 12:05 AM')
    expect(pagerText(2, 5)).toBe('Halaman 2 daripada 5')
  })

  it('labels every row mode', () => {
    expect(Object.values(MODE_BADGES).map((b) => b.label)).toEqual([
      'Tahun Lepas',
      'Latih Tubi',
      'Tracking A',
      'Bijak SPM',
      'Subjektif',
      'Soalan Berstruktur',
      'Simulasi - Kuiz',
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
