/**
 * R1-B08: `Be09BijakQuestionSource` resolves file tokens and serves a published bank question with an image
 * stimulus (shared by two members) plus option images; a refused one is reported with its BM reason.
 * Fake repositories (no database): the pupil read rule itself is covered by `test/files/question-image-access.spec.ts`
 * (it reads exactly the stimulus asset of a group member and the option images this source puts on the wire).
 */
import { QuestionPartSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { buildServedPaper } from '../../src/modules/bijak/attempts/marking'
import { Be09BijakQuestionSource } from '../../src/modules/bijak/question-bridge/be09-question-source'
import type { QuestionRecord, StimulusGroupRecord } from '../../src/modules/questions/types'

const now = new Date('2026-01-01T00:00:00Z')
const mcq = (withImages: boolean) =>
  QuestionPartSchema.parse({
    label: '',
    marks: 2,
    mode: 'mcq',
    key: { kind: 'option', correct: 'A' },
    prompt: { ms: 'Pilih.' },
    options: [
      { label: 'A', body: { ms: 'Satu' }, ...(withImages ? { imageId: '501' } : {}) },
      { label: 'B', body: { ms: 'Dua' }, ...(withImages ? { imageId: '502' } : {}) },
      { label: 'C', body: { ms: 'Tiga' } },
    ],
  })
const rec = (id: string, withImages: boolean, extra: Partial<QuestionRecord['version']> = {}) =>
  ({
    id,
    isActive: true,
    sourceType: 'manual',
    createdById: null,
    latestVersionNo: 1,
    liveVersionNo: 1,
    groupId: '9',
    groupPosition: null,
    spmPool: true,
    createdAt: now,
    updatedAt: now,
    version: {
      id: `v${id}`,
      versionNo: 1,
      status: 'published',
      archiveReason: null,
      publishedAt: now,
      type: 'mcq',
      stemMs: 'Lihat Rajah 1.',
      language: 'ms',
      explanationMs: null,
      subjectId: null,
      unitId: null,
      formOrigin: 't4',
      difficultyTp: 3,
      spIds: [],
      stimulusIds: ['71'],
      parts: [mcq(withImages)],
      createdAt: now,
      updatedAt: now,
      ...extra,
    },
  }) as unknown as QuestionRecord

const group: StimulusGroupRecord = {
  id: '9',
  stimuli: [
    { id: '71', kind: 'image', label: 'Rajah 1', bodyMs: null, bodyEn: null, assetFileId: '900', alt: 'Rajah satu' },
  ] as unknown as StimulusGroupRecord['stimuli'],
  optionBank: [],
  questionIds: ['1', '2'],
}

const source = (records: QuestionRecord[]) =>
  new Be09BijakQuestionSource(
    {
      getMany: (ids: string[]) => Promise.resolve(records.filter((r) => ids.includes(r.id))),
      groupOf: () => Promise.resolve(group),
      stimulusAssets: () => Promise.resolve([]),
    } as never,
    {
      subject: () => Promise.resolve(null),
      nodeById: () => Promise.resolve(null),
    } as never,
    {
      publicIdsOf: (ids: string[]) =>
        Promise.resolve(new Map(ids.filter((i) => i !== '502').map((i) => [i, `tok${i}`]))),
    },
  )

describe('Be09BijakQuestionSource media', () => {
  it('serves two members of an image group: one stimulus, token URLs, option images, marks on members only', async () => {
    const src = source([rec('1', false), rec('2', false)])
    const bundles = await src.loadQuestions(['1', '2'])
    expect([...bundles.keys()]).toEqual(['1', '2'])
    const served = buildServedPaper(
      [{ id: 's', label: 'A', rule: { type: 'all' }, questionIds: ['1', '2'] }],
      bundles,
    )
    expect(served.groups).toHaveLength(1)
    expect(served.groups[0]?.stimulus.image?.url).toBe('/api/files/tok900')
    expect(served.groups[0]?.questionIds).toEqual(['1', '2'])
    expect(served.questions).toHaveLength(2)
    expect(served.sections[0]?.marks).toBe(4)
    const info = await src.getMany(['1', '2'])
    expect(info.get('1')?.marks).toBe(2)
  })

  it('option images get token URLs; an option whose file has no token refuses the question with a BM reason', async () => {
    const withImages = rec('1', true)
    const src = source([withImages])
    expect((await src.loadQuestions(['1'])).size).toBe(0)
    const refusals = await src.refusalsOf(['1'])
    expect(refusals.get('1')).toMatchObject({
      code: 'file_missing',
      reasonCode: 'shape_unsupported:file_missing',
      reasonMs: 'fail gambar rangsangan atau pilihan tidak dijumpai',
    })
  })
})
