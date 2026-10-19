import { describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { gradePart, containsPhrase, MAX_KEYWORD_ANSWER_WORDS } from '../domain/grading'
import {
  answersEquivalent,
  matchFinal,
  numericValue,
  parseAnswer,
  splitUnit,
} from '../domain/math-expr'

/** Cases the G4 review found wrongly equivalent ("before"): all must now be different. */
describe('former false positives are now different', () => {
  const different: [string, string][] = [
    // variable names
    ['x=3, y=2', 'x=2, y=3'],
    ['y=3', 'x=3'],
    ['x=3', 'y=3'],
    // numbers
    ['1 1/2', '1/2'],
    ['1 000', '0'],
    ['3,000', '3'],
    ['1.2.3', '0.36'],
    ['3 4', '12'],
    // sign
    ['abs(x)', 'x'],
    ['sqrt(x^2)', 'x'],
    ['sqrt(x-5)', 'sqrt(x-6)'],
  ]
  it.each(different)('%s is not %s', (a, b) => {
    expect(answersEquivalent(a, b)).toBe(false)
  })

  const same: [string, string][] = [
    ['x=3, y=2', 'y=2, x=3'],
    ['x=3', '3'],
    ['1 1/2', '3/2'],
    ['1 1/2', '1.5'],
    ['1 000', '1000'],
    ['3,000', '3000'],
    ['0,5', '0.5'],
    ['abs(x)', 'abs(-x)'],
    ['sqrt(x^2)', 'abs(x)'],
    ['sqrt(x-5)', 'sqrt(x-5)'],
    ['2*sqrt(x-5)', 'sqrt(4*(x-5))'],
  ]
  it.each(same)('%s is still %s', (a, b) => {
    expect(answersEquivalent(a, b)).toBe(true)
  })

  it('treats malformed numbers as unreadable, not as a mismatch', () => {
    for (const bad of ['1.2.3', '3 4', '1..2']) expect(parseAnswer(bad)).toBeNull()
    expect(matchFinal('1.2.3', '', { accept: ['0.36'] }).value).toBe('unparseable')
  })

  it('applies no absolute tolerance to variable expressions', () => {
    expect(answersEquivalent('x', 'x+0.001', 0.01)).toBe(false)
    expect(answersEquivalent('3.14', '3.1416', 0.005)).toBe(true)
  })
})

describe('units and ECF values', () => {
  it('splits a percent unit', () => {
    expect(splitUnit('25%', '%')).toEqual({ value: '25', unit: '%' })
    expect(matchFinal('25%', '', { accept: ['25'], unit: '%' })).toEqual({
      value: 'match',
      unit: 'ok',
    })
    expect(matchFinal('25', '%', { accept: ['25'], unit: '%' })).toEqual({
      value: 'match',
      unit: 'ok',
    })
    expect(matchFinal('25', '', { accept: ['25'], unit: '%' })).toEqual({
      value: 'match',
      unit: 'missing',
    })
  })
  it('reads a number with an inline unit', () => {
    expect(numericValue('12 cm')).toBe(12)
    expect(numericValue('12cm')).toBe(12)
    expect(numericValue('RM12')).toBe(12)
    expect(numericValue('30 cm^2')).toBe(30)
    expect(numericValue('banyak sekali')).toBeNull()
  })
  it('lets ECF work when the earlier answer was written with its unit', () => {
    const part = {
      id: 'mat2-diskaun-v1-b',
      label: '(b)',
      prompt: '',
      marks: 1,
      kind: 'numeric' as const,
    }
    const scheme = BANK.schemes.get('mat2-diskaun-v1-b')!
    const prev = numericValue('RM10') // the student's (a), written with the unit inline
    const r = gradePart({
      part,
      scheme,
      answer: { final: '70', unit: 'RM' },
      ctx: { previousFinals: { 'mat2-diskaun-v1-a': prev } },
    })
    expect(r.awarded).toBe(1)
    expect(r.ecf).toContain('ECF')
  })
})

describe('keyword marking', () => {
  it('matches whole words only', () => {
    expect(containsPhrase('lapangan terbang', 'air')).toBe(false)
    expect(containsPhrase('air masuk ke sel', 'air')).toBe(true)
    expect(containsPhrase('membran separa telap', 'separa telap')).toBe(true)
  })
  it('does not award a keyword hidden inside another word', () => {
    const part = {
      id: 'sn2-sel-q2-a',
      label: '(a)',
      prompt: '',
      marks: 1,
      kind: 'short_text' as const,
    }
    const scheme = BANK.schemes.get('sn2-sel-q2-a')!
    expect(
      gradePart({ part, scheme, answer: { text: 'vakuolar' }, ctx: { previousFinals: {} } })
        .awarded,
    ).toBe(0)
    expect(
      gradePart({ part, scheme, answer: { text: 'vakuol' }, ctx: { previousFinals: {} } }).awarded,
    ).toBe(1)
  })
  it('counts each point once and sends a very long answer to review', () => {
    const part = {
      id: 'sn2-fotosintesis-a',
      label: '',
      prompt: '',
      marks: 4,
      kind: 'short_text' as const,
    }
    const scheme = BANK.schemes.get('sn2-fotosintesis-a')!
    const stuffed = Array.from({ length: 10 }, () => 'cahaya').join(' ')
    const r1 = gradePart({ part, scheme, answer: { text: stuffed }, ctx: { previousFinals: {} } })
    expect(r1.awarded).toBe(1)
    const long = `cahaya suhu karbon dioksida air ${'dan lagi '.repeat(MAX_KEYWORD_ANSWER_WORDS)}`
    const r2 = gradePart({ part, scheme, answer: { text: long }, ctx: { previousFinals: {} } })
    expect(r2.status).toBe('belum_dimarkah')
  })
})
