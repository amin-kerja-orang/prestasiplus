import { BijakBuilderEditorSchema, BijakBuilderPaperCreateResultSchema, envelopeOf, mutationEnvelopeOf, QuestionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Question = mutationEnvelopeOf(QuestionSchema)

/**
 * Regression for the kertas gap: a question made through the admin API with `kertas` (no SQL) is a paper-builder
 * candidate once published, one made without it is not, and changing or clearing the kertas moves it in and out.
 */
describe('paper builder candidates of API-created questions carry the kertas', () => {
  let t: BuilderTestApp
  let admin: Client
  let body: Record<string, unknown>

  beforeAll(async () => {
    t = await bootBuilderApp({ realBank: true })
    admin = await loginAs(t, ACCOUNTS.admin)
    const one = async (sql: string) => String((await t.db.query<Record<string, unknown>>(sql))[0]!.id)
    const mat = await one(`select id::text id from subjects where code = 'MATH'`)
    const level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${mat} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${mat} and education_level_id = ${level} order by sort_order, id limit 1`)
    body = {
      subjectId: mat,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      tag: { unitId: unit, spIds: [sp], tp: 3 },
    }
  })
  afterAll(async () => {
    await t.close()
  })

  const make = async (over: Record<string, unknown>): Promise<string> => {
    const res = await admin.post('/api/questions', { ...body, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return Question.parse(res.body).data.id
  }
  const candidates = async (): Promise<string[]> => {
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = Created.parse(created.body).data.id
    return Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data.questions.map((q) => q.id)
  }

  it('a published question created with kertas 2 is a kertas 2 candidate, without SQL', async () => {
    const withKertas = await make({ status: 'approved', kertas: '2' })
    const without = await make({ status: 'approved' })
    const other = await make({ status: 'approved', kertas: '1' })
    const list = await candidates()
    expect(list).toContain(withKertas)
    expect(list).not.toContain(without)
    expect(list).not.toContain(other)
  })

  it('a draft with kertas is not a candidate; clearing the kertas of a new version removes it once that version is live', async () => {
    const draft = await make({ status: 'draft', kertas: '2' })
    const id = await make({ status: 'approved', kertas: '2' })
    const list = await candidates()
    expect(list).toContain(id)
    expect(list).not.toContain(draft)
    // Editing a published question writes a draft n+1; the live version keeps serving and keeps its kertas.
    const put = await admin.put(`/api/questions/${id}`, { ...body, kertas: null })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await candidates()).toContain(id)
    const svc = t.app.get(QuestionsService)
    for (const status of ['review', 'approved'] as const) await svc.setStatus(id, status, '1')
    expect(await candidates()).not.toContain(id)
  })
})
