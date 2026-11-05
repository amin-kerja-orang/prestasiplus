import { QuestionBulkResultSchema, QuestionDetailSchema, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

describe('AC 5 (endpoint half): publishing needs subject, level, unit, SP and TP', () => {
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

  it('POST with status published and no tag is 422 naming the missing tag fields; nothing is stored', async () => {
    const before = await t.db.query(`select 1 from questions`)
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { status: 'approved' })), 'VALIDATION_ERROR')
    // The TP is the required difficulty level on the flat body, so it is never the missing piece here.
    expect(Object.keys(error.fields ?? {})).toEqual(expect.arrayContaining(['unitId', 'spIds']))
    expect(error.fields?.unitId).toBe('Sila pilih unit DSKP.')
    expect(await t.db.query(`select 1 from questions`)).toHaveLength(before.length)
  })

  it('a tag with only a unit still lacks the SP', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag: { unitId: tag.unitId, spIds: [], tp: null } })), 'VALIDATION_ERROR')
    expect(error.fields?.spIds).toBe('Sila pilih sekurang-kurangnya satu SP DSKP.')
    expect(error.fields?.unitId).toBeUndefined()
  })

  it('an unknown or foreign unit/SP is a 422 on the tag field, not a publish', async () => {
    const error = expectError(await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag: { unitId: '999999', spIds: ['999999'], tp: 3 } })), 'VALIDATION_ERROR')
    expect(error.fields?.['tag.unitId']).toBeDefined()
    expect(error.fields?.['tag.spIds']).toBeDefined()
  })

  it('POST with status published and a full tag is 201 and the question is live', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { data } = mutationEnvelopeOf(QuestionSchema).parse(res.body)
    expect(data.status).toBe('approved')
    const rows = await t.db.query<{ live_version_no: number | null }>(`select live_version_no from questions where id = $1`, [data.id])
    expect(rows[0]?.live_version_no).toBe(1)
  })

  it('a flat dskpSpId alone gives the SP, but the TP is the difficulty and the unit is its ancestor', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', dskpSpId: tag.spIds[0] }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('bulk Terbitkan: a review question without a tag stays in review; a tagged one is approved', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const plain = mutationEnvelopeOf(QuestionSchema).parse((await admin.post('/api/questions', mcqBody(refs, { status: 'review' }))).body).data
    const tagged = mutationEnvelopeOf(QuestionSchema).parse((await admin.post('/api/questions', mcqBody(refs, { status: 'review', tag }))).body).data
    const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [plain.id, tagged.id] })
    expect(mutationEnvelopeOf(QuestionBulkResultSchema).parse(res.body).data.affected).toBe(1)
    expect(parseData(await admin.get(`/api/questions/${plain.id}`), QuestionDetailSchema).status).toBe('review')
    expect(parseData(await admin.get(`/api/questions/${tagged.id}`), QuestionDetailSchema).status).toBe('approved')
  })

  it('editing a published question keeps the live version and shows the new draft version to the admin', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const q = mutationEnvelopeOf(QuestionSchema).parse((await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag }))).body).data
    const put = await admin.put(`/api/questions/${q.id}`, mcqBody(refs, { questionText: 'Soalan yang telah disunting selepas terbit.' }))
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(mutationEnvelopeOf(QuestionSchema).parse(put.body).data.status).toBe('draft')
    const rows = await t.db.query<{ live_version_no: number; latest_version_no: number }>(`select live_version_no, latest_version_no from questions where id = $1`, [q.id])
    expect(rows[0]).toEqual({ live_version_no: 1, latest_version_no: 2 })
  })
})
