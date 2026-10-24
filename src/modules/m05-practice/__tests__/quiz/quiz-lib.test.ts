import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { PRACTICE_LABELS, REVISION_LABELS } from '../../components/quiz/quiz-labels'
import {
  buildAnswerRecord,
  formatTime,
  hasJsonBody,
  optionLabel,
  optionState,
  planStartError,
  resultMessage,
  safeHref,
  scoreBand,
  scorePercent,
} from '../../components/quiz/quiz-lib'

const options = [
  { id: 0, label: 'A', text: 'Satu' },
  { id: 1, label: 'B', text: 'Dua' },
]

describe('formatTime / scorePercent / scoreBand', () => {
  it('formats MM:SS', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(65)).toBe('01:05')
    expect(formatTime(3599)).toBe('59:59')
    expect(formatTime(-3)).toBe('00:00')
  })

  it('rounds the percentage and bands it at 50 and 80', () => {
    expect(scorePercent(7, 10)).toBe(70)
    expect(scorePercent(17, 20)).toBe(85)
    expect(scorePercent(1, 3)).toBe(33)
    expect(scorePercent(0, 0)).toBe(0)
    expect(scoreBand(80)).toBe('high')
    expect(scoreBand(79)).toBe('mid')
    expect(scoreBand(50)).toBe('mid')
    expect(scoreBand(49)).toBe('low')
  })

  it('picks the result message per band (S7 and Q1 copy)', () => {
    expect(resultMessage(100, REVISION_LABELS.messages)).toBe(
      'Sempurna! Semua soalan salah berjaya diperbetulkan!',
    )
    expect(resultMessage(85, REVISION_LABELS.messages)).toBe(
      'Cemerlang! Hampir semua berjaya diperbetulkan!',
    )
    expect(resultMessage(50, REVISION_LABELS.messages)).toBe('Bagus! Teruskan ulang kaji!')
    expect(resultMessage(10, REVISION_LABELS.messages)).toBe(
      'Jangan putus asa! Cuba ulang kaji lagi!',
    )
    expect(resultMessage(100, PRACTICE_LABELS.messages)).toBe('Sempurna! Semua jawapan betul!')
    expect(resultMessage(80, PRACTICE_LABELS.messages)).toBe('Cemerlang!')
  })
})

describe('options and answers', () => {
  it('labels an option "{label}. {text}" and gives an empty label for none', () => {
    expect(optionLabel(options, 1)).toBe('B. Dua')
    expect(optionLabel(options, null)).toBe('')
    expect(optionLabel(options, 9)).toBe('')
  })

  it('derives the option state before and after a check', () => {
    expect(optionState(0, null, null)).toBe('idle')
    expect(optionState(0, 0, null)).toBe('selected')
    const wrong = { correctOptionId: 1, isCorrect: false }
    expect(optionState(1, 0, wrong)).toBe('correct')
    expect(optionState(0, 0, wrong)).toBe('wrong')
    expect(optionState(2, 0, wrong)).toBe('dim')
    // An error body has no correct option: only the user's pick is marked.
    const errorBody = { correctOptionId: null, isCorrect: false }
    expect(optionState(0, 0, errorBody)).toBe('wrong')
    expect(optionState(1, 0, errorBody)).toBe('dim')
  })

  it('builds the review record with an empty correct label for an error body', () => {
    const q = {
      id: 5,
      questionText: 'Soalan?',
      textDirection: 'ltr' as const,
      scriptType: 'rumi' as const,
      wrongTimes: 0,
      hasDskp: true,
      contributor: null,
      options,
    }
    expect(
      buildAnswerRecord(q, 0, { isCorrect: false, correctOptionId: 1, explanation: 'Sebab' }),
    ).toEqual({
      questionId: 5,
      questionText: 'Soalan?',
      selectedOptionId: 0,
      selectedLabel: 'A. Satu',
      correctLabel: 'B. Dua',
      isCorrect: false,
      explanation: 'Sebab',
    })
    expect(
      buildAnswerRecord(q, 0, { isCorrect: false, correctOptionId: null, explanation: null })
        .correctLabel,
    ).toBe('')
  })
})

describe('safeHref', () => {
  it('allows http(s) and internal paths only', () => {
    expect(safeHref('https://x.my/p')).toBe('https://x.my/p')
    expect(safeHref('/profil/3')).toBe('/profil/3')
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('//evil.example')).toBeNull()
    expect(safeHref('/\\evil.example')).toBeNull()
    expect(safeHref(null)).toBeNull()
  })
})

describe('planStartError', () => {
  const err = (status: number, code: string, message = 'm') =>
    new ApiError({ status, code, message })

  it('sends a trial-exhausted start to the pricing page and a locked chapter back', () => {
    expect(planStartError(err(402, 'TRIAL_EXHAUSTED'), PRACTICE_LABELS)).toEqual({
      kind: 'pricing',
    })
    expect(planStartError(err(409, 'CHAPTER_LOCKED'), PRACTICE_LABELS)).toEqual({ kind: 'locked' })
    expect(planStartError(err(404, 'NOT_FOUND'), PRACTICE_LABELS)).toEqual({ kind: 'not-found' })
  })

  it('alerts the server message, else the S7 fallbacks', () => {
    expect(
      planStartError(err(422, 'VALIDATION_ERROR', 'Soalan tidak mencukupi.'), PRACTICE_LABELS),
    ).toEqual({ kind: 'alert', message: 'Soalan tidak mencukupi.' })
    expect(planStartError(err(500, 'SERVER_ERROR', ''), REVISION_LABELS)).toEqual({
      kind: 'alert',
      message: 'Gagal memuatkan kuiz ulang kaji',
    })
    expect(planStartError(new Error(''), REVISION_LABELS)).toEqual({
      kind: 'alert',
      message: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.',
    })
    expect(planStartError(new Error('Gagal'), REVISION_LABELS)).toEqual({
      kind: 'alert',
      message: 'Gagal',
    })
  })
})

describe('hasJsonBody', () => {
  it('is true for an error response with a body and false for a network failure', () => {
    expect(
      hasJsonBody(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', body: {} })),
    ).toBe(true)
    expect(hasJsonBody(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }))).toBe(
      false,
    )
    expect(hasJsonBody(new Error('x'))).toBe(false)
  })
})
