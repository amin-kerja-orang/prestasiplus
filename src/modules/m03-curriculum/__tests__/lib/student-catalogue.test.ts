import { describe, expect, it } from 'vitest'

import {
  ALL_GRADES,
  GRADE_CHIPS,
  MAP_GRADES,
  effectiveMapGrade,
  effectiveTopicGrade,
  formGrade,
  gradeLabel,
  mapTo,
  topicsTo,
} from '../../lib/student-catalogue'

describe('student catalogue scope (D54, D101: Tingkatan 1 to 5)', () => {
  it('grade chips are Semua Tingkatan + Tingkatan 1 to 5, no Darjah', () => {
    expect(GRADE_CHIPS).toEqual([
      { code: 'SEMUA', label: 'Semua Tingkatan' },
      { code: 'TINGKATAN_1', label: 'Tingkatan 1' },
      { code: 'TINGKATAN_2', label: 'Tingkatan 2' },
      { code: 'TINGKATAN_3', label: 'Tingkatan 3' },
      { code: 'TINGKATAN_4', label: 'Tingkatan 4' },
      { code: 'TINGKATAN_5', label: 'Tingkatan 5' },
    ])
    expect(JSON.stringify(GRADE_CHIPS)).not.toMatch(/darjah/i)
    expect([...MAP_GRADES]).toEqual(['TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4', 'TINGKATAN_5'])
  })

  it('gradeLabel', () => {
    expect(gradeLabel('TINGKATAN_4')).toBe('Tingkatan 4')
    expect(gradeLabel('TINGKATAN_5')).toBe('Tingkatan 5')
  })

  it('formGrade: grade 7..11 = Tingkatan 1..5, everything else Tingkatan 4', () => {
    expect([7, 8, 9, 10, 11].map((g) => formGrade(g))).toEqual([
      'TINGKATAN_1',
      'TINGKATAN_2',
      'TINGKATAN_3',
      'TINGKATAN_4',
      'TINGKATAN_5',
    ])
    expect(formGrade(1)).toBe('TINGKATAN_4')
    expect(formGrade(12)).toBe('TINGKATAN_4')
    expect(formGrade(null)).toBe('TINGKATAN_4')
    expect(formGrade(undefined)).toBe('TINGKATAN_4')
  })

  it('effectiveTopicGrade: SEMUA, T4/T5 (any case), else the form', () => {
    expect(effectiveTopicGrade('SEMUA', 11)).toBe(ALL_GRADES)
    expect(effectiveTopicGrade('semua', 10)).toBe(ALL_GRADES)
    expect(effectiveTopicGrade('TINGKATAN_4', 11)).toBe('TINGKATAN_4')
    expect(effectiveTopicGrade('tingkatan_5', 10)).toBe('TINGKATAN_5')
    expect(effectiveTopicGrade(null, 11)).toBe('TINGKATAN_5')
    expect(effectiveTopicGrade(null, null)).toBe('TINGKATAN_4')
    expect(effectiveTopicGrade('DARJAH_3', 11)).toBe('TINGKATAN_5')
    expect(effectiveTopicGrade('TINGKATAN_1', 10)).toBe('TINGKATAN_1')
    expect(effectiveTopicGrade('TINGKATAN_6', 10)).toBe('TINGKATAN_4')
    expect(effectiveTopicGrade(null, 7)).toBe('TINGKATAN_1')
  })

  it('effectiveMapGrade: T1 to T5 (any case), else the form; SEMUA is not a map grade', () => {
    expect(effectiveMapGrade('TINGKATAN_5', 10)).toBe('TINGKATAN_5')
    expect(effectiveMapGrade('tingkatan_4', 11)).toBe('TINGKATAN_4')
    expect(effectiveMapGrade(null, 11)).toBe('TINGKATAN_5')
    expect(effectiveMapGrade('SEMUA', 10)).toBe('TINGKATAN_4')
    expect(effectiveMapGrade('DARJAH_4', 10)).toBe('TINGKATAN_4')
  })

  it('link targets always carry the grade', () => {
    expect(topicsTo('TINGKATAN_4', null)).toEqual({
      path: '/topics',
      query: { grade_level: 'TINGKATAN_4' },
    })
    expect(topicsTo('SEMUA', 'SAINS')).toEqual({
      path: '/topics',
      query: { grade_level: 'SEMUA', subject: 'SAINS' },
    })
    expect(mapTo('SAINS', 'TINGKATAN_5')).toEqual({
      path: '/peta-belajar',
      query: { subject: 'SAINS', grade: 'TINGKATAN_5' },
    })
  })
})
