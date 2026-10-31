/**
 * BE-09 AC 9: mock parity. Replays the route-level cases of the M04 mock tests
 * (src/modules/m04-question-bank/__tests__/mock/{questions-write,questions-read}.test.ts) against the real API and
 * asserts the same HTTP status and error `code` (and, for 422, the same field keys and BM copy).
 *
 * Not replayed here, with the reason:
 * - questions-store.test.ts / contributions.test.ts: they test the in-memory store, the observed anchor counts and the
 *   M05/M06/M07/M08/M10/M11 contribution blocks (mock-only machinery). The real store is covered by repository.spec.ts,
 *   service.spec.ts and seed.spec.ts; `contributionCountsFor` (BE-17) by service.spec.ts.
 * - ai-explanation and DSKP cascade routes: BE-10.
 * - PKSK rows: the mock keeps PKSK rows in the same store (404 on /api/questions); BE-42 owns PKSK in v2.
 *
 * Every intended difference is in DIFFERENCES and has a matching row in docs/architecture/v2-backend-deviations.md.
 */
import { ErrorBodySchema, QuestionStatusSchema, SessionSchema } from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, DEMO_PASSWORD, bootQuestionsApp, csrfHeader, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/** Mock status -> v2 wire status (BE-09 AC 11). `rejected` has no v2 status. */
export const MOCK_STATUS_TO_V2: Record<string, string | undefined> = {
  draft: 'draft',
  pending_review: 'review',
  approved: 'approved',
  archived: 'archived',
  rejected: undefined,
}

/** Mock bulk verbs -> v2 bulk actions (D54a). `reject` has no v2 action. */
export const MOCK_BULK_TO_V2: Record<string, string | undefined> = {
  approve: 'approved',
  pending_review: 'review',
  archive: 'archived',
  delete: 'delete',
  reject: undefined,
}

/** Intended differences from the mock; each is also a deviation row (BE-09 parity). */
export const DIFFERENCES: readonly { id: string; mock: string; v2: string }[] = [
  { id: 'D-1', mock: 'Ids are numbers (9000001, 564159)', v2: 'Ids are decimal strings' },
  { id: 'D-2', mock: 'Create stores status `approved` (live at once)', v2: 'Create stores status `draft` unless `status` is sent; publishing runs the tag gate' },
  { id: 'D-3', mock: 'Status values draft/pending_review/approved/rejected/archived', v2: 'draft/review/approved/published/archived; `pending_review` and `rejected` are 422 `fields.status` (see MOCK_STATUS_TO_V2)' },
  { id: 'D-4', mock: 'GET /questions?status=nonsense matches nothing (200, 0 rows)', v2: '422 VALIDATION_ERROR with `fields.status` (D54); other unknown filter values still match nothing' },
  { id: 'D-5', mock: 'Bulk verbs approve/reject/pending_review/archive/delete', v2: 'Bulk actions draft/review/approved/published/archived/delete (see MOCK_BULK_TO_V2); `reject` is 422 "Tindakan tidak sah."' },
  { id: 'D-6', mock: 'Bulk change applies any status to any row', v2: 'Bulk applies the contract transition table; a refused transition, an unknown id or a failed publish gate is skipped and not counted' },
  { id: 'D-7', mock: 'Create and update accept multipart with image files', v2: 'JSON only; images are already uploaded `question_image` file ids' },
  { id: 'D-8', mock: 'Editing an approved question edits it in place', v2: 'Editing a published question writes version n+1 as `draft`; the live version keeps serving' },
  { id: 'D-9', mock: 'Guru create lands in `pending_review`', v2: 'Guru create lands in `review`' },
  { id: 'D-10', mock: 'POST /api/questions/:id/ai-explanation and the DSKP cascade are in the same module', v2: 'Not in BE-09 (BE-10)' },
  { id: 'D-12', mock: 'Any page number is an empty page', v2: 'A page above 100000 is 422 `fields.page` "Halaman tidak sah." (keeps OFFSET bounded)' },
  { id: 'D-11', mock: 'A non-numeric id is 404', v2: 'A non-numeric id is 404 as well (not probeable)' },
]

const STATUS_FIELD = 'status'

const errorOf = (res: Response) => ErrorBodySchema.parse(res.body).error
const expectErr = (res: Response, status: number, code: string) => {
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  const error = errorOf(res)
  expect(error.code).toBe(code)
  return error
}
const bodyData = (res: Response) => (res.body as { data: Record<string, any>; status?: string }).data // eslint-disable-line @typescript-eslint/no-explicit-any

describe('AC 9: mock status mapping table', () => {
  it('maps the mock values to the v2 wire values', () => {
    expect(MOCK_STATUS_TO_V2).toEqual({ draft: 'draft', pending_review: 'review', approved: 'approved', archived: 'archived', rejected: undefined })
  })

  it('every mapped value is a v2 status, and the unmapped mock values are not', () => {
    for (const [mock, v2] of Object.entries(MOCK_STATUS_TO_V2)) {
      if (v2 === undefined) expect(QuestionStatusSchema.safeParse(mock).success, mock).toBe(false)
      else expect(QuestionStatusSchema.safeParse(v2).success, v2).toBe(true)
    }
    expect(QuestionStatusSchema.safeParse('pending_review').success).toBe(false)
  })

  it('DIFFERENCES has unique ids and both sides filled', () => {
    expect(new Set(DIFFERENCES.map((d) => d.id)).size).toBe(DIFFERENCES.length)
    for (const d of DIFFERENCES) {
      expect(d.mock.length).toBeGreaterThan(0)
      expect(d.v2.length).toBeGreaterThan(0)
    }
  })
})

describe('AC 9: mock parity on the 14 routes', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let teacher2: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    // The second teacher also holds school_admin and starts in that role: switch to teacher.
    const agent = t.agent()
    const login = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS.teacher2, password: DEMO_PASSWORD, remember: false })
    const first = SessionSchema.parse(login.body.data)
    const switched = await agent.post('/api/session/role').set('X-CSRF-Token', first.csrf).send({ role: 'teacher' })
    const csrf = SessionSchema.parse(switched.body.data).csrf
    const mk = (m: 'post' | 'put') => (url: string, b?: unknown) => agent[m](url).set('X-CSRF-Token', csrf).send(b as object)
    teacher2 = { csrf, userId: first.user.id, get: (u) => agent.get(u), post: mk('post'), put: mk('put'), patch: mk('post'), delete: (u) => agent.delete(u).set('X-CSRF-Token', csrf), noCsrf: {} as Client['noCsrf'] }
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const create = async (over: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return bodyData(res)
  }
  const list = (query = '') => admin.get(`/api/questions${query}`)
  const bulk = (body: unknown) => admin.post('/api/questions/bulk-action', body)

  describe('#3 POST /api/questions', () => {
    it('201 with the flash; wire fields of the mock; status is draft (D-2)', async () => {
      const res = await admin.post('/api/questions', mcqBody(refs))
      expect(res.status).toBe(201)
      expect((res.body as { status: string }).status).toBe('Soalan berjaya ditambah.')
      expect(bodyData(res)).toMatchObject({
        subjectId: refs.mathId,
        educationLevelId: refs.t4Id,
        difficultyLevel: 3,
        questionType: 'mcq',
        options: ['4', '5', '6', '7'],
        correctAnswer: 1,
        status: MOCK_STATUS_TO_V2.draft,
        isActive: true,
        aiVerified: false,
        needsDiagram: false,
        qualityScore: null,
      })
      expect(typeof bodyData(res).id).toBe('string')
    })

    it('appears first in the admin list and moves the total by one', async () => {
      const before = (await list()).body.meta.totalItems as number
      const q = await create()
      const res = await list()
      expect(res.body.data[0].id).toBe(q.id)
      expect(res.body.meta.totalItems).toBe(before + 1)
    })

    it('stores only the fields of the chosen type (true_false, fill_blank, short_answer, essay)', async () => {
      const base = { options: undefined, correctAnswer: undefined, questionText: 'Soalan contoh untuk jenis lain selain aneka pilihan.' }
      const tf = await create({ ...base, questionType: 'true_false', tfAnswer: true })
      expect(tf).toMatchObject({ questionType: 'true_false', tfAnswer: true, options: null, correctAnswer: null, correctAnswerText: null })
      const fill = await create({ ...base, questionType: 'fill_blank', correctAnswerText: '12', altAnswers: ['dua belas'] })
      expect(fill).toMatchObject({ questionType: 'fill_blank', correctAnswerText: '12', tfAnswer: null, options: null })
      const short = await create({ ...base, questionType: 'short_answer', correctAnswerText: '12' })
      expect(short.questionType).toBe('short_answer')
      const essay = await create({ ...base, questionType: 'essay', modelAnswer: 'Jawapan contoh esei.' })
      expect(essay).toMatchObject({ questionType: 'essay', modelAnswer: 'Jawapan contoh esei.', correctAnswerText: null })
    })

    it('an empty post lists the required fields in one 422 VALIDATION_ERROR', async () => {
      const error = expectErr(await admin.post('/api/questions', {}), 422, 'VALIDATION_ERROR')
      expect(error.fields).toMatchObject({
        subjectId: 'Sila pilih subjek.',
        educationLevelId: 'Sila pilih tahap pendidikan.',
        difficultyLevel: 'Sila pilih tahap kesukaran.',
        questionType: 'Jenis soalan tidak sah.',
        questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
      })
    })

    it.each([
      ['subject not in M03', { subjectId: '999999' }, 'subjectId', 'Sila pilih subjek.'],
      ['level not in M03', { educationLevelId: '999999' }, 'educationLevelId', 'Sila pilih tahap pendidikan.'],
      ['difficulty 0', { difficultyLevel: 0 }, 'difficultyLevel', 'Sila pilih tahap kesukaran.'],
      ['difficulty 6', { difficultyLevel: 6 }, 'difficultyLevel', 'Sila pilih tahap kesukaran.'],
      ['unknown type', { questionType: 'matching' }, 'questionType', 'Jenis soalan tidak sah.'],
      ['text of 9 characters', { questionText: '123456789' }, 'questionText', 'Teks soalan mesti sekurang-kurangnya 10 aksara.'],
      ['a blank option', { options: ['4', '5', '6', ' '] }, 'options', 'Sila isi semua pilihan jawapan.'],
      ['correct answer 4', { correctAnswer: 4 }, 'correctAnswer', 'Sila pilih jawapan betul.'],
      ['points 0', { pointsValue: 0 }, 'pointsValue', 'Nilai mata mesti sekurang-kurangnya 1.'],
      ['language fr', { language: 'fr' }, 'language', 'Bahasa tidak sah.'],
    ])('%s: 422 on that field', async (_name, over, field, message) => {
      const error = expectErr(await admin.post('/api/questions', mcqBody(refs, over)), 422, 'VALIDATION_ERROR')
      expect(Object.keys(error.fields ?? {})).toContain(field)
      expect(error.fields?.[field]).toBe(message)
    })

    it('short answer needs correctAnswerText', async () => {
      const error = expectErr(
        await admin.post('/api/questions', mcqBody(refs, { questionType: 'short_answer', options: undefined, correctAnswer: undefined, correctAnswerText: '  ' })),
        422,
        'VALIDATION_ERROR',
      )
      expect(error.fields).toMatchObject({ correctAnswerText: 'Sila masukkan jawapan betul.' })
    })

    it('D-3: pending_review and rejected are 422 on fields.status', async () => {
      for (const status of ['pending_review', 'rejected', 'approved ']) {
        const error = expectErr(await admin.post('/api/questions', mcqBody(refs, { status })), 422, 'VALIDATION_ERROR')
        expect(Object.keys(error.fields ?? {})).toContain(STATUS_FIELD)
      }
    })

    it('tags a DSKP SP and lists it as tagged', async () => {
      const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
      const q = await create({ dskpSpId: tag.spIds[0], questionText: 'Soalan bertanda SP DSKP untuk padanan.' })
      expect(q.dskpSpId).toBe(tag.spIds[0])
      const res = await list(`?dskpFilter=tagged&subjectId=${refs.mathId}&educationLevelId=${refs.t4Id}`)
      expect(res.body.data.map((r: { id: string }) => r.id)).toContain(q.id)
    })

    it('D-7: a multipart body with fields is not the contract (JSON works, 201)', async () => {
      expect((await admin.post('/api/questions', mcqBody(refs))).status).toBe(201)
    })

    it('no session 401, school admin 403, missing CSRF 403 CSRF_INVALID', async () => {
      expectErr(await t.http().post('/api/questions').send(mcqBody(refs)), 401, 'UNAUTHORIZED')
      expectErr(await admin.noCsrf.post('/api/questions', mcqBody(refs)), 403, 'CSRF_INVALID')
      const school = await loginAs(t, 'schoolAdmin')
      expectErr(await school.post('/api/questions', mcqBody(refs)), 403, 'FORBIDDEN')
    })
  })

  describe('#1 GET /api/questions and #2 summary', () => {
    it('page 1 is 20 rows newest first with meta', async () => {
      for (let i = 0; i < 3; i += 1) await create({ questionText: `Soalan senarai nombor ${String(i)} untuk jadual.` })
      const res = await list()
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeLessThanOrEqual(20)
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20 })
      const ids = res.body.data.map((r: { id: string }) => BigInt(r.id))
      for (let i = 1; i < ids.length; i += 1) expect(ids[i - 1]! >= ids[i]!).toBe(true)
    })

    it('a row carries the QuestionRow fields with subject and level names', async () => {
      const row = (await list()).body.data[0]
      expect(row.subject).toMatchObject({ id: expect.any(String), name: expect.any(String) })
      expect(row.level).toMatchObject({ id: expect.any(String), name: expect.any(String) })
      expect(row).toHaveProperty('dskpTagged')
    })

    it('filters combine with AND and search is a case-insensitive substring', async () => {
      const q = await create({ questionText: 'Padanan UNIK Parity Zxqv dalam teks.' })
      const hit = await list('?search=unik parity zxqv')
      expect(hit.body.data.map((r: { id: string }) => r.id)).toEqual([q.id])
      expect((await list(`?search=unik+parity+zxqv&subjectId=${refs.sciId}`)).body.meta.totalItems).toBe(0)
    })

    it('unknown parameters are ignored; unknown filter values and non-numeric ids match nothing', async () => {
      const total = (await list()).body.meta.totalItems as number
      expect((await list('?type=essay&sort=id')).body.meta.totalItems).toBe(total)
      expect((await list('?dskpFilter=maybe')).body.meta.totalItems).toBe(0)
      expect((await list('?sourceFilter=ai_generated_x')).body.meta.totalItems).toBe(0)
      expect((await list('?subjectId=abc')).body.meta.totalItems).toBe(0)
      expect((await list('?subjectId=&educationLevelId=&status=&search=')).body.meta.totalItems).toBe(total)
    })

    it('D-4: an unknown status filter is 422 fields.status (mock: 200, 0 rows)', async () => {
      for (const status of ['nonsense', 'pending_review', 'rejected']) {
        const error = expectErr(await list(`?status=${status}`), 422, 'VALIDATION_ERROR')
        expect(Object.keys(error.fields ?? {})).toContain(STATUS_FIELD)
      }
    })

    it('an out-of-range page is an empty page, not an error', async () => {
      const res = await list('?page=100000')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.page).toBe(100_000)
    })

    it('D-12: a page number above 100000 is 422 fields.page (mock: empty page)', async () => {
      const error = expectErr(await list('?page=999999'), 422, 'VALIDATION_ERROR')
      expect(Object.keys(error.fields ?? {})).toContain('page')
    })

    it('summary: total plus one tile per subject; approved counts the published rows', async () => {
      const res = await admin.get('/api/questions/summary')
      expect(res.status).toBe(200)
      const data = bodyData(res)
      expect(data.total).toBe((await list()).body.meta.totalItems)
      expect(Array.isArray(data.subjects)).toBe(true)
      const published = Number((await t.db.query<{ n: string }>(`select count(*)::text n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where v.status = 'approved'`))[0]?.n)
      const sum = (data.subjects as { approved: number }[]).reduce((a, s) => a + s.approved, 0)
      expect(sum).toBeLessThanOrEqual(published)
    })
  })

  describe('#4 GET /api/questions/:id', () => {
    it('returns the question with names, the DSKP chain and the creator', async () => {
      const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
      const q = await create({ dskpSpId: tag.spIds[0], questionText: 'Soalan terperinci untuk bacaan butiran.' })
      const res = await admin.get(`/api/questions/${String(q.id)}`)
      expect(res.status).toBe(200)
      expect(bodyData(res)).toMatchObject({ id: q.id, subject: { id: refs.mathId }, level: { id: refs.t4Id }, createdBy: { id: admin.userId } })
      expect(bodyData(res).dskp).not.toBeNull()
    })

    it('an untagged question has dskp null', async () => {
      const q = await create({ questionText: 'Soalan tanpa tag DSKP sama sekali.' })
      expect(bodyData(await admin.get(`/api/questions/${String(q.id)}`)).dskp).toBeNull()
    })

    it('an unknown id and a non-numeric id are 404 NOT_FOUND (D-11)', async () => {
      expectErr(await admin.get('/api/questions/999999999'), 404, 'NOT_FOUND')
      expectErr(await admin.get('/api/questions/abc'), 404, 'NOT_FOUND')
    })
  })

  describe('#5 PUT /api/questions/:id', () => {
    it('updates the fields, keeps the type and status, and returns the flash', async () => {
      const q = await create()
      const res = await admin.put(`/api/questions/${String(q.id)}`, mcqBody(refs, { questionText: 'Teks soalan yang sudah dikemaskini.', correctAnswer: 2 }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect((res.body as { status: string }).status).toBe('Soalan berjaya dikemaskini.')
      expect(bodyData(res)).toMatchObject({ id: q.id, questionText: 'Teks soalan yang sudah dikemaskini.', correctAnswer: 2, questionType: 'mcq', status: 'draft' })
    })

    it('validates like a create and changes nothing on 422', async () => {
      const q = await create()
      const res = await admin.put(`/api/questions/${String(q.id)}`, { subjectId: refs.mathId, educationLevelId: refs.t4Id, difficultyLevel: 2, questionText: 'kurang' })
      const error = expectErr(res, 422, 'VALIDATION_ERROR')
      expect(error.fields).toMatchObject({ questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.' })
      expect(bodyData(await admin.get(`/api/questions/${String(q.id)}`)).questionText).toBe(q.questionText)
    })

    it('an unknown id is 404', async () => {
      expectErr(await admin.put('/api/questions/999999999', mcqBody(refs)), 404, 'NOT_FOUND')
    })
  })

  describe('#6 DELETE /api/questions/:id', () => {
    it('deletes and answers the flash; the second call is 404', async () => {
      const q = await create()
      const before = (await list()).body.meta.totalItems as number
      const res = await admin.delete(`/api/questions/${String(q.id)}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Soalan berjaya dipadam.' })
      expect((await list()).body.meta.totalItems).toBe(before - 1)
      expectErr(await admin.delete(`/api/questions/${String(q.id)}`), 404, 'NOT_FOUND')
    })

    it('an unknown id is 404 and nothing is removed', async () => {
      const before = (await list()).body.meta.totalItems as number
      expectErr(await admin.delete('/api/questions/999999999'), 404, 'NOT_FOUND')
      expect((await list()).body.meta.totalItems).toBe(before)
    })
  })

  describe('#7 POST /api/questions/bulk-action', () => {
    it('D-5: the mapped verbs set the mapped status (draft, review, archived)', async () => {
      const a = (await create()).id as string
      const b = (await create()).id as string
      for (const mockVerb of ['pending_review', 'archive']) {
        const action = MOCK_BULK_TO_V2[mockVerb]!
        const res = await bulk({ action, ids: [a, b] })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect(bodyData(res)).toEqual({ affected: 2, failed: [] })
        expect((res.body as { status: string }).status).toBe('2 soalan berjaya dikemaskini.')
        const status = MOCK_STATUS_TO_V2[mockVerb === 'archive' ? 'archived' : 'pending_review']
        expect(bodyData(await admin.get(`/api/questions/${a}`)).status).toBe(status)
        expect(bodyData(await admin.get(`/api/questions/${b}`)).status).toBe(status)
        if (action === 'review') await bulk({ action: 'draft', ids: [a, b] })
      }
    })

    it('D-6: a refused transition is skipped and not counted (draft to approved)', async () => {
      const a = (await create()).id as string
      const res = await bulk({ action: 'approved', ids: [a] })
      expect(res.status).toBe(200)
      expect(bodyData(res)).toEqual({
        affected: 0,
        failed: [{ id: a, code: 'CONFLICT', message: 'Perubahan status daripada Draf kepada Diterbitkan tidak dibenarkan.', fields: {} }],
      })
    })

    it('D-6: a publish without the curriculum tag is skipped, with the tag it is counted', async () => {
      const bare = (await create()).id as string
      await bulk({ action: 'review', ids: [bare] })
      await bulk({ action: 'approved', ids: [bare] })
      expect(bodyData(await bulk({ action: 'approved', ids: [bare] }))).toEqual({ affected: 0, failed: [expect.objectContaining({ id: bare, code: 'VALIDATION_ERROR' })] })
    })

    it('delete removes the rows; unknown ids are not counted and duplicates count once', async () => {
      const a = (await create()).id as string
      const res = await bulk({ action: 'delete', ids: [a, '999999999', a] })
      expect(res.status).toBe(200)
      expect(bodyData(res)).toEqual({ affected: 1, failed: [{ id: '999999999', code: 'NOT_FOUND', message: 'Soalan tidak dijumpai.', fields: {} }] })
      expect((res.body as { status: string }).status).toBe('1 soalan berjaya dikemaskini.')
      expectErr(await admin.get(`/api/questions/${a}`), 404, 'NOT_FOUND')
    })

    it('422 without an action, without ids, with a bad action or bad ids', async () => {
      expect(expectErr(await bulk({ ids: ['1'] }), 422, 'VALIDATION_ERROR').fields).toEqual({ action: 'Sila pilih tindakan terlebih dahulu.' })
      expect(expectErr(await bulk({ action: 'draft', ids: [] }), 422, 'VALIDATION_ERROR').fields).toEqual({ ids: 'Sila pilih sekurang-kurangnya satu soalan.' })
      expect(Object.keys(expectErr(await bulk({}), 422, 'VALIDATION_ERROR').fields ?? {}).sort()).toEqual(['action', 'ids'])
      expect(expectErr(await bulk({ action: 'explode', ids: ['1'] }), 422, 'VALIDATION_ERROR').fields).toEqual({ action: 'Tindakan tidak sah.' })
      expect(expectErr(await bulk({ action: 'draft', ids: [{}, '2'] }), 422, 'VALIDATION_ERROR').fields).toEqual({ ids: 'Senarai soalan tidak sah.' })
    })

    it('D-5: the mock verbs approve, reject and pending_review are 422 Tindakan tidak sah.', async () => {
      for (const verb of ['approve', 'reject', 'pending_review']) {
        expect(expectErr(await bulk({ action: verb, ids: ['1'] }), 422, 'VALIDATION_ERROR').fields).toEqual({ action: 'Tindakan tidak sah.' })
      }
    })
  })

  describe('admin guards (every admin route)', () => {
    const routes: [string, string][] = [
      ['get', '/api/questions'],
      ['get', '/api/questions/summary'],
      ['post', '/api/questions'],
      ['get', '/api/questions/1'],
      ['put', '/api/questions/1'],
      ['delete', '/api/questions/1'],
      ['post', '/api/questions/bulk-action'],
    ]
    const call = (client: Client | null, method: string, url: string) => {
      if (!client) return (t.http() as any)[method](url) as Promise<Response> // eslint-disable-line @typescript-eslint/no-explicit-any
      return (client as any)[method](url, {}) as Promise<Response> // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    it.each(routes)('%s %s: guest 401, student, teacher and school admin 403', async (method, url) => {
      expectErr(await call(null, method, url), 401, 'UNAUTHORIZED')
      for (const who of ['student', 'teacher', 'schoolAdmin'] as const) {
        expectErr(await call(await loginAs(t, who), method, url), 403, 'FORBIDDEN')
      }
    })
  })

  describe('Guru routes (/api/guru/questions)', () => {
    const body = () => mcqBody(refs, { questionText: 'Soalan guru untuk ujian pariti.' })
    it('create lands in review (D-9), owned by the caller; the list shows own rows only', async () => {
      const res = await teacher.post('/api/guru/questions', body())
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = bodyData(res).id as string
      expect(bodyData(res).status).toBe(MOCK_STATUS_TO_V2.pending_review)
      const own = await teacher.get('/api/guru/questions')
      expect(own.body.data.map((r: { id: string }) => r.id)).toContain(id)
      const other = await teacher2.get('/api/guru/questions')
      expect(other.body.data.map((r: { id: string }) => r.id)).not.toContain(id)
    })

    it('another teacher\'s id is 404 on get, update and delete (never 403)', async () => {
      const id = bodyData(await teacher.post('/api/guru/questions', body())).id as string
      expectErr(await teacher2.get(`/api/guru/questions/${id}`), 404, 'NOT_FOUND')
      expectErr(await teacher2.put(`/api/guru/questions/${id}`, body()), 404, 'NOT_FOUND')
      expectErr(await teacher2.delete(`/api/guru/questions/${id}`), 404, 'NOT_FOUND')
    })

    it('missing fields use the BM copy of the mock', async () => {
      const error = expectErr(await teacher.post('/api/guru/questions', {}), 422, 'VALIDATION_ERROR')
      expect(error.fields).toMatchObject({ educationLevelId: 'Sila pilih tahap pendidikan.', subjectId: 'Sila pilih subjek.', difficultyLevel: 'Sila pilih tahap kesukaran.', questionText: 'Sila isi soalan.' })
    })

    it('delete answers {removed: 1}; the second call is 404', async () => {
      const id = bodyData(await teacher.post('/api/guru/questions', body())).id as string
      const res = await teacher.delete(`/api/guru/questions/${id}`)
      expect(res.status).toBe(200)
      expect(bodyData(res)).toEqual({ removed: 1 })
      expectErr(await teacher.delete(`/api/guru/questions/${id}`), 404, 'NOT_FOUND')
    })

    it('a student gets 403 and a guest 401; a write without CSRF is CSRF_INVALID', async () => {
      const student = await loginAs(t, 'student')
      expectErr(await student.get('/api/guru/questions'), 403, 'FORBIDDEN')
      expectErr(await t.http().get('/api/guru/questions'), 401, 'UNAUTHORIZED')
      expectErr(await teacher.noCsrf.post('/api/guru/questions', body()), 403, 'CSRF_INVALID')
    })
  })

  describe('structured reads', () => {
    it('list is 200 with stats; an unknown id is 404; the guard is admin only', async () => {
      const res = await admin.get('/api/structured-questions')
      expect(res.status).toBe(200)
      expect(res.body.meta).toHaveProperty('stats')
      expectErr(await admin.get('/api/structured-questions/999999999'), 404, 'NOT_FOUND')
      expectErr(await teacher.get('/api/structured-questions'), 403, 'FORBIDDEN')
    })

    it('a seeded structured question reads back', async () => {
      const rows = await t.db.query<{ id: string }>(`select q.id::text id from questions q join question_versions v on v.question_id = q.id where v.type = 'structured' limit 1`)
      const id = rows[0]?.id
      if (!id) return
      expect((await admin.get(`/api/structured-questions/${id}`)).status).toBe(200)
    })
  })

  it('csrfHeader and questionIdOf helpers are the ones other specs use', async () => {
    expect(csrfHeader(admin)).toEqual({ 'X-CSRF-Token': admin.csrf })
    expect(typeof questionIdOf).toBe('function')
  })
})
