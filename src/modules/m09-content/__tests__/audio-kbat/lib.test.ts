import { describe, expect, it } from 'vitest'

import { attemptBody, queryId, queryString, sectionRange, sortByName } from '../../lib/audio-kbat'

describe('audio-kbat lib', () => {
  it('queryId accepts positive integers only', () => {
    expect(queryId('10')).toBe(10)
    expect(queryId(['3', '4'])).toBe(3)
    expect(queryId('0')).toBeUndefined()
    expect(queryId('abc')).toBeUndefined()
    expect(queryId('1.5')).toBeUndefined()
    expect(queryId(undefined)).toBeUndefined()
  })

  it('queryString returns the first string or empty', () => {
    expect(queryString('x')).toBe('x')
    expect(queryString(['a', 'b'])).toBe('a')
    expect(queryString(null)).toBe('')
  })

  it('sortByName sorts a copy A-Z', () => {
    const input = [{ name: 'Matematik' }, { name: 'Bahasa Arab' }]
    expect(sortByName(input).map((i) => i.name)).toEqual(['Bahasa Arab', 'Matematik'])
    expect(input[0]?.name).toBe('Matematik')
  })

  it('sectionRange gives min-max of question numbers', () => {
    expect(sectionRange([{ no: 9 }, { no: 16 }, { no: 10 }])).toBe('9-16')
    expect(sectionRange([])).toBe('')
  })

  it('attemptBody keeps only answered questions in order', () => {
    expect(attemptBody({ 3: 'B', 1: 'A', 2: undefined })).toEqual({
      answers: [
        { no: 1, choice: 'A' },
        { no: 3, choice: 'B' },
      ],
    })
  })
})
