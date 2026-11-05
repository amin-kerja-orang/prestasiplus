import { QuestionGateCheckSchema, QuestionGuruSummarySchema, SessionSchema, envelopeOf, listEnvelopeOf } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { bootFullApp, type FullApp } from '../r1/full-app'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * AC-GUR-44-11 (docs/prd/r1/20-guru-admin-sekolah.md): "Given a question from an old CSV without Bab and SP, when the admin opens it in review, then the
 * admin can set them; before that the gate refuses "Terbitkan" and the teacher still sees "Menunggu Semakan"." (S6-T06, issue #482).
 *
 * Real app, real routes, no row is written by hand. The OLD header is the legacy one (`question_text,...,subject_id,education_level_id,difficulty_level`):
 * it has no Bab, no SP, no TP and no Aras column, so the row becomes a guru intake item with `low_fields = [tag.tp, tag.sp]` and no unit.
 *   1. the teacher imports the row (POST /api/guru/questions/import) and sees "Menunggu Semakan";
 *   2. Terima asks only what a Draf needs (S1-T04, #807): the admin confirms the low fields and accepts with no unit and no SP; the result is a Draf
 *      with no unit, SP or Bab, and the teacher still sees "Menunggu Semakan";
 *   3. Draf -> Semakan needs no tag; Terbitkan (POST /api/questions/:id/status approved) is refused with 422 naming the unit, the SP and the Bab;
 *      the question stays in review and the teacher still sees "Menunggu Semakan";
 *   4. the admin sets the unit, SP, TP and Aras in review (PUT /api/questions/:id) but not the Bab: Terbitkan is refused with "Sila pilih Bab." only;
 *   5. the admin sets the Bab (PUT /api/questions/:id), Terbitkan succeeds, and the teacher now sees "Diluluskan".
 */
interface Client {
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  patch(url: string, body?: unknown): request.Test
}

async function login(t: FullApp, identifier: string): Promise<Client> {
  const agent = request.agent(t.app.getHttpServer()) as unknown as TestAgent
  const res = await agent.post('/api/auth/login').send({ identifier, password: 'Demo1234', remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  return {
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', session.csrf).send((body ?? {}) as object),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', session.csrf).send((body ?? {}) as object),
    patch: (url, body) => agent.patch(url).set('X-CSRF-Token', session.csrf).send((body ?? {}) as object),
  }
}

describe('AC-GUR-44-11: an old guru CSV row without Bab and SP is refused at Terbitkan until the admin sets them', () => {
  let t: FullApp
  let teacher: Client
  let admin: Client
  let itemId = ''
  let questionId = ''
  let subjectId = ''
  let levelId = ''
  let unitCode = ''
  let spCode = ''
  let chapterId = ''

  const STEM = 'Berapakah hasil tambah dua belas dan lima belas dalam pengiraan ini?'
  const OPTIONS = ['25', '26', '27', '28']

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  /** The latest version of the question: its status and tags. */
  const latest = async () =>
    (await q(`select v.status, v.chapter_id::text chapter, v.unit_node_id::text unit, v.difficulty_tp tp from question_versions v where v.question_id = $1::bigint order by v.version_no desc limit 1`, [questionId]))[0]!
  const item = async () => (await q(`select review_state, low_fields, question_id::text question_id, payload from intake_items where id = $1::bigint`, [itemId]))[0]!
  /** What the teacher's own list shows for the item. */
  const listed = async () => {
    const res = await teacher.get('/api/guru/questions')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const rows = listEnvelopeOf(QuestionGuruSummarySchema).parse(res.body).data.filter((r) => r.id === itemId)
    expect(rows, 'the teacher list holds the item once').toHaveLength(1)
    return rows[0]!
  }
  const gateCheck = async () => envelopeOf(QuestionGateCheckSchema).parse((await admin.get(`/api/questions/${questionId}/gate-check?gate=approve`)).body).data
  const questionRows = async () => Number((await q(`select count(*)::int n from questions`))[0]!.n)

  beforeAll(async () => {
    t = await bootFullApp({
      INTAKE_TEACHER_ENABLED: 'true',
      INTAKE_WRITES_PER_MINUTE: '1000',
      INTAKE_READS_PER_MINUTE: '10000',
      INTAKE_REVIEW_WRITES_PER_MINUTE: '10000',
      INTAKE_REVIEW_READS_PER_MINUTE: '10000',
      JOBS_WORKER_ENABLED: 'false',
    })
    teacher = await login(t, 'guru@demo.test')
    admin = await login(t, 'admin@demo.test')
    // MATH Tingkatan 4 has chapters and DSKP nodes in the seed (the specs bab-optional and chain-intake-to-pupil rely on the same pair).
    subjectId = String((await q(`select id::text id from subjects where code = 'MATH'`))[0]!.id)
    levelId = String((await q(`select id::text id from education_levels where code = 'T4'`))[0]!.id)
    const node = async (kind: string) =>
      String((await q(`select code from curriculum_nodes where kind = $1 and subject_id = $2::bigint and education_level_id = $3::bigint order by id limit 1`, [kind, subjectId, levelId]))[0]!.code)
    unitCode = await node('unit')
    spCode = await node('sp')
    const chapter = (await q(`select id::text id from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree order by id limit 1`, [subjectId, levelId]))[0]
    expect(chapter, 'MATH T4 has a chapter in the seed').toBeDefined()
    chapterId = String(chapter!.id)
  })
  afterAll(async () => {
    await t.close()
  })

  it('1. the teacher imports a row of the OLD header (no Bab, no SP, no TP): it is a guru intake item, with the tag fields unconfirmed, and "Menunggu Semakan"', async () => {
    const head = 'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level'
    const row = `"${STEM}",${OPTIONS.join(',')},C,${subjectId},${levelId},3`
    const before = await questionRows()
    const res = await teacher.post('/api/guru/questions/import', { csv: [head, row].join('\n') })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ imported: 1, errors: [] })
    expect(await questionRows(), 'a teacher import never writes the bank').toBe(before)
    const items = await q(
      `select i.id::text id from intake_items i join intake_batches b on b.id = i.batch_id where b.source = 'guru' and b.owner_user_id = $1::bigint`,
      [teacher.userId],
    )
    expect(items).toHaveLength(1)
    itemId = String(items[0]!.id)
    const stored = await item()
    expect(stored.review_state).toBe('needs_review')
    expect(stored.low_fields).toEqual(['tag.tp', 'tag.sp'])
    expect(stored.payload).toMatchObject({ guru: { chapterId: null, spIds: [], tp: null, cognitiveLevel: null }, tag: { unit: null, sp: [] } })
    expect(await listed()).toMatchObject({ status: 'pending', statusLabel: 'Menunggu Semakan', editable: true, questionText: STEM })
  })

  /** The question body of PUT /api/questions/:id with the given tag and Bab. */
  const putBody = (tag: { unitId: string; spIds: string[]; tp: number }, curriculumChapterId?: string) => ({
    subjectId,
    educationLevelId: levelId,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: STEM,
    options: OPTIONS,
    correctAnswer: 2,
    kertas: '2',
    cognitiveLevel: 'mengaplikasi',
    ...(curriculumChapterId === undefined ? {} : { curriculumChapterId }),
    tag,
  })
  const nodeId = async (kind: string, code: string) =>
    String((await q(`select id::text id from curriculum_nodes where kind = $1 and code = $2 and subject_id = $3::bigint and education_level_id = $4::bigint`, [kind, code, subjectId, levelId]))[0]!.id)

  it('2. Terima asks only what a Draf needs (S1-T04): the admin accepts with no unit and no SP; a Draf with no unit, SP or Bab; the teacher still sees "Menunggu Semakan"', async () => {
    const stored = await item()
    // the reviewer confirms the low-confidence tag fields as they are (empty): Terima asks for that, not for a value
    const confirmed = await admin.patch(`/api/intake/items/${itemId}`, { confirmed: stored.low_fields })
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200)
    const before = await questionRows()
    const res = await admin.post(`/api/intake/items/${itemId}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await questionRows()).toBe(before + 1)
    const accepted = await item()
    expect(accepted.review_state).toBe('accepted')
    questionId = String(accepted.question_id)
    expect(questionId).not.toBe('null')
    expect(await latest()).toMatchObject({ status: 'draft', chapter: null, unit: null })
    // accepted but not published: the teacher still sees "Menunggu Semakan", and can no longer edit it
    expect(await listed()).toMatchObject({ status: 'pending', statusLabel: 'Menunggu Semakan', editable: false })
  })

  it('3. Semakan needs no tag, but Terbitkan is refused while the unit, SP and Bab are not set; the teacher still sees "Menunggu Semakan"', async () => {
    const submit = await admin.post(`/api/questions/${questionId}/status`, { to: 'review' })
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    expect((await latest()).status).toBe('review')

    const refused = await admin.post(`/api/questions/${questionId}/status`, { to: 'approved' })
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(refused.body.error.code).toBe('VALIDATION_ERROR')
    expect(refused.body.error.fields).toMatchObject({ chapterId: 'Sila pilih Bab.' })
    expect(refused.body.error.fields).toHaveProperty('unitId')
    expect(refused.body.error.fields).toHaveProperty('spIds')
    expect(await latest()).toMatchObject({ status: 'review', chapter: null, unit: null })
    expect(await listed()).toMatchObject({ status: 'pending', statusLabel: 'Menunggu Semakan' })
  })

  it('4. the admin sets the unit, SP, TP and Aras in review but not the Bab: Terbitkan is refused with "Sila pilih Bab." only', async () => {
    const tag = { unitId: await nodeId('unit', unitCode), spIds: [await nodeId('sp', spCode)], tp: 3 }
    const put = await admin.put(`/api/questions/${questionId}`, putBody(tag))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await latest()).toMatchObject({ status: 'review', chapter: null })
    expect((await latest()).unit).not.toBeNull()

    const check = await gateCheck()
    expect(check.ok).toBe(false)
    expect(check.issues).toContainEqual({ path: 'chapterId', code: 'NO_CHAPTER', message: 'Sila pilih Bab.', step: 4 })

    const refused = await admin.post(`/api/questions/${questionId}/status`, { to: 'approved' })
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(refused.body.error.fields).toMatchObject({ chapterId: 'Sila pilih Bab.' })
    // the unit and SP are set now, so the gate does not ask for them again
    expect(refused.body.error.fields).not.toHaveProperty('unitId')
    expect(refused.body.error.fields).not.toHaveProperty('spIds')
    expect(await latest()).toMatchObject({ status: 'review', chapter: null })
    expect(await listed()).toMatchObject({ status: 'pending', statusLabel: 'Menunggu Semakan' })
  })

  it('5. the admin sets the Bab in review, Terbitkan succeeds, and the teacher now sees "Diluluskan"', async () => {
    const version = await q(`select v.id::text id, v.unit_node_id::text unit from question_versions v where v.question_id = $1::bigint order by v.version_no desc limit 1`, [questionId])
    const sps = await q(`select node_id::text node from question_version_sp_nodes where question_version_id = $1::bigint`, [version[0]!.id])
    expect(sps.length).toBeGreaterThan(0)
    const put = await admin.put(`/api/questions/${questionId}`, putBody({ unitId: String(version[0]!.unit), spIds: sps.map((s) => String(s.node)), tp: 3 }, chapterId))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await latest()).toMatchObject({ status: 'review', chapter: chapterId })
    expect((await gateCheck()).ok).toBe(true)

    const approved = await admin.post(`/api/questions/${questionId}/status`, { to: 'approved' })
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
    expect((await latest()).status).toBe('approved')
    expect(await listed()).toMatchObject({ status: 'approved', statusLabel: 'Diluluskan' })
  })
})
