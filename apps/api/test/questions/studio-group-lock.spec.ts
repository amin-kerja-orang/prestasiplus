import { STIMULUS_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { StudioDskpSchema } from '@pp/contract'
import { tagOf, type Tag } from './fixtures'

/**
 * B2 review of T13 (probes re-run on T32's single lock path, REQ-C-003): `POST/PUT /api/questions` with `stimulusGroupId` obeys
 * the same rules as the group routes. A served question is never moved in or out (409 `memberServed` / `groupServed`); a draft
 * may join a group with served members but only at the end, and the served members keep their order; one group per question.
 */
describe('stimulusGroupId on the question write path', () => {
  let t: QuestionsTestApp
  let admin: Client
  let tag: Tag

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  const body = (n: number, over: Record<string, unknown> = {}) => ({
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: `Soalan percubaan nombor ${String(n)} tentang rajah itu?`,
    options: ['Satu', 'Dua', 'Tiga', 'Empat'],
    correctAnswer: 1,
    ...over,
  })
  const q = async (sql: string, p: unknown[] = []) => t.db.query<Record<string, string | number | null>>(sql, p)
  const groupOf = async (ref: string) => (await q('select group_id::text g from questions where id = $1', [await questionIdOf(t.db, ref)]))[0]?.g as string

  async function groupWith(a: string, b: string): Promise<string> {
    const s = await admin.post('/api/stimuli', { kind: 'passage', body: { ms: 'Petikan percubaan.' } })
    expect(s.status, JSON.stringify(s.body)).toBe(201)
    const g = await admin.post('/api/stimulus-groups', { stimulusIds: [s.body.data.id], questionIds: [a, b] })
    expect(g.status, JSON.stringify(g.body)).toBe(201)
    return g.body.data.id as string
  }
  const draft = async (n: number, over: Record<string, unknown> = {}): Promise<string> => {
    const r = await admin.post('/api/questions', body(n, over))
    expect(r.status, JSON.stringify(r.body)).toBe(201)
    return r.body.data.id as string
  }

  it('probe 1: a draft joins a group with a served member only at the end; the served member keeps its place (create and update)', async () => {
    const servedQ = await questionIdOf(t.db, 'SEED-GRP-PASAR-1')
    const served = await groupOf('SEED-GRP-PASAR-1')
    const before = (await q('select id::text id from questions where group_id = $1 order by group_position', [served])).map((r) => r.id)
    const pasar = await tagOf(t.db, 'SEED-GRP-PASAR-1') // a group takes members of one subject only (T32)
    const own = { subjectId: pasar.subjectId, educationLevelId: pasar.levelId, stimulusGroupId: served }
    const viaCreate = await admin.post('/api/questions', body(1, own))
    expect(viaCreate.status, JSON.stringify(viaCreate.body)).toBe(201)
    const d = await draft(2, { subjectId: pasar.subjectId, educationLevelId: pasar.levelId })
    expect((await admin.put(`/api/questions/${d}`, body(2, own))).status).toBe(200)
    const after = (await q('select id::text id from questions where group_id = $1 order by group_position', [served])).map((r) => r.id)
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after).toHaveLength(before.length + 2)
    expect(after[0]).toBeDefined()
    expect(before).toContain(servedQ)
  })

  it('probe 2: a served question is never regrouped, and a served member cannot be taken out through PUT', async () => {
    const free = await draft(3)
    const other = await draft(4)
    const g = await groupWith(free, other)
    const servedId = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    expectError(await admin.put(`/api/questions/${servedId}`, body(5, { stimulusGroupId: g })), 'CONFLICT', STIMULUS_MESSAGES.memberServed)
    expect((await q('select group_id from questions where id = $1', [servedId]))[0]?.group_id).toBeNull()
    const member = await questionIdOf(t.db, 'SEED-GRP-PASAR-1')
    const before = (await q('select group_id::text g, group_position p from questions where id = $1', [member]))[0]
    const own = (await admin.get(`/api/questions/${member}`)).body.data as Record<string, unknown>
    const same = { subjectId: own.subjectId, educationLevelId: own.educationLevelId, difficultyLevel: own.difficultyLevel, questionType: own.questionType, questionText: own.questionText, parts: own.parts, tag: own.tag }
    expectError(await admin.put(`/api/questions/${member}`, { ...same, stimulusGroupId: null }), 'CONFLICT', STIMULUS_MESSAGES.groupServed)
    expect((await q('select group_id::text g, group_position p from questions where id = $1', [member]))[0]).toEqual(before)
  })

  it('one group per question: a draft in a group cannot jump to another one, and re-sending its own group keeps its place', async () => {
    const [a, b, c, d] = [await draft(7), await draft(8), await draft(9), await draft(10)]
    const g1 = await groupWith(a, b)
    const g2 = await groupWith(c, d)
    const res = await admin.put(`/api/questions/${a}`, body(7, { stimulusGroupId: g2 }))
    expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ stimulusGroupId: STIMULUS_MESSAGES.memberTaken })
    expect((await q('select group_id::text g from questions where id = $1', [a]))[0]?.g).toBe(g1)
    // same group again: no move to the end
    expect((await admin.put(`/api/questions/${a}`, body(7, { stimulusGroupId: g1 }))).status).toBe(200)
    expect((await q('select group_position p from questions where id = $1', [a]))[0]?.p).toBe(1)
    // leaving is allowed for a draft, joining a free group too
    expect((await admin.put(`/api/questions/${a}`, body(7, { stimulusGroupId: null }))).status).toBe(200)
    expect((await admin.put(`/api/questions/${a}`, body(7, { stimulusGroupId: g2 }))).status).toBe(200)
    expect((await q('select group_position p from questions where id = $1', [a]))[0]?.p).toBe(3)
  })

  it('a draft joins a group with only drafts, and a new question can be created into it', async () => {
    const [a, b] = [await draft(11), await draft(12)]
    const g = await groupWith(a, b)
    const c = await draft(13, { stimulusGroupId: g })
    expect((await q('select group_position p from questions where id = $1', [c]))[0]?.p).toBe(3)
  })

  it('the DSKP picker lists units with their SP for a subject and level, admin only', async () => {
    const res = await admin.get(`/api/questions/studio/dskp?subjectId=${tag.subjectId}&educationLevelId=${tag.levelId}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const dskp = StudioDskpSchema.parse(res.body.data)
    expect(dskp.units.some((u) => u.id === tag.unitId && u.sps.some((s) => s.id === tag.spId))).toBe(true)
    expectError(await admin.get('/api/questions/studio/dskp?subjectId=x'), 'VALIDATION_ERROR')
    const guru = await loginAs(t, 'teacher')
    expectError(await guru.get(`/api/questions/studio/dskp?subjectId=${tag.subjectId}&educationLevelId=${tag.levelId}`), 'FORBIDDEN')
  })
})
