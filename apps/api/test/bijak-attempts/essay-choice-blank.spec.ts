/**
 * REQ-B-025 (c): an `essay_choice` answer with a topic but no essay text is blank (REQ-B-021b, `isBlank(answer, kind)`).
 * The attempts adapter must pass the leaf kind, so (i) such a question is not "attempted" for best-N and (ii) a self-mark of
 * 0 on it gives `kosong`, not `salah`. A real essay text keeps both as before.
 */
import { BijakAttemptResultViewSchema, BijakAttemptSelfMarkResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

// The PoC bank has no essay_choice leaf, so the fixture below re-types ONE points-scheme short_text leaf (Sains K2 sn2-sel-q2-b) as an essay_choice
// part with two topics. Its points scheme stays, which is what makes it self-markable; nothing else about the paper changes.
const ESSAY_CHOICE_PART = 'sn2-sel-q2-b'
const TOPICS = [
  { id: 'tajuk-1', label: 'Fungsi vakuol' },
  { id: 'tajuk-2', label: 'Fungsi kloroplas' },
]

class PointsLeafAsEssayChoiceSource extends FakeQuestionSource {
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const base = await super.loadQuestions(ids)
    const out = new Map(base)
    for (const [id, b] of base) {
      if (!b.question.parts?.some((p) => p.id === ESSAY_CHOICE_PART)) continue
      const parts = b.question.parts.map((p) => (p.id === ESSAY_CHOICE_PART ? { ...p, answer: { ...p.answer, kind: 'essay_choice' as const, topics: TOPICS } } : p))
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
  ports.provideQuestionSource(new PointsLeafAsEssayChoiceSource())
  ports.provideReward(new SpyReward())
  ports.provideAggregate(new SpyAggregate())
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

async function sit(answer: { choice: string; text?: string }): Promise<string> {
  const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
  const res = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [change(ESSAY_CHOICE_PART, answer)] })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return id
}
const resultOf = async (id: string) => {
  const res = await me.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data).result
}
const questionOf = (r: Awaited<ReturnType<typeof resultOf>>) => r.questions.find((q) => q.parts.some((p) => p.partId === ESSAY_CHOICE_PART))!

describe('REQ-B-025(c): a topic without essay text is blank', () => {
  it('(i) the question is not attempted for best-N and the part is kosong', async () => {
    const q = questionOf(await resultOf(await sit({ choice: 'tajuk-1' })))
    expect(q.attempted).toBe(false)
    expect(q.parts.find((p) => p.partId === ESSAY_CHOICE_PART)?.status).toBe('kosong')
  })

  it('a topic with essay text is an answer: attempted', async () => {
    const q = questionOf(await resultOf(await sit({ choice: 'tajuk-1', text: 'Vakuol menyimpan air dan bahan terlarut.' })))
    expect(q.attempted).toBe(true)
  })

  it('(ii) a self-mark of 0 on a choice-only essay is kosong, not salah; with text it is salah', async () => {
    const blank = await sit({ choice: 'tajuk-1' })
    const r = BijakAttemptSelfMarkResultSchema.parse((await me.post(`/api/bijak/attempts/${blank}/self-mark`, { partId: ESSAY_CHOICE_PART, mark: 0 })).body.data)
    expect(r.awarded).toBe(0)
    expect(questionOf(await resultOf(blank)).parts.find((p) => p.partId === ESSAY_CHOICE_PART)?.status).toBe('kosong')
    const typed = await sit({ choice: 'tajuk-1', text: 'jawapan yang salah sama sekali' })
    await me.post(`/api/bijak/attempts/${typed}/self-mark`, { partId: ESSAY_CHOICE_PART, mark: 0 })
    expect(questionOf(await resultOf(typed)).parts.find((p) => p.partId === ESSAY_CHOICE_PART)?.status).toBe('salah')
  })
})
