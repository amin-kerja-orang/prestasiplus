/**
 * FR-MUR-13-6, 46 section 3.5 (Mod Latihan "Semak"): auto-markable parts only; at most 3 answer-changing checks per question; a question with only
 * essay, working, drawing or table_fill parts has no "Semak"; DM-68 `revealed` is set by the check. An edited answer shows no verdict until its own check.
 */
import { BijakAttemptPaperViewSchema, BijakAttemptQuestionResultSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, correctChoice, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

const AUTO_PART = 'sn2-sel-q2-a'
const ESSAY_PART = 'sn2-sel-q2-b'
const ESSAY_ONLY = 'sn2-laju-v1'

/** `sn2-sel-q2` becomes short_text + essay; `sn2-laju-v1` becomes essay only. */
class MixedSource extends FakeQuestionSource {
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const out = new Map(await super.loadQuestions(ids))
    for (const [id, b] of out) {
      const parts = b.question.parts
      if (!parts) continue
      if (parts.some((p) => p.id === ESSAY_PART)) {
        out.set(id, { ...b, question: { ...b.question, parts: parts.map((p) => (p.id === ESSAY_PART ? { ...p, answer: { kind: 'essay' as const } } : p)) } })
      } else if (id === ESSAY_ONLY) {
        const essay = (p: (typeof parts)[number]): (typeof parts)[number] => (p.children ? { ...p, children: p.children.map(essay) } : { ...p, answer: { kind: 'essay' as const } })
        out.set(id, { ...b, question: { ...b.question, parts: parts.map(essay) } })
      }
    }
    return out
  }
}

let t: AttemptsTestApp
let me: Client
beforeAll(async () => {
  t = await bootAttemptsApp({ THROTTLE_BIJAK_CHECK_PER_MINUTE: '100000' }, { plugPorts: false })
  const ports = t.app.get(BijakAttemptPorts)
  ports.providePaperSource(new FakePaperSource())
  ports.provideQuestionSource(new MixedSource())
  ports.provideReward(new SpyReward())
  ports.provideAggregate(new SpyAggregate())
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

const view = async (id: string) => envelopeOf(BijakAttemptPaperViewSchema).parse((await me.get(`/api/bijak/attempts/${id}`)).body).data
const check = async (id: string, q: string, body: object = {}) => {
  const res = await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, body)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptQuestionResultSchema.parse(res.body.data)
}
const save = (id: string, changes: object[]) => me.put(`/api/bijak/attempts/${id}/answers`, { changes })
const stored = async (id: string, part: string) =>
  (await t.db.query<{ answer: Record<string, unknown>; rev: number }>(`select answer, rev from attempt_answers where attempt_id = $1 and part_id = $2`, [id, part]))[0]
const mixedQuestion = async (id: string) => (await view(id)).questions.find((q) => q.parts?.some((p) => p.id === AUTO_PART))!.id

describe('Semak (FR-MUR-13-6)', () => {
  it('a check that changes no answer uses no check; each changed answer does; the cap is 3', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan', true)
    const q = (await view(id)).questions[0]!.id
    const right = correctChoice(q)
    expect((await check(id, q, { changes: [change(q, { choice: `${q}-x` }, 1)] })).checksUsed).toBe(1)
    expect((await check(id, q)).checksUsed).toBe(1)
    expect((await save(id, [change(q, { choice: `${q}-y` }, 2)])).status).toBe(200)
    expect((await check(id, q)).checksUsed).toBe(2)
    expect((await check(id, q, { changes: [change(q, { choice: `${q}-z` }, 3)] })).checksUsed).toBe(3)
    const atCap = await check(id, q, { changes: [change(q, { choice: right }, 4)] })
    expect(atCap.checksUsed).toBe(3)
    expect(atCap.awarded).toBe(0)
    expect((await view(id)).attempt.answers[q]!.answer.choice).toBe(`${q}-z`)
  })

  it('returns only the auto-markable parts, with totals for those parts; no essay scheme reaches the pupil', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const q = await mixedQuestion(id)
    const r = await check(id, q, { changes: [change(AUTO_PART, { text: 'vakuol' }, 1), change(ESSAY_PART, { text: 'esei' }, 1)] })
    expect(r.parts.map((p) => p.partId)).toEqual([AUTO_PART])
    expect(r.marks).toBe(r.parts[0]!.marks)
    const inView = (await view(id)).checks.find((c) => c.questionId === q)
    expect(inView?.parts.map((p) => p.partId)).toEqual([AUTO_PART])
  })

  it('a question with no auto-markable part has no Semak: 403 and nothing stored', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const res = await me.post(`/api/bijak/attempts/${id}/questions/${ESSAY_ONLY}/check`, {})
    expect(res.status).toBe(403)
    expect(res.body.error.message).toBe('Skema hanya didedahkan selepas Hantar')
    expect((await view(id)).attempt.checkCounts).toBeUndefined()
  })

  it('at the cap the checked parts lock; an essay in the same question stays open', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const q = await mixedQuestion(id)
    for (let i = 1; i <= 3; i++) await check(id, q, { changes: [change(AUTO_PART, { text: `jawapan ${i}` }, i)] })
    expect((await save(id, [change(AUTO_PART, { text: 'selepas had' }, 9), change(ESSAY_PART, { text: 'esei baharu' }, 9)])).status).toBe(200)
    const a = (await view(id)).attempt.answers
    expect(a[AUTO_PART]?.answer.text).toBe('jawapan 3')
    expect(a[ESSAY_PART]?.answer.text).toBe('esei baharu')
  })

  it('DM-68: the check sets revealed on the checked parts only, and keeps the rev', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const q = await mixedQuestion(id)
    await check(id, q, { changes: [change(AUTO_PART, { text: 'jawapan' }, 0)] })
    expect(await stored(id, AUTO_PART)).toMatchObject({ answer: { text: 'jawapan', revealed: true }, rev: 0 })
    expect(await stored(id, ESSAY_PART)).toBeUndefined()
    // a later save wins over rev 0 and keeps the marker
    expect((await save(id, [change(AUTO_PART, { text: 'jawapan baharu' }, 1)])).status).toBe(200)
    expect(await stored(id, AUTO_PART)).toMatchObject({ answer: { text: 'jawapan baharu', revealed: true }, rev: 1 })
    // a repeat check keeps both
    await check(id, q)
    expect(await stored(id, AUTO_PART)).toMatchObject({ answer: { text: 'jawapan baharu', revealed: true }, rev: 1 })
  })

  it('lead ruling Q3: a blank part is refused 422 fields.questionId, uses no check and reveals nothing', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const q = await mixedQuestion(id)
    // an essay answer alone does not make the auto-markable part answered
    for (const body of [{}, { changes: [change(ESSAY_PART, { text: 'esei' }, 1)] }]) {
      const res = await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, body)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.fields.questionId).toBeTruthy()
    }
    expect(await stored(id, AUTO_PART)).toBeUndefined()
    const v = await view(id)
    expect(v.checks).toEqual([])
    expect(v.attempt.checkCounts ?? {}).toEqual({})
  })

  it('an edited answer shows no verdict in the view until its own Semak, so a reload never marks it for free', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan', true)
    const q = (await view(id)).questions[0]!.id
    await check(id, q, { changes: [change(q, { choice: `${q}-x` }, 1)] })
    expect((await view(id)).checks.map((c) => c.questionId)).toEqual([q])
    expect((await save(id, [change(q, { choice: correctChoice(q) }, 2)])).status).toBe(200)
    const v = await view(id)
    expect(v.checks).toEqual([])
    expect(v.attempt.checkCounts).toEqual({ [q]: 1 })
    expect((await check(id, q)).awarded).toBeGreaterThan(0)
    expect((await view(id)).attempt.checkCounts).toEqual({ [q]: 2 })
  })

  it('text the grader defuses is the same answer: a repeat check uses no check, and the verdict survives a reload', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const q = await mixedQuestion(id)
    const first = await check(id, q, { changes: [change(AUTO_PART, { text: '[Ca] ion' }, 1)] })
    expect(first.checksUsed).toBe(1)
    expect((await check(id, q)).checksUsed).toBe(1)
    expect((await check(id, q)).checksUsed).toBe(1)
    const v = await view(id)
    expect(v.checks.map((c) => c.questionId)).toEqual([q])
    expect(v.attempt.checkCounts).toEqual({ [q]: 1 })
    // not locked: the part still takes an edit
    expect((await save(id, [change(AUTO_PART, { text: 'kalsium' }, 2)])).status).toBe(200)
    expect((await view(id)).attempt.answers[AUTO_PART]?.answer.text).toBe('kalsium')
  })

  it('a stored check row made before this rule is still narrowed in the view', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    const q = await mixedQuestion(id)
    await check(id, q, { changes: [change(AUTO_PART, { text: 'vakuol' }, 1)] })
    await t.db.query(
      `update attempt_checks set result = jsonb_set(result, '{parts}', (result->'parts') || jsonb_build_array(jsonb_build_object('partId', $2::text, 'marks', 2, 'awarded', 0, 'answer', '{}'::jsonb))) where attempt_id = $1`,
      [id, ESSAY_PART],
    )
    const inView = (await view(id)).checks.find((c) => c.questionId === q)
    expect(inView?.parts.map((p) => p.partId)).toEqual([AUTO_PART])
  })
})
