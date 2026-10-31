/**
 * AC-10.9 (T50), the data behind the reveal copy: after Hantar the result carries, per part, the verdict (Betul / Salah), the
 * scheme (the correct option, the accepted answers as text, the model answer) and the explanation. The copy strings are front end.
 */
import { BijakAttemptResultViewSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type AttemptsTestApp, bootAttemptsApp, change, type Client, correctChoice, loginAs, PAPER, startAttempt, STUDENT } from './helpers'

let t: AttemptsTestApp
let me: Client
beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

async function sitAndRead(paperId: string, answers: (qids: string[]) => ReturnType<typeof change>[]) {
  const id = await startAttempt(me, paperId, 'exam', true)
  const view = (await me.get(`/api/bijak/attempts/${id}`)).body.data as { questions: { id: string }[] }
  const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: answers(view.questions.map((q) => q.id)) })
  expect(sub.status, JSON.stringify(sub.body)).toBe(200)
  const res = await me.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data).result.questions.flatMap((q) => q.parts)
}

describe('AC-10.9 the result reveals verdict, scheme and explanation', () => {
  it('an MCQ part: Betul with the correct option, Salah with the same correct option', async () => {
    const parts = await sitAndRead(PAPER.matK1, (qids) => [
      change(qids[0]!, { choice: correctChoice(qids[0]!) }),
      change(qids[1]!, { choice: 'no-such-option' }),
    ])
    const first = parts.find((p) => p.partId === parts[0]!.partId)!
    expect(first.status).toBe('betul')
    expect(first.scheme?.correctOption).toBeTruthy()
    expect((first.scheme?.explanation ?? '').trim()).not.toBe('') // Penjelasan
    const wrong = parts[1]!
    expect(wrong.status).toBe('salah')
    expect(wrong.scheme?.correctOption).toBeTruthy()
  })

  it('a structured paper reveals the accepted answers as text (Jawapan diterima) for its parts', async () => {
    const parts = await sitAndRead(PAPER.matK2, () => [])
    const accepted = parts.filter((p) => (p.scheme?.acceptedText ?? []).length > 0)
    expect(accepted.length).toBeGreaterThan(0)
    expect(accepted.every((p) => (p.scheme?.acceptedText ?? []).every((x) => x.trim() !== ''))).toBe(true)
    // every part shows a scheme after Hantar and a verdict from the allowed set
    for (const p of parts) {
      expect(p.scheme, p.partId).toBeDefined()
      expect(['betul', 'separa', 'salah', 'kosong', 'belum_dimarkah']).toContain(p.status)
    }
  })
})
