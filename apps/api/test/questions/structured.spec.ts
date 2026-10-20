import { QuestionStructuredDetailSchema, QuestionStructuredRowSchema, ListMetaSchema, QuestionStructuredStatsSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bootQuestionsApp, expectError, loginAs, parseData, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { refsOf, type Refs } from './http-helpers'

const ListSchema = z.object({ data: z.array(QuestionStructuredRowSchema), meta: ListMetaSchema.extend({ stats: QuestionStructuredStatsSchema }) })

describe('structured question reads (admin)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const list = async (query = '') => {
    const res = await admin.get(`/api/structured-questions${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return ListSchema.parse(res.body)
  }

  it('lists the 3 seeded structured questions, 25 per page, with stats over the whole store', async () => {
    const out = await list()
    expect(out.data).toHaveLength(3)
    expect(out.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: 3 })
    expect(out.meta.stats.total).toBe(3)
    expect(out.meta.stats.published).toBe(3)
    expect(out.meta.stats.bySubject.reduce((s, x) => s + x.count, 0)).toBe(3)
    expect(out.data.every((r) => r.totalMarks > 0 && r.subCount > 0)).toBe(true)
  })

  it('a subject filter narrows the rows but not the stats', async () => {
    const out = await list(`?subjectId=${refs.sciId}`)
    expect(out.data).toHaveLength(1)
    expect(out.data[0]?.subject?.id).toBe(refs.sciId)
    expect(out.meta.stats.total).toBe(3)
    expect((await list('?subjectId=999999')).data).toHaveLength(0)
    expect((await list('?educationLevelId=abc')).data).toHaveLength(0)
  })

  it('the detail flattens the part tree depth first, branches included, with parent links', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const detail = parseData(await admin.get(`/api/structured-questions/${id}`), QuestionStructuredDetailSchema)
    expect(detail.status).toBe('published')
    expect(detail.visibility).toBe('public')
    expect(detail.subQuestions.length).toBeGreaterThan(3)
    const ids = new Set(detail.subQuestions.map((s) => s.id))
    expect(ids.size).toBe(detail.subQuestions.length)
    expect(detail.subQuestions.every((s) => s.parentSubId === null || ids.has(s.parentSubId))).toBe(true)
    expect(detail.subQuestions.some((s) => s.parentSubId !== null)).toBe(true)
    expect(detail.subQuestions.map((s) => s.order)).toEqual(detail.subQuestions.map((_, i) => i + 1))
    expect(detail.subQuestions.reduce((s, x) => s + x.marks, 0)).toBe(detail.totalMarks)
    expect(detail.subQuestions.some((s) => s.answerType === 'numeric' && s.expectedNumeric !== null)).toBe(true)
  })

  it('an objective question id is 404 on the structured detail; unknown ids too', async () => {
    const mcq = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    expectError(await admin.get(`/api/structured-questions/${mcq}`), 'NOT_FOUND')
    expectError(await admin.get('/api/structured-questions/999999999'), 'NOT_FOUND')
    expectError(await admin.get('/api/structured-questions/xyz'), 'NOT_FOUND')
  })

  it('a bad page is 422', async () => {
    expect(expectError(await admin.get('/api/structured-questions?page=0'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
  })

  it('the envelope of the detail is { data }', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    envelopeOf(QuestionStructuredDetailSchema).parse((await admin.get(`/api/structured-questions/${id}`)).body)
  })
})
