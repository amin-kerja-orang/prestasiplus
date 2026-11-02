/**
 * REQ-B-079 (A4 review minor): a missing bundle is a 404 since the change above, and `sweepUser` (run by history, the in-progress lookup and
 * the past-sittings route) closes the caller's expired sittings one by one. One dead expired sitting (its questions are gone from the question
 * source, like the retired PoC paper) must not make those routes 404 for the whole pupil: the sitting is skipped with a warning and left
 * unchanged, as `sweepExpired` already does for the scheduled sweep.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, type BijakQuestionBundle } from '../../src/modules/bijak/attempts'
import { type AttemptsTestApp, bootAttemptsApp, type Client, FakePaperSource, FakeQuestionSource, loginAs, PAPER, SpyAggregate, SpyReward, startAttempt, STUDENT } from './helpers'

const GRACE = 300

/** Returns no bundle for the Sains K2 questions (`sn2-*`) once `vanish` is set; every other paper keeps working. */
class VanishingSainsSource extends FakeQuestionSource {
  vanish = false
  override async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    return super.loadQuestions(this.vanish ? ids.filter((id) => !id.startsWith('sn2-')) : ids)
  }
}

let t: AttemptsTestApp
let me: Client
const source = new VanishingSainsSource()

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

describe('REQ-B-079: one dead expired sitting does not break the pupil\'s history', () => {
  it('history is 200 and lists the normal sitting; the dead sitting is skipped and left in_progress; the in-progress lookup of another paper works too', async () => {
    await t.db.query('truncate exam_attempts cascade')
    source.vanish = false
    const dead = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    const normal = await startAttempt(me, PAPER.matK1, 'exam', true)
    const submitted = await me.post(`/api/bijak/attempts/${normal}/submit`, { idempotencyKey: `k-${normal}`, changes: [] })
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)

    const view = (await me.get(`/api/bijak/attempts/${dead}`)).body.data as { attempt: { deadline: string } }
    t.clock.set(new Date(new Date(view.attempt.deadline).getTime() + (GRACE + 5) * 1000).toISOString())
    source.vanish = true
    try {
      const history = await me.get('/api/bijak/history')
      expect(history.status, JSON.stringify(history.body)).toBe(200)
      const rows = history.body.data as { attemptId: string; status: string }[]
      expect(rows.find((r) => r.attemptId === normal)).toMatchObject({ status: 'submitted' })
      expect(rows.find((r) => r.attemptId === dead)).toMatchObject({ status: 'in_progress' })
      // the dead sitting was not touched: no status change, no answers lost
      expect((await t.db.query<{ status: string }>('select status from exam_attempts where id = $1', [dead]))[0]!.status).toBe('in_progress')
      // the other lookups that sweep the caller's sittings keep working as well
      expect((await me.get(`/api/bijak/papers/${PAPER.matK1}/in-progress`)).status).toBe(200)
    } finally {
      source.vanish = false
    }
  })
})
