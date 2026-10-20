import {
  QUESTION_MESSAGES,
  QuestionBulkResultSchema,
  QuestionDeleteResultSchema,
  QuestionDetailSchema,
  QuestionSchema,
  mutationEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { countOf, mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

const leaf = (label: string, extra: Record<string, unknown> = {}) => ({
  label,
  prompt: { ms: `Jawab bahagian ${label}.` },
  marks: 2,
  mode: 'short_text',
  key: { kind: 'accepted', values: ['jawapan'] },
  ...extra,
})

describe('admin question CRUD (AC 1, AC 2)', () => {
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

  const created = async (over: Record<string, unknown> = {}) => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body)
  }

  it('creates a one-part MCQ: 201, draft, flash, and reads back with the key and the part tree', async () => {
    const { data, status } = await created()
    expect(status).toBe(QUESTION_MESSAGES.added)
    expect(data.status).toBe('draft')
    expect(data.questionType).toBe('mcq')
    expect(data.options).toEqual(['4', '5', '6', '7'])
    expect(data.correctAnswer).toBe(1)
    expect(data.parts).toHaveLength(1)
    const detail = parseData(await admin.get(`/api/questions/${data.id}`), QuestionDetailSchema)
    expect(detail.id).toBe(data.id)
    expect(detail.correctAnswer).toBe(1)
    expect(detail.subject?.id).toBe(refs.mathId)
    expect(detail.level?.id).toBe(refs.t4Id)
    expect(detail.createdBy.id).toBe(admin.userId)
    expect(detail.parts?.[0]).toMatchObject({ mode: 'mcq', key: { kind: 'option', correct: 'B' } })
  })

  it('round-trips a 3-level tree ((a)(i)(A)) with marks only on the leaves', async () => {
    const parts = [{ label: 'a', prompt: { ms: 'Bahagian (a).' }, children: [{ label: 'i', prompt: { ms: 'Bahagian (i).' }, children: [leaf('A'), leaf('B')] }] }]
    const res = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', questionText: 'Soalan berstruktur tiga peringkat.', options: undefined, correctAnswer: undefined, parts }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { data } = mutationEnvelopeOf(QuestionSchema).parse(res.body)
    const read = parseData(await admin.get(`/api/questions/${data.id}`), QuestionDetailSchema)
    expect(read.parts).toEqual(parts)
  })

  it('refuses marks on a branch part: 422 VALIDATION_ERROR naming the parts field', async () => {
    const parts = [{ label: 'a', prompt: { ms: 'Cawangan.' }, marks: 3, children: [leaf('i')] }]
    const res = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', options: undefined, correctAnswer: undefined, parts }))
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(Object.keys(error.fields ?? {}).some((k) => k.startsWith('parts'))).toBe(true)
  })

  it('refuses an invalid mode and key combination (mcq with a rubric key) with the offending field', async () => {
    const bad = {
      label: '1',
      prompt: { ms: 'Soalan.' },
      marks: 2,
      mode: 'mcq',
      options: [{ label: 'A', body: { ms: 'a' } }, { label: 'B', body: { ms: 'b' } }, { label: 'C', body: { ms: 'c' } }],
      key: { kind: 'rubric', marks: 2, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Baik', range: [1, 2] }] },
    }
    const res = await admin.post('/api/questions', mcqBody(refs, { questionType: 'essay', options: undefined, correctAnswer: undefined, parts: [bad] }))
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(Object.keys(error.fields ?? {}).some((k) => k.startsWith('parts'))).toBe(true)
  })

  it('reports every missing required field in one 422', async () => {
    const res = await admin.post('/api/questions', { questionType: 'mcq' })
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(Object.keys(error.fields ?? {})).toEqual(expect.arrayContaining(['subjectId', 'educationLevelId', 'difficultyLevel', 'questionText']))
  })

  it('422 when the body is not a JSON object', async () => {
    expectError(await admin.post('/api/questions', [1, 2]), 'VALIDATION_ERROR')
  })

  it('422 for an unknown subject id on create', async () => {
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { subjectId: '999999' })), 'VALIDATION_ERROR')
    expect(error.fields?.subjectId).toBe(QUESTION_MESSAGES.subject)
  })

  it('PUT updates the question: 200, flash, new text', async () => {
    const { data } = await created()
    const res = await admin.put(`/api/questions/${data.id}`, mcqBody(refs, { questionText: 'Teks soalan yang telah dikemaskini.', correctAnswer: 2 }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = mutationEnvelopeOf(QuestionSchema).parse(res.body)
    expect(out.status).toBe(QUESTION_MESSAGES.updated)
    expect(out.data.questionText).toBe('Teks soalan yang telah dikemaskini.')
    expect(out.data.correctAnswer).toBe(2)
  })

  it('PUT on an unknown id is 404 even with an invalid body; a bad body on a real id is 422', async () => {
    expectError(await admin.put('/api/questions/999999999', { nothing: true }), 'NOT_FOUND')
    const { data } = await created()
    const error = expectError(await admin.put(`/api/questions/${data.id}`, { questionText: 'pendek' }), 'VALIDATION_ERROR')
    expect(error.fields?.subjectId).toBeDefined()
  })

  it('DELETE answers 200 with { deleted: 1 } and the flash; the row is gone', async () => {
    const { data } = await created()
    const res = await admin.delete(`/api/questions/${data.id}`)
    expect(res.status).toBe(200)
    const out = mutationEnvelopeOf(QuestionDeleteResultSchema).parse(res.body)
    expect(out).toEqual({ data: { deleted: 1 }, status: QUESTION_MESSAGES.deleted })
    expectError(await admin.get(`/api/questions/${data.id}`), 'NOT_FOUND')
    expectError(await admin.delete(`/api/questions/${data.id}`), 'NOT_FOUND')
  })

  it('an id that is not a number is 404 on get, put and delete', async () => {
    expectError(await admin.get('/api/questions/abc'), 'NOT_FOUND')
    expectError(await admin.put('/api/questions/abc', mcqBody(refs)), 'NOT_FOUND')
    expectError(await admin.delete('/api/questions/abc'), 'NOT_FOUND')
  })

  it('writes an audit row with ids and counts only, never the question text', async () => {
    const { data } = await created({ questionText: 'Teks rahsia untuk ujian audit.' })
    const rows = await t.db.query<{ detail: unknown; action: string }>(`select action, detail from audit_events where target_type = 'question' and target_id = $1`, [data.id])
    expect(rows.map((r) => r.action)).toContain('question.created')
    expect(JSON.stringify(rows)).not.toContain('rahsia')
  })

  describe('bulk action', () => {
    it('moves drafts to review: affected counts, flash, unknown ids skipped, duplicates once', async () => {
      const a = (await created()).data
      const b = (await created()).data
      const res = await admin.post('/api/questions/bulk-action', { action: 'review', ids: [a.id, b.id, b.id, '999999999'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const out = mutationEnvelopeOf(QuestionBulkResultSchema).parse(res.body)
      expect(out.data.affected).toBe(2)
      expect(out.status).toBe(QUESTION_MESSAGES.bulkUpdated(2))
      expect(parseData(await admin.get(`/api/questions/${a.id}`), QuestionDetailSchema).status).toBe('review')
    })

    it('delete removes the rows', async () => {
      const a = (await created()).data
      const before = await countOf(t.db, `select count(*) n from questions`)
      const res = await admin.post('/api/questions/bulk-action', { action: 'delete', ids: [a.id] })
      expect(mutationEnvelopeOf(QuestionBulkResultSchema).parse(res.body).data.affected).toBe(1)
      expect(await countOf(t.db, `select count(*) n from questions`)).toBe(before - 1)
    })

    it('a refused transition leaves the row alone and is not counted', async () => {
      const a = (await created()).data
      const res = await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [a.id] })
      expect(mutationEnvelopeOf(QuestionBulkResultSchema).parse(res.body).data.affected).toBe(1)
      const again = await admin.post('/api/questions/bulk-action', { action: 'published', ids: [a.id] })
      expect(mutationEnvelopeOf(QuestionBulkResultSchema).parse(again.body).data.affected).toBe(0)
    })

    it('422 with the mock copy for a missing action, a bad action, no ids and bad ids', async () => {
      expect(expectError(await admin.post('/api/questions/bulk-action', { ids: ['1'] }), 'VALIDATION_ERROR').fields?.action).toBe(QUESTION_MESSAGES.bulkNoAction)
      expect(expectError(await admin.post('/api/questions/bulk-action', { action: 'zip', ids: ['1'] }), 'VALIDATION_ERROR').fields?.action).toBe(QUESTION_MESSAGES.bulkBadAction)
      expect(expectError(await admin.post('/api/questions/bulk-action', { action: 'review' }), 'VALIDATION_ERROR').fields?.ids).toBe(QUESTION_MESSAGES.bulkNoIds)
      expect(expectError(await admin.post('/api/questions/bulk-action', { action: 'review', ids: [] }), 'VALIDATION_ERROR').fields?.ids).toBe(QUESTION_MESSAGES.bulkNoIds)
      expect(expectError(await admin.post('/api/questions/bulk-action', { action: 'review', ids: [1] }), 'VALIDATION_ERROR').fields?.ids).toBe(QUESTION_MESSAGES.bulkBadIds)
    })

    it('422 when more than 200 ids are sent', async () => {
      const ids = Array.from({ length: 201 }, (_, i) => String(i + 1))
      expectError(await admin.post('/api/questions/bulk-action', { action: 'review', ids }), 'VALIDATION_ERROR')
    })
  })

  it('creates a tagged question straight as approved and reads the DSKP chain back', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const { data } = await created({ status: 'approved', tag })
    const detail = parseData(await admin.get(`/api/questions/${data.id}`), QuestionDetailSchema)
    expect(detail.dskp?.sp.id).toBe(tag.spIds[0])
    expect(detail.tag).toEqual(tag)
  })
})
