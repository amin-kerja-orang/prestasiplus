/**
 * DM-68, API-BIJAK-04 (d): the part answer gains `choices`, `gaps`, `cells`, `topicId` and `revealed`. Additive: an open essay_choice answer that holds
 * its topic in `choice` is still read. `revealed` is the server's: a client can neither set it nor clear it.
 */
import { BijakAttemptPaperViewSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

const PART = 'sn2-sel-q2-b' // Sains K2, a short_text leaf in the PoC bank; here served as an essay_choice part
const OTHER = 'sn2-sel-q2-a'
const TOPICS = [
  { id: 'tajuk-1', label: 'Fungsi vakuol' },
  { id: 'tajuk-2', label: 'Fungsi kloroplas' },
]

class EssayChoiceSource extends FakeQuestionSource {
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const base = await super.loadQuestions(ids)
    const out = new Map(base)
    for (const [id, b] of base) {
      if (!b.question.parts?.some((p) => p.id === PART)) continue
      const parts = b.question.parts.map((p) => (p.id === PART ? { ...p, answer: { ...p.answer, kind: 'essay_choice' as const, topics: TOPICS } } : p))
      out.set(id, { ...b, question: { ...b.question, parts } })
    }
    return out
  }
}

let t: AttemptsTestApp
let me: Client

beforeAll(async () => {
  t = await bootAttemptsApp({}, { plugPorts: false })
  const ports = t.app.get(BijakAttemptPorts)
  ports.providePaperSource(new FakePaperSource())
  ports.provideQuestionSource(new EssayChoiceSource())
  ports.provideReward(new SpyReward())
  ports.provideAggregate(new SpyAggregate())
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

const save = (id: string, changes: object[]) => me.put(`/api/bijak/attempts/${id}/answers`, { changes })
const storedAnswer = async (id: string, part: string) =>
  (await t.db.query<{ answer: Record<string, unknown> }>(`select answer from attempt_answers where attempt_id = $1 and part_id = $2`, [id, part]))[0]?.answer
const view = async (id: string) => envelopeOf(BijakAttemptPaperViewSchema).parse((await me.get(`/api/bijak/attempts/${id}`)).body).data

describe('DM-68 answer keys', () => {
  it('stores and returns choices, gaps and cells under the same per-part rev', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    const answer = { choices: ['a', 'c'], gaps: { g1: 'mitokondria' }, cells: { 'r1-c2': '12' } }
    const res = await save(id, [change(OTHER, answer, 2)])
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await storedAnswer(id, OTHER)).toMatchObject(answer)
    expect((await view(id)).attempt.answers[OTHER]?.answer).toMatchObject(answer)
    // the existing rev rule also holds for the new keys
    expect((await save(id, [change(OTHER, { choices: ['b'] }, 2)])).status).toBe(200)
    expect(await storedAnswer(id, OTHER)).toMatchObject({ choices: ['a', 'c'] })
  })

  it('refuses oversized new keys with 422', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await save(id, [change(OTHER, { choices: Array.from({ length: 9 }, (_, i) => `o${i}`) })])).status).toBe(422)
    expect((await save(id, [change(OTHER, { gaps: { g1: 'x'.repeat(1001) } })])).status).toBe(422)
    expect((await save(id, [change(OTHER, { cells: Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`c${i}`, '1'])) })])).status).toBe(422)
    expect(await storedAnswer(id, OTHER)).toBeUndefined()
  })

  it('topicId of the part is accepted and copied to choice; an unknown topicId is 422', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await save(id, [change(PART, { topicId: 'tajuk-2', text: 'Kloroplas.' })])).status).toBe(200)
    expect(await storedAnswer(id, PART)).toMatchObject({ topicId: 'tajuk-2', choice: 'tajuk-2' })
    const bad = await save(id, [change(PART, { topicId: 'tajuk-99' }, 2)])
    expect(bad.status).toBe(422)
    expect((bad.body as { error: { fields: Record<string, string> } }).error.fields).toHaveProperty(`answers.${PART}.topicId`)
  })

  it('a topicId on a leaf without topicIds is dropped; a valid one on a leaf with topicIds is kept', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await save(id, [change(OTHER, { topicId: 'tajuk-1', text: 'a' })])).status).toBe(200)
    const dropped = await storedAnswer(id, OTHER)
    expect(dropped).toMatchObject({ text: 'a' })
    expect(dropped).not.toHaveProperty('topicId')
    expect(dropped).not.toHaveProperty('choice')
    expect((await save(id, [change(PART, { topicId: 'tajuk-1', text: 'b' })])).status).toBe(200)
    expect(await storedAnswer(id, PART)).toMatchObject({ topicId: 'tajuk-1', choice: 'tajuk-1' })
  })

  it('an open essay_choice answer that holds its topic in choice is still read and marked', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await save(id, [change(PART, { choice: 'tajuk-1', text: 'Vakuol menyimpan air.' })])).status).toBe(200)
    const stored = await storedAnswer(id, PART)
    expect(stored).toMatchObject({ choice: 'tajuk-1' })
    expect(stored).not.toHaveProperty('topicId')
    const done = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [] })
    expect(done.status, JSON.stringify(done.body)).toBe(200)
    const result = (await me.get(`/api/bijak/attempts/${id}/result`)).body as { data: { result: { questions: { parts: { partId: string; answer: { choice?: string }; status: string }[] }[] } } }
    const part = result.data.result.questions.flatMap((q) => q.parts).find((p) => p.partId === PART)
    expect(part?.answer.choice).toBe('tajuk-1')
    expect(part?.status).not.toBe('kosong')
  })

  it('a client cannot set revealed, and a later save does not clear it', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan', true)
    expect((await save(id, [change(OTHER, { text: 'a', revealed: true }, 1)])).status).toBe(200)
    expect(await storedAnswer(id, OTHER)).not.toHaveProperty('revealed')
    await t.db.query(`update attempt_answers set answer = answer || '{"revealed": true}'::jsonb where attempt_id = $1 and part_id = $2`, [id, OTHER])
    expect((await save(id, [change(OTHER, { text: 'b', revealed: false }, 2)])).status).toBe(200)
    expect(await storedAnswer(id, OTHER)).toMatchObject({ text: 'b', revealed: true })
    expect((await save(id, [change(OTHER, { text: 'c' }, 3)])).status).toBe(200)
    expect(await storedAnswer(id, OTHER)).toMatchObject({ text: 'c', revealed: true })
  })
})
