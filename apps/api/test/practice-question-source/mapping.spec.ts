import { describe, expect, it } from 'vitest'

import { difficultyOfTp, servableMcq, toPracticeQuestion, tpsOfDifficulty } from '../../src/modules/practice/question-bridge'
import type { QuestionPart, QuestionRecord } from '../../src/modules/questions'

const mcqLeaf = (over: Record<string, unknown> = {}): QuestionPart =>
  ({
    label: '1',
    mode: 'mcq',
    marks: 1,
    prompt: { ms: 'Pilih jawapan.' },
    options: ['A', 'B', 'C', 'D'].map((label) => ({ label, body: { ms: `Pilihan ${label}` } })),
    key: { kind: 'option', correct: 'C' },
    ...over,
  }) as unknown as QuestionPart

function record(over: { parts?: QuestionPart[]; type?: string; groupId?: string | null; stimulusIds?: string[]; stem?: string | null; language?: string; tp?: number | null; chapterId?: string | null } = {}): QuestionRecord {
  const now = new Date('2026-10-21T00:00:00Z')
  return {
    id: '42',
    isActive: true,
    sourceType: null,
    createdById: null,
    latestVersionNo: 3,
    liveVersionNo: 3,
    groupId: over.groupId ?? null,
    groupPosition: null,
    spmPool: true,
    createdAt: now,
    updatedAt: now,
    version: {
      id: '7',
      versionNo: 3,
      status: 'published',
      archiveReason: null,
      publishedAt: now,
      type: (over.type ?? 'mcq') as never,
      stemMs: over.stem === undefined ? 'Soalan pokok' : over.stem,
      stemEn: null,
      numberLabel: null,
      language: (over.language ?? 'ms') as never,
      explanationMs: 'Kerana C.',
      explanationEn: null,
      subjectId: '1',
      educationLevelId: '2',
      unitId: '3',
      chapterId: over.chapterId === undefined ? '4' : over.chapterId,
      topicId: null,
      formOrigin: 't4',
      cognitiveLevel: null,
      kbat: null,
      tagReview: false,
      catalogueVersion: null,
      difficultyTp: over.tp === undefined ? 6 : over.tp,
      sourcePage: null,
      setLabel: null,
      sourceFile: null,
      spIds: [],
      stimulusIds: over.stimulusIds ?? [],
      parts: over.parts ?? [mcqLeaf()],
      createdAt: now,
      updatedAt: now,
    },
  }
}

describe('BE-09 -> practice mapping', () => {
  it('maps a single text MCQ leaf: options in order, key label, version, dimensions, TP 6 as difficulty 5', () => {
    const q = toPracticeQuestion(record(), { name: 'Cikgu Contoh', profileUrl: null })
    expect(q).toEqual({
      id: '42',
      versionNo: 3,
      subjectId: '1',
      educationLevelId: '2',
      chapterId: '4',
      topicId: null,
      difficulty: 5,
      questionType: 'mcq',
      spmPool: true,
      questionText: 'Soalan pokok\n\nPilih jawapan.',
      textDirection: 'ltr',
      scriptType: 'rumi',
      hasDskp: true,
      contributor: { name: 'Cikgu Contoh', profileUrl: null },
      options: ['A', 'B', 'C', 'D'].map((label) => ({ label, text: `Pilihan ${label}` })),
      correctLabel: 'C',
      explanation: 'Kerana C.',
    })
  })

  it('stem equal to the prompt is not repeated; no stem uses the prompt; jawi is rtl', () => {
    expect(toPracticeQuestion(record({ stem: 'Pilih jawapan.' }), null)?.questionText).toBe('Pilih jawapan.')
    expect(toPracticeQuestion(record({ stem: null }), null)?.questionText).toBe('Pilih jawapan.')
    const jawi = toPracticeQuestion(record({ language: 'jawi', chapterId: null, tp: null }), null)
    expect(jawi).toMatchObject({ textDirection: 'rtl', scriptType: 'jawi', hasDskp: false, difficulty: null })
  })

  it.each([
    ['a non-MCQ type', record({ type: 'short' })],
    ['two parts', record({ parts: [mcqLeaf(), mcqLeaf({ label: '2' })] })],
    ['a stimulus group', record({ groupId: '9' })],
    ['a version stimulus', record({ stimulusIds: ['5'] })],
    ['a leaf stimulus', record({ parts: [mcqLeaf({ stimulusId: '5' })] })],
    ['an option image', record({ parts: [mcqLeaf({ options: [{ label: 'A', body: { ms: 'x' }, imageId: '8' }, { label: 'B', body: { ms: 'y' } }, { label: 'C', body: { ms: 'z' } }] })] })],
    ['a key naming no option', record({ parts: [mcqLeaf({ key: { kind: 'option', correct: 'H' } })] })],
    ['a non-MCQ leaf', record({ parts: [{ label: '1', mode: 'short_text', marks: 1, prompt: { ms: 'x' }, key: { kind: 'accepted', values: ['y'] } } as unknown as QuestionPart] })],
  ])('refuses %s (never served half-mapped)', (_name, r) => {
    expect(servableMcq(r).ok).toBe(false)
    expect(toPracticeQuestion(r, null)).toBeNull()
  })

  it('difficulty <-> TP', () => {
    expect([1, 2, 3, 4, 5].map(tpsOfDifficulty)).toEqual([[1], [2], [3], [4], [5, 6]])
    expect([null, 1, 5, 6].map(difficultyOfTp)).toEqual([null, 1, 5, 5])
  })
})
