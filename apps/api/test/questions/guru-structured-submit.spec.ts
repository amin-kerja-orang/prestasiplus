import { GuruStructuredDetailSchema, GuruStructuredRowSchema, ListMetaSchema, SessionSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ACCOUNTS, DEMO_PASSWORD, bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { refsOf, type Refs } from './http-helpers'

const ListSchema = z.object({ data: z.array(GuruStructuredRowSchema), meta: ListMetaSchema })
const Detail = envelopeOf(GuruStructuredDetailSchema)

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

/** S6-T17 (API-GUR-17 structured variant, ADD-13; API-GUR-26 own-review union): one guru batch, one structured item, no question row. */
describe('Guru structured submission: POST/PUT/DELETE /guru/intake/structured and the API-GUR-26 union', () => {
  let t: QuestionsTestApp
  let teacher: Client
  let teacher2: Client
  let refs: Refs
  let facts: { hasChapters: boolean; hasDskpNodes: boolean }
  let chapterId: string
  let spId: string
  beforeAll(async () => {
    t = await bootQuestionsApp()
    teacher = await loginAs(t, 'teacher')
    teacher2 = await teacherTwo(t)
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

  const part = (over: Record<string, unknown> = {}) => ({ text: 'Hitung luas segi tiga itu.', marks: 3, scheme: '1/2 x tapak x tinggi = 12 cm2', ...over })
  /** A body that passes whatever the seed says about chapters and DSKP nodes of MATH T4. */
  const body = (over: Record<string, unknown> = {}) => ({
    educationLevelId: refs.t4Id,
    subjectId: refs.mathId,
    difficultyLevel: 3,
    stimulus: 'Rajah menunjukkan sebuah segi tiga dengan tapak 6 cm dan tinggi 4 cm.',
    parts: [part(), part({ text: 'Hitung perimeter jika sisi ketiga ialah 5 cm.', marks: 2, scheme: '6 + 5 + 5 = 16 cm' })],
    ...(facts.hasChapters ? { chapterId } : {}),
    ...(facts.hasDskpNodes ? { spIds: [spId], tp: 3, cognitiveLevel: 'mengaplikasi' } : {}),
    ...over,
  })
  const created = async (c: Client, over: Record<string, unknown> = {}) => {
    const res = await c.post('/api/guru/intake/structured', body(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Detail.parse(res.body).data
  }
  const count = async (sql: string): Promise<number> => Number((await t.db.query<{ n: string }>(sql))[0]?.n)
  const list = async (c: Client, query = '') => {
    const res = await c.get(`/api/guru/structured-questions${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return ListSchema.parse(res.body)
  }

  it('creates ONE guru batch and ONE structured item, no question row; the total marks are computed', async () => {
    const questions = await count(`select count(*)::text n from questions`)
    const batches = await count(`select count(*)::text n from intake_batches where source = 'guru'`)
    const d = await created(teacher)
    expect(d).toMatchObject({ status: 'review', source: 'submission', editable: true, totalMarks: 5, subCount: 2 })
    expect(d.id).toMatch(/^g\d+$/)
    expect(d.subQuestions.map((p) => [p.partLabel, p.marks, p.modelAnswer])).toEqual([
      ['(a)', 3, '1/2 x tapak x tinggi = 12 cm2'],
      ['(b)', 2, '6 + 5 + 5 = 16 cm'],
    ])
    expect(await count(`select count(*)::text n from questions`)).toBe(questions)
    expect(await count(`select count(*)::text n from intake_batches where source = 'guru'`)).toBe(batches + 1)
    const rows = await t.db.query<{ source: string; owner: string; paper_type: string; item_type: string; state: string; n: string }>(
      `select b.source, b.owner_user_id::text owner, b.paper_type, i.item_type, i.review_state state, (select count(*)::text from intake_items x where x.batch_id = b.id) n
         from intake_items i join intake_batches b on b.id = i.batch_id where i.id = $1`,
      [d.id.slice(1)],
    )
    expect(rows[0]).toMatchObject({ source: 'guru', owner: teacher.userId, paper_type: 'umum', item_type: 'structured', state: 'needs_review', n: '1' })
  })

  it('stores the stimulus ONCE on the group (the item stem) and the parts as parts', async () => {
    const d = await created(teacher, { stimulus: 'Petikan rangsangan tunggal.' })
    const p = (await t.db.query<{ payload: { stem: string; marks: number; parts: { prompt: string; marks: number }[]; guru: { questionType: string } } }>(`select payload from intake_items where id = $1`, [d.id.slice(1)]))[0]!.payload
    expect(p.stem).toBe('Petikan rangsangan tunggal.')
    expect(p.marks).toBe(5)
    expect(p.parts.map((x) => x.prompt).join('|')).not.toContain('Petikan rangsangan tunggal.')
    expect(p.parts).toHaveLength(2)
    expect(p.guru.questionType).toBe('structured')
    expect(d.stimulus).toBe('Petikan rangsangan tunggal.')
  })

  it('the 422 messages are verbatim and keyed by field and part index', async () => {
    const post = (over: Record<string, unknown>) => teacher.post('/api/guru/intake/structured', body(over))
    expect(expectError(await post({ parts: [part({ marks: 21 })] }), 'VALIDATION_ERROR').fields?.['parts.0.marks']).toBe('Markah mesti antara 1 dan 20.')
    expect(expectError(await post({ parts: [part({ marks: 0 })] }), 'VALIDATION_ERROR').fields?.['parts.0.marks']).toBe('Markah mesti antara 1 dan 20.')
    expect(expectError(await post({ parts: [part({ text: ' ' })] }), 'VALIDATION_ERROR').fields?.['parts.0.text']).toBe('Sila isi teks sub-soalan.')
    expect(expectError(await post({ parts: [part({ scheme: '' })] }), 'VALIDATION_ERROR').fields?.['parts.0.scheme']).toBe('Sila isi skema jawapan.')
    expect(expectError(await post({ stimulus: 'x'.repeat(4001) }), 'VALIDATION_ERROR').fields?.stimulus).toBe('Rangsangan tidak boleh melebihi 4000 aksara.')
    expect(expectError(await post({ parts: [] }), 'VALIDATION_ERROR').fields?.parts).toBe('Sekurang-kurangnya satu sub-soalan diperlukan.')
    expect(expectError(await post({ subjectId: '' }), 'VALIDATION_ERROR').fields?.subjectId).toBe('Sila pilih subjek.')
    expect(expectError(await post({ difficultyLevel: 9 }), 'VALIDATION_ERROR').fields?.difficultyLevel).toBe('Sila pilih kesukaran.')
    expect(expectError(await post({ stimulusImageId: 'tiada-fail' }), 'VALIDATION_ERROR').fields?.stimulusImageId).toBe('Fail mesti berupa imej (jpg, png atau webp).')
  })

  it('accepts 1 to 10 parts and refuses 11; marks 1 and 20 are the bounds', async () => {
    const one = await created(teacher, { parts: [part({ marks: 1 })] })
    expect(one.totalMarks).toBe(1)
    const ten = await created(teacher, { parts: Array.from({ length: 10 }, () => part({ marks: 20 })) })
    expect(ten).toMatchObject({ subCount: 10, totalMarks: 200 })
    const f = expectError(await teacher.post('/api/guru/intake/structured', body({ parts: Array.from({ length: 11 }, () => part()) })), 'VALIDATION_ERROR').fields
    expect(f?.parts).toBe('Satu soalan berstruktur boleh mempunyai 1 hingga 10 sub-soalan sahaja.')
  })

  it('an item with no stimulus is accepted (the stimulus is optional)', async () => {
    const d = await created(teacher, { stimulus: null })
    expect(d.stimulus).toBe('')
  })

  it('the union: the owner sees the review item, another teacher does not; status filters work', async () => {
    const d = await created(teacher, { stimulus: 'Rangsangan untuk senarai kesatuan.' })
    const all = await list(teacher)
    const first = all.data[0]!
    expect(first).toMatchObject({ id: d.id, status: 'review', source: 'submission', editable: true, marks: 5, subCount: 2 })
    expect(all.data.map((r, i) => r.number === i + 1).every(Boolean)).toBe(true)
    const own = await list(teacher, '?status=review')
    expect(own.data.every((r) => r.source === 'submission' && r.status === 'review')).toBe(true)
    expect(own.data.map((r) => r.id)).toContain(d.id)
    const approved = await list(teacher, '?status=approved')
    expect(approved.data.every((r) => r.source === 'question')).toBe(true)
    expect(all.meta.totalItems).toBe(approved.meta.totalItems + own.meta.totalItems)
    const other = await list(teacher2)
    expect(other.data.map((r) => r.id)).not.toContain(d.id)
    expect((await list(teacher2, '?status=review')).meta.totalItems).toBe(0)
    // Ids never collide with a question id.
    expect(own.data.every((r) => /^g\d+$/.test(r.id))).toBe(true)
    // The detail follows the same rule.
    expect(Detail.parse((await teacher.get(`/api/guru/structured-questions/${d.id}`)).body).data).toMatchObject({ id: d.id, status: 'review', form: { difficultyLevel: 3 } })
    expectError(await teacher2.get(`/api/guru/structured-questions/${d.id}`), 'NOT_FOUND')
  })

  it('the union paginates over own submissions then approved questions', async () => {
    await created(teacher)
    const own = (await list(teacher, '?status=review')).meta.totalItems
    const approved = (await list(teacher, '?status=approved')).meta.totalItems
    const p1 = await list(teacher)
    expect(p1.meta.totalItems).toBe(own + approved)
    expect(p1.data).toHaveLength(Math.min(20, own + approved))
    const p2 = await list(teacher, '?page=2')
    expect(p2.data).toHaveLength(Math.max(0, Math.min(20, own + approved - 20)))
    const ids = [...p1.data, ...p2.data].map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(p2.data[0]?.number ?? 21).toBe(21)
  })

  it('another teacher gets 404 (never 403) on get, put and delete; an unknown id is 404', async () => {
    const d = await created(teacher)
    expectError(await teacher2.get(`/api/guru/structured-questions/${d.id}`), 'NOT_FOUND')
    expectError(await teacher2.put(`/api/guru/intake/structured/${d.id}`, body()), 'NOT_FOUND')
    expectError(await teacher2.delete(`/api/guru/intake/structured/${d.id}`), 'NOT_FOUND')
    expectError(await teacher.put('/api/guru/intake/structured/g999999999', body()), 'NOT_FOUND')
    // A single-MCQ item id is not a structured submission either.
    expectError(await teacher.delete('/api/guru/intake/structured/1'), 'NOT_FOUND')
  })

  it('edit and delete work only while the item is editable (409 once accepted)', async () => {
    const d = await created(teacher)
    const res = await teacher.put(`/api/guru/intake/structured/${d.id}`, body({ stimulus: 'Rangsangan disunting.', parts: [part({ marks: 7 })] }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(Detail.parse(res.body).data).toMatchObject({ id: d.id, stimulus: 'Rangsangan disunting.', totalMarks: 7, subCount: 1, status: 'review' })
    expect(expectError(await teacher.put(`/api/guru/intake/structured/${d.id}`, body({ parts: [part({ marks: 21 })] })), 'VALIDATION_ERROR').fields?.['parts.0.marks']).toBe('Markah mesti antara 1 dan 20.')

    const locked = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'accepted' where id = $1`, [locked.id.slice(1)])
    expectError(await teacher.put(`/api/guru/intake/structured/${locked.id}`, body()), 'CONFLICT')
    expectError(await teacher.delete(`/api/guru/intake/structured/${locked.id}`), 'CONFLICT')
    // An accepted item is a question the admin handles: it is no longer a review row.
    expect((await list(teacher, '?status=review')).data.map((r) => r.id)).not.toContain(locked.id)

    const removable = await created(teacher)
    const del = await teacher.delete(`/api/guru/intake/structured/${removable.id}`)
    expect(del.status, JSON.stringify(del.body)).toBe(200)
    expectError(await teacher.get(`/api/guru/structured-questions/${removable.id}`), 'NOT_FOUND')
    expect(await count(`select count(*)::text n from intake_items where id = ${removable.id.slice(1)}`)).toBe(0)
  })

  it('a returned (rejected) item can be edited and goes back to review', async () => {
    const d = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'rejected', reject_reason = 'Sila lengkapkan skema.' where id = $1`, [d.id.slice(1)])
    const back = Detail.parse((await teacher.get(`/api/guru/structured-questions/${d.id}`)).body).data
    expect(back).toMatchObject({ editable: true, form: { rejectionReason: 'Sila lengkapkan skema.' } })
    const res = await teacher.put(`/api/guru/intake/structured/${d.id}`, body())
    expect(res.status).toBe(200)
    expect(Detail.parse(res.body).data.form?.rejectionReason).toBeNull()
  })

  it('a structured item is not in the single-MCQ list, and the roles are enforced', async () => {
    const d = await created(teacher)
    const mcq = await teacher.get('/api/guru/questions')
    expect(JSON.stringify(mcq.body)).not.toContain(`"id":"${d.id.slice(1)}"`)
    const student = await loginAs(t, 'student')
    expectError(await student.post('/api/guru/intake/structured', body()), 'FORBIDDEN')
  })
})
