import { describe, expect, it } from 'vitest'

import {
  bahasaHref,
  bestScoreLabel,
  dskpLine,
  isStartable,
  lockChip,
  parseSetQuery,
  setHref,
  setSize,
  subjektifHref,
  tabSubjects,
  targetChip,
  tileTarget,
} from '../lib/tracking'
import { isSetRefusal } from '../lib/tracking-quiz-api'
import { ApiError } from '@/api'

describe('tracking lib', () => {
  it('formats the DSKP line with a rounded percentage', () => {
    expect(dskpLine({ dskpTagged: 67, dskpTotal: 67 })).toBe('DSKP: 67/67 (100%)')
    expect(dskpLine({ dskpTagged: 1, dskpTotal: 3 })).toBe('DSKP: 1/3 (33%)')
    expect(dskpLine({ dskpTagged: 0, dskpTotal: 0 })).toBe('DSKP: 0/0 (0%)')
  })

  it('knows which statuses start and the default size', () => {
    expect(isStartable('bersih')).toBe(true)
    expect(isStartable('bank_besar')).toBe(true)
    expect(isStartable('belum_cukup')).toBe(false)
    expect(setSize(34)).toBe(34)
    expect(setSize(null)).toBe(40)
  })

  it('builds chip texts and links', () => {
    expect(targetChip('spm', 40)).toBe('Target SPM: 40')
    expect(targetChip('latihan', 20)).toBe('Target Latihan: 20')
    expect(tileTarget('BM', 34)).toBe('BM · Target set: 34 soalan')
    expect(lockChip({ setNo: 1, readyCount: 9, target: 34 })).toBe('2026 Set 1 · 9/34')
    expect(setHref('GEO', 1)).toBe('/spm/ramalan/GEO?year=2026&set=1')
    expect(bahasaHref(2)).toBe('/latihan-berstruktur?subject_id=2&scope=spm&track=bahasa')
    expect(subjektifHref(17)).toBe('/latihan-berstruktur?subject_id=17&scope=spm')
  })

  it('parses ?year and ?set only when both are numbers', () => {
    expect(parseSetQuery({ year: '2026', set: '3' })).toEqual({ year: 2026, setNo: 3 })
    expect(parseSetQuery({ year: '2026' })).toBeNull()
    expect(parseSetQuery({ set: '3' })).toBeNull()
    expect(parseSetQuery({ year: 'abc', set: '3' })).toBeNull()
    expect(parseSetQuery({ year: ['2026', '2025'], set: ['3'] })).toEqual({ year: 2026, setNo: 3 })
  })

  it('filters the subjects of a tab and labels the best score', () => {
    const subjects = [
      { subjectId: 1, group: 'teras' },
      { subjectId: 2, group: 'elektif' },
    ] as Parameters<typeof tabSubjects>[0]
    expect(tabSubjects(subjects, 'all')).toHaveLength(2)
    expect(tabSubjects(subjects, 'teras').map((s) => s.subjectId)).toEqual([1])
    expect(tabSubjects(subjects, 'elektif').map((s) => s.subjectId)).toEqual([2])
    expect(bestScoreLabel(null)).toBe('Belum Ada')
    expect(bestScoreLabel(75)).toBe('75%')
  })

  it('recognises the refusals of a set start', () => {
    expect(isSetRefusal(new ApiError({ status: 422, code: 'SET_NOT_READY', message: 'x' }))).toBe(
      true,
    )
    expect(isSetRefusal(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))).toBe(true)
    expect(
      isSetRefusal(new ApiError({ status: 422, code: 'NOT_ENOUGH_QUESTIONS', message: 'x' })),
    ).toBe(true)
    expect(isSetRefusal(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x' }))).toBe(
      false,
    )
    expect(isSetRefusal(new ApiError({ status: 402, code: 'PAYMENT', message: 'x' }))).toBe(false)
    expect(isSetRefusal(new Error('x'))).toBe(false)
  })
})
