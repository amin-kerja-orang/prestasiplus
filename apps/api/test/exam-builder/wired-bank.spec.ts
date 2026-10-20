import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BijakBuilderEditorSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  envelopeOf,
  mutationEnvelopeOf,
  QuestionSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Preview = envelopeOf(BijakBuilderPreviewSchema)
const Question = mutationEnvelopeOf(QuestionSchema)

/**
 * BE-39 wired to the real BE-09 question bank: the production `QuestionBankBuilderSource` (no fake, no PoC
 * fixture). The questions are created and published through the BE-09 admin API, so they are genuinely Terbit.
 * BE-09 has no writer for the source paper code or the pool tag yet (intake cards), so the kertas of a question is
 * set with SQL here, exactly as those cards will write it: `paper_code` `1449/2`, or a `MAT2-B` pool tag.
 */
describe('paper builder wired to the BE-09 question bank', () => {
  let t: BuilderTestApp
  let admin: Client
  let student: Client
  let subjects: { mat: string; sci: string }
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)

  async function mk(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', {
      subjectId: subjects.mat,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      tag,
      status: 'published',
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Question.parse(res.body).data.id
  }
  const setCode = (id: string, code: string) => q(`update question_versions set paper_code = $2 where question_id = $1`, [id, code])

  let ids: { a: string[]; b: string; c: string[]; draft: string; review: string; kertas1: string; sci: string }

  beforeAll(async () => {
    t = await bootBuilderApp({ realBank: true })
    admin = await loginAs(t, ACCOUNTS.admin)
    student = await loginAs(t, ACCOUNTS.student)
    const one = async (sql: string) => String((await q(sql))[0]!.id)
    subjects = { mat: await one(`select id::text id from subjects where code = 'MATH'`), sci: await one(`select id::text id from subjects where code = 'SCI'`) }
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subjects.mat} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subjects.mat} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }

    // MAT kertas 2 blueprint: A 3 x 1 mark, B 1 x 1 mark, C choose 1 of 2 (2 marks each).
    const a = [await mk(), await mk(), await mk()]
    const b = await mk()
    const c = [await mk({ pointsValue: 2 }), await mk({ pointsValue: 2 })]
    for (const id of [...a, ...c]) await setCode(id, '1449/2')
    // The kertas of B comes from a pool tag instead of the paper code.
    await q(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'MAT2-B')`, [b])
    const draft = await mk({ status: 'draft', tag: undefined })
    const review = await mk({ status: 'review' })
    await setCode(draft, '1449/2')
    await setCode(review, '1449/2')
    const kertas1 = await mk()
    await setCode(kertas1, '1449/1')
    const sci = await mk({ subjectId: subjects.sci, tag: undefined, status: 'draft' })
    await setCode(sci, '1449/2')
    ids = { a, b, c, draft, review, kertas1, sci }
  })
  afterAll(async () => {
    await t.close()
  })

  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Created.parse(res.body).data.id
  }
  const editor = async (id: string) => Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data
  async function fill(id: string, lists: { A: string[]; B: string[]; C: string[] }) {
    const e = await editor(id)
    const [sa, sb, sc] = e.paper.sections
    return admin.put(`/api/admin/papers/${id}`, {
      sections: [
        { id: sa!.id, questionIds: lists.A },
        { id: sb!.id, questionIds: lists.B },
        { id: sc!.id, questionIds: lists.C },
      ],
    })
  }

  it('the candidates are the Terbit, active questions of the paper subject and kertas, in bank order', async () => {
    const e = await editor(await newPaper())
    expect(e.questions.map((x) => x.id)).toEqual([...ids.a, ids.b, ...ids.c])
    expect(e.questions.every((x) => x.status === 'published' && x.subject === 'MAT' && x.kertas === 2)).toBe(true)
    expect(e.questions.map((x) => x.marks)).toEqual([1, 1, 1, 1, 2, 2])
    expect(e.questions[0]).toMatchObject({ kind: 'objektif', preview: 'Berapakah hasil tambah 2 dan 3?' })
    expect(e.questions[0]!.topic).not.toBe('')
    const all = e.questions.map((x) => x.id)
    for (const hidden of [ids.draft, ids.review, ids.kertas1, ids.sci]) expect(all).not.toContain(hidden)
  })

  it('a deactivated question leaves the candidates (BE-09 Q-2)', async () => {
    const id = await mk()
    await setCode(id, '1449/2')
    expect((await editor(await newPaper())).questions.map((x) => x.id)).toContain(id)
    await q(`update questions set is_active = false where id = $1`, [id])
    expect((await editor(await newPaper())).questions.map((x) => x.id)).not.toContain(id)
  })

  it('a draft or review question is refused: the editor reports it as not Terbit and publish says so', async () => {
    const id = await newPaper()
    const res = await fill(id, { A: [ids.a[0]!, ids.a[1]!, ids.draft], B: [ids.b], C: ids.c })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const e = Editor.parse(res.body).data
    expect(e.questions.find((x) => x.id === ids.draft)).toMatchObject({ status: 'draft', marks: 1 })
    const out = Publish.parse((await admin.post(`/api/admin/papers/${id}/publish`)).body).data
    expect(out.ok).toBe(false)
    expect(out.errors).toEqual(['Bahagian A: 1 soalan belum Terbit'])
    expect(out.errors).toContain(LINES.sectionLine('Bahagian A', LINES.notPublished(1)))
    expect((await q('select status from papers where id = $1', [id]))[0]?.status).toBe('draft')

    const review = await newPaper()
    await fill(review, { A: [ids.a[0]!, ids.a[1]!, ids.review], B: [ids.b], C: ids.c })
    const again = Publish.parse((await admin.post(`/api/admin/papers/${review}/publish`)).body).data
    expect(again).toMatchObject({ ok: false })
    expect(again.errors).toEqual(['Bahagian A: 1 soalan belum Terbit'])
  })

  it('a question of another subject is refused with 422 on the PUT', async () => {
    const id = await newPaper()
    const res = await fill(id, { A: [ids.sci], B: [], C: [] })
    expect(res.status).toBe(422)
  })

  it('publishes a paper of real questions, pins their version and marks, and the student sees it', async () => {
    const id = await newPaper()
    const res = await fill(id, { A: ids.a, B: [ids.b], C: ids.c })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = Publish.parse((await admin.post(`/api/admin/papers/${id}/publish`)).body)
    expect(out.data).toEqual({ ok: true, errors: [] })

    const placements = await q(
      `select pl.question_id::text qid, pl.pinned_version_no, pl.marks_override from paper_placements pl
         join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by pl.id`,
      [id],
    )
    expect(placements.map((p) => [p.qid, p.pinned_version_no, p.marks_override])).toEqual([
      ...ids.a.map((x) => [x, 1, 1]),
      [ids.b, 1, 1],
      ...ids.c.map((x) => [x, 1, 2]),
    ])

    const list = await student.get('/api/bijak/papers')
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const row = (list.body.data as { id: string; code: string; marks: number; status?: string }[]).find((p) => p.id === id)
    expect(row).toMatchObject({ code: '1449/2', marks: 6 })

    const cover = await student.get(`/api/bijak/papers/${id}`)
    expect(cover.status, JSON.stringify(cover.body)).toBe(200)
    expect((cover.body.data.sections as { label: string; marks: number; questionCount: number }[]).map((s) => [s.label, s.marks, s.questionCount])).toEqual([
      ['Bahagian A', 3, 3],
      ['Bahagian B', 1, 1],
      ['Bahagian C', 2, 2],
    ])
  })

  it('editing a published question after the paper is published keeps the pinned version and marks', async () => {
    const id = await newPaper()
    await fill(id, { A: ids.a, B: [ids.b], C: ids.c })
    expect(Publish.parse((await admin.post(`/api/admin/papers/${id}/publish`)).body).data.ok).toBe(true)
    const target = ids.c[0]!
    const put = await admin.put(`/api/questions/${target}`, {
      subjectId: subjects.mat,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Soalan yang disunting.',
      options: ['1', '2', '3', '4'],
      correctAnswer: 0,
      pointsValue: 5,
    })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    const e = await editor(id)
    // The published paper still describes version 1 (2 marks), although version 2 exists and is a draft.
    expect(e.paper.sections[2]!.questionIds).toContain(target)
    expect(e.questions.find((x) => x.id === target)).toMatchObject({ marks: 2, status: 'published' })
    const cover = await student.get(`/api/bijak/papers/${id}`)
    expect((cover.body.data.sections as { marks: number }[])[2]!.marks).toBe(2)
  })

  it('the admin preview carries the key and scheme of the real question', async () => {
    const res = await admin.post('/api/admin/papers/preview', { ids: [ids.a[0]!, '999999999'] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const data = Preview.parse(res.body).data
    expect(data.questions).toHaveLength(1)
    const only = data.questions[0]!
    expect(only).toMatchObject({ id: ids.a[0], marks: 1, curriculum: { subject: 'MAT', level: 'T4' } })
    expect(only.mcq).toMatchObject({ correct: 'B' })
    expect(only.mcq?.options.map((o) => o.text)).toEqual(['4', '5', '6', '7'])
    expect(only.scheme[only.id]).toEqual({ marks: 1, lines: [{ text: 'Jawapan betul: B' }] })
  })

  describe('kertas rule', () => {
    const pools = (id: string, ...codes: string[]) =>
      Promise.all(codes.map((c) => q(`insert into question_tags (question_id, kind, code) values ($1, 'pool', $2)`, [id, c])))
    const candidates = async (kertas: number): Promise<string[]> => {
      const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas })
      if (res.status !== 201) return []
      return (await editor(Created.parse(res.body).data.id)).questions.map((x) => x.id)
    }

    it('conflicting pool tags give the lowest digit, whatever the insert order', async () => {
      const x = await mk()
      await pools(x, 'MAT2-B', 'MAT1-A')
      const y = await mk()
      await pools(y, 'MAT1-A', 'MAT2-B')
      expect(await candidates(1)).toEqual(expect.arrayContaining([x, y]))
      expect(await candidates(2)).not.toContain(x)
      expect(await candidates(2)).not.toContain(y)
    })

    it('a pool code that is not of the paper subject form (F4-A, SN2-A) is ignored; the paper code decides', async () => {
      const z = await mk()
      await pools(z, 'F4-A', 'SN3-A')
      await setCode(z, '1449/2')
      expect(await candidates(2)).toContain(z)
      expect(await candidates(1)).not.toContain(z)
    })

    it('candidates come in question id order', async () => {
      const list = (await candidates(2)).map(BigInt)
      expect(list).toEqual([...list].sort((a, b) => (a < b ? -1 : 1)))
    })
  })
})
