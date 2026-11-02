/**
 * REQ-B-025 (c): an `essay_choice` answer with a topic but no essay text is blank (REQ-B-021b, `isBlank(answer, kind)`).
 * The attempts adapter must pass the leaf kind, so (i) such a question is not "attempted" for best-N and (ii) a self-mark of
 * 0 on it gives `kosong`, not `salah`. A real essay text keeps both as before.
 *
 * Two re-typed leaves, because only a "Pilih N" Bahagian can show the best-N effect: Sains K2 Bahagian A is "all" (every question counts
 * whether attempted or not), so sn2-sel-q2-b only shows the part status and the totals; Bahagian B is "Pilih 1 daripada 2" (osmosis,
 * fotosintesis), so sn2-osmosis-a shows WHICH question counts. The last block pins the V2 rule that a self-mark makes a question attempted.
 */
import { BijakAttemptResultViewSchema, BijakAttemptSelfMarkResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

// The PoC bank has no essay_choice leaf, so the fixture below re-types two points-scheme short_text leaves of Sains K2 as essay_choice parts with
// two topics each: sn2-sel-q2-b (Bahagian A, "all") and sn2-osmosis-a (Bahagian B, "Pilih 1 daripada 2"). Their points schemes stay, which is what
// makes them self-markable; nothing else about the paper changes.
const ESSAY_CHOICE_PART = 'sn2-sel-q2-b'
const ALL_Q = 'sn2-sel-q2'
const CHOOSE_PART = 'sn2-osmosis-a'
const CHOOSE_Q = 'sn2-osmosis'
const OTHER_PART = 'sn2-fotosintesis-a'
const OTHER_Q = 'sn2-fotosintesis'
const A_QUESTIONS = ['sn2-sel-q1', 'sn2-sel-q2', 'sn2-laju-v1'] // Bahagian A, rule "all"
const TOPICS = [
  { id: 'tajuk-1', label: 'Fungsi vakuol' },
  { id: 'tajuk-2', label: 'Fungsi kloroplas' },
]
const RETYPED = new Set([ESSAY_CHOICE_PART, CHOOSE_PART])

class PointsLeafAsEssayChoiceSource extends FakeQuestionSource {
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const base = await super.loadQuestions(ids)
    const out = new Map(base)
    for (const [id, b] of base) {
      if (!b.question.parts?.some((p) => RETYPED.has(p.id))) continue
      const parts = b.question.parts.map((p) => (RETYPED.has(p.id) ? { ...p, answer: { ...p.answer, kind: 'essay_choice' as const, topics: TOPICS } } : p))
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

type Answer = { choice?: string; text?: string }
async function sitWith(answers: Record<string, Answer>): Promise<string> {
  const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
  const res = await me.post(`/api/bijak/attempts/${id}/submit`, {
    idempotencyKey: `k-${id}`,
    changes: Object.entries(answers).map(([partId, a]) => change(partId, a)),
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return id
}
const sit = (answer: Answer) => sitWith({ [ESSAY_CHOICE_PART]: answer })
const resultOf = async (id: string) => {
  const res = await me.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data).result
}
type Result = Awaited<ReturnType<typeof resultOf>>
const question = (r: Result, questionId: string) => r.questions.find((q) => q.questionId === questionId)!
const part = (r: Result, partId: string) => r.questions.flatMap((q) => q.parts).find((p) => p.partId === partId)!
const questionOf = (r: Result) => question(r, ALL_Q)
const sectionA = (r: Result) => r.sections.find((s) => s.label === 'Bahagian A')!
const sectionB = (r: Result) => r.sections.find((s) => s.chooseN === 1)!
const selfMark = (id: string, partId: string, mark: number) => me.post(`/api/bijak/attempts/${id}/self-mark`, { partId, mark })

describe('REQ-B-025(c): a topic without essay text is blank', () => {
  it('(i) in an "all" Bahagian the part is kosong, the question is not attempted, yet it still counts and nothing is awarded', async () => {
    const r = await resultOf(await sit({ choice: 'tajuk-1' }))
    const q = questionOf(r)
    expect(q).toMatchObject({ attempted: false, counted: true, awarded: 0 })
    expect(part(r, ESSAY_CHOICE_PART)).toMatchObject({ status: 'kosong', awarded: 0 })
    expect(sectionA(r)).toMatchObject({ label: 'Bahagian A', awarded: 0, counted: A_QUESTIONS })
    expect(r.score).toBe(0)
  })

  it('a topic with essay text is an answer: attempted, marked by its points scheme and added to the section and the total', async () => {
    const r = await resultOf(await sit({ choice: 'tajuk-1', text: 'Vakuol menyimpan air dan bahan terlarut.' }))
    expect(questionOf(r)).toMatchObject({ attempted: true, counted: true, awarded: 1 })
    expect(part(r, ESSAY_CHOICE_PART)).toMatchObject({ status: 'separa', awarded: 1 })
    expect(sectionA(r)).toMatchObject({ awarded: 1, counted: A_QUESTIONS })
    expect(r.score).toBe(1)
  })

  it('(ii) a self-mark of 0 on a choice-only essay is kosong, not salah; with text it is salah', async () => {
    const blank = await sit({ choice: 'tajuk-1' })
    const marked = BijakAttemptSelfMarkResultSchema.parse((await selfMark(blank, ESSAY_CHOICE_PART, 0)).body.data)
    expect(marked).toMatchObject({ partId: ESSAY_CHOICE_PART, awarded: 0, status: 'kosong' })
    const rb = await resultOf(blank)
    expect(part(rb, ESSAY_CHOICE_PART)).toMatchObject({ status: 'kosong', awarded: 0, selfMarked: true })
    expect(rb.score).toBe(0)
    const typed = await sit({ choice: 'tajuk-1', text: 'jawapan yang salah sama sekali' })
    const markedTyped = BijakAttemptSelfMarkResultSchema.parse((await selfMark(typed, ESSAY_CHOICE_PART, 0)).body.data)
    expect(markedTyped).toMatchObject({ awarded: 0, status: 'salah' })
    const rt = await resultOf(typed)
    expect(part(rt, ESSAY_CHOICE_PART)).toMatchObject({ status: 'salah', awarded: 0, selfMarked: true })
    expect(rt.score).toBe(0)
  })
})

describe('REQ-B-025(c): best-N in a "Pilih 1 daripada 2" Bahagian (sn2-osmosis-a re-typed as essay_choice)', () => {
  it('a choice-only osmosis is not attempted: with nothing else attempted no question counts and the section awards 0', async () => {
    const r = await resultOf(await sitWith({ [CHOOSE_PART]: { choice: 'tajuk-1' } }))
    expect(question(r, CHOOSE_Q)).toMatchObject({ attempted: false, counted: false, awarded: 0 })
    expect(question(r, OTHER_Q)).toMatchObject({ attempted: false, counted: false })
    expect(part(r, CHOOSE_PART).status).toBe('kosong')
    expect(sectionB(r)).toMatchObject({ chooseN: 1, awarded: 0, counted: [] })
    expect(r.score).toBe(0)
  })

  it('a choice-only osmosis loses a 0-0 tie to an attempted fotosintesis that sits after it (otherwise the lower position would win)', async () => {
    const r = await resultOf(
      await sitWith({ [CHOOSE_PART]: { choice: 'tajuk-1' }, [OTHER_PART]: { text: 'jawapan yang tidak berkaitan sama sekali' } }),
    )
    expect(question(r, CHOOSE_Q)).toMatchObject({ attempted: false, counted: false })
    expect(question(r, OTHER_Q)).toMatchObject({ attempted: true, counted: true, awarded: 0 })
    expect(sectionB(r)).toMatchObject({ awarded: 0, counted: [OTHER_Q] })
  })

  it('an osmosis answered with a topic AND text is attempted, so it counts (and wins the tie by position)', async () => {
    const r = await resultOf(
      await sitWith({ [CHOOSE_PART]: { choice: 'tajuk-1', text: 'jawapan yang tidak berkaitan sama sekali' }, [OTHER_PART]: { text: 'jawapan yang tidak berkaitan sama sekali' } }),
    )
    expect(question(r, CHOOSE_Q)).toMatchObject({ attempted: true, counted: true })
    expect(question(r, OTHER_Q)).toMatchObject({ attempted: true, counted: false })
    expect(sectionB(r).counted).toEqual([CHOOSE_Q])
  })
})

describe('REQ-B-025(c) + V2: a self-mark makes a question attempted, even a choice-only essay marked 0', () => {
  // self-mark.ts: "V2: a self-mark creates a response row, and ExamBestNScorer counts a question as attempted once any response row exists".
  // The PART stays kosong (REQ-B-025c: the answer is still blank) but the QUESTION now takes part in best-N.
  it('self-mark 0 on the choice-only osmosis: the part stays kosong with 0 marks, but the question becomes attempted and counts in Bahagian B', async () => {
    const id = await sitWith({ [CHOOSE_PART]: { choice: 'tajuk-1' } })
    expect(sectionB(await resultOf(id)).counted).toEqual([])
    expect((await selfMark(id, CHOOSE_PART, 0)).status).toBe(200)
    const r = await resultOf(id)
    expect(part(r, CHOOSE_PART)).toMatchObject({ status: 'kosong', awarded: 0, selfMarked: true })
    expect(question(r, CHOOSE_Q)).toMatchObject({ attempted: true, counted: true, awarded: 0 })
    expect(sectionB(r)).toMatchObject({ awarded: 0, counted: [CHOOSE_Q] })
    expect(r.score).toBe(0)
  })

  it('self-mark 0 on a choice-only essay in an "all" Bahagian flips attempted to true and changes nothing else', async () => {
    const id = await sit({ choice: 'tajuk-1' })
    const before = await resultOf(id)
    expect(questionOf(before).attempted).toBe(false)
    await selfMark(id, ESSAY_CHOICE_PART, 0)
    const after = await resultOf(id)
    expect(questionOf(after)).toMatchObject({ attempted: true, counted: true, awarded: 0 })
    expect(after.score).toBe(before.score)
    expect(after.sections.map((s) => [s.awarded, s.counted])).toEqual(before.sections.map((s) => [s.awarded, s.counted]))
  })

  it('a positive self-mark on the choice-only essay is partial credit: separa, awarded, in the section and the total', async () => {
    const id = await sit({ choice: 'tajuk-1' })
    const marked = BijakAttemptSelfMarkResultSchema.parse((await selfMark(id, ESSAY_CHOICE_PART, 1)).body.data)
    expect(marked).toMatchObject({ awarded: 1, status: 'separa', attemptScore: 1 })
    const r = await resultOf(id)
    expect(questionOf(r)).toMatchObject({ attempted: true, counted: true, awarded: 1 })
    expect(sectionA(r)).toMatchObject({ awarded: 1 })
    expect(r.score).toBe(1)
  })
})
