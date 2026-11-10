import { describe, expect, it } from 'vitest'
import { PracticeQuizQuestionSchema } from '@pp/contract'

import type { PracticeQuestion } from '../../src/modules/practice/ports'
import { quizQuestionsOf } from '../../src/modules/practice/practice-wire'
import { toPracticeQuestion } from '../../src/modules/practice/question-bridge'
import { mediaFileIds, practiceMediaOf } from '../../src/modules/practice/question-bridge/practice-media'
import type { QuestionPart, QuestionRecord, StimulusGroupRecord } from '../../src/modules/questions'

/**
 * T-C13 (D105, D90, PO core requirement): a drill question carries its rajah. EVERY member of a stimulus group carries the group's stimuli
 * (the 2nd and 3rd question show the rajah too), with its place in the group; a stimulus or option picture that cannot be shown refuses the
 * question; the key and the explanation never reach the wire.
 */
const leaf = (over: Record<string, unknown> = {}): QuestionPart =>
  ({
    label: '1',
    mode: 'mcq',
    marks: 1,
    prompt: { ms: 'Berdasarkan Rajah 1, pilih jawapan.' },
    options: ['A', 'B', 'C'].map((label) => ({ label, body: { ms: `Pilihan ${label}` } })),
    key: { kind: 'option', correct: 'B' },
    ...over,
  }) as unknown as QuestionPart

function record(id: string, over: { groupId?: string | null; position?: number | null; stimulusIds?: string[]; parts?: QuestionPart[] } = {}): QuestionRecord {
  const now = new Date('2026-11-01T00:00:00Z')
  return {
    id,
    isActive: true,
    sourceType: null,
    createdById: null,
    latestVersionNo: 1,
    liveVersionNo: 1,
    groupId: over.groupId ?? null,
    groupPosition: over.position ?? null,
    spmPool: true,
    createdAt: now,
    updatedAt: now,
    version: {
      id: `v${id}`,
      versionNo: 1,
      status: 'approved',
      archiveReason: null,
      publishedAt: now,
      type: 'mcq',
      stemMs: null,
      stemEn: null,
      numberLabel: null,
      language: 'ms',
      explanationMs: 'Kerana B (rahsia).',
      explanationEn: null,
      subjectId: '1',
      educationLevelId: '2',
      unitId: null,
      chapterId: '4',
      topicId: null,
      formOrigin: 't4',
      cognitiveLevel: null,
      kbat: null,
      tagReview: false,
      catalogueVersion: null,
      difficultyTp: 3,
      difficultyLevel: null,
      textbookRef: null,
      rejectionReason: null,
      sourcePage: null,
      setLabel: null,
      sourceFile: null,
      spIds: [],
      stimulusIds: over.stimulusIds ?? [],
      parts: over.parts ?? [leaf()],
      createdAt: now,
      updatedAt: now,
    },
  } as unknown as QuestionRecord
}

const rajah: StimulusGroupRecord = {
  id: 'G1',
  label: 'Rajah 1',
  stimuli: [
    { id: 's1', kind: 'diagram', label: 'Rajah 1', bodyMs: null, bodyEn: null, assetFileId: 'f1', alt: 'Graf halaju lawan masa', caption: 'Graf halaju', sourceCitation: 'SPM 2023' },
    { id: 's2', kind: 'table', label: 'Jadual 1', bodyMs: null, bodyEn: null, assetFileId: null, alt: null, tableData: { head: ['x', 'y'], rows: [['1', '2']] } },
  ],
  optionBank: [],
  questionIds: ['1', '2', '3'],
}
const tokens = new Map([['f1', 'TOKENf1AAAAAAAAAAAA']])
const ownImage = (sharedBy: number) => new Map([['s9', { kind: 'image', assetFileId: 'f1', label: '', bodyMs: null, alt: null, sharedBy }]])

describe('practiceMediaOf: what a drill question shows', () => {
  it('a group member gets the group stimuli (picture as a token URL, table grid, alt, caption, source) in order', () => {
    const m = practiceMediaOf(record('2', { groupId: 'G1', position: 2 }), rajah, new Map(), tokens)
    expect(m?.stimuli.map((s) => [s.kind, s.label])).toEqual([
      ['diagram', 'Rajah 1'],
      ['table', 'Jadual 1'],
    ])
    expect(m?.stimuli[0]).toMatchObject({ alt: 'Graf halaju lawan masa', caption: 'Graf halaju', source: 'SPM 2023', image: { url: '/api/files/TOKENf1AAAAAAAAAAAA' } })
    expect(m?.stimuli[1]?.table).toEqual({ head: ['x', 'y'], rows: [['1', '2']] })
  })

  it('EVERY member of the group carries the same stimuli, not only the first (D90): the 2nd and 3rd question show the rajah', () => {
    const served = ['1', '2', '3'].map((id, i) => {
      const r = record(id, { groupId: 'G1', position: i + 1 })
      return toPracticeQuestion(r, null, { allowStimulus: true, group: rajah, media: practiceMediaOf(r, rajah, new Map(), tokens) }) as PracticeQuestion
    })
    const wire = quizQuestionsOf(served, () => 0)
    for (const q of wire) {
      expect(q.stimuli?.map((s) => s.kind)).toEqual(['diagram', 'table'])
      expect(q.stimuli?.[0]?.image?.url).toBe('/api/files/TOKENf1AAAAAAAAAAAA')
    }
    expect(wire.map((q) => q.group)).toEqual([
      { id: 'G1', index: 1, size: 3 },
      { id: 'G1', index: 2, size: 3 },
      { id: 'G1', index: 3, size: 3 },
    ])
    expect(wire.map((q) => q.id)).toEqual(['1', '2', '3'])
  })

  it('the wire is valid against the strict contract and never carries the key or the explanation', () => {
    const r = record('1', { groupId: 'G1', position: 1 })
    const served = toPracticeQuestion(r, null, { allowStimulus: true, group: rajah, media: practiceMediaOf(r, rajah, new Map(), tokens) }) as PracticeQuestion
    const [wire] = quizQuestionsOf([served], () => 0)
    expect(PracticeQuizQuestionSchema.safeParse(wire).success).toBe(true)
    expect(JSON.stringify(wire)).not.toMatch(/correct|Kerana B|rahsia/i)
  })

  it('a question outside a group keeps its own linked figure (stem picture) and has no group', () => {
    const m = practiceMediaOf(record('7', { stimulusIds: ['s9'] }), null, ownImage(1) as never, tokens)
    expect(m?.stimuli).toHaveLength(1)
    expect(m?.stimuli[0]).toMatchObject({ kind: 'image', image: { url: '/api/files/TOKENf1AAAAAAAAAAAA' }, alt: 'Gambar untuk soalan ini' })
    const served = toPracticeQuestion(record('7'), null, { allowStimulus: true, media: m }) as PracticeQuestion
    expect(quizQuestionsOf([served], () => 0)[0]?.group).toBeUndefined()
  })

  it('option pictures become token URLs on the options', () => {
    const r = record('8', { parts: [leaf({ options: [{ label: 'A', body: { ms: 'Segi tiga' }, imageId: 'f1' }, { label: 'B', body: { ms: 'Bulatan' } }] })] })
    const served = toPracticeQuestion(r, null, { allowStimulus: true, media: practiceMediaOf(r, null, new Map(), tokens) }) as PracticeQuestion
    expect(quizQuestionsOf([served], () => 0)[0]?.options).toEqual([
      { id: 0, label: 'A', text: 'Segi tiga', imageUrl: '/api/files/TOKENf1AAAAAAAAAAAA' },
      { id: 1, label: 'B', text: 'Bulatan' },
    ])
  })

  it('refuses a picture with no public token, an option picture without one, and a stimulus shared by several questions but not grouped', () => {
    expect(practiceMediaOf(record('2', { groupId: 'G1' }), rajah, new Map(), new Map())).toBeNull()
    const withOption = record('8', { parts: [leaf({ options: [{ label: 'A', body: { ms: 'x' }, imageId: 'f2' }, { label: 'B', body: { ms: 'y' } }] })] })
    expect(practiceMediaOf(withOption, null, new Map(), tokens)).toBeNull()
    expect(practiceMediaOf(record('7', { stimulusIds: ['s9'] }), null, ownImage(2) as never, tokens)).toBeNull()
  })

  it('lists the files whose tokens are needed (group, own, option pictures)', () => {
    const own = new Map([['s9', { kind: 'image', assetFileId: 'f3', label: '', bodyMs: null, alt: null, sharedBy: 1 }]])
    const r = record('8', { groupId: 'G1', parts: [leaf({ options: [{ label: 'A', body: { ms: 'x' }, imageId: 'f2' }, { label: 'B', body: { ms: 'y' } }] })] })
    expect(mediaFileIds(r, rajah, own as never).sort()).toEqual(['f1', 'f2', 'f3'])
  })
})
