import { describe, expect, it } from 'vitest'

import { buildBody, emptyValues } from '../../components/soalan/form'
import {
  bidangLabel,
  chapterLabel,
  COPY,
  fileKind,
  isLoadableImage,
  isRtlScript,
  megabytes,
} from '../../components/soalan/lib'

describe('S21-S24 helpers', () => {
  it('uses the live delete confirm text', () => {
    expect(COPY.confirmDelete(522425)).toBe(
      'Padam soalan #522425? Tindakan ini tidak boleh dibatalkan.',
    )
  })

  it('formats labels', () => {
    expect(chapterLabel({ chapterNumber: 99, name: 'Kemahiran Bahasa' })).toBe(
      'Bab 99: Kemahiran Bahasa',
    )
    expect(bidangLabel({ code: '1.0', name: 'Bunyi' })).toBe('1.0 — Bunyi')
    expect(bidangLabel({ code: null, name: 'Bunyi' })).toBe('Bunyi')
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

describe('buildBody', () => {
  const base = () => ({
    ...emptyValues(),
    levelId: '11',
    subjectId: '1',
    difficulty: 'hard' as const,
    questionText: 'Soalan?',
  })

  it('sends the MCQ options and the correct index, keeping the difficulty keyword', () => {
    const body = buildBody({ ...base(), options: ['a', 'b', 'c', 'd'], correct: 2 })
    expect(body).toMatchObject({
      educationLevelId: 11,
      subjectId: 1,
      questionType: 'mcq',
      difficultyLevel: 'hard',
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: 2,
      dskpSpId: null,
    })
    expect(body.tfAnswer).toBeUndefined()
  })

  it('sends only the active answer block', () => {
    expect(buildBody({ ...base(), questionType: 'true_false', tfAnswer: 'false' })).toMatchObject({
      tfAnswer: false,
    })
    const short = buildBody({
      ...base(),
      questionType: 'short_answer',
      correctAnswerText: 'Jawapan',
      altAnswers: 'a, b',
    })
    expect(short).toMatchObject({ correctAnswer: 'Jawapan', altAnswers: 'a, b' })
    expect(short.options).toBeUndefined()
    const essay = buildBody({ ...base(), questionType: 'essay', modelAnswer: 'Contoh' })
    expect(essay.modelAnswer).toBe('Contoh')
  })

  it('sends the curriculum ids and the explanation when set', () => {
    const body = buildBody({
      ...base(),
      chapterId: '5',
      topicId: '9',
      spId: '221',
      explanation: 'Sebab',
      scriptType: 'jawi',
    })
    expect(body).toMatchObject({
      curriculumChapterId: 5,
      curriculumTopicId: 9,
      dskpSpId: 221,
      explanation: 'Sebab',
      scriptType: 'jawi',
    })
  })
})
