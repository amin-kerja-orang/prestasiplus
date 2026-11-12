/**
 * KP-15 (list, cover and start agree): a question a published fixed paper places that is unservable ONLY because a picture file is
 * missing keeps the paper listed, the cover available and the start allowed (the question is served with the image placeholder). Every
 * other rule is unchanged: a draft live version, a taken-down pin and a generated (jana) paper still hide / refuse as before.
 *
 * DB-free: the REAL `Be09BijakQuestionSource`, `PapersService` and `BijakPapersAttemptSource` over fake repositories.
 */
import { QuestionPartSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { BijakPapersAttemptSource, PapersService } from '../../src/modules/bijak/papers'
import { BijakPapersPorts, pinKey, placesUnservable } from '../../src/modules/bijak/papers/ports'
import { Be09BijakQuestionSource } from '../../src/modules/bijak/question-bridge/be09-question-source'
import type { QuestionRecord } from '../../src/modules/questions/types'

const now = new Date('2026-01-01T00:00:00Z')
const mcq = (withImages: boolean) =>
  QuestionPartSchema.parse({
    label: '',
    marks: 2,
    mode: 'mcq',
    key: { kind: 'option', correct: 'A' },
    prompt: { ms: 'Pilih.' },
    options: [
      { label: 'A', body: { ms: 'Satu' }, ...(withImages ? { imageId: '502' } : {}) },
      { label: 'B', body: { ms: 'Dua' } },
    ],
  })
const rec = (id: string, withImages: boolean, status = 'approved') =>
  ({
    id,
    isActive: true,
    sourceType: 'manual',
    createdById: null,
    latestVersionNo: 1,
    liveVersionNo: 1,
    groupId: null,
    groupPosition: null,
    spmPool: true,
    createdAt: now,
    updatedAt: now,
    version: {
      id: `v${id}`,
      versionNo: 1,
      status,
      archiveReason: null,
      publishedAt: now,
      type: 'mcq',
      stemMs: 'Soalan.',
      language: 'ms',
      explanationMs: null,
      subjectId: null,
      unitId: null,
      formOrigin: 't4',
      difficultyTp: 3,
      spIds: [],
      stimulusIds: [],
      parts: [mcq(withImages)],
      createdAt: now,
      updatedAt: now,
    },
  }) as unknown as QuestionRecord

function build(records: QuestionRecord[], kind: 'pilihan' | 'jana' = 'pilihan') {
  const questions = {
    // the live read: only a question with a live version; the pinned read: exactly the pinned (id, version)
    getMany: (ids: string[]) => Promise.resolve(records.filter((r) => ids.includes(r.id))),
    getVersions: (pins: { questionId: string; versionNo: number }[]) =>
      Promise.resolve(records.filter((r) => pins.some((p) => p.questionId === r.id && p.versionNo === r.version.versionNo))),
    groupOf: () => Promise.resolve(null),
    stimulusAssets: () => Promise.resolve([]),
    unservableAmong: () => Promise.resolve(new Set<string>()),
    withdrawnVersionNos: () => Promise.resolve(new Map()),
    versionStimuli: () => Promise.resolve([]),
    stimulusUseCounts: () => Promise.resolve(new Map()),
  }
  // file 502 has no token: an option picture whose file is missing
  const source = new Be09BijakQuestionSource(
    questions as never,
    { subject: () => Promise.resolve(null), nodeById: () => Promise.resolve(null) } as never,
    { publicIdsOf: (ids: string[]) => Promise.resolve(new Map(ids.filter((i) => i !== '502').map((i) => [i, `tok${i}`]))) },
  )
  const ports = new BijakPapersPorts()
  ports.provideQuestionSource({
    getMany: (ids, pins) => source.getMany(ids, pins),
    takenDownPins: (pins) => source.takenDownPins(pins),
    pool: () => Promise.resolve({ entries: [], groups: new Map() }),
  })
  const paper = {
    id: 7n,
    kind,
    status: 'published',
    surface: 'simulasi',
    title: 'Kertas Contoh',
    kertas: 2,
    year: 2024,
    paperCode: '1449/2',
    printedDurationMin: 90,
    totalMarks: null,
    examBoard: null,
    levelScope: null,
    subjectId: 1n,
    instructions: [],
    referenceSheets: [],
    generatedForUserId: kind === 'jana' ? 5n : null,
    publishedAt: now,
    createdAt: now,
    sections: [
      {
        id: 70n,
        label: 'A',
        title: null,
        instruction: null,
        compulsory: true,
        markBudget: 2,
        ruleType: 'all',
        ruleN: null,
        placements: records.map((r, i) => ({ questionId: BigInt(r.id), pinnedVersionNo: 1, marksOverride: null, position: i + 1 })),
      },
    ],
  }
  const repo = {
    gradeOf: () => Promise.resolve(10),
    listPublishedPilihan: () => Promise.resolve([paper]),
    findPaper: () => Promise.resolve(paper),
    subjectsByIds: () => Promise.resolve(new Map([['1', { id: 1n, code: 'MATH', name: 'Matematik' }]])),
  }
  const service = new PapersService(repo as never, ports, { now: () => now })
  const start = new BijakPapersAttemptSource(repo as never, ports)
  return { service, start, source, ports }
}

const USER = '5'
const listed = async (s: PapersService): Promise<string[]> => (await s.listPapers(USER)).map((p) => p.id)
const startOf = async (s: BijakPapersAttemptSource) => (await s.resolveForAttempt({ userId: USER, paperId: '7', isTest: false })).ok

describe('KP-15: a placed question missing only its picture file keeps the paper (list, cover, start)', () => {
  it('listed, cover available, start allowed; the start serves the placeholder; marks unchanged', async () => {
    const t = build([rec('1', false), rec('2', true)])
    expect(await listed(t.service)).toEqual(['7'])
    const cover = await t.service.getCover(USER, '7')
    expect(cover.unavailable).toBe(false)
    expect(cover.marks).toBe(4)
    expect(await startOf(t.start)).toBe(true)
    const bundles = await t.source.loadQuestions(['1', '2'], new Map([['1', 1], ['2', 1]]))
    expect([...bundles.keys()].sort()).toEqual(['1', '2'])
    expect(JSON.stringify(bundles.get('2'))).toContain('Gambar tiada')
  })

  it('a draft live version is still hidden by the list, unavailable on the cover and refused by the start (as today)', async () => {
    const t = build([rec('1', false), rec('2', true, 'draft')])
    expect(await listed(t.service)).toEqual([])
    expect(await t.service.getCover(USER, '7')).toMatchObject({ unavailable: true, unavailableReason: 'QUESTION_WITHDRAWN' })
    expect(await startOf(t.start)).toBe(false)
  })

  it('a draft question WITHOUT a missing picture is still hidden (control)', async () => {
    const t = build([rec('1', false, 'draft')])
    expect(await listed(t.service)).toEqual([])
  })

  it('a pin that is taken down still hides the paper even when the picture is the missing part', async () => {
    const t = build([rec('2', true)])
    const down = new Set([pinKey({ questionId: '2', versionNo: 1 })])
    const original = t.ports.questionSource
    ;(t.ports as unknown as { questions: unknown }).questions = { ...original, getMany: (ids: string[], pins: never) => original.getMany(ids, pins), takenDownPins: () => Promise.resolve(down), pool: original.pool }
    expect(await listed(t.service)).toEqual([])
    expect(await startOf(t.start)).toBe(false)
  })

  it('a generated (jana) paper is an automatic draw: it keeps hiding the question and refuses the start', async () => {
    const t = build([rec('2', true)], 'jana')
    expect(await startOf(t.start)).toBe(false)
    expect((await t.service.getCover(USER, '7')).unavailable).toBe(true)
  })

  it('the read is batched: one pinned read for the whole list, not one per paper', async () => {
    const t = build([rec('1', true), rec('2', true), rec('3', true)])
    const info = await t.source.getMany(['1', '2', '3'], ['1', '2', '3'].map((questionId) => ({ questionId, versionNo: 1 })))
    expect([...info.keys()].sort()).toEqual(['1', '2', '3'])
  })

  it('without pins the eligibility read is unchanged (a missing picture is still absent)', async () => {
    const t = build([rec('2', true)])
    expect((await t.source.getMany(['2'])).size).toBe(0)
  })
})

describe('the decision rule is unchanged (DB-free)', () => {
  const pins = [{ questionId: '1', versionNo: 1 }]
  it('no pins, an unserved id or a taken-down pin is unservable', () => {
    expect(placesUnservable([], new Map(), new Set())).toBe(true)
    expect(placesUnservable(pins, new Map(), new Set())).toBe(true)
    expect(placesUnservable(pins, new Map([['1', 1]]), new Set([pinKey(pins[0]!)]))).toBe(true)
    expect(placesUnservable(pins, new Map([['1', 1]]), new Set())).toBe(false)
  })
})
