import { describe, expect, it } from 'vitest'

import { isLowerFormGrade, LOWER_FORM_COPY } from '../lower-form'

describe('isLowerFormGrade', () => {
  it('holds back a student in Tingkatan 1-3 (grade 7-9) only', () => {
    expect([6, 7, 8, 9, 10, 11].map((g) => isLowerFormGrade('student', g))).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ])
  })

  it('never holds back staff or a student without a grade', () => {
    expect(isLowerFormGrade('teacher', 7)).toBe(false)
    expect(isLowerFormGrade('admin', 8)).toBe(false)
    expect(isLowerFormGrade('student', null)).toBe(false)
    expect(isLowerFormGrade(undefined, 7)).toBe(false)
  })

  it('has the agreed copy', () => {
    expect(LOWER_FORM_COPY.title).toBe('Kandungan akan datang')
    expect(LOWER_FORM_COPY.description).toBe(
      'Kandungan untuk Tingkatan anda akan datang. Buat masa ini, latihan tersedia untuk Tingkatan 4 dan 5.',
    )
  })
})
