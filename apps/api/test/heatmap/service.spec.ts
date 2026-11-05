/**
 * S10-T05 part 3 (FR-MUR-14-3): the heatmap service with an in-memory answer port and curriculum (no database).
 * Per subject and Tingkatan: Bab data keeps Bab tiles, otherwise SP tiles (`number: null`) in the same `chapters[]`.
 */
import { describe, expect, it } from 'vitest'

import type { CurriculumRepository, HeatmapSpNode } from '../../src/modules/curriculum/curriculum.repository'
import { HeatmapService } from '../../src/modules/heatmap/heatmap.service'
import type { HeatmapPorts } from '../../src/modules/heatmap'
import type { ChapterCount, QuestionCount } from '../../src/modules/heatmap'

const T1 = { levelCode: 'T1', levelOrder: 1 }
const T4 = { levelCode: 'T4', levelOrder: 4 }

const sp = (id: number, subjectId: number, code: string, title: string, sortOrder: number, level = T4): HeatmapSpNode => ({
  id: BigInt(id),
  subjectId: BigInt(subjectId),
  code,
  title,
  sortOrder,
  ...level,
})

interface Fixture {
  chapterRows?: ChapterCount[]
  questionRows?: QuestionCount[]
  /** bigint chapter id -> subject id */
  chapters?: { id: number; subjectId: number; name: string; number: number | null; level?: typeof T1 }[]
  /** `subjectId:levelCode` pairs with Bab data */
  bab?: [number, string][]
  /** SP tags per question id */
  tagsByQuestion?: Record<string, HeatmapSpNode[]>
  /** SP tags of approved questions */
  approvedSp?: HeatmapSpNode[]
}

function service(f: Fixture): HeatmapService {
  const ports = {
    answerCounts: {
      chapterAnswerCounts: async () => f.chapterRows ?? [],
      questionAnswerCounts: async () => f.questionRows ?? [],
    },
  } as unknown as HeatmapPorts
  const chapters = f.chapters ?? []
  const curriculum = {
    chaptersByIds: async (ids: bigint[]) =>
      chapters.filter((c) => ids.includes(BigInt(c.id))).map((c) => ({ id: BigInt(c.id), name: c.name, subjectId: BigInt(c.subjectId) })),
    chaptersOfSubjectsInForms: async (subjectIds: bigint[]) =>
      chapters
        .filter((c) => subjectIds.includes(BigInt(c.subjectId)))
        .map((c) => ({
          id: BigInt(c.id),
          subjectId: BigInt(c.subjectId),
          name: c.name,
          chapterNumber: c.number,
          ...(c.level ?? T4),
        })),
    subjects: async () => [
      { id: 1n, code: 'MAT', name: 'Matematik', isCore: true },
      { id: 2n, code: 'SEJ', name: 'Sejarah', isCore: true },
    ],
    subjectLevelsWithBab: async () => (f.bab ?? []).map(([s, l]) => ({ subjectId: BigInt(s), levelCode: l })),
    spNodesOfApprovedQuestions: async () => f.approvedSp ?? [],
    spNodesOfQuestions: async (ids: bigint[]) => {
      const out = new Map<bigint, HeatmapSpNode[]>()
      for (const id of ids) {
        const tags = f.tagsByQuestion?.[id.toString()]
        if (tags) out.set(id, tags)
      }
      return out
    },
  } as unknown as CurriculumRepository
  return new HeatmapService(ports, curriculum)
}

const who = { userId: '7', isTest: false }

describe('HeatmapService SP fallback (FR-MUR-14-3)', () => {
  it('a subject with Bab data keeps Bab tiles; SP tags are ignored', async () => {
    const s = service({
      chapterRows: [{ chapterId: '11', attempts: 4, correct: 2 }],
      questionRows: [{ questionId: '100', attempts: 4, correct: 2 }],
      chapters: [
        { id: 11, subjectId: 1, name: 'Nombor', number: 1 },
        { id: 12, subjectId: 1, name: 'Algebra', number: 2 },
      ],
      bab: [[1, 'T4']],
      tagsByQuestion: { '100': [sp(501, 1, '1.1.1', 'Mengenal nombor', 1)] },
      approvedSp: [sp(501, 1, '1.1.1', 'Mengenal nombor', 1)],
    })
    const out = await s.forCaller(who)
    expect(out.subjects).toHaveLength(1)
    expect(out.subjects[0]?.chapters.map((c) => [c.id, c.number, c.name, c.state])).toEqual([
      ['11', 1, 'Nombor', 'amber'],
      ['12', 2, 'Algebra', 'belum-cuba'],
    ])
  })

  it('a subject without Bab data gets SP tiles with number null; an unattempted SP is belum-cuba', async () => {
    const s = service({
      questionRows: [{ questionId: '200', attempts: 3, correct: 3 }],
      bab: [],
      tagsByQuestion: { '200': [sp(601, 2, '2.1.1', 'Memahami sejarah', 1)] },
      approvedSp: [sp(601, 2, '2.1.1', 'Memahami sejarah', 1), sp(602, 2, '2.1.2', 'Menghuraikan peristiwa', 2)],
    })
    const out = await s.forCaller(who)
    expect(out.subjects).toEqual([
      {
        id: '2',
        code: 'SEJ',
        name: 'Sejarah',
        chapters: [
          { id: '601', number: null, name: '2.1.1 Memahami sejarah', attempts: 3, correct: 3, accuracy: 100, state: 'green' },
          { id: '602', number: null, name: '2.1.2 Menghuraikan peristiwa', attempts: 0, correct: 0, accuracy: null, state: 'belum-cuba' },
        ],
      },
    ])
  })

  it('a mixed pupil: one subject on Bab tiles, the other on SP tiles; Subjek Teras then name order', async () => {
    const s = service({
      chapterRows: [{ chapterId: '11', attempts: 1, correct: 0 }],
      questionRows: [{ questionId: '200', attempts: 2, correct: 1 }],
      chapters: [{ id: 11, subjectId: 1, name: 'Nombor', number: 1 }],
      bab: [[1, 'T4']],
      tagsByQuestion: { '200': [sp(601, 2, '2.1.1', 'Memahami sejarah', 1)] },
    })
    const out = await s.forCaller(who)
    expect(out.subjects.map((x) => x.code)).toEqual(['MAT', 'SEJ'])
    expect(out.subjects[0]?.chapters).toEqual([
      { id: '11', number: 1, name: 'Nombor', attempts: 1, correct: 0, accuracy: 0, state: 'red' },
    ])
    expect(out.subjects[1]?.chapters).toEqual([
      { id: '601', number: null, name: '2.1.1 Memahami sejarah', attempts: 2, correct: 1, accuracy: 50, state: 'amber' },
    ])
  })

  it('per Tingkatan: T4 has Bab data (Bab tiles), T1 has none (SP tiles) in the same subject block', async () => {
    const s = service({
      chapterRows: [{ chapterId: '11', attempts: 1, correct: 1 }],
      questionRows: [{ questionId: '300', attempts: 1, correct: 0 }],
      chapters: [
        { id: 11, subjectId: 1, name: 'Nombor', number: 1 },
        { id: 13, subjectId: 1, name: 'Bab T1', number: 1, level: T1 },
      ],
      bab: [[1, 'T4']],
      tagsByQuestion: { '300': [sp(701, 1, '1.1.1', 'Sifir', 1, T1)] },
    })
    const out = await s.forCaller(who)
    expect(out.subjects[0]?.chapters.map((c) => [c.id, c.number, c.state])).toEqual([
      ['11', 1, 'green'],
      ['701', null, 'red'],
    ])
  })

  it('accuracy rounds to 1 decimal on the wire (7 attempts, 4 correct = 57.1, state amber)', async () => {
    const s = service({
      questionRows: [{ questionId: '200', attempts: 7, correct: 4 }],
      tagsByQuestion: { '200': [sp(601, 2, '2.1.1', 'Memahami sejarah', 1)] },
    })
    const tile = (await s.forCaller(who)).subjects[0]?.chapters[0]
    expect(tile).toMatchObject({ attempts: 7, correct: 4, accuracy: 57.1, state: 'amber' })
  })

  it('two questions on one SP pool their attempts; a question with two SP tags counts for both', async () => {
    const a = sp(601, 2, '2.1.1', 'A', 1)
    const b = sp(602, 2, '2.1.2', 'B', 2)
    const s = service({
      questionRows: [
        { questionId: '200', attempts: 3, correct: 1 },
        { questionId: '201', attempts: 2, correct: 2 },
      ],
      tagsByQuestion: { '200': [a, b], '201': [a] },
    })
    const tiles = (await s.forCaller(who)).subjects[0]?.chapters
    expect(tiles?.map((c) => [c.id, c.attempts, c.correct, c.accuracy])).toEqual([
      ['601', 5, 3, 60],
      ['602', 3, 1, 33.3],
    ])
  })

  it('no answers, or answers with neither a Bab nor an SP tag, give an empty subject list', async () => {
    expect((await service({}).forCaller(who)).subjects).toEqual([])
    const s = service({ questionRows: [{ questionId: '999', attempts: 2, correct: 1 }] })
    expect((await s.forCaller(who)).subjects).toEqual([])
  })

  it('an SP-tagged attempt in a Bab Tingkatan does not list the subject (no tile maps to it)', async () => {
    const s = service({
      questionRows: [{ questionId: '200', attempts: 2, correct: 1 }],
      bab: [[2, 'T4']],
      tagsByQuestion: { '200': [sp(601, 2, '2.1.1', 'Memahami sejarah', 1)] },
    })
    expect((await s.forCaller(who)).subjects).toEqual([])
  })
})
