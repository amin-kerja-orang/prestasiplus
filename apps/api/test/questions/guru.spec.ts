import { QuestionGuruDetailSchema, QuestionGuruRemoveResultSchema, QuestionGuruSummarySchema, SessionSchema, envelopeOf, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, DEMO_PASSWORD, bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
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

/** S6-T06 (API-GUR-18, D113, L-6): a teacher's submission is an intake item of a `source = 'guru'` batch, never a question row. */
describe('Guru question routes: intake submissions, own rows only', () => {
  let t: QuestionsTestApp
  let teacher: Client
  let teacher2: Client
  let admin: Client
  let refs: Refs
  let facts: { hasChapters: boolean; hasDskpNodes: boolean }
  let chapterId: string
  let spId: string
  beforeAll(async () => {
    t = await bootQuestionsApp()
    teacher = await loginAs(t, 'teacher')
    teacher2 = await teacherTwo(t)
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    const f = await t.db.query<{ has_dskp: boolean; has_chapters: boolean }>(
      `select exists (select 1 from curriculum_nodes where subject_id = $1 and education_level_id = $2) has_dskp,
              exists (select 1 from chapters where subject_id = $1 and education_level_id = $2 and is_active and in_tree) has_chapters`,
      [refs.mathId, refs.t4Id],
    )
    facts = { hasChapters: f[0]?.has_chapters === true, hasDskpNodes: f[0]?.has_dskp === true }
    chapterId = refs.chapterId as string
    spId = (await t.db.query<{ id: string }>(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 order by id limit 1`, [refs.mathId, refs.t4Id]))[0]?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  /** A body that passes whatever the seed says about chapters and DSKP nodes of MATH T4. */
  const body = (over: Record<string, unknown> = {}) => ({
    educationLevelId: refs.t4Id,
    subjectId: refs.mathId,
    questionType: 'mcq',
    difficultyLevel: 4,
    questionText: 'Berapakah punca kuasa dua bagi 81?',
    options: ['7', '8', '9', '10'],
    correctAnswer: 2,
    explanation: 'Sembilan darab sembilan ialah lapan puluh satu.',
    ...(facts.hasChapters ? { chapterId } : {}),
    ...(facts.hasDskpNodes ? { spIds: [spId], tp: 3, cognitiveLevel: 'mengaplikasi' } : {}),
    ...over,
  })
  const drop = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, undefined]))
  const questionRows = async () => Number((await t.db.query<{ n: string }>(`select count(*)::text n from questions`))[0]?.n)
  const created = async (c: Client, over: Record<string, unknown> = {}) => envelopeOf(QuestionGuruDetailSchema).parse((await c.post('/api/guru/questions', body(over))).body).data

  it('creates ONE guru batch with ONE pending item and no question row; the stored difficulty and key come back', async () => {
    const before = await questionRows()
    const res = await teacher.post('/api/guru/questions', body())
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const q = envelopeOf(QuestionGuruDetailSchema).parse(res.body).data
    expect(q).toMatchObject({ status: 'pending', statusLabel: 'Menunggu Semakan', rejectionReason: null, editable: true, questionType: 'mcq', correctAnswer: 2, options: ['7', '8', '9', '10'], difficultyLevel: 4 })
    expect(await questionRows()).toBe(before)
    const rows = await t.db.query<{ source: string; owner: string; state: string; item_type: string; n: string }>(
      `select b.source, b.owner_user_id::text owner, i.review_state state, i.item_type, (select count(*)::text from intake_items x where x.batch_id = b.id) n
         from intake_items i join intake_batches b on b.id = i.batch_id where i.id = $1`,
      [q.id],
    )
    expect(rows[0]).toMatchObject({ source: 'guru', owner: teacher.userId, state: 'needs_review', item_type: 'mcq', n: '1' })
    expect(parseData(await teacher.get(`/api/guru/questions/${q.id}`), QuestionGuruDetailSchema)).toMatchObject({ id: q.id, difficultyLevel: 4, correctAnswer: 2 })
  })

  it('the list holds only the caller own items, 20 per page, newest first', async () => {
    const a = await created(teacher, { questionText: 'Soalan pertama untuk senarai?' })
    const b = await created(teacher, { questionText: 'Soalan kedua untuk senarai?' })
    const mine = listEnvelopeOf(QuestionGuruSummarySchema).parse((await teacher.get('/api/guru/questions')).body)
    const ids = mine.data.map((r) => r.id)
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id))
    expect(mine.meta).toMatchObject({ page: 1, pageSize: 20 })
    expect(listEnvelopeOf(QuestionGuruSummarySchema).parse((await teacher2.get('/api/guru/questions')).body).data).toHaveLength(0)
    expectError(await teacher.get('/api/guru/questions?page=0'), 'VALIDATION_ERROR')
  })

  it('another teacher gets 404 (never 403) on get, put and delete; an unknown id is 404 too', async () => {
    const q = await created(teacher)
    expectError(await teacher2.get(`/api/guru/questions/${q.id}`), 'NOT_FOUND')
    expectError(await teacher2.put(`/api/guru/questions/${q.id}`, body()), 'NOT_FOUND')
    expectError(await teacher2.delete(`/api/guru/questions/${q.id}`), 'NOT_FOUND')
    expectError(await teacher.get('/api/guru/questions/987654321'), 'NOT_FOUND')
    expect(await t.db.query(`select 1 from intake_items where id = $1`, [q.id])).toHaveLength(1)
  })

  it('edit and delete work while the item is pending; deleting the only item removes its batch', async () => {
    const q = await created(teacher)
    const put = await teacher.put(`/api/guru/questions/${q.id}`, body({ questionText: 'Soalan yang telah disunting oleh guru.', difficultyLevel: 2, correctAnswer: 'A', options: ['1', '2', '3', '4'] }))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(envelopeOf(QuestionGuruDetailSchema).parse(put.body).data).toMatchObject({ questionText: 'Soalan yang telah disunting oleh guru.', difficultyLevel: 2, correctAnswer: 0, status: 'pending' })
    const batch = (await t.db.query<{ id: string }>(`select batch_id::text id from intake_items where id = $1`, [q.id]))[0]?.id as string
    const del = await teacher.delete(`/api/guru/questions/${q.id}`)
    expect(del.status).toBe(200)
    expect(envelopeOf(QuestionGuruRemoveResultSchema).parse(del.body).data).toEqual({ removed: 1 })
    expectError(await teacher.get(`/api/guru/questions/${q.id}`), 'NOT_FOUND')
    expect(await t.db.query(`select 1 from intake_batches where id = $1`, [batch])).toHaveLength(0)
  })

  it('an accepted item is read-only: edit and delete are 409 and it stays "Menunggu Semakan"', async () => {
    const q = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'accepted' where id = $1`, [q.id])
    expectError(await teacher.put(`/api/guru/questions/${q.id}`, body()), 'CONFLICT')
    expectError(await teacher.delete(`/api/guru/questions/${q.id}`), 'CONFLICT')
    expect(parseData(await teacher.get(`/api/guru/questions/${q.id}`), QuestionGuruDetailSchema)).toMatchObject({ status: 'pending', editable: false })
  })

  it('a rejected item shows "Ditolak" with the admin reason; editing it returns it to review', async () => {
    const q = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'rejected', reject_reason = 'Kunci jawapan salah.' where id = $1`, [q.id])
    expect(parseData(await teacher.get(`/api/guru/questions/${q.id}`), QuestionGuruDetailSchema)).toMatchObject({ status: 'rejected', statusLabel: 'Ditolak', rejectionReason: 'Kunci jawapan salah.', editable: true })
    const put = await teacher.put(`/api/guru/questions/${q.id}`, body({ correctAnswer: 1 }))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(envelopeOf(QuestionGuruDetailSchema).parse(put.body).data).toMatchObject({ status: 'pending', rejectionReason: null, correctAnswer: 1 })
  })

  it('MCQ only: another question type, a word difficulty and a missing difficulty are 422', async () => {
    expect(expectError(await teacher.post('/api/guru/questions', body({ questionType: 'true_false' })), 'VALIDATION_ERROR').fields?.questionType).toBeDefined()
    expect(expectError(await teacher.post('/api/guru/questions', body({ questionType: 'essay' })), 'VALIDATION_ERROR').fields?.questionType).toBeDefined()
    expect(expectError(await teacher.post('/api/guru/questions', body({ difficultyLevel: 'medium' })), 'VALIDATION_ERROR').fields?.difficultyLevel).toBe('Sila pilih kesukaran.')
    expect(expectError(await teacher.post('/api/guru/questions', body(drop('difficultyLevel'))), 'VALIDATION_ERROR').fields?.difficultyLevel).toBe('Sila pilih kesukaran.')
  })

  it('form validation: BM copy on the field keys', async () => {
    const f = expectError(await teacher.post('/api/guru/questions', body({ options: ['a', '', 'c', 'd'], ...drop('correctAnswer'), questionText: '' })), 'VALIDATION_ERROR').fields
    expect(f).toMatchObject({ options: 'Sila isi pilihan B.', correctAnswer: 'Sila tanda satu jawapan yang betul.', questionText: 'Sila isi soalan.' })
    expect(expectError(await teacher.post('/api/guru/questions', body({ subjectId: '' })), 'VALIDATION_ERROR').fields?.subjectId).toBe('Sila pilih subjek.')
    expect(expectError(await teacher.post('/api/guru/questions', body({ educationLevelId: '' })), 'VALIDATION_ERROR').fields?.educationLevelId).toBe('Sila pilih tingkatan.')
  })

  it('DSKP rule (D112): Bab only where chapters exist; SP, TP and Aras only where DSKP nodes exist', async () => {
    const res = await teacher.post('/api/guru/questions', body(drop('chapterId', 'spIds', 'tp', 'cognitiveLevel')))
    const expected: Record<string, string> = {
      ...(facts.hasChapters ? { chapterId: 'Sila pilih bab.' } : {}),
      ...(facts.hasDskpNodes ? { spIds: 'Sila pilih Standard Pembelajaran (SP).', tp: 'Sila pilih TP.', cognitiveLevel: 'Sila pilih aras pemikiran.' } : {}),
    }
    if (Object.keys(expected).length === 0) expect(res.status).toBe(201)
    else expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual(expected)
    expect(expectError(await teacher.post('/api/guru/questions', body({ tp: 7 })), 'VALIDATION_ERROR').fields?.tp).toBe('Tahap Penguasaan (TP) mesti antara 1 dan 6.')
    expect(expectError(await teacher.post('/api/guru/questions', body({ spIds: ['999999999'] })), 'VALIDATION_ERROR').fields?.spIds).toBe('SP tidak sah.')
    expect(expectError(await teacher.post('/api/guru/questions', body({ chapterId: '999999999' })), 'VALIDATION_ERROR').fields?.chapterId).toBe('Bab tidak sah.')
  })

  it('Admin Pusat may use the Guru routes and sees only the items it owns', async () => {
    const q = await created(admin)
    const list = listEnvelopeOf(QuestionGuruSummarySchema).parse((await admin.get('/api/guru/questions?page=1')).body)
    expect(list.data.map((r) => r.id)).toEqual([q.id])
  })
})
