/**
 * S3-T06 Kertas Subjektif sittings on the attempt routes (API-BIJAK-04): an untimed paper (no Tempoh, durationMin 0,
 * PO decision 2026-11-05 item 17) never gets a deadline, so it is never swept as expired.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type AttemptsTestApp, bootAttemptsApp, type Client, loginAs, MIN, PAPER, START, startAttempt, STUDENT } from './helpers'

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
  t.clock.set(START)
  t.papers.patch = {}
  await t.db.query('truncate exam_attempts cascade')
})

describe('untimed paper (durationMin 0)', () => {
  it('stores duration 0 and no deadline even when started in exam mode, and stays open (no instant expiry)', async () => {
    t.papers.patch = { durationMin: 0 }
    const id = await startAttempt(me, PAPER.matK2, 'exam')
    const [row] = await t.db.query<{ duration_min: number; deadline_at: Date | null }>(`select duration_min, deadline_at from exam_attempts where id = $1`, [id])
    expect(row).toEqual({ duration_min: 0, deadline_at: null })
    t.clock.advance(10 * MIN) // a deadline at start (durationMin 0) would be past its 300 s grace by now
    const res = await me.get(`/api/bijak/attempts/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.attempt).toMatchObject({ status: 'in_progress', durationMin: 0, deadline: null })
  })
})
