/**
 * Secondary-only (D72, R1-B21): a question cannot be created or edited with a Darjah (primary-stage) level. The refusal is a 422
 * VALIDATION_ERROR on `educationLevelId` with the BM message "Sila pilih tahap pendidikan.", and nothing is written.
 */
import { QUESTION_MESSAGES, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { countOf, mcqBody, refsOf, type Refs } from './http-helpers'

describe('a Darjah level is refused when a question is written (D72)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let primaryId: string

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    primaryId = (await t.db.query<{ id: string }>(`select id::text from education_levels where stage = 'primary' order by id limit 1`))[0]?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  it('there is a primary-stage level in the seed to try', () => {
    expect(primaryId).toBeTruthy()
  })

  it('create with a Darjah level: 422 on educationLevelId, no question row', async () => {
    const before = await countOf(t.db, 'select count(*) n from questions')
    const res = await admin.post('/api/questions', mcqBody(refs, { educationLevelId: primaryId }))
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(error.fields).toMatchObject({ educationLevelId: QUESTION_MESSAGES.level })
    expect(await countOf(t.db, 'select count(*) n from questions')).toBe(before)
  })

  it('edit a question to a Darjah level: 422, the level is kept', async () => {
    const made = await admin.post('/api/questions', mcqBody(refs))
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(made.body).data.id
    const res = await admin.put(`/api/questions/${id}`, mcqBody(refs, { educationLevelId: primaryId }))
    const error = expectError(res, 'VALIDATION_ERROR')
    expect(error.fields).toMatchObject({ educationLevelId: QUESTION_MESSAGES.level })
    const kept = await t.db.query<{ education_level_id: string }>(
      `select v.education_level_id::text from question_versions v where v.question_id = $1 order by v.version_no desc limit 1`,
      [id],
    )
    expect(kept[0]?.education_level_id).toBe(refs.t4Id)
  })
})
