import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { BuilderRepository } from '../../src/modules/exam/builder/builder.repository'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder/question-bank.source'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { ESSAY_CHOICE_NOT_STORED } from '../../src/modules/questions/questions.service'
import { adminActor, apiError, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

type Kind = 'passage' | 'image' | 'diagram' | 'table' | 'map' | 'infographic' | 'graph' | 'audio'

/**
 * R1-T07 (display gaps), against a real database: the group read passes the seven stimulus kinds with caption, source and
 * table grid; the version read returns stimuli linked straight to a version; the paper builder source carries every
 * stimulus (1 to 3) of a group, once per group (D90).
 */
describe('stimulus display read model (R1-T07)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let source: QuestionBankBuilderSource
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    const prisma = t.app.get(PrismaService)
    source = new QuestionBankBuilderSource(prisma, repo, new BuilderRepository(prisma))
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const stimulus = async (kind: Kind, label: string, extra: { caption?: string; source?: string; table?: unknown } = {}): Promise<string> => {
    const id = await svc.createStimulus({ kind, label, bodyMs: `Isi ${label}`, bodyEn: null, altText: `Alt ${label}`, assetFileId: null })
    await t.db.query(`update stimuli set caption = $2, source_citation = $3, table_data = $4::jsonb where id = $1`, [
      id,
      extra.caption ?? null,
      extra.source ?? null,
      extra.table === undefined ? null : JSON.stringify(extra.table),
    ])
    return id
  }

  async function groupOfQuestions(stimulusIds: string[], members = 2): Promise<{ groupId: string; members: string[] }> {
    const groupId = await svc.createStimulusGroup({ label: 'Kumpulan', scope: 'section', stimulusIds, optionBank: [] })
    const ids: string[] = []
    for (let n = 1; n <= members; n++) {
      const q = await svc.create(mcqInput(tag, { questionText: `Soalan ahli kumpulan ${String(n)} untuk ujian paparan.`, stimulusGroupId: groupId }), admin)
      ids.push(q.id)
    }
    return { groupId, members: ids }
  }

  const table = { head: ['Bulan', 'Jumlah'], rows: [['Jan', '10'], ['Feb', '12']] }

  it('groupOf passes all seven kinds with caption, sourceCitation and tableData', async () => {
    const first = await groupOfQuestions([
      await stimulus('passage', 'Petikan 1', { source: 'Sumber contoh' }),
      await stimulus('image', 'Gambar 1', { caption: 'Gambar sebuah pasar' }),
      await stimulus('diagram', 'Rajah 1'),
    ])
    const second = await groupOfQuestions([
      await stimulus('table', 'Jadual 1', { caption: 'Jualan', table }),
      await stimulus('map', 'Peta 1', { caption: 'Peta negeri' }),
      await stimulus('infographic', 'Infografik 1'),
    ])
    const third = await groupOfQuestions([await stimulus('graph', 'Graf 1', { caption: 'Graf garis' })])

    const a = await repo.groupOf(first.members[1] as string)
    expect(a?.stimuli.map((s) => s.kind)).toEqual(['passage', 'image', 'diagram'])
    expect(a?.stimuli[0]?.sourceCitation).toBe('Sumber contoh')
    expect(a?.stimuli[1]?.caption).toBe('Gambar sebuah pasar')
    const b = await repo.groupOf(second.members[0] as string)
    expect(b?.stimuli.map((s) => s.kind)).toEqual(['table', 'map', 'infographic'])
    expect(b?.stimuli[0]?.tableData).toEqual(table)
    expect(b?.stimuli[0]?.caption).toBe('Jualan')
    const c = await repo.groupOf(third.members[0] as string)
    expect(c?.stimuli.map((s) => s.kind)).toEqual(['graph'])
    expect(c?.stimuli[0]).toMatchObject({ label: 'Graf 1', caption: 'Graf garis', alt: 'Alt Graf 1' })
    // D90: one group, listed once, both members under it.
    expect(a?.questionIds).toEqual(first.members)
  })

  it('groupOf leaves audio out and keeps the others', async () => {
    const g = await groupOfQuestions([await stimulus('audio', 'Audio 1'), await stimulus('passage', 'Petikan 2')])
    const got = await repo.groupOf(g.members[0] as string)
    expect(got?.stimuli.map((s) => s.label)).toEqual(['Petikan 2'])
  })

  it('versionStimuli returns the stimuli linked straight to a version, in link order, without audio', async () => {
    const q = await svc.create(mcqInput(tag, { questionText: 'Soalan dengan gambar sendiri untuk ujian paparan.' }), admin)
    const [version] = await t.db.query<{ id: string }>(`select id::text id from question_versions where question_id = $1 and version_no = 1`, [q.id])
    const links = [await stimulus('map', 'Peta soalan', { caption: 'Peta' }), await stimulus('audio', 'Bunyi'), await stimulus('table', 'Jadual soalan', { table })]
    let position = 1
    for (const id of links) await t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, $3)`, [version?.id, id, position++])

    const got = await repo.versionStimuli([
      { questionId: q.id, versionNo: 1 },
      { questionId: q.id, versionNo: 9 },
      { questionId: 'bukan-id', versionNo: 1 },
    ])
    const own = got.get(`${q.id}:1`)
    expect(own?.map((s) => s.kind)).toEqual(['map', 'table'])
    expect(own?.[0]).toMatchObject({ label: 'Peta soalan', bodyMs: 'Isi Peta soalan', caption: 'Peta', alt: 'Alt Peta soalan' })
    expect(own?.[1]?.tableData).toEqual(table)
    expect(got.get(`${q.id}:9`)).toEqual([])
    expect(got.size).toBe(2)
    expect((await repo.versionStimuli([])).size).toBe(0)
  })

  it('the builder source carries every stimulus of a group (1 to 3), once, with the members as one unit', async () => {
    const g = await groupOfQuestions([
      await stimulus('passage', 'Petikan B'),
      await stimulus('table', 'Jadual B', { caption: 'Jadual jualan', table }),
      await stimulus('image', 'Gambar B'),
    ], 3)
    const groups = await source.groups([g.groupId, '999999999'])
    expect([...groups.keys()]).toEqual([g.groupId])
    const info = groups.get(g.groupId)
    expect(info?.questionIds).toEqual(g.members)
    expect(info?.stimuli?.map((s) => s.label)).toEqual(['Petikan B', 'Jadual B', 'Gambar B'])
    expect(info?.stimulus).toEqual(info?.stimuli?.[0])
    const grid = info?.stimuli?.[1]
    expect(grid).toMatchObject({ kind: 'table', caption: 'Jadual jualan', table })
    // R1-T31: the seven store kinds pass through to the wire (an image stays `image`).
    expect(info?.stimuli?.[2]?.kind).toBe('image')

    const described = await source.describe(g.members.map((id) => ({ id })))
    for (const id of g.members) expect(described.get(id)).toMatchObject({ groupId: g.groupId, stimulusLabel: 'Petikan B' })

    const review = await source.review([g.members[0] as string, g.members[2] as string])
    expect(Object.keys(review.stimuli)).toEqual([g.groupId])
    expect(review.groupStimuli?.[g.groupId]?.map((s) => s.label)).toEqual(['Petikan B', 'Jadual B', 'Gambar B'])
    expect(review.stimuli[g.groupId]).toEqual(review.groupStimuli?.[g.groupId]?.[0])
  })

  it('a group whose only stimulus is audio is STILL a group (D90): emitted with no stimuli and its members as one unit', async () => {
    const g = await groupOfQuestions([await stimulus('audio', 'Hanya audio')])
    const groups = await source.groups([g.groupId])
    expect([...groups.keys()]).toEqual([g.groupId])
    const info = groups.get(g.groupId)
    expect(info?.questionIds).toEqual(g.members)
    expect(info?.stimuli).toEqual([])
    // No displayable stimulus: the group carries none (the wire field is optional), it is still emitted.
    expect(info?.stimulus).toBeUndefined()
    const described = await source.describe(g.members.map((id) => ({ id })))
    for (const id of g.members) expect(described.get(id)?.groupId).toBe(g.groupId)
  })

  it('an essay_choice leaf is valid in the contract but refused with 422 on the write path until it can be stored', async () => {
    const part = {
      label: '',
      prompt: { ms: 'Pilih satu tajuk dan tulis karangan.' },
      mode: 'essay_choice',
      marks: 30,
      key: { kind: 'rubric', marks: 30, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Cemerlang', range: [25, 30] }] },
      topics: [{ id: 'a', label: 'Tajuk satu' }, { id: 'b', label: 'Tajuk dua' }],
    }
    const err = await apiError(() => svc.create(mcqInput(tag, { questionType: 'essay', options: undefined, correctAnswer: undefined, parts: [part] as never }), admin))
    expect(err.getStatus()).toBe(422)
    expect(err.fields).toEqual({ parts: ESSAY_CHOICE_NOT_STORED })
  })
})
