import { QuestionDetailSchema, QuestionRowSchema, QuestionSummarySchema, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { countOf, refsOf, type Refs } from './http-helpers'

describe('admin list, summary and detail on the seeded bank (AC 7)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let total: number
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    total = await countOf(t.db, `select count(*) n from questions`)
  })
  afterAll(async () => {
    await t.close()
  })

  const list = async (query = '') => {
    const res = await admin.get(`/api/questions${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return listEnvelopeOf(QuestionRowSchema).parse(res.body)
  }

  it('returns the seeded rows newest first with the mock meta and the per-status counts', async () => {
    const out = await list()
    expect(out.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: total, totalPages: 1, from: 1, to: total })
    expect(out.data).toHaveLength(total)
    const ids = out.data.map((r) => BigInt(r.id))
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? 1 : -1)))
    const byStatus = await t.db.query<{ status: string; n: string }>(`select status, count(*) n from question_versions group by 1`)
    const expected = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]))
    expect(out.meta.counts).toMatchObject(expected)
    expect(out.meta.counts?.approved ?? 0).toBe(0)
  })

  it('paginates: pageSize 5, page 2 holds rows 6 to 10', async () => {
    const out = await list('?pageSize=5&page=2')
    expect(out.meta).toMatchObject({ page: 2, pageSize: 5, from: 6, to: 10, totalItems: total })
    expect(out.data).toHaveLength(5)
  })

  it('filters by status, subject, level, dskpFilter and search; unknown filter values match nothing', async () => {
    expect((await list('?status=review')).data).toHaveLength(1)
    expect((await list('?status=draft')).data.every((r) => r.status === 'draft')).toBe(true)
    const math = await list(`?subjectId=${refs.mathId}`)
    expect(math.data.length).toBeGreaterThan(0)
    expect(math.data.every((r) => r.subject?.id === refs.mathId)).toBe(true)
    const t5 = await list(`?educationLevelId=${refs.t5Id}`)
    expect(t5.data.every((r) => r.level?.id === refs.t5Id)).toBe(true)
    const untagged = await list('?dskpFilter=untagged')
    expect(untagged.data.length).toBeGreaterThan(0)
    expect(untagged.data.every((r) => !r.dskpTagged)).toBe(true)
    expect((await list('?search=Pasar')).data.length).toBeGreaterThan(0)
    expect((await list('?subjectId=abc')).data).toHaveLength(0)
    expect((await list('?subjectId=999999')).data).toHaveLength(0)
    expect((await list('?dskpFilter=zzz')).data).toHaveLength(0)
    expect((await list('?search=')).data).toHaveLength(total)
    expect((await list('?search=zzzxqv')).meta.totalItems).toBe(0)
  })

  it('is bounded: bad page, page size and long values are 422 with the field', async () => {
    expect(expectError(await admin.get('/api/questions?page=0'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
    expect(expectError(await admin.get('/api/questions?page=abc'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
    expect(expectError(await admin.get('/api/questions?page=999999999'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
    expect(expectError(await admin.get('/api/questions?pageSize=101'), 'VALIDATION_ERROR').fields?.pageSize).toBeDefined()
    expect(expectError(await admin.get(`/api/questions?search=${'a'.repeat(101)}`), 'VALIDATION_ERROR').fields?.search).toBeDefined()
    expect(expectError(await admin.get('/api/questions?page=1&page=2'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
  })

  it('summary: total and one tile per active subject, approved = published', async () => {
    const out = parseData(await admin.get('/api/questions/summary'), QuestionSummarySchema)
    expect(out.total).toBe(total)
    const published = await countOf(t.db, `select count(*) n from question_versions where status = 'published'`)
    expect(out.subjects.reduce((s, x) => s + x.approved, 0)).toBe(published)
    expect(out.subjects.reduce((s, x) => s + x.total, 0)).toBeLessThanOrEqual(total)
    const math = out.subjects.find((s) => s.id === refs.mathId)
    expect(math?.total).toBeGreaterThan(0)
  })

  it('detail of a seeded published question carries the DSKP chain and the creator', async () => {
    const [row] = await t.db.query<{ question_id: string }>(`select question_id::text from question_versions where number_label = 'SEED-MCQ-MATH-T4'`)
    const detail = parseData(await admin.get(`/api/questions/${row?.question_id}`), QuestionDetailSchema)
    expect(detail.status).toBe('published')
    expect(detail.dskp).not.toBeNull()
    expect(detail.createdBy.id).toBe(admin.userId)
    expect(detail.subject?.name).toBeTruthy()
  })

  it('detail of a grouped question returns the stimulus group once with its ordered members', async () => {
    const [row] = await t.db.query<{ question_id: string }>(`select question_id::text from question_versions where number_label = 'SEED-GRP-PASAR-2'`)
    const detail = parseData(await admin.get(`/api/questions/${row?.question_id}`), QuestionDetailSchema)
    expect(detail.stimulusGroup?.stimuli).toHaveLength(1)
    expect(detail.stimulusGroup?.questionIds).toHaveLength(3)
  })

  it('unknown and malformed ids are 404', async () => {
    expectError(await admin.get('/api/questions/999999999'), 'NOT_FOUND')
    expectError(await admin.get('/api/questions/not-an-id'), 'NOT_FOUND')
  })
})
