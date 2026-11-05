import { describe, expect, it } from 'vitest'

import { buildBody, emptyValues } from '../../components/soalan/form'
import {
  chapterLabel,
  COPY,
  DIFFICULTY_OPTIONS,
  difficultyFromTp,
  fileKind,
  isLoadableImage,
  isRtlScript,
  megabytes,
  rejectionLine,
  spLabel,
  STATUS_WORDS,
} from '../../components/soalan/lib'

describe('S21-S24 helpers', () => {
  it('uses the live delete confirm text', () => {
    expect(COPY.confirmDelete(522425)).toBe(
      'Padam soalan #522425? Tindakan ini tidak boleh dibatalkan.',
    )
  })

  it('formats labels', () => {
    expect(chapterLabel({ chapterNumber: null, name: 'Kemahiran Bahasa' })).toBe('Kemahiran Bahasa')
    expect(megabytes(1.5 * 1024 * 1024)).toBe('1.50 MB')
    expect(fileKind('a.PDF')).toBe('pdf')
    expect(fileKind('a.docx')).toBe('word')
    expect(fileKind('a.xlsx')).toBe('excel')
    expect(fileKind('a.zip')).toBe('file')
  })

  it('treats only Arab and Jawi as right to left', () => {
    expect(isRtlScript('arab')).toBe(true)
    expect(isRtlScript('jawi')).toBe(true)
    expect(isRtlScript('mixed')).toBe(false)
    expect(isRtlScript('rumi')).toBe(false)
  })

  it('never loads a mock blob reference', () => {
    expect(isLoadableImage('blob:mock/question/a.png')).toBe(false)
    expect(isLoadableImage(null)).toBe(false)
    expect(isLoadableImage('https://x/y.png')).toBe(true)
  })
})

describe('buildBody (44-F1, MCQ only)', () => {
  const base = () => ({
    ...emptyValues(),
    levelId: '11',
    subjectId: '1',
    difficulty: '4',
    questionText: 'Soalan?',
    options: ['a', 'b', 'c', 'd'],
    correct: 2,
  })

  it('sends questionType mcq, an int difficultyLevel, the options and the correct index', () => {
    const body = buildBody(base())
    expect(body).toMatchObject({
      educationLevelId: 11,
      subjectId: 1,
      questionType: 'mcq',
      difficultyLevel: 4,
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: 2,
    })
    expect(body.chapterId).toBeUndefined()
    expect(body.spIds).toBeUndefined()
    expect(body.tp).toBeUndefined()
  })

  it('sends Bab, a one-element spIds, TP and Aras when chosen, and the explanation', () => {
    const body = buildBody({
      ...base(),
      chapterId: '5',
      spId: '221',
      tp: '3',
      cognitiveLevel: 'mengaplikasi',
      explanation: 'Sebab',
      scriptType: 'jawi',
    })
    expect(body).toMatchObject({
      chapterId: 5,
      spIds: [221],
      tp: 3,
      cognitiveLevel: 'mengaplikasi',
      explanation: 'Sebab',
      scriptType: 'jawi',
    })
  })
})

describe('R1-GUR-44 labels and status words', () => {
  it('FR-GUR-44-9: five star options from Sangat mudah to Sangat sukar', () => {
    expect(DIFFICULTY_OPTIONS.map((d) => d.label)).toEqual([
      '⭐ — Sangat mudah',
      '⭐⭐ — Mudah',
      '⭐⭐⭐ — Sederhana',
      '⭐⭐⭐⭐ — Sukar',
      '⭐⭐⭐⭐⭐ — Sangat sukar',
    ])
    expect(DIFFICULTY_OPTIONS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5])
  })

  it('44-F1: Kesukaran defaults to min(5, TP)', () => {
    expect(difficultyFromTp(3)).toBe(3)
    expect(difficultyFromTp(6)).toBe(5)
  })

  it('FR-GUR-44-10: the three status words and the rejection line', () => {
    expect(STATUS_WORDS).toEqual({
      pending: 'Menunggu Semakan',
      approved: 'Diluluskan',
      rejected: 'Ditolak',
    })
    expect(rejectionLine('Salah jawapan')).toBe('Sebab: Salah jawapan')
  })

  it('44-F1: Bab label "{nombor}. {nama}" and SP label "{kod} {nama}"', () => {
    expect(chapterLabel({ chapterNumber: 2, name: 'Bunyi' })).toBe('2. Bunyi')
    expect(spLabel({ code: '1.1.1', description: 'Menyebut' })).toBe('1.1.1 Menyebut')
  })

  it('FR-GUR-44-3, 44-F3: success and result texts', () => {
    expect(COPY.paperSent).toBe('Kertas dihantar kepada admin.')
    expect(COPY.created).toBe('Soalan dihantar untuk semakan.')
    expect(COPY.importDone(2, 1)).toBe('2 soalan diimport, 1 baris gagal.')
  })
})
