/**
 * FR-PA-21, AC-PA-20, API-BIJAK-05: an essay reads `belum_dimarkah`, never "Salah"; a short answer of 3 or more wrong words and an unreadable number become
 * `belum_dimarkah` and are self-markable, while a clear wrong answer stays automatic. No line says a teacher will mark it.
 */
import { BijakAttemptResultViewSchema, BijakAttemptSelfMarkResultSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

const SHORT = 'sn2-sel-q2-a' // short_text in the PoC bank; here with an `accepted` scheme
const NUMERIC = 'sn2-sel-q2-b' // here a numeric part with an `accepted` scheme

class AcceptedSource extends FakeQuestionSource {
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const out = new Map(await super.loadQuestions(ids))
    for (const [id, b] of out) {
      if (!b.question.parts?.some((p) => p.id === SHORT)) continue
      const parts = b.question.parts.map((p) => (p.id === NUMERIC ? { ...p, answer: { kind: 'numeric' as const } } : p))
      out.set(id, {
        ...b,
        question: { ...b.question, parts },
        schemes: {
          ...b.schemes,
          [SHORT]: { kind: 'accepted', marks: 1, values: [{ v: 'vakuol' }] },
          [NUMERIC]: { kind: 'accepted', marks: 2, values: [{ v: '12' }] },
        } as BijakQuestionBundle['schemes'],
      })
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
  ports.provideQuestionSource(new AcceptedSource())
  ports.provideReward(new SpyReward())
  ports.provideAggregate(new SpyAggregate())
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

async function sit(changes: object[]) {
  const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
  const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes })
  expect(sub.status, JSON.stringify(sub.body)).toBe(200)
  const res = await me.get(`/api/bijak/attempts/${id}/result`)
  const parts = BijakAttemptResultViewSchema.parse(res.body.data).result.questions.flatMap((q) => q.parts)
  return { id, part: (partId: string) => parts.find((p) => p.partId === partId)!, body: JSON.stringify(res.body) }
}

describe('self-mark of accepted parts (FR-PA-21, AC-PA-20)', () => {
  it('a short answer of 4 wrong words is belum_dimarkah and self-markable, and the self-mark is taken', async () => {
    const { id, part } = await sit([change(SHORT, { text: 'empat perkataan yang salah' })])
    expect(part(SHORT)).toMatchObject({ status: 'belum_dimarkah', selfMarkable: true })
    const res = await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SHORT, mark: 1 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(BijakAttemptSelfMarkResultSchema.parse(res.body.data)).toMatchObject({ partId: SHORT, awarded: 1 })
  })

  it('an unreadable number is belum_dimarkah and self-markable', async () => {
    const { part } = await sit([change(NUMERIC, { final: '@@' })])
    expect(part(NUMERIC)).toMatchObject({ status: 'belum_dimarkah', selfMarkable: true })
  })

  it('a clear wrong short answer stays automatic: salah, not self-markable, and the self-mark is refused', async () => {
    const { id, part } = await sit([change(SHORT, { text: 'salah' })])
    expect(part(SHORT).status).toBe('salah')
    expect(part(SHORT).selfMarkable).toBeUndefined()
    const res = await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SHORT, mark: 1 })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).toContain('Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.')
  })

  it('a correct accepted answer is betul, not self-markable', async () => {
    const { part } = await sit([change(SHORT, { text: 'Vakuol' })])
    expect(part(SHORT)).toMatchObject({ status: 'betul', awarded: 1 })
    expect(part(SHORT).selfMarkable).toBeUndefined()
  })

  it('an essay is belum_dimarkah, never salah, and the grader lines say no teacher marks it', async () => {
    const id = await startAttempt(me, PAPER.sejK2, 'exam', true)
    const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [change('sej2-q3-a', { text: 'Esei tentang sejarah negara.' })] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const res = await me.get(`/api/bijak/attempts/${id}/result`)
    const essay = BijakAttemptResultViewSchema.parse(res.body.data).result.questions.flatMap((q) => q.parts).find((p) => p.partId === 'sej2-q3-a')
    expect(essay?.status).toBe('belum_dimarkah')
    expect(JSON.stringify(res.body)).not.toMatch(/Guru akan menilai|Disemak oleh guru/)
  })
})
