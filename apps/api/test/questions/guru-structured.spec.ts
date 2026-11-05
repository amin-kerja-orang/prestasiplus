import { GuruStructuredDetailSchema, GuruStructuredRowSchema, ListMetaSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bootQuestionsApp, expectError, loginAs, parseData, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { refsOf, type Refs } from './http-helpers'

const ListSchema = z.object({ data: z.array(GuruStructuredRowSchema), meta: ListMetaSchema })

/** What a pupil is served (isStructuredVisible), counted straight from the tables: the oracle of the list total. */
const SERVED_COUNT = `
  select count(*)::int as n
    from questions q
    join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
    join education_levels el on el.id = v.education_level_id
   where q.is_active and v.status = 'approved' and v.type = 'structured' and el.code in ('T4', 'T5')
     and not (coalesce(v.import_issues, '[]'::jsonb) @> '[{"code": "legacy_image_unresolved"}]'::jsonb)`

describe('structured question reads (teacher mount, API-GUR-26)', () => {
  let t: QuestionsTestApp
  let teacher: Client
  let admin: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    teacher = await loginAs(t, 'teacher')
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const list = async (query = '') => {
    const res = await teacher.get(`/api/guru/structured-questions${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return ListSchema.parse(res.body)
  }
  const served = async (): Promise<number> => Number((await t.db.query<{ n: number }>(SERVED_COUNT))[0]?.n)

  it('the list total equals the dataset, 20 per page, rows numbered from 1', async () => {
    const out = await list()
    const n = await served()
    expect(n).toBeGreaterThan(0)
    expect(out.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: n })
    expect(out.data).toHaveLength(Math.min(n, 20))
    expect(out.data.map((r) => r.number)).toEqual(out.data.map((_, i) => i + 1))
    expect(out.data.every((r) => r.status === 'approved' && r.marks > 0 && r.subCount > 0)).toBe(true)
    expect((await list('?page=2')).data).toHaveLength(Math.max(0, n - 20))
  })

  it('the rows are newest first', async () => {
    const ids = (await list()).data.map((r) => r.id)
    expect(ids.length).toBeGreaterThan(1)
    // Make the order observable: the first listed becomes the oldest.
    const last = ids[ids.length - 1]!
    await t.db.query(`update questions set created_at = now() + interval '1 day' where id = $1`, [last])
    const after = (await list()).data.map((r) => r.id)
    expect(after[0]).toBe(last)
    const stamps = await t.db.query<{ at: string }>(`select created_at::text as at from questions where id = any($1::bigint[]) order by array_position($1::bigint[], id)`, [after])
    const times = stamps.map((s) => new Date(s.at).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('only approved, live and active questions are listed', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    const before = await list()
    expect(before.data.some((r) => r.id === id)).toBe(true)
    await t.db.query(`update question_versions set status = 'draft' where question_id = $1`, [id])
    const after = await list()
    expect(after.meta.totalItems).toBe(before.meta.totalItems - 1)
    expect(after.data.some((r) => r.id === id)).toBe(false)
    expect((await teacher.get(`/api/guru/structured-questions/${id}`)).status).toBe(404)
    await t.db.query(`update question_versions set status = 'approved' where question_id = $1`, [id])
    await t.db.query(`update questions set is_active = false where id = $1`, [id])
    expect((await list()).data.some((r) => r.id === id)).toBe(false)
    await t.db.query(`update questions set is_active = true where id = $1`, [id])
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
  })

  it('FR-X1-4f: a question that needs a figure it lacks is not served (list and detail)', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
    const issue = JSON.stringify([{ code: 'legacy_image_unresolved', target: 'question', path: 'soalan/rajah.png' }])
    await t.db.query(`update question_versions set import_issues = $2::jsonb where question_id = $1`, [id, issue])
    const out = await list()
    expect(out.data.some((r) => r.id === id)).toBe(false)
    expect(out.meta.totalItems).toBe(await served())
    expectError(await teacher.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
    await t.db.query(`update question_versions set import_issues = '[]'::jsonb where question_id = $1`, [id])
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
  })

  it('the subject filter narrows the rows and the total; unknown values match nothing', async () => {
    const out = await list(`?subjectId=${refs.sciId}`)
    expect(out.data.every((r) => r.subject?.id === refs.sciId)).toBe(true)
    expect(out.meta.totalItems).toBe(out.data.length)
    expect((await list('?subjectId=999999')).data).toHaveLength(0)
  })

  it('status=review is an empty page; status=approved is the default list; another value is 422', async () => {
    const review = await list('?status=review')
    expect(review.data).toHaveLength(0)
    expect(review.meta.totalItems).toBe(0)
    expect((await list('?status=approved')).meta.totalItems).toBe(await served())
    expect(expectError(await teacher.get('/api/guru/structured-questions?status=draft'), 'VALIDATION_ERROR').fields?.status).toBeDefined()
    expect(expectError(await teacher.get('/api/guru/structured-questions?page=0'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
  })

  it('the detail shows the stimulus once above the parts, with the scheme, and the marks agree with the row', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const res = await teacher.get(`/api/guru/structured-questions/${id}`)
    const detail = parseData(res, GuruStructuredDetailSchema)
    const row = (await list()).data.find((r) => r.id === id)!
    expect(detail.status).toBe('approved')
    expect(detail.totalMarks).toBe(row.marks)
    expect(detail.subCount).toBe(row.subCount)
    expect(detail.subQuestions.reduce((s, x) => s + x.marks, 0)).toBe(detail.totalMarks)
    expect(detail.subQuestions.some((s) => s.modelAnswer !== '')).toBe(true)
    expect(detail.stimulus).not.toBe('')
    expect(JSON.stringify(res.body).split(JSON.stringify(detail.stimulus).slice(1, -1)).length - 1).toBe(1)
  })

  it('no admin-only field is on the row or the detail', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const row = (await list()).data[0] as Record<string, unknown>
    const detail = (await teacher.get(`/api/guru/structured-questions/${id}`)).body.data as Record<string, unknown>
    const forbidden = ['sourceFile', 'sourcePage', 'sourceSet', 'complianceStatus', 'visibility', 'createdBy', 'isActive', 'needsDiagram', 'subjectId', 'educationLevelId', 'dskpSpId', 'curriculumChapterId', 'stats']
    for (const key of forbidden) {
      expect(row, key).not.toHaveProperty(key)
      expect(detail, key).not.toHaveProperty(key)
    }
  })

  it('an objective question id and an unknown id are 404', async () => {
    const mcq = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    expectError(await teacher.get(`/api/guru/structured-questions/${mcq}`), 'NOT_FOUND')
    expectError(await teacher.get('/api/guru/structured-questions/999999999'), 'NOT_FOUND')
    expectError(await teacher.get('/api/guru/structured-questions/xyz'), 'NOT_FOUND')
  })

  it('Admin Pusat may read it too; the admin route is unchanged (25 per page)', async () => {
    expect((await admin.get('/api/guru/structured-questions')).status).toBe(200)
    const res = await admin.get('/api/structured-questions')
    expect(res.status).toBe(200)
    expect(res.body.meta.pageSize).toBe(25)
  })

  it('student and school_admin get 403 on the list and the detail; a teacher gets 403 on the admin route', async () => {
    for (const role of ['student', 'schoolAdmin'] as const) {
      const c = await loginAs(t, role)
      expectError(await c.get('/api/guru/structured-questions'), 'FORBIDDEN')
      expectError(await c.get('/api/guru/structured-questions/1'), 'FORBIDDEN')
    }
    expectError(await teacher.get('/api/structured-questions'), 'FORBIDDEN')
  })
})
