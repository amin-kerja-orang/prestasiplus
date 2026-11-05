import { describe, expect, it } from 'vitest'

import {
  DSKP_MESSAGES,
  dskpRequired,
  parseTp,
  validateDskp,
} from '../../components/soalan/dskp-rule'
import { emptyValues, validateForm } from '../../components/soalan/form'

const none = { chapterId: '', spIds: [], tp: '', cognitiveLevel: '' }

describe('dskp-rule (D112; shared with S6-T16)', () => {
  it('Bab is required only when chapters exist, SP/TP/Aras only where DSKP nodes exist', () => {
    expect(dskpRequired({ hasChapters: true, hasDskpNodes: false })).toEqual({
      chapterId: true,
      spIds: false,
      tp: false,
      cognitiveLevel: false,
    })
    expect(dskpRequired({ hasChapters: false, hasDskpNodes: true })).toEqual({
      chapterId: false,
      spIds: true,
      tp: true,
      cognitiveLevel: true,
    })
  })

  it('AC-GUR-44-10: with chapters and nodes every empty field gets its exact BM text', () => {
    expect(validateDskp(none, { hasChapters: true, hasDskpNodes: true })).toEqual({
      chapterId: 'Sila pilih bab.',
      spIds: 'Sila pilih Standard Pembelajaran (SP).',
      tp: 'Sila pilih TP.',
      cognitiveLevel: 'Sila pilih aras pemikiran.',
    })
  })

  it('AC-GUR-44-10: without chapters or nodes nothing is required', () => {
    expect(validateDskp(none, { hasChapters: false, hasDskpNodes: false })).toEqual({})
  })

  it('a complete pick is valid', () => {
    expect(
      validateDskp(
        { chapterId: '5', spIds: ['9'], tp: '3', cognitiveLevel: 'menilai' },
        { hasChapters: true, hasDskpNodes: true },
      ),
    ).toEqual({})
  })

  it('a TP outside 1 to 6 is refused even when optional', () => {
    expect(validateDskp({ ...none, tp: '7' }, { hasChapters: false, hasDskpNodes: false }).tp).toBe(
      DSKP_MESSAGES.tpRange,
    )
    expect(parseTp('0')).toBeNull()
    expect(parseTp('6')).toBe(6)
  })

  it('AC-GUR-44-12: every field filled except Bab gives only "Sila pilih bab."', () => {
    const v = {
      ...emptyValues(),
      levelId: '1',
      subjectId: '2',
      spId: '9',
      tp: '3',
      cognitiveLevel: 'memahami',
      difficulty: '3',
      questionText: 'Soalan?',
      options: ['a', 'b', 'c', 'd'],
      correct: 1,
    }
    expect(validateForm(v, { hasChapters: true, hasDskpNodes: true })).toEqual({
      chapterId: 'Sila pilih bab.',
    })
  })
})

describe('validateForm (44-F1 texts)', () => {
  it('names each missing field in the PRD text', () => {
    const e = validateForm(emptyValues(), { hasChapters: false, hasDskpNodes: false })
    expect(e).toEqual({
      educationLevelId: 'Sila pilih tingkatan.',
      subjectId: 'Sila pilih subjek.',
      difficultyLevel: 'Sila pilih kesukaran.',
      questionText: 'Sila isi soalan.',
      options: 'Sila isi pilihan A.',
      correctAnswer: 'Sila tanda satu jawapan yang betul.',
    })
  })

  it('checks lengths', () => {
    const e = validateForm(
      {
        ...emptyValues(),
        questionText: 'x'.repeat(2001),
        options: ['a', 'b', 'c'.repeat(501), 'd'],
        explanation: 'e'.repeat(2001),
      },
      { hasChapters: false, hasDskpNodes: false },
    )
    expect(e.questionText).toBe('Soalan tidak boleh melebihi 2000 aksara.')
    expect(e.options).toBe('Pilihan C tidak boleh melebihi 500 aksara.')
    expect(e.explanation).toBe('Penerangan tidak boleh melebihi 2000 aksara.')
  })
})
