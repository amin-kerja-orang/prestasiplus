import { describe, expect, it } from 'vitest'

import {
  accuracyClass,
  activeScope,
  apiQuery,
  formQuery,
  readRankingState,
  scopeLabel,
  scopeQuery,
  tabTitle,
} from '../../lib/ranking'

const state = (q: Record<string, string>) => readRankingState(q)

describe('S19 scope and title (FR-M08-108, DV-22)', () => {
  it('labels each scope and defaults to Nasional', () => {
    expect(scopeLabel(state({}))).toBe('Nasional')
    expect(scopeLabel(state({ scope: 'nasional' }))).toBe('Nasional')
    expect(scopeLabel(state({ scope: 'negeri' }))).toBe('Negeri')
    expect(scopeLabel(state({ scope: 'daerah' }))).toBe('Daerah')
    expect(scopeLabel(state({ scope: 'sekolah' }))).toBe('Sekolah')
  })

  it('uses the negeri value on the negeri scope only', () => {
    expect(scopeLabel(state({ scope: 'negeri', negeri: 'Selangor' }))).toBe('Selangor')
    expect(tabTitle(state({ scope: 'negeri', negeri: 'Selangor' }))).toBe('Kedudukan Selangor')
    expect(scopeLabel(state({ scope: 'daerah', negeri: 'Selangor' }))).toBe('Daerah')
    expect(scopeLabel(state({ scope: 'nasional', negeri: 'Selangor' }))).toBe('Nasional')
  })

  it('treats an unknown scope as Nasional with no pill active', () => {
    expect(activeScope('xyz')).toBeNull()
    expect(scopeLabel(state({ scope: 'xyz' }))).toBe('Nasional')
    expect(tabTitle(state({ scope: 'xyz' }))).toBe('Kedudukan Nasional')
    expect(activeScope('')).toBe('nasional')
  })
})

describe('S19 query strings (FR-M08-109, FR-M08-110)', () => {
  const filters = { subjectId: '3', tingkatan: '', negeri: 'Selangor' }

  it('keeps the non-empty filters on the pills, then the scope', () => {
    const q = scopeQuery(filters, 'daerah')
    expect(Object.entries(q)).toEqual([
      ['subject_id', '3'],
      ['negeri', 'Selangor'],
      ['scope', 'daerah'],
    ])
    expect(scopeQuery({ subjectId: '', tingkatan: '', negeri: '' }, 'negeri')).toEqual({
      scope: 'negeri',
    })
  })

  it('submits the hidden scope first (the native GET form) and drops empty selects', () => {
    expect(Object.keys(formQuery(filters, 'negeri'))).toEqual(['scope', 'subject_id', 'negeri'])
  })

  it('maps the URL to the client query', () => {
    expect(apiQuery(state({}))).toEqual({})
    expect(
      apiQuery(state({ scope: 'negeri', subject_id: '3', tingkatan: 'T4', negeri: 'Johor' })),
    ).toEqual({
      scope: 'negeri',
      subjectId: 3,
      tingkatan: 'T4',
      negeri: 'Johor',
    })
    expect(apiQuery(state({ subject_id: 'abc' }))).toEqual({})
  })
})

describe('S19 accuracy colour (FR-M08-112)', () => {
  it('is green from 50 and red below', () => {
    expect(accuracyClass(50)).toBe('text-green-600')
    expect(accuracyClass(93.48)).toBe('text-green-600')
    expect(accuracyClass(49.99)).toBe('text-red-500')
    expect(accuracyClass(35.5)).toBe('text-red-500')
  })
})
