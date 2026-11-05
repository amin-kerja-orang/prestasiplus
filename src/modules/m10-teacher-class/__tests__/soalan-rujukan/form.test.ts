import { describe, expect, it } from 'vitest'

import {
  buildBody,
  emptyValues,
  excerpt,
  isHttpUrl,
  RUJUKAN_MESSAGES,
  validateForm,
  type RujukanValues,
} from '../../components/soalan-rujukan/form'

const NO_DSKP = { hasChapters: false, hasDskpNodes: false }
const WITH_DSKP = { hasChapters: true, hasDskpNodes: true }

const filled = (over: Partial<RujukanValues> = {}): RujukanValues => ({
  ...emptyValues(),
  subjectId: '3',
  levelId: '10',
  difficulty: '3',
  text: 'Apakah 2 + 2?',
  options: ['3', '4', '5', '6'],
  correct: 1,
  ...over,
})

describe('validateForm (R1-GUR-44a field table)', () => {
  it('an empty form shows the exact BM texts of the required fields', () => {
    const e = validateForm(emptyValues(), NO_DSKP)
    expect(e).toEqual({
      subjectId: 'Sila pilih subjek.',
      educationLevelId: 'Sila pilih tingkatan.',
      difficulty: 'Sila pilih kesukaran.',
      text: 'Sila isi teks soalan.',
      options: 'Sila isi pilihan A.',
      correctIndex: 'Sila tanda satu jawapan yang betul.',
    })
  })

  it('names the first empty option (B, C, D alike)', () => {
    expect(validateForm(filled({ options: ['a', '', 'c', ''] }), NO_DSKP).options).toBe(
      'Sila isi pilihan B.',
    )
    expect(validateForm(filled({ options: ['a', 'b', 'c', ' '] }), NO_DSKP).options).toBe(
      'Sila isi pilihan D.',
    )
  })

  it('AC-GUR-44a-2: Teks Soalan empty is refused', () => {
    expect(validateForm(filled({ text: '   ' }), NO_DSKP).text).toBe('Sila isi teks soalan.')
  })

  it('limits: text 2000, option 500, link 2048', () => {
    expect(validateForm(filled({ text: 'a'.repeat(2001) }), NO_DSKP).text).toBe(
      'Teks soalan tidak boleh melebihi 2000 aksara.',
    )
    expect(validateForm(filled({ text: 'a'.repeat(2000) }), NO_DSKP).text).toBeUndefined()
    expect(
      validateForm(filled({ options: ['a', 'b', 'c'.repeat(501), 'd'] }), NO_DSKP).options,
    ).toBe('Pilihan C tidak boleh melebihi 500 aksara.')
    const long = `https://example.org/${'a'.repeat(2040)}`
    expect(validateForm(filled({ referenceUrl: long }), NO_DSKP).referenceUrl).toBe(
      'Pautan tidak boleh melebihi 2048 aksara.',
    )
  })

  it('AC-GUR-44a-8: ftp://contoh is refused with the exact text', () => {
    expect(validateForm(filled({ referenceUrl: 'ftp://contoh' }), NO_DSKP).referenceUrl).toBe(
      'Pautan mesti bermula dengan http:// atau https://.',
    )
  })

  it('AC-GUR-44a-3: javascript:alert(1) is refused', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,x',
      'https://',
    ]) {
      expect(isHttpUrl(bad), bad).toBe(false)
      expect(validateForm(filled({ referenceUrl: bad }), NO_DSKP).referenceUrl, bad).toBe(
        RUJUKAN_MESSAGES.url,
      )
    }
  })

  it('accepts http and https and an empty link (optional)', () => {
    for (const ok of ['http://example.org/a', 'https://example.org/rujukan', '']) {
      expect(validateForm(filled({ referenceUrl: ok }), NO_DSKP).referenceUrl, ok).toBeUndefined()
    }
  })

  it('AC-GUR-44a-7: SP, Bab, TP and Aras are required only where they exist (D112)', () => {
    expect(validateForm(filled(), NO_DSKP)).toEqual({})
    const e = validateForm(filled(), WITH_DSKP)
    expect(e.chapterId).toBe('Sila pilih bab.')
    expect(e.spIds).toBe('Sila pilih Standard Pembelajaran (SP).')
    expect(e.tp).toBe('Sila pilih TP.')
    expect(e.cognitiveLevel).toBe('Sila pilih aras pemikiran.')
  })

  it('a TP outside 1 to 6 gets the range text', () => {
    expect(validateForm(filled({ tp: '7' }), NO_DSKP).tp).toBe(
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
    )
  })
})

describe('buildBody (API-GUR-24)', () => {
  it('AC-GUR-44a-1: the body carries B as correctIndex 1 and the link', () => {
    expect(buildBody(filled({ referenceUrl: ' https://example.org/rujukan ' }))).toEqual({
      subjectId: 3,
      educationLevelId: 10,
      difficulty: 3,
      text: 'Apakah 2 + 2?',
      options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '6' }],
      correctIndex: 1,
      referenceUrl: 'https://example.org/rujukan',
    })
  })

  it('sends only the DSKP fields that were chosen and no empty link', () => {
    const body = buildBody(
      filled({ chapterId: '7', spId: '111', tp: '4', cognitiveLevel: 'menilai' }),
    )
    expect(body).toMatchObject({ chapterId: 7, spIds: [111], tp: 4, cognitiveLevel: 'menilai' })
    expect(body).not.toHaveProperty('referenceUrl')
    expect(buildBody(filled())).not.toHaveProperty('chapterId')
  })
})

describe('excerpt', () => {
  it('cuts the list text at 120 characters', () => {
    expect(excerpt('a'.repeat(120))).toBe('a'.repeat(120))
    expect(excerpt('a'.repeat(121))).toBe(`${'a'.repeat(120)}…`)
  })
})
