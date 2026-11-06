/**
 * S3-T06 Kertas Subjektif sittings on the attempt routes (API-BIJAK-04, API-BIJAK-05; 46 sections 3.4, 3.5, 4.7):
 * - the attempt kind follows the paper surface: `paper_kind = 'subjektif'`, always `latihan`, untimed (DM-83);
 * - an untimed paper (durationMin 0, PO decision 2026-11-05 item 17) never gets a deadline;
 * - no "Semak" before "Hantar & Semak" (FR-PA-20, AC-PA-10);
 * - the result holds no scheme text until `?scheme=1` (AC-MUR-13-21); the self-mark response holds none either;
 * - the sitting is paid at Hantar (46 section 3.6, B6).
 */
import { BijakAttemptResultViewSchema, BijakAttemptSelfMarkResultSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type AttemptsTestApp, bootAttemptsApp, change, type Client, loginAs, MIN, PAPER, START, startAttempt, STUDENT } from './helpers'

let t: AttemptsTestApp
let me: Client

const SEL_B = 'sn2-sel-q2-b' // Sains K2, points scheme, 2 marks
const SEL_Q = 'sn2-sel-q2' // its question

beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  t.clock.set(START)
  t.papers.patch = {}
  t.reward.calls.length = 0
  await t.db.query('truncate exam_attempts cascade')
})

const row = async (id: string) =>
  (await t.db.query<{ paper_kind: string; mode: string; duration_min: number; deadline_at: Date | null }>(`select paper_kind, mode, duration_min, deadline_at from exam_attempts where id = $1`, [id]))[0]

async function sitSubjektif(text = 'bahan terlarut dalam sel itu'): Promise<string> {
  t.papers.patch = { surface: 'subjektif', durationMin: 0 }
  const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
  const res = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [change(SEL_B, { text })] })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return id
}
const partsOf = (data: unknown) => BijakAttemptResultViewSchema.parse(data).result.questions.flatMap((q) => q.parts)

describe('untimed paper (durationMin 0)', () => {
  it('stores duration 0 and no deadline even when started in exam mode, and stays open (no instant expiry)', async () => {
    t.papers.patch = { durationMin: 0 }
    const id = await startAttempt(me, PAPER.matK2, 'exam')
    expect(await row(id)).toEqual({ paper_kind: 'pilihan', mode: 'exam', duration_min: 0, deadline_at: null })
    t.clock.advance(10 * MIN) // a deadline at start (durationMin 0) would be past its 300 s grace by now
    const res = await me.get(`/api/bijak/attempts/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.attempt).toMatchObject({ status: 'in_progress', durationMin: 0, deadline: null })
  })
})

describe('Kertas Subjektif sitting (paper surface subjektif)', () => {
  it('derives paper_kind subjektif and forces latihan with no deadline, whatever mode the client sent', async () => {
    t.papers.patch = { surface: 'subjektif', durationMin: 150 }
    const id = await startAttempt(me, PAPER.sainsK2, 'exam')
    expect(await row(id)).toEqual({ paper_kind: 'subjektif', mode: 'latihan', duration_min: 150, deadline_at: null })
    const view = await me.get(`/api/bijak/attempts/${id}`)
    expect(view.body.data.attempt).toMatchObject({ paperKind: 'subjektif', mode: 'latihan', deadline: null })
  })

  it('refuses "Semak" before Hantar & Semak (403, no scheme)', async () => {
    t.papers.patch = { surface: 'subjektif' }
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan')
    const res = await me.post(`/api/bijak/attempts/${id}/questions/${SEL_Q}/check`, {})
    expect(res.status).toBe(403)
    expect(res.body.error.message).toBe('Skema hanya didedahkan selepas Hantar')
  })

  it('a result before submit, with or without scheme=1, is 409 NOT_SUBMITTED', async () => {
    t.papers.patch = { surface: 'subjektif' }
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan')
    for (const q of ['', '?scheme=1']) {
      const res = await me.get(`/api/bijak/attempts/${id}/result${q}`)
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('NOT_SUBMITTED')
    }
  })

  it('the result holds no scheme text until ?scheme=1 (AC-MUR-13-21)', async () => {
    const id = await sitSubjektif()
    const plain = await me.get(`/api/bijak/attempts/${id}/result`)
    expect(plain.status).toBe(200)
    const hidden = partsOf(plain.body.data)
    expect(hidden.length).toBeGreaterThan(0)
    for (const p of hidden) {
      expect(p.scheme).toBeUndefined()
      expect(p.suggestion).toBeUndefined()
      expect(p.points).toEqual([])
    }
    expect(hidden.find((p) => p.partId === SEL_B)).toMatchObject({ selfMarkable: true })
    const shown = await me.get(`/api/bijak/attempts/${id}/result?scheme=1`)
    expect(shown.status).toBe(200)
    const parts = partsOf(shown.body.data)
    expect(parts.every((p) => p.scheme !== undefined)).toBe(true)
    // Only the scheme text differs: marks and status are the same either way.
    expect(parts.map((p) => [p.partId, p.awarded, p.status])).toEqual(hidden.map((p) => [p.partId, p.awarded, p.status]))
  })

  it('self-mark works and its response carries no scheme text', async () => {
    const id = await sitSubjektif()
    const res = await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SEL_B, mark: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = BijakAttemptSelfMarkResultSchema.parse(res.body.data)
    expect(out).toMatchObject({ partId: SEL_B, awarded: 2, max: 2 })
    for (const p of out.result.questions.flatMap((q) => q.parts)) expect(p.scheme).toBeUndefined()
  })

  it('self-mark after "Tunjuk Skema Pemarkahan" (?scheme=1) keeps the scheme in its response', async () => {
    const id = await sitSubjektif()
    const res = await me.post(`/api/bijak/attempts/${id}/self-mark?scheme=1`, { partId: SEL_B, mark: 1 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const parts = BijakAttemptSelfMarkResultSchema.parse(res.body.data).result.questions.flatMap((q) => q.parts)
    expect(parts.every((p) => p.scheme !== undefined)).toBe(true)
  })

  it('an automatically marked part of a subjektif attempt answers 409 (46 section 3.4)', async () => {
    t.papers.patch = { surface: 'subjektif' }
    const id = await startAttempt(me, PAPER.sejK2, 'latihan')
    expect((await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [] })).status).toBe(200)
    const res = await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: 'sej2-q2-a', mark: 1 }) // the mapping part, marked automatically
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.' })
  })

  it('Cuba Lagi starts another subjektif latihan sitting; history shows the kind subjektif', async () => {
    const id = await sitSubjektif()
    const retry = await me.post(`/api/bijak/attempts/${id}/retry`, {})
    expect(retry.status, JSON.stringify(retry.body)).toBe(201)
    expect(await row(retry.body.data.attemptId)).toEqual({ paper_kind: 'subjektif', mode: 'latihan', duration_min: 0, deadline_at: null })
    const history = await me.get('/api/bijak/history')
    expect(history.status).toBe(200)
    expect(history.body.data.find((h: { attemptId: string }) => h.attemptId === id)).toMatchObject({ kind: 'subjektif', mode: 'latihan' })
  })

  it('"Mula" again resumes the open subjektif sitting', async () => {
    t.papers.patch = { surface: 'subjektif' }
    const first = await startAttempt(me, PAPER.sainsK2, 'latihan')
    const again = await me.post('/api/bijak/attempts', { paperId: PAPER.sainsK2, mode: 'exam' })
    expect(again.body.data.attemptId).toBe(first)
  })

  it('is paid at Hantar like an exam sitting (46 section 3.6, B6), although its mode is latihan', async () => {
    await sitSubjektif()
    expect(t.reward.calls).toHaveLength(1)
  })

  it('a Simulasi latihan sitting is still not paid and still has Semak (unchanged)', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan')
    expect(await row(id)).toMatchObject({ paper_kind: 'pilihan', mode: 'latihan' })
    const check = await me.post(`/api/bijak/attempts/${id}/questions/${SEL_Q}/check`, {})
    expect(check.status).toBe(200)
    const res = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [] })
    expect(res.status).toBe(200)
    // Not paid: the only question was checked (revealed), so the port is still called for the streak with nothing to credit.
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toMatchObject({ coins: 0, points: 0 })
    const result = await me.get(`/api/bijak/attempts/${id}/result`)
    expect(partsOf(result.body.data).every((p) => p.scheme !== undefined)).toBe(true)
  })
})
