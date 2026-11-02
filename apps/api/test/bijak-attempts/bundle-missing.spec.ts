/**
 * REQ-B-079 (1): a sitting whose questions the question source no longer returns (the retired PoC paper of the demo seed: its composition ids are
 * PoC fixtures, which production code no longer reads) used to answer 500 SERVER_ERROR on every route that loads the bundles. It is now
 * 404 NOT_FOUND "Kertas tidak ditemui" (the existing copy a start on an unknown or unpublished paper already uses); the error is still logged.
 */
import { BIJAK_ATTEMPTS_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

/** The bank as the attempt left it, until `vanish` is set: then no bundle comes back, like a retired fixture. */
class VanishingQuestionSource extends FakeQuestionSource {
  vanish = false
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    if (this.vanish) return new Map()
    return super.loadQuestions(ids)
  }
}

let t: AttemptsTestApp
let me: Client
const source = new VanishingQuestionSource()

beforeAll(async () => {
  t = await bootAttemptsApp({}, { plugPorts: false })
  const ports = t.app.get(BijakAttemptPorts)
  ports.providePaperSource(new FakePaperSource())
  ports.provideQuestionSource(source)
  ports.provideReward(new SpyReward())
  ports.provideAggregate(new SpyAggregate())
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

describe('REQ-B-079 (1): an attempt whose questions are gone from the question source', () => {
  it('opening the sitting is 404 "Kertas tidak ditemui", not 500; the same sitting opens again once the questions are back', async () => {
    source.vanish = false
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await me.get(`/api/bijak/attempts/${id}`)).status).toBe(200)

    source.vanish = true
    try {
      const gone = await me.get(`/api/bijak/attempts/${id}`)
      expect(gone.status, JSON.stringify(gone.body)).toBe(404)
      expect(gone.body.error).toMatchObject({ code: 'NOT_FOUND', message: BIJAK_ATTEMPTS_MESSAGES.paperNotFound })
      expect(BIJAK_ATTEMPTS_MESSAGES.paperNotFound).toBe('Kertas tidak ditemui')
    } finally {
      source.vanish = false
    }
    expect((await me.get(`/api/bijak/attempts/${id}`)).status).toBe(200)
  })

  it('submitting such a sitting is 404 too, and nothing is graded', async () => {
    source.vanish = false
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    source.vanish = true
    try {
      const res = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes: [change('sn2-sel-q2-b', { text: 'bahan terlarut dalam sel itu' })] })
      expect(res.status, JSON.stringify(res.body)).toBe(404)
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Kertas tidak ditemui' })
    } finally {
      source.vanish = false
    }
    const view = await me.get(`/api/bijak/attempts/${id}`)
    expect(view.status).toBe(200)
    expect(view.body.data.attempt).toMatchObject({ status: 'in_progress' })
  })
})
