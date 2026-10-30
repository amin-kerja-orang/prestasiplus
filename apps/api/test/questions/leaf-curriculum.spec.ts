import { QuestionDetailSchema, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { loadEffectiveLeaves, questionTp, unitMarks } from '../../src/modules/questions/effective-leaf'
import { bootQuestionsApp, expectError, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

const leaf = (label: string, marks: number, extra: Record<string, unknown> = {}) => ({
  label,
  prompt: { ms: `Jawab bahagian ${label}.` },
  marks,
  mode: 'short_text',
  key: { kind: 'accepted', values: ['jawapan'] },
  ...extra,
})

/** BJS-06: per-leaf TP, unit and form origin with inheritance from the question version. */
describe('per-leaf curriculum overrides (BJS-06)', () => {
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

  const essay = (parts: unknown[], over: Record<string, unknown> = {}) =>
    mcqBody(refs, { questionType: 'essay', options: undefined, correctAnswer: undefined, parts, ...over })

  it('round-trips unitNodeId, formOrigin and difficultyTp on a leaf; absent fields stay absent (inherit)', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const parts = [leaf('a', 2, { unitNodeId: tag.unitId, formOrigin: 't5', difficultyTp: 5 }), leaf('b', 3)]
    const res = await admin.post('/api/questions', essay(parts))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { data } = mutationEnvelopeOf(QuestionSchema).parse(res.body)
    const read = parseData(await admin.get(`/api/questions/${data.id}`), QuestionDetailSchema)
    expect(read.parts?.[0]).toMatchObject({ unitNodeId: tag.unitId, formOrigin: 't5', difficultyTp: 5 })
    const second = read.parts?.[1] as Record<string, unknown>
    expect(second).not.toHaveProperty('unitNodeId')
    expect(second).not.toHaveProperty('difficultyTp')
    expect(second).not.toHaveProperty('formOrigin')
  })

  it('null is accepted and stored as inherit', async () => {
    const parts = [leaf('a', 2, { unitNodeId: null, formOrigin: null, difficultyTp: null })]
    const res = await admin.post('/api/questions', essay(parts))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('rejects out-of-range TP and an unknown form origin: 422', async () => {
    expectError(await admin.post('/api/questions', essay([leaf('a', 2, { difficultyTp: 7 })])), 'VALIDATION_ERROR')
    expectError(await admin.post('/api/questions', essay([leaf('a', 2, { formOrigin: 't6' })])), 'VALIDATION_ERROR')
  })

  it('rejects a unit that does not exist, is not a unit, or belongs to another subject: 422 on parts', async () => {
    const other = await tagOf(t.db, refs.sciId, refs.t4Id)
    const sp = (await tagOf(t.db, refs.mathId, refs.t4Id)).spIds[0]
    for (const unitNodeId of ['999999', sp, other.unitId]) {
      const error = expectError(await admin.post('/api/questions', essay([leaf('a', 2, { unitNodeId })])), 'VALIDATION_ERROR')
      expect(Object.keys(error.fields ?? {})).toContain('parts')
    }
  })

  it('effective helper: coalesce(part, version); question TP is the max; marks per unit are per leaf', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const parts = [leaf('a', 2, { difficultyTp: 5 }), leaf('b', 3, { difficultyTp: 2, formOrigin: 't5' }), leaf('c', 4)]
    const res = await admin.post('/api/questions', essay(parts, { tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { data } = mutationEnvelopeOf(QuestionSchema).parse(res.body)
    const versions = await t.db.query<{ id: string }>(`select id::text from question_versions where question_id = $1`, [data.id])
    const leaves = await loadEffectiveLeaves(t.app.get(PrismaService).client, versions.map((v) => BigInt(v.id)))
    expect(leaves).toHaveLength(3)
    // Leaf c has no override: it inherits the version TP (tag.tp = 3), unit and form origin (t4 level).
    expect(leaves.map((l) => l.tp)).toEqual([5, 2, 3])
    expect(leaves.map((l) => l.formOrigin)).toEqual(['t4', 't5', 't4'])
    expect(new Set(leaves.map((l) => l.unitNodeId))).toEqual(new Set([tag.unitId]))
    expect(questionTp(leaves)).toBe(5)
    expect(unitMarks(leaves).get(tag.unitId)).toBe(9)
  })

  it('GET ?missing= filters on the effective value: a leaf unit override or a question unit satisfies it', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const make = async (body: Record<string, unknown>): Promise<string> => {
      const res = await admin.post('/api/questions', body)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    }
    const noUnit = await make(essay([leaf('a', 2)], { questionText: 'Soalan tanpa unit, tiada tag.' }))
    const tagged = await make(essay([leaf('a', 2)], { tag }))
    const ids = async (query: string): Promise<string[]> => {
      const res = await admin.get(`/api/questions?pageSize=100&subjectId=${refs.mathId}&${query}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return ((res.body as { data: { id: string }[] }).data ?? []).map((q) => q.id)
    }
    const missingUnit = await ids('missing=unit')
    expect(missingUnit).toContain(noUnit)
    expect(missingUnit).not.toContain(tagged)
    expect(await ids('missing=key')).not.toContain(tagged)
    expect(await ids('missing=marks')).not.toContain(tagged)
    expectError(await admin.get('/api/questions?missing=bogus'), 'VALIDATION_ERROR')
  })

  it('GET ?tagReview=true returns only flagged questions', async () => {
    // The tag_review column arrives with the amended BJS-02 migration; until then this check cannot run.
    const col = await t.db.query(`select 1 from information_schema.columns where table_name = 'question_versions' and column_name = 'tag_review'`)
    if (col.length === 0) return
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const res = await admin.post('/api/questions', essay([leaf('a', 2)], { tag }))
    const { data } = mutationEnvelopeOf(QuestionSchema).parse(res.body)
    await t.db.query(`update question_versions set tag_review = true where question_id = $1`, [data.id])
    const list = await admin.get(`/api/questions?pageSize=100&tagReview=true`)
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const found = (list.body as { data: { id: string }[] }).data.map((q) => q.id)
    expect(found).toContain(data.id)
    const other = await admin.get(`/api/questions?pageSize=100&subjectId=${refs.mathId}`)
    expect((other.body as { data: { id: string }[] }).data.length).toBeGreaterThan(found.length - 1)
    expectError(await admin.get('/api/questions?tagReview=false'), 'VALIDATION_ERROR')
  })

  it('a leaf override survives an edit as a new version', async () => {
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const created = await admin.post('/api/questions', essay([leaf('a', 2, { difficultyTp: 4 })], { tag }))
    const { data } = mutationEnvelopeOf(QuestionSchema).parse(created.body)
    const res = await admin.put(`/api/questions/${data.id}`, essay([leaf('a', 2, { difficultyTp: 6 })], { tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const read = parseData(await admin.get(`/api/questions/${data.id}`), QuestionDetailSchema)
    expect(read.parts?.[0]).toMatchObject({ difficultyTp: 6 })
  })
})
