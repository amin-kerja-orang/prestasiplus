import { describe, expect, it } from 'vitest'

import {
  dmy,
  handoffQuery,
  levelCodeOfSlug,
  orDash,
  pageOf,
  rubricShort,
  wordCount,
} from '../../components/teacher/lib'

describe('teacher lib', () => {
  it('pageOf: a positive integer, else 1', () => {
    expect(pageOf('3')).toBe(3)
    expect(pageOf(['2', '5'])).toBe(2)
    expect(pageOf('0')).toBe(1)
    expect(pageOf('abc')).toBe(1)
    expect(pageOf(undefined)).toBe(1)
  })

  it('dmy: YYYY-MM-DD to dd/mm/yyyy', () => {
    expect(dmy('2026-09-28')).toBe('28/09/2026')
    expect(dmy('x')).toBe('x')
  })

  it('rubricShort drops "(n markah)"', () => {
    expect(rubricShort('spm_bm_karangan')).toBe('SPM Bahasa Melayu — Karangan (Bahagian B)')
    expect(rubricShort('general')).toBe('Rubric Am (default)')
  })

  it('orDash shows "-" for empty text', () => {
    expect(orDash(null)).toBe('-')
    expect(orDash('  ')).toBe('-')
    expect(orDash(' Ali ')).toBe('Ali')
  })

  it('levelCodeOfSlug (BR-M13-18)', () => {
    expect(levelCodeOfSlug('tingkatan-5')).toBe('T5')
    expect(levelCodeOfSlug('tahun-3')).toBe('D3')
    expect(levelCodeOfSlug('pra')).toBe('')
  })

  it('wordCount counts \\S+ runs', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('  satu   dua\ntiga ')).toBe(3)
  })

  it('handoffQuery: form encoding, all six keys, empty values kept', () => {
    expect(
      handoffQuery({
        rubric: 'sejarah_essay',
        subject: 'Sejarah',
        level: 'T5',
        student: 'Murid Demo 03',
        title: 'Semangat Patriotisme',
      }),
    ).toBe(
      'action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme',
    )
    expect(
      handoffQuery({ rubric: 'general', subject: '', level: '', student: '', title: '' }),
    ).toBe('action=mark_essay&rubric=general&subject=&level=&student=&title=')
  })
})
