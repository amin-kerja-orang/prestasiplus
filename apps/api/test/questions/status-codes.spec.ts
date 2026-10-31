import { QUESTION_STATUSES, QuestionRowSchema, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MOCK_STATUS_TO_V2, mockStatusToV2 } from '../../src/modules/questions'
import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

describe('AC 11: wire statuses are the v2 codes only', () => {
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

  it('maps the mock values to the v2 codes (rejected has none)', () => {
    expect(MOCK_STATUS_TO_V2).toEqual({ draft: 'draft', pending_review: 'review', approved: 'approved', archived: 'archived', rejected: undefined })
    expect(mockStatusToV2('pending_review')).toBe('review')
    expect(mockStatusToV2('approved')).toBe('approved')
    expect(mockStatusToV2('rejected')).toBeUndefined()
    expect(mockStatusToV2('constructor')).toBeUndefined()
    expect(QUESTION_STATUSES).toEqual(['draft', 'review', 'approved', 'archived'])
  })

  it.each(['pending_review', 'rejected', 'live', ''])('create with status %j is 422 on fields.status', async (status) => {
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { status })), 'VALIDATION_ERROR')
    expect(error.fields?.status).toBe('Status tidak sah.')
  })

  it.each(['pending_review', 'rejected', 'Published'])('list filtered by status %j is 422 on fields.status', async (status) => {
    const error = expectError(await admin.get(`/api/questions?status=${status}`), 'VALIDATION_ERROR')
    expect(error.fields?.status).toBe('Status tidak sah.')
  })

  it('an empty status filter means no filter', async () => {
    expect((await admin.get('/api/questions?status=')).status).toBe(200)
  })

  it.each(['approve', 'reject', 'pending_review', 'archive'])('bulk action with the mock verb %s is 422 on fields.action', async (action) => {
    const error = expectError(await admin.post('/api/questions/bulk-action', { action, ids: ['1'] }), 'VALIDATION_ERROR')
    expect(error.fields?.action).toBe('Tindakan tidak sah.')
  })

  it('every status on the wire is one of the five codes and no mock value appears in any response', async () => {
    await admin.post('/api/questions', mcqBody(refs, { status: 'review' }))
    const res = await admin.get('/api/questions?pageSize=100')
    const rows = listEnvelopeOf(QuestionRowSchema).parse(res.body)
    for (const row of rows.data) expect(QUESTION_STATUSES).toContain(row.status)
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('pending_review')
    expect(text).not.toContain('rejected')
    expect(Object.keys(rows.meta.counts ?? {}).every((k) => (QUESTION_STATUSES as readonly string[]).includes(k))).toBe(true)
  })

  it('HTTP codes: 201 create, 200 update, delete and bulk, 404 unknown, 422 invalid', async () => {
    const created = await admin.post('/api/questions', mcqBody(refs))
    expect(created.status).toBe(201)
    const id = (created.body as { data: { id: string } }).data.id
    expect((await admin.put(`/api/questions/${id}`, mcqBody(refs))).status).toBe(200)
    expect((await admin.post('/api/questions/bulk-action', { action: 'review', ids: [id] })).status).toBe(200)
    expect((await admin.delete(`/api/questions/${id}`)).status).toBe(200)
    expect((await admin.get(`/api/questions/${id}`)).status).toBe(404)
    expect((await admin.post('/api/questions', {})).status).toBe(422)
  })
})
