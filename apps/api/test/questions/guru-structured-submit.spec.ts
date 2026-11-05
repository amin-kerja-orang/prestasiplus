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

  it('stores the stimulus ONCE as the batch stimulus the item links to (the stem and the parts do not carry it)', async () => {
    const d = await created(teacher, { stimulus: 'Petikan rangsangan tunggal.' })
    const row = (await t.db.query<{ payload: { stem: string; marks: number; parts: { prompt: string; marks: number; mode: string }[]; guru: { questionType: string } }; stimulus_id: string | null; batch_id: string }>(
      `select payload, stimulus_id::text, batch_id::text from intake_items where id = $1`,
      [d.id.slice(1)],
    ))[0]!
    expect(row.payload.stem).toBe('')
    expect(JSON.stringify(row.payload.parts)).not.toContain('Petikan rangsangan tunggal.')
    expect(row.payload.parts).toHaveLength(2)
    expect(row.payload.guru.questionType).toBe('structured')
    const stimuli = await t.db.query<{ id: string; kind: string; body: string | null; alt_text: string }>(`select id::text, kind, body, alt_text from intake_stimuli where batch_id = $1`, [row.batch_id])
    expect(stimuli).toHaveLength(1)
    expect(stimuli[0]).toMatchObject({ id: row.stimulus_id, kind: 'passage', body: 'Petikan rangsangan tunggal.', alt_text: 'Rangsangan' })
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
    expect(f?.parts).toBe('Bilangan sub-soalan mesti antara 1 dan 10.')
  })

  it('an item with no stimulus is accepted (the stimulus is optional)', async () => {
    const d = await created(teacher, { stimulus: null })
    expect(d.stimulus).toBe('')
    expect(await count(`select count(*)::text n from intake_items where id = ${d.id.slice(1)} and stimulus_id is null`)).toBe(1)
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
    // An accepted item stays the teacher's own row (Menunggu Semakan until Terbitkan), but is no longer editable.
    expect((await list(teacher, '?status=review')).data.find((r) => r.id === locked.id)).toMatchObject({ status: 'review', editable: false, source: 'submission' })

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

  describe('stimulus image (jpg, png or webp, at most 2 MB, the caller own question_image upload)', () => {
    let n = 0
    const file = async (owner: string, over: { purpose?: string; mime?: string; size?: number } = {}): Promise<string> => {
      n += 1
      const token = `imgTok${String(Date.now())}${String(n)}`.padEnd(22, 'x').slice(0, 22)
      await t.db.query(`insert into files (public_id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, $2, $3, $4, $5, repeat('b', 64), $1)`, [
        token,
        owner,
        over.purpose ?? 'question_image',
        over.mime ?? 'image/png',
        over.size ?? 1000,
      ])
      return token
    }
    const refused = async (token: string, message: string) =>
      expect(expectError(await teacher.post('/api/guru/intake/structured', body({ stimulusImageId: token })), 'VALIDATION_ERROR').fields?.stimulusImageId).toBe(message)

    it('happy path: the detail shows the file URL and the token is stored in the item', async () => {
      const token = await file(teacher.userId)
      const d = await created(teacher, { stimulusImageId: token, stimulus: null })
      expect(d.stimulusImage).toBe(`/api/files/${token}`)
      expect(d.form?.stimulusImageId).toBe(token)
      expect(await count(`select count(*)::text n from intake_stimuli s join intake_items i on i.stimulus_id = s.id where i.id = ${d.id.slice(1)}`)).toBe(1)
    })
    it('refuses another user token, the wrong purpose, the wrong mime and a file over 2 MB', async () => {
      await refused(await file(teacher2.userId), 'Fail mesti berupa imej (jpg, png atau webp).')
      await refused(await file(teacher.userId, { purpose: 'avatar' }), 'Fail mesti berupa imej (jpg, png atau webp).')
      await refused(await file(teacher.userId, { mime: 'image/gif' }), 'Fail mesti berupa imej (jpg, png atau webp).')
      await refused(await file(teacher.userId, { size: 2 * 1024 * 1024 + 1 }), 'Saiz imej tidak boleh melebihi 2 MB.')
      expect((await teacher.post('/api/guru/intake/structured', body({ stimulusImageId: await file(teacher.userId, { size: 2 * 1024 * 1024 }) }))).status).toBe(201)
    })
    it('PUT replaces the image and discards the old file; DELETE discards the current one', async () => {
      const first = await file(teacher.userId)
      const second = await file(teacher.userId)
      const d = await created(teacher, { stimulusImageId: first })
      const res = await teacher.put(`/api/guru/intake/structured/${d.id}`, body({ stimulusImageId: second }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const exists = async (tok: string) => count(`select count(*)::text n from files where public_id = '${tok}'`)
      expect(await exists(first)).toBe(0)
      expect(await exists(second)).toBe(1)
      expect((await teacher.delete(`/api/guru/intake/structured/${d.id}`)).status).toBe(200)
      expect(await exists(second)).toBe(0)
    })
  })

  it('PUT checks "still editable" (409) before the body (422)', async () => {
    const d = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'accepted' where id = $1`, [d.id.slice(1)])
    expectError(await teacher.put(`/api/guru/intake/structured/${d.id}`, body({ parts: [] })), 'CONFLICT')
  })

  it('the detail status and editable follow the real item state', async () => {
    const a = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'accepted' where id = $1`, [a.id.slice(1)])
    expect(Detail.parse((await teacher.get(`/api/guru/structured-questions/${a.id}`)).body).data).toMatchObject({ status: 'review', editable: false })
    // Accepted and the question is published (a live version): approved, not editable.
    const live = (await t.db.query<{ id: string }>(`select id::text from questions where live_version_no is not null limit 1`))[0]?.id
    expect(live).toBeDefined()
    const b = await created(teacher)
    await t.db.query(`update intake_items set review_state = 'accepted', question_id = $2 where id = $1`, [b.id.slice(1), live])
    expect(Detail.parse((await teacher.get(`/api/guru/structured-questions/${b.id}`)).body).data).toMatchObject({ status: 'approved', editable: false })
    const c = await created(teacher)
    expect(Detail.parse((await teacher.get(`/api/guru/structured-questions/${c.id}`)).body).data).toMatchObject({ status: 'review', editable: true })
  })

  it('own items never vanish: accepted and unpublished stays as review (not editable); published appears once, as approved; another teacher sees neither', async () => {
    const draft = (await t.db.query<{ id: string }>(`select id::text from questions where live_version_no is null order by id limit 1`))[0]?.id ?? null
    const pending = await created(teacher, { stimulus: 'Diterima tetapi belum diterbitkan.' })
    await t.db.query(`update intake_items set review_state = 'accepted', question_id = $2 where id = $1`, [pending.id.slice(1), draft])
    for (const q of ['', '?status=review']) {
      const row = (await list(teacher, q)).data.find((r) => r.id === pending.id)
      expect(row, q).toMatchObject({ status: 'review', editable: false, source: 'submission' })
    }
    expect((await list(teacher, '?status=approved')).data.map((r) => r.id)).not.toContain(pending.id)
    expect(Detail.parse((await teacher.get(`/api/guru/structured-questions/${pending.id}`)).body).data).toMatchObject({ status: 'review', editable: false })

    const publishedQuestion = (await list(teacher, '?status=approved')).data.find((r) => r.source === 'question')
    expect(publishedQuestion).toBeDefined()
    const done = await created(teacher, { stimulus: 'Diterbitkan.' })
    await t.db.query(`update intake_items set review_state = 'accepted', question_id = $2 where id = $1`, [done.id.slice(1), publishedQuestion?.id])
    const everything = await list(teacher)
    const own = (await list(teacher, '?status=review')).meta.totalItems
    const approvedTotal = (await list(teacher, '?status=approved')).meta.totalItems
    // No duplicate between the two sides: the union count is exactly own review rows plus approved questions.
    expect(everything.meta.totalItems).toBe(own + approvedTotal)
    expect(everything.data.map((r) => r.id)).not.toContain(done.id)
    expect((await list(teacher, '?status=review')).data.map((r) => r.id)).not.toContain(done.id)
    expect((await list(teacher, '?status=approved')).data.filter((r) => r.id === publishedQuestion?.id)).toHaveLength(1)

    // Published but NOT served (inactive): the approved side no longer lists it, so the own item stays, once, as an `approved` submission row
    // (not editable): under status=approved and the default list, never under status=review.
    const hidden = await created(teacher, { stimulus: 'Diterbitkan tetapi tidak aktif.' })
    await t.db.query(`update intake_items set review_state = 'accepted', question_id = $2 where id = $1`, [hidden.id.slice(1), publishedQuestion?.id])
    await t.db.query(`update questions set is_active = false where id = $1`, [publishedQuestion?.id])
    try {
      const reach = async (query: string) => {
        const first = await list(teacher, query)
        const pages = Math.max(1, Math.ceil(first.meta.totalItems / 20))
        const rows = [...first.data]
        for (let p = 2; p <= pages; p += 1) rows.push(...(await list(teacher, `${query === '' ? '?' : `${query}&`}page=${String(p)}`)).data)
        expect(rows).toHaveLength(first.meta.totalItems)
        return rows
      }
      expect((await reach('?status=approved')).filter((r) => r.id === hidden.id)).toEqual([expect.objectContaining({ status: 'approved', source: 'submission', editable: false })])
      expect((await reach('')).filter((r) => r.id === hidden.id)).toHaveLength(1)
      expect((await reach('?status=review')).map((r) => r.id)).not.toContain(hidden.id)
      expect((await reach('?status=approved')).map((r) => r.id)).not.toContain(publishedQuestion?.id)
      expectError(await teacher2.get(`/api/guru/structured-questions/${hidden.id}`), 'NOT_FOUND')
    } finally {
      await t.db.query(`update questions set is_active = true where id = $1`, [publishedQuestion?.id])
    }

    for (const id of [pending.id, done.id]) {
      expect((await list(teacher2, '?status=review')).data.map((r) => r.id)).not.toContain(id)
      expectError(await teacher2.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
    }
  })

  it('a structured item is not in the single-MCQ list, and the roles are enforced', async () => {
    const d = await created(teacher)
    const mcq = await teacher.get('/api/guru/questions')
    expect(JSON.stringify(mcq.body)).not.toContain(`"id":"${d.id.slice(1)}"`)
    const student = await loginAs(t, 'student')
    expectError(await student.post('/api/guru/intake/structured', body()), 'FORBIDDEN')
  })
  it('the union crosses the boundary between own and approved rows (more than 20 own items)', async () => {
    const mine: string[] = []
    for (let i = 0; i < 21; i += 1) mine.push((await created(teacher2, { stimulus: `Rangsangan sempadan ${String(i)}.` })).id)
    const approved = (await list(teacher2, '?status=approved')).meta.totalItems
    const p1 = await list(teacher2)
    const p2 = await list(teacher2, '?page=2')
    expect(p1.meta.totalItems).toBe(21 + approved)
    expect(p1.data).toHaveLength(20)
    expect(p1.data.every((r) => r.source === 'submission')).toBe(true)
    // Page 2: the last own item first, then approved questions up to 20 rows.
    expect(p2.data[0]).toMatchObject({ source: 'submission', number: 21 })
    expect(p2.data.slice(1).every((r) => r.source === 'question')).toBe(true)
    expect(p2.data).toHaveLength(Math.min(20, 21 + approved - 20))
    expect(p2.data.map((r) => r.number)).toEqual(p2.data.map((_, i) => 21 + i))
    const ids = [...p1.data, ...p2.data].map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(mine.every((id) => ids.includes(id))).toBe(true)
  })
})
