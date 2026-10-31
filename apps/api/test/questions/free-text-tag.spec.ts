import { QuestionDetailSchema, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { countOf, mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/**
 * AC-03.4 (v2-admin-student-pipeline, D53h): "Given a free-text tag instead of a curriculum node, then it is not accepted."
 * A tag is a curriculum node id (unit, SP) of the question's subject and level, or the chapter / topic ids of the curriculum. Text typed
 * in their place is refused with 422 on create and on update, nothing is stored, and a stray free-text field is never persisted.
 */
describe('AC-03.4: a free-text tag instead of a curriculum node is not accepted', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const total = () => countOf(t.db, 'select count(*) n from questions')
  const FREE = 'Algebra dan fungsi'

  it('create: a free-text unit or SP in the tag is 422 and no question is stored', async () => {
    const good = await tagOf(t.db, refs.mathId, refs.t4Id)
    const before = await total()
    for (const tag of [{ ...good, unitId: FREE }, { ...good, spIds: [FREE] }, { ...good, spIds: [good.spIds[0], 'persamaan linear'] }]) {
      const error = expectError(await admin.post('/api/questions', mcqBody(refs, { tag })), 'VALIDATION_ERROR')
      expect(Object.keys(error.fields ?? {}).length, JSON.stringify(tag)).toBeGreaterThan(0)
    }
    expect(await total()).toBe(before)
  })

  it('create: a free-text flat SP (dskpSpId) is 422 on dskpSpId', async () => {
    const before = await total()
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { dskpSpId: FREE })), 'VALIDATION_ERROR')
    expect(Object.keys(error.fields ?? {})).toContain('dskpSpId')
    expect(await total()).toBe(before)
  })

  it('create: a free-text chapter is 422 on curriculumChapterId', async () => {
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { curriculumChapterId: FREE })), 'VALIDATION_ERROR')
    expect(Object.keys(error.fields ?? {})).toContain('curriculumChapterId')
  })

  it('update: a free-text tag is 422 and the stored tag is unchanged', async () => {
    const good = await tagOf(t.db, refs.mathId, refs.t4Id)
    const res = await admin.post('/api/questions', mcqBody(refs, { tag: good }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    const stored = async () => (await t.db.query<{ unit_node_id: string | null }>(`select unit_node_id::text from question_versions where question_id = $1 order by version_no desc limit 1`, [id]))[0]?.unit_node_id
    expect(await stored()).toBe(good.unitId)
    expectError(await admin.put(`/api/questions/${id}`, mcqBody(refs, { tag: { ...good, unitId: FREE } })), 'VALIDATION_ERROR')
    expectError(await admin.put(`/api/questions/${id}`, mcqBody(refs, { dskpSpId: FREE })), 'VALIDATION_ERROR')
    expect(await stored()).toBe(good.unitId)
    // Control: a real node id is accepted on the same question.
    const ok = await admin.put(`/api/questions/${id}`, mcqBody(refs, { tag: good, questionText: 'Teks soalan yang telah dikemaskini.' }))
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
  })

  it('a free-text field next to the tag (topic, tagText, tags) is never stored or returned', async () => {
    const good = await tagOf(t.db, refs.mathId, refs.t4Id)
    const res = await admin.post('/api/questions', mcqBody(refs, { tag: good, topic: FREE, tagText: FREE, tags: [FREE], dskpTag: FREE }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    const detail = await admin.get(`/api/questions/${id}`)
    expect(JSON.stringify(detail.body)).not.toContain(FREE)
    expect(parseData(detail, QuestionDetailSchema).tag?.unitId).toBe(good.unitId)
    const rows = await t.db.query<{ n: string }>(`select count(*) n from question_versions v where v.question_id = $1 and v::text like $2`, [id, `%${FREE}%`])
    expect(Number(rows[0]?.n)).toBe(0)
  })

  it('Guru create: a free-text topic or chapter is 422 on its own key', async () => {
    const body = (over: Record<string, unknown>) => ({
      educationLevelId: refs.t4Id,
      subjectId: refs.mathId,
      questionType: 'mcq',
      difficultyLevel: 'medium',
      questionText: 'Berapakah punca kuasa dua bagi 81?',
      options: ['7', '8', '9', '10'],
      correctAnswer: 2,
      ...over,
    })
    expect(Object.keys(expectError(await teacher.post('/api/guru/questions', body({ curriculumTopicId: FREE })), 'VALIDATION_ERROR').fields ?? {})).toContain('curriculumTopicId')
    expect(Object.keys(expectError(await teacher.post('/api/guru/questions', body({ curriculumChapterId: FREE })), 'VALIDATION_ERROR').fields ?? {})).toContain('curriculumChapterId')
    expect(Object.keys(expectError(await teacher.post('/api/guru/questions', body({ dskpSpId: FREE })), 'VALIDATION_ERROR').fields ?? {})).toContain('dskpSpId')
  })
})
