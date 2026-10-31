/**
 * REQ-B-014 (a): the topic picked for an `essay_choice` part must be one of that part's topics. Any other id is a 422
 * VALIDATION_ERROR with a BM message, on autosave, check and submit alike; nothing is stored on a refusal.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { BIJAK_ATTEMPTS_MESSAGES, ErrorBodySchema } from '@pp/contract'
import {
  type AttemptsTestApp,
  bootAttemptsApp,
  change,
  type Client,
  FakePaperSource,
  FakeQuestionSource,
  loginAs,
  PAPER,
  SpyAggregate,
  SpyReward,
  startAttempt,
  STUDENT,
} from './helpers'

const PART = 'sn2-sel-q2-b' // Sains K2, a short_text leaf in the PoC bank; here served as an essay_choice part
const TOPICS = [
  { id: 'tajuk-1', label: 'Fungsi vakuol' },
  { id: 'tajuk-2', label: 'Fungsi kloroplas' },
]

/** The PoC bank with one leaf turned into an essay_choice part. */
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
const stored = async (id: string) =>
  (await t.db.query<{ n: string }>(`select count(*) n from attempt_answers where attempt_id = $1 and part_id = $2`, [id, PART]))[0]?.n

describe('essay_choice topic ids', () => {
  it('a topic of the part is accepted and stored', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    const res = await save(id, [change(PART, { choice: 'tajuk-2', text: 'Kloroplas menjalankan fotosintesis.' })])
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await stored(id)).toBe('1')
  })

  it('an unknown topic id is a 422 with the BM message on the answer, and nothing is stored', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    const res = await save(id, [change(PART, { choice: 'tajuk-99', text: 'x' })])
    const body = ErrorBodySchema.parse(res.body)
    expect(res.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.fields).toEqual({ [`answers.${PART}.choice`]: 'Tajuk yang dipilih tiada pada bahagian ini.' })
    expect(BIJAK_ATTEMPTS_MESSAGES.essayTopicUnknown).toBe('Tajuk yang dipilih tiada pada bahagian ini.')
    expect(await stored(id)).toBe('0')
  })

  it('a topic id of another part (an id that only looks valid) is refused too, also in the revision-ignored case', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await save(id, [change(PART, { choice: 'tajuk-1' }, 5)])).status).toBe(200)
    const stale = await save(id, [change(PART, { choice: PART }, 1)]) // an old revision must not hide a bad id
    expect(stale.status).toBe(422)
    expect(await stored(id)).toBe('1')
  })

  it('submit refuses an unknown topic, in changes and in the carried answers, and the attempt stays open', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    const inChanges = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k1-${id}`, changes: [change(PART, { choice: 'tajuk-99', text: 'x' })] })
    expect(inChanges.status).toBe(422)
    const carried = await me.post(`/api/bijak/attempts/${id}/submit`, {
      idempotencyKey: `k2-${id}`,
      changes: [],
      answers: { [PART]: { answer: { choice: 'tajuk-99', text: 'x' }, rev: 1, savedAt: '2026-10-20T09:00:00+08:00' } },
    })
    expect(carried.status).toBe(422)
    const status = (await t.db.query<{ status: string }>(`select status from exam_attempts where id = $1`, [id]))[0]?.status
    expect(status).toBe('in_progress')
    const ok = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k3-${id}`, changes: [change(PART, { choice: 'tajuk-1', text: 'Vakuol menyimpan air.' })] })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
  })

  it('a choice on a part that is not essay_choice (an MCQ option, a letter) is not checked here', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'exam', true)
    const res = await save(id, [change('101', { choice: 'whatever' })])
    expect(res.status).toBe(200)
  })
})
