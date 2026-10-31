/**
 * R1-10.2 (T40, D93): Cuba Lagi is a NEW attempt and earns again, as V2 does; nothing re-pays an attempt that was already paid.
 * Ledger rows = attempts, the XP follows the result of each attempt once, the kombo (streak) counts the day once, and a resubmit
 * of either attempt (same key or another) writes nothing. V2: docs/discovery/cloud-student-mechanism.md 1.7 ("Cuba Lagi" POST
 * creates a new attempt), docs/discovery/BIJAK-SPM-cloud.md 4.5 (one aggregate row per attempt, 2 syiling and 10 XP per mark).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema, BijakPaperSummarySchema } from '@pp/contract'

import { POC_BANK, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from './helpers'

let t: IntegrationApp
let student: Client

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

const correct = new Map<string, string>()
for (const q of POC_BANK.questions) {
  if (!q.mcq) continue
  const s = POC_BANK.schemes.find((x) => x.id === q.id)?.scheme as { kind: string; correct?: string } | undefined
  if (s?.kind === 'option' && s.correct) correct.set(pocQuestionId(q.id).toString(), s.correct)
}

const wallet = async () =>
  (await t.db.query<{ current_syiling: number; xp: number }>('select current_syiling, xp from wallets where user_id = $1', [student.userId]))[0] ?? { current_syiling: 0, xp: 0 }
const ledger = (attemptId: string) => t.db.query<{ amount: number }>(`select amount from coin_ledger where source = 'quiz_spm' and source_id = $1`, [attemptId])
const streak = async () =>
  (await t.db.query<{ total_days: number; current: number }>('select total_days, current from streaks where user_id = $1', [student.userId]))[0]!
const submit = (id: string, key: string) => student.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: key, changes: [] })
const result = async (id: string) => {
  const res = await student.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data).result
}

/** Answers the first PoC MCQ of the sitting correctly. */
async function answer(attemptId: string): Promise<void> {
  const v = BijakAttemptPaperViewSchema.parse((await student.get(`/api/bijak/attempts/${attemptId}`)).body.data)
  const qid = v.questions.map((q) => q.id).find((q) => correct.has(q))!
  const res = await student.put(`/api/bijak/attempts/${attemptId}/answers`, {
    changes: [{ partId: qid, answer: { choice: correct.get(qid)! }, rev: 1, savedAt: t.clock.now().toISOString() }],
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

describe('Cuba Lagi earns per attempt and never re-pays the first one', () => {
  it('ledger rows = attempts, XP once per attempt, the kombo once per day, and a resubmit writes nothing', async () => {
    const list = ((await student.get('/api/bijak/papers')).body.data as unknown[]).map((p) => BijakPaperSummarySchema.parse(p))
    const paper = list.find((p) => p.code === '1449/1' && p.kertas === 1)!
    const w0 = await wallet()

    // attempt A
    const a = (await student.post('/api/bijak/attempts', { paperId: paper.id, mode: 'exam' })).body.data.attemptId as string
    await answer(a)
    expect((await submit(a, 'a-1')).status).toBe(200)
    const ra = await result(a)
    expect(ra.coins).toBeGreaterThan(0)
    const ledgerA = await ledger(a)
    expect(ledgerA).toEqual([{ amount: ra.coins }])
    const w1 = await wallet()
    expect(w1.current_syiling).toBe(w0.current_syiling + ra.coins)
    expect(w1.xp).toBe(w0.xp + ra.points)
    const streakA = await streak()

    // Cuba Lagi: a new attempt of the same paper
    const retry = await student.post(`/api/bijak/attempts/${a}/retry`)
    expect(retry.status, JSON.stringify(retry.body)).toBeLessThan(300)
    const b = (retry.body as { data: { attemptId: string } }).data.attemptId
    expect(b).not.toBe(a)
    expect(await ledger(b)).toHaveLength(0) // nothing is paid before the new attempt is submitted
    await answer(b)
    expect((await submit(b, 'b-1')).status).toBe(200)
    const rb = await result(b)
    // ledger rows = attempts: A's row is untouched, B has its own
    expect(await ledger(a)).toEqual(ledgerA)
    expect(await ledger(b)).toEqual([{ amount: rb.coins }])
    const w2 = await wallet()
    expect(w2.current_syiling).toBe(w1.current_syiling + rb.coins)
    expect(w2.xp).toBe(w1.xp + rb.points)
    // the kombo counts the day once, not once per attempt
    expect(await streak()).toEqual(streakA)

    // resubmits of either attempt (same key, then another key) write nothing
    for (const [id, key] of [[a, 'a-1'], [a, 'a-2'], [b, 'b-1'], [b, 'b-2']] as const) expect((await submit(id, key)).status).toBe(200)
    expect(await ledger(a)).toEqual(ledgerA)
    expect(await ledger(b)).toEqual([{ amount: rb.coins }])
    expect(await wallet()).toEqual(w2)
    expect(await streak()).toEqual(streakA)
  })
})
