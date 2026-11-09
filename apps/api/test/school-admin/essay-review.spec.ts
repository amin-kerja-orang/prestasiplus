import { EssayReviewConfirmResultSchema, EssayReviewListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  apiOf,
  bootSchoolAdminApp,
  expectError,
  login,
  SCHOOL_ADMIN,
  schoolIdOf,
  STUDENT,
  TEACHER,
  userIdOf,
  type Api,
  type SchoolAdminTestApp,
} from './helpers'

/** Tanda Karangan (V2 `/spm/tanda-karangan`): list of pending AI proposals, confirm with the final mark, school scoping, role refusal. */
describe('Tanda Karangan: list and confirm', () => {
  let t: SchoolAdminTestApp
  let schoolAdmin: Api
  let admin: Api
  let s1: string
  let s2: string
  let pupil1: string
  let pupil2: string

  const insert = async (schoolId: string, studentId: string, essay: string, max = 10, proposed: number | null = 7): Promise<string> =>
    (
      await t.db.query<{ id: string }>(
        `insert into essay_review_proposals (school_id, student_id, question_label, stem, scheme, essay_text, max_marks, proposed_marks, rationale, points)
         values ($1::bigint, $2::bigint, '3', 'Tulis sebuah karangan.', '["Isi pertama","Isi kedua"]'::jsonb, $3, $4, $5, 'Isi mencukupi.', '[{"id":1,"covered":true,"awarded":2}]'::jsonb)
         returning id::text`,
        [schoolId, studentId, essay, max, proposed],
      )
    )[0]?.id as string

  const state = async (id: string) =>
    (await t.db.query<{ status: string; final_marks: number | null; confirmed_by: string | null }>(`select status, final_marks, confirmed_by::text from essay_review_proposals where id = $1::bigint`, [id]))[0]

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    schoolAdmin = apiOf(await login(t, SCHOOL_ADMIN))
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    pupil1 = await userIdOf(t.db, STUDENT)
    const other = await t.db.query<{ id: string }>(
      `insert into users (name, email, is_active, school_id, created_at, updated_at) values ('Murid Sekolah Dua', 'murid-s2@ujian.test', true, $1::bigint, now(), now()) returning id::text`,
      [s2],
    )
    pupil2 = other[0]?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  it('an empty queue is an empty list with a zero count (no-store)', async () => {
    const res = await schoolAdmin.get('/admin-sekolah/tanda-karangan')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = EssayReviewListResponseSchema.parse(res.body)
    expect(body.data).toEqual([])
    expect(body.meta.totalItems).toBe(0)
  })

  it('a school admin lists only the own school; Admin Pusat lists every school', async () => {
    const mine = await insert(s1, pupil1, 'Karangan murid sekolah satu.')
    const foreign = await insert(s2, pupil2, 'Karangan murid sekolah dua.')

    const own = EssayReviewListResponseSchema.parse((await schoolAdmin.get('/admin-sekolah/tanda-karangan')).body)
    expect(own.data.map((r) => r.id)).toEqual([mine])
    expect(own.meta.totalItems).toBe(1)
    expect(own.data[0]).toMatchObject({ questionNo: '3', marks: 10, proposed: 7, essay: 'Karangan murid sekolah satu.', scheme: ['Isi pertama', 'Isi kedua'], rationale: 'Isi mencukupi.' })
    // A schoolId in the query cannot widen the school.
    const forged = EssayReviewListResponseSchema.parse((await schoolAdmin.get(`/admin-sekolah/tanda-karangan?schoolId=${s2}`)).body)
    expect(forged.data.map((r) => r.id)).toEqual([mine])

    const all = EssayReviewListResponseSchema.parse((await admin.get('/admin/spm/tanda-karangan')).body)
    expect(all.data.map((r) => r.id)).toEqual([foreign, mine])
    expect(all.meta.totalItems).toBe(2)
  })

  it('confirm records the final mark and who confirmed it; the row leaves the queue', async () => {
    const id = await insert(s1, pupil1, 'Karangan untuk disahkan.')
    const res = await schoolAdmin.post(`/admin-sekolah/tanda-karangan/${id}/sahkan`, { marks: 6 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = EssayReviewConfirmResultSchema.parse(res.body)
    expect(body).toMatchObject({ data: { id, finalMarks: 6 }, status: 'Markah karangan disahkan.' })
    expect(await state(id)).toMatchObject({ status: 'confirmed', final_marks: 6 })
    expect((await state(id))?.confirmed_by).toBe(await userIdOf(t.db, SCHOOL_ADMIN))
    const list = EssayReviewListResponseSchema.parse((await schoolAdmin.get('/admin-sekolah/tanda-karangan')).body)
    expect(list.data.map((r) => r.id)).not.toContain(id)
    // Audit has ids only, never the essay.
    const audit = await t.db.query<{ detail: unknown }>(`select detail from audit_events where action = 'essay_review.confirmed' and target_id = $1`, [id])
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit[0]?.detail)).not.toContain('Karangan untuk disahkan')
  })

  it('the mark is clamped to the part maximum; a bad mark is 422 and changes nothing', async () => {
    const id = await insert(s1, pupil1, 'Karangan had markah.', 10)
    const over = await schoolAdmin.post(`/admin-sekolah/tanda-karangan/${id}/sahkan`, { marks: 999 })
    expect(EssayReviewConfirmResultSchema.parse(over.body).data.finalMarks).toBe(10)

    const fresh = await insert(s1, pupil1, 'Karangan markah salah.')
    for (const bad of [{}, { marks: -1 }, { marks: 1.5 }, { marks: 'tujuh' }, { marks: 70000 }]) {
      const res = await schoolAdmin.post(`/admin-sekolah/tanda-karangan/${fresh}/sahkan`, bad)
      expectError(res, 'VALIDATION_ERROR')
    }
    expect((await state(fresh))?.status).toBe('pending')
  })

  it('a school admin cannot confirm another school (404, same as an unknown id) but Admin Pusat can', async () => {
    const foreign = await insert(s2, pupil2, 'Karangan sekolah lain.')
    expectError(await schoolAdmin.post(`/admin-sekolah/tanda-karangan/${foreign}/sahkan`, { marks: 5 }), 'NOT_FOUND')
    expectError(await schoolAdmin.post('/admin-sekolah/tanda-karangan/999999999/sahkan', { marks: 5 }), 'NOT_FOUND')
    expectError(await schoolAdmin.post('/admin-sekolah/tanda-karangan/abc/sahkan', { marks: 5 }), 'NOT_FOUND')
    expect((await state(foreign))?.status).toBe('pending')

    const res = await admin.post(`/admin/spm/tanda-karangan/${foreign}/sahkan`, { marks: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await state(foreign)).toMatchObject({ status: 'confirmed', final_marks: 5 })
  })

  it('other roles are refused (403), and no session is 401', async () => {
    const id = await insert(s1, pupil1, 'Karangan peranan.')
    for (const who of [STUDENT, TEACHER]) {
      const api = apiOf(await login(t, who))
      expectError(await api.get('/admin-sekolah/tanda-karangan'), 'FORBIDDEN')
      expectError(await api.get('/admin/spm/tanda-karangan'), 'FORBIDDEN')
      expectError(await api.post(`/admin-sekolah/tanda-karangan/${id}/sahkan`, { marks: 5 }), 'FORBIDDEN')
    }
    expect((await state(id))?.status).toBe('pending')
    expect((await t.http().get('/api/admin-sekolah/tanda-karangan')).status).toBe(401)
  })
})
