import { QuestionGuruDetailSchema, QuestionGuruRemoveResultSchema, QuestionGuruSummarySchema, SessionSchema, envelopeOf, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, DEMO_PASSWORD, bootQuestionsApp, expectError, loginAs, parseData, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { refsOf, type Refs } from './http-helpers'

/** The second teacher also holds school_admin and starts in that role: log in, then switch to teacher. */
async function teacherTwo(t: QuestionsTestApp): Promise<Client> {
  const agent = t.agent()
  const login = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS.teacher2, password: DEMO_PASSWORD, remember: false })
  expect(login.status, JSON.stringify(login.body)).toBe(200)
  const first = SessionSchema.parse(login.body.data)
  const switched = await agent.post('/api/session/role').set('X-CSRF-Token', first.csrf).send({ role: 'teacher' })
  expect(switched.status, JSON.stringify(switched.body)).toBe(200)
  const session = SessionSchema.parse(switched.body.data)
  expect(session.active.role).toBe('teacher')
  const csrf = session.csrf
  return {
    csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', csrf).send(body as object),
    patch: (url, body) => agent.patch(url).set('X-CSRF-Token', csrf).send(body as object),
    delete: (url) => agent.delete(url).set('X-CSRF-Token', csrf),
    noCsrf: {
      post: (url, body) => agent.post(url).send(body as object),
      put: (url, body) => agent.put(url).send(body as object),
      patch: (url, body) => agent.patch(url).send(body as object),
      delete: (url) => agent.delete(url),
    },
  }
}

describe('Guru question routes: own rows only (AC 7, AC 10)', () => {
  let t: QuestionsTestApp
  let teacher: Client
  let teacher2: Client
  let admin: Client
  let refs: Refs
  let seededReviewId: string
  let adminOwnedId: string
  beforeAll(async () => {
    t = await bootQuestionsApp()
    teacher = await loginAs(t, 'teacher')
    teacher2 = await teacherTwo(t)
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    seededReviewId = await questionIdOf(t.db, 'SEED-REVIEW-SCI-T5')
    adminOwnedId = await questionIdOf(t.db, 'SEED-DRAFT-BM-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  const body = (over: Record<string, unknown> = {}) => ({
    educationLevelId: refs.t4Id,
    subjectId: refs.mathId,
    questionType: 'mcq',
    difficultyLevel: 'medium',
    questionText: 'Berapakah punca kuasa dua bagi 81?',
    options: ['7', '8', '9', '10'],
    correctAnswer: 2,
    ...over,
  })

  it('the list holds only the caller own rows (the seeded review question), newest page of 20', async () => {
    const res = await teacher.get('/api/guru/questions')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = listEnvelopeOf(QuestionGuruSummarySchema).parse(res.body)
    expect(out.data.map((r) => r.id)).toEqual([seededReviewId])
    expect(out.data[0]).toMatchObject({ status: 'review', statusLabel: 'Semakan', questionType: 'mcq' })
    expect(out.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 1 })
  })

  it('another teacher sees an empty list and gets 404 (never 403) on the first teacher id', async () => {
    const list = listEnvelopeOf(QuestionGuruSummarySchema).parse((await teacher2.get('/api/guru/questions')).body)
    expect(list.data).toHaveLength(0)
    expectError(await teacher2.get(`/api/guru/questions/${seededReviewId}`), 'NOT_FOUND')
    expectError(await teacher2.put(`/api/guru/questions/${seededReviewId}`, { questionText: 'Teks baharu yang sah.' }), 'NOT_FOUND')
    expectError(await teacher2.delete(`/api/guru/questions/${seededReviewId}`), 'NOT_FOUND')
    expect(await t.db.query(`select 1 from questions where id = $1`, [seededReviewId])).toHaveLength(1)
  })

  it('a teacher gets 404 on a question owned by the admin, in the list and by id', async () => {
    expectError(await teacher.get(`/api/guru/questions/${adminOwnedId}`), 'NOT_FOUND')
    expectError(await teacher.put(`/api/guru/questions/${adminOwnedId}`, { questionText: 'Teks baharu yang sah.' }), 'NOT_FOUND')
    expectError(await teacher.delete(`/api/guru/questions/${adminOwnedId}`), 'NOT_FOUND')
    const list = listEnvelopeOf(QuestionGuruSummarySchema).parse((await teacher.get('/api/guru/questions')).body)
    expect(list.data.map((r) => r.id)).not.toContain(adminOwnedId)
  })

  it('creates a question saved as review with the teacher as owner; it shows in their list only', async () => {
    const res = await teacher.post('/api/guru/questions', body())
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const q = envelopeOf(QuestionGuruDetailSchema).parse(res.body).data
    expect(q).toMatchObject({ status: 'review', statusLabel: 'Semakan', correctAnswer: 2, options: ['7', '8', '9', '10'], difficultyLevel: 3, difficultyLabel: 'Sederhana' })
    const owner = await t.db.query<{ created_by_id: string }>(`select created_by_id::text from questions where id = $1`, [q.id])
    expect(owner[0]?.created_by_id).toBe(teacher.userId)
    const mine = listEnvelopeOf(QuestionGuruSummarySchema).parse((await teacher.get('/api/guru/questions')).body)
    expect(mine.data.map((r) => r.id)).toContain(q.id)
    expect(parseData(await teacher.get(`/api/guru/questions/${q.id}`), QuestionGuruDetailSchema).id).toBe(q.id)
    expectError(await teacher2.get(`/api/guru/questions/${q.id}`), 'NOT_FOUND')
    const theirs = listEnvelopeOf(QuestionGuruSummarySchema).parse((await teacher2.get('/api/guru/questions')).body)
    expect(theirs.data.map((r) => r.id)).not.toContain(q.id)
  })

  it('creates a true/false and a short answer question', async () => {
    const tf = envelopeOf(QuestionGuruDetailSchema).parse((await teacher.post('/api/guru/questions', body({ questionType: 'true_false', options: undefined, correctAnswer: undefined, tfAnswer: false, questionText: 'Bumi itu leper.' }))).body).data
    expect(tf).toMatchObject({ questionType: 'true_false', tfAnswer: false })
    const short = envelopeOf(QuestionGuruDetailSchema).parse((await teacher.post('/api/guru/questions', body({ questionType: 'short_answer', options: undefined, correctAnswer: undefined, correctAnswerText: 'Jakarta', questionText: 'Apakah ibu negara Indonesia?' }))).body).data
    expect(short).toMatchObject({ questionType: 'short_answer', correctAnswerText: 'Jakarta' })
  })

  it('the owner edits and removes their question: PUT 200, DELETE { removed: 1 }', async () => {
    const q = envelopeOf(QuestionGuruDetailSchema).parse((await teacher.post('/api/guru/questions', body())).body).data
    const put = await teacher.put(`/api/guru/questions/${q.id}`, { questionText: 'Soalan yang telah disunting oleh guru.' })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(envelopeOf(QuestionGuruDetailSchema).parse(put.body).data.questionText).toBe('Soalan yang telah disunting oleh guru.')
    const del = await teacher.delete(`/api/guru/questions/${q.id}`)
    expect(del.status).toBe(200)
    expect(envelopeOf(QuestionGuruRemoveResultSchema).parse(del.body).data).toEqual({ removed: 1 })
    expectError(await teacher.get(`/api/guru/questions/${q.id}`), 'NOT_FOUND')
  })

  it('validation: 422 with the mock keys for a bad option list and a missing MCQ key', async () => {
    const res = await teacher.post('/api/guru/questions', body({ options: ['a', '', 'c', 'd'], correctAnswer: undefined }))
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(error.fields?.options).toBeDefined()
    expect(error.fields?.correctAnswer).toBeDefined()
    expectError(await teacher.post('/api/guru/questions', body({ questionText: '' })), 'VALIDATION_ERROR')
    expectError(await teacher.get('/api/guru/questions?page=0'), 'VALIDATION_ERROR')
  })

  it('an update with a bad body on an own row is 422', async () => {
    const error = expectError(await teacher.put(`/api/guru/questions/${seededReviewId}`, { questionText: '' }), 'VALIDATION_ERROR')
    expect(error.fields?.questionText).toBeDefined()
  })

  it('Admin Pusat may use the Guru routes and sees only the rows it owns', async () => {
    const q = envelopeOf(QuestionGuruDetailSchema).parse((await admin.post('/api/guru/questions', body())).body).data
    const list = listEnvelopeOf(QuestionGuruSummarySchema).parse((await admin.get('/api/guru/questions?page=1')).body)
    expect(list.data.map((r) => r.id)).not.toContain(seededReviewId)
    expect((await admin.get(`/api/guru/questions/${q.id}`)).status).toBe(200)
  })
})
