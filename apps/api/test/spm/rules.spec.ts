import type { QuestionPart } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { parseAnswers } from '../../src/modules/spm/mock.service'
import {
  difficultyOf,
  gradeOf,
  heroClassOf,
  isStartable,
  markPaper2,
  mcqItemOf,
  modelTextOf,
  paper1Feedback,
  paper2Feedback,
  setFigures,
  setStatus,
  structuredItemOf,
  weakTopicsOf,
} from '../../src/modules/spm/rules'

describe('AC4 set status (BR-M06-08)', () => {
  it('belum_cukup below the size, bank_besar above it, otherwise bersih', () => {
    expect(setStatus(39, null, 40)).toBe('belum_cukup')
    expect(setStatus(0, null, 40)).toBe('belum_cukup')
    expect(setStatus(40, null, 40)).toBe('bersih')
    expect(setStatus(40, 41, 40)).toBe('bank_besar')
    expect(setStatus(40, 40, 40)).toBe('bersih')
    expect(setStatus(20, 20, 20)).toBe('bersih')
  })

  it('only belum_cukup is not startable', () => {
    expect(isStartable('bersih')).toBe(true)
    expect(isStartable('bank_besar')).toBe(true)
    expect(isStartable('belum_cukup')).toBe(false)
  })

  it('figures from the eligible count: ready = min(eligible, size), bank size only above the size', () => {
    expect(setFigures(10, 40)).toEqual({ readyCount: 10, bankSource: null, status: 'belum_cukup' })
    expect(setFigures(40, 40)).toEqual({ readyCount: 40, bankSource: null, status: 'bersih' })
    expect(setFigures(67, 40)).toEqual({ readyCount: 40, bankSource: 67, status: 'bank_besar' })
  })
})

describe('AC11 grading rules', () => {
  it('grade bands', () => {
    expect([100, 90, 89.99, 80, 70, 60, 50, 45, 40, 39.99, 0].map(gradeOf)).toEqual(['A+', 'A+', 'A', 'A', 'B+', 'B', 'C', 'D', 'E', 'G', 'G'])
  })

  it('hero classes', () => {
    expect(heroClassOf('A+')).toBe('good')
    expect(heroClassOf('B')).toBe('good')
    expect(heroClassOf('C')).toBe('mid')
    expect(heroClassOf('D')).toBe('mid')
    expect(heroClassOf('E')).toBe('mid')
    expect(heroClassOf('G')).toBe('bad')
  })

  it('the Paper 2 marker: 0 for empty, round(max x min(1, words / 60)) otherwise', () => {
    expect(markPaper2(null, 10)).toBe(0)
    expect(markPaper2('  ', 10)).toBe(0)
    expect(markPaper2(Array(30).fill('a').join(' '), 10)).toBe(5)
    expect(markPaper2(Array(500).fill('a').join(' '), 10)).toBe(10)
    expect(markPaper2('satu', 10)).toBe(0)
  })

  it('feedback copy', () => {
    expect(paper1Feedback(true, 'B')).toBe('Tahniah, jawapan anda betul.')
    expect(paper1Feedback(false, 'B')).toBe('Jawapan yang betul ialah B.')
    expect(paper2Feedback(7, 10)).toBe('Jawapan anda merangkumi 7 daripada 10 markah. Rujuk skema.')
  })

  it('weak topics: only items below max, count desc then name (ms)', () => {
    expect(
      weakTopicsOf([
        { topic: 'B', marks: 0, maxMarks: 1 },
        { topic: 'A', marks: 0, maxMarks: 1 },
        { topic: 'B', marks: null, maxMarks: 1 },
        { topic: 'C', marks: 1, maxMarks: 1 },
      ]),
    ).toEqual([
      { topic: 'B', wrongCount: 2 },
      { topic: 'A', wrongCount: 1 },
    ])
  })

  it('difficulty 1 to 5 from a TP: 6 clamps to 5, unset counts as 1', () => {
    expect([1, 2, 3, 4, 5, 6, null].map(difficultyOf)).toEqual([1, 2, 3, 4, 5, 5, 1])
  })
})

describe('AC11 submit answers parsing', () => {
  it('trims, truncates to 5000 characters and treats a missing or null answer as empty', () => {
    const m = parseAnswers([{ no: 1, answer: '  b ' }, { no: 2 }, { no: 3, answer: null }, { no: 4, answer: 'x'.repeat(6000) }], 4)
    expect(m?.get(1)).toBe('b')
    expect(m?.get(2)).toBe('')
    expect(m?.get(3)).toBe('')
    expect(m?.get(4)).toHaveLength(5000)
  })

  it.each([
    ['not an array', 'x'],
    ['no is out of range', [{ no: 99, answer: 'A' }]],
    ['no is zero', [{ no: 0 }]],
    ['no is not an integer', [{ no: 1.5 }]],
    ['no is a string', [{ no: '1' }]],
    ['answer is a number', [{ no: 1, answer: 5 }]],
    ['an entry is not an object', [1]],
  ])('refuses %s', (_label, value) => {
    expect(parseAnswers(value, 4)).toBeNull()
  })
})

describe('question mapping (open question 6)', () => {
  const mcq: QuestionPart = {
    label: 'a',
    prompt: { ms: 'Prompt' },
    mode: 'mcq',
    marks: 1,
    options: [
      { label: 'A', body: { ms: 'Satu' } },
      { label: 'B', body: { ms: 'Dua' } },
      { label: 'C', body: { ms: 'Tiga' } },
    ],
    key: { kind: 'option', correct: 'C' },
  }
  const working = (label: string, modelText?: string): QuestionPart =>
    ({ label, prompt: { ms: `Bahagian ${label}` }, mode: 'working', marks: 4, key: { kind: 'points', marks: 4, points: [{ id: 'p', code: 'M', label: 'Kaedah', marks: 4 }], ...(modelText ? { modelText } : {}) } }) as QuestionPart

  it('a single mcq leaf gives stem, option texts and the key letter; anything else gives null', () => {
    expect(mcqItemOf('Stem', [mcq])).toEqual({ text: 'Stem', options: ['Satu', 'Dua', 'Tiga'], letter: 'C' })
    expect(mcqItemOf(null, [mcq])?.text).toBe('Prompt')
    expect(mcqItemOf('Stem', [mcq, mcq])).toBeNull()
    expect(mcqItemOf('Stem', [working('a')])).toBeNull()
  })

  it('a structured item is the first leaf prompt plus the newline-joined model texts of all leaves', () => {
    const tree: QuestionPart = { label: 'a', prompt: { ms: 'Cabang' }, children: [working('i', 'Jawapan i'), working('ii', 'Jawapan ii')] } as QuestionPart
    expect(structuredItemOf('Stem', [tree, working('b', 'Jawapan b')])).toEqual({ text: 'Bahagian i', modelAnswer: 'Jawapan i\nJawapan ii\nJawapan b' })
    expect(structuredItemOf('Stem', [])).toBeNull()
  })

  it('model text falls back to the marking points, the accepted values and the option key', () => {
    const [leaf] = [working('a')] as Extract<QuestionPart, { mode: string }>[]
    expect(modelTextOf(leaf as never)).toBe('Kaedah')
    expect(modelTextOf({ ...(leaf as object), mode: 'short_text', key: { kind: 'accepted', values: ['x', 'y'] } } as never)).toBe('x, y')
    expect(modelTextOf(mcq as never)).toBe('C')
  })
})
