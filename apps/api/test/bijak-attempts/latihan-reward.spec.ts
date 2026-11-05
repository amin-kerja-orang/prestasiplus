/**
 * S3-T04 (46 D-PA-13, FR-PA-16, AC-PA-11): a Mod Latihan sitting credits Syiling only for the parts "Semak" never revealed; exam mode pays as before.
 * A question that was checked counts as revealed (DM-68 `revealed` on an answer row counts too).
 */
import { BijakAttemptPaperViewSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type AttemptsTestApp, bootAttemptsApp, change, type Client, correctChoice, loginAs, PAPER, questionIdsOfView, startAttempt, STUDENT } from './helpers'

let t: AttemptsTestApp
let me: Client

beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  await t.db.query('truncate exam_attempts cascade')
  t.reward.calls.length = 0
})

const questions = async (id: string) => questionIdsOfView(BijakAttemptPaperViewSchema.parse((await me.get(`/api/bijak/attempts/${id}`)).body.data))
const submit = (id: string, changes: object[]) => me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes })
const allCorrect = (qs: string[]) => qs.map((q) => change(q, { choice: correctChoice(q) }))

describe('Mod Latihan reward (FR-PA-16)', () => {
  it('pays only the parts never revealed: 2 checked questions are not paid, the rest are', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(id)
    expect(qs.length).toBeGreaterThanOrEqual(3)
    for (const q of qs.slice(0, 2)) expect((await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, { changes: [change(q, { choice: correctChoice(q) })] })).status).toBe(200)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    const call = t.reward.calls[0]!
    const unrevealed = qs.length - 2
    expect(call).toMatchObject({ attemptId: id, score: qs.length })
    expect(call.coins).toBe(unrevealed * 2)
    expect(call.points).toBe(unrevealed * 10)
  })

  it('pays nothing when every question was revealed, and the full amount when none was', async () => {
    const all = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(all)
    for (const q of qs) await me.post(`/api/bijak/attempts/${all}/questions/${q}/check`, { changes: [change(q, { choice: correctChoice(q) })] })
    expect((await submit(all, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls.at(-1)).toMatchObject({ attemptId: all, coins: 0, points: 0 })
    const none = await startAttempt(me, PAPER.matK1, 'latihan')
    expect((await submit(none, allCorrect(await questions(none)))).status).toBe(200)
    expect(t.reward.calls.at(-1)).toMatchObject({ attemptId: none, coins: qs.length * 2 })
  })

  it('a part flagged revealed on its answer row is not paid', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(id)
    await me.put(`/api/bijak/attempts/${id}/answers`, { changes: allCorrect(qs) })
    await t.db.query(`update attempt_answers set answer = answer || '{"revealed": true}'::jsonb where attempt_id = $1 and part_id = $2`, [id, qs[0]])
    expect((await submit(id, [])).status).toBe(200)
    expect(t.reward.calls[0]).toMatchObject({ coins: (qs.length - 1) * 2 })
  })

  it('exam mode is unchanged: the whole result pays', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    const qs = await questions(id)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toMatchObject({ attemptId: id, coins: qs.length * 2, points: qs.length * 10 })
  })
})
