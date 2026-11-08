/**
 * S3-T04 part 9, AC-MUR-13-25: a 40-MCQ sitting writes exactly 40 answer rows (mode `simulasi`, `attempt_id` = the attempt) through the
 * one `AnswerLogPort`, once; a second Hantar leaves 40. The fixture paper is built here from clones of one bank MCQ (no 40-MCQ paper exists).
 * The port is the recording stand-in of `helpers.ts`; the real-database idempotency on the DM-44 key is in
 * `test/bijak-integration/answer-rows.spec.ts` and `test/practice/answer-log-port.spec.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BANK } from '../../../../src/modules/m28-bijak-spm/data/registry'
import { BijakAttemptPorts, type BijakPaperSource, type BijakQuestionBundle, type BijakQuestionSource, type PaperResolution } from '../../src/modules/bijak/attempts/ports'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, loginAs, startAttempt, STUDENT } from './helpers'

const COUNT = 40
const IDS = Array.from({ length: COUNT }, (_, i) => String(9000 + i))
const base = [...BANK.questions.values()].find((q) => q.mcq && !q.groupId)!
const baseScheme = BANK.schemes.get(base.id)! as { kind: string; correct: string }

class FortyPapers implements BijakPaperSource {
  async resolveForAttempt(): Promise<PaperResolution> {
    return {
      ok: true,
      paper: {
        id: '700',
        kind: 'pilihan',
        title: 'Kertas 40 MCQ',
        subject: 'MAT',
        subjectName: 'Matematik',
        kertas: 1,
        code: '1449/1',
        durationMin: 60,
        sections: [{ id: 's1', label: 'Bahagian A', rule: { type: 'all' }, questionIds: IDS }],
      },
    }
  }
}
class FortyQuestions implements BijakQuestionSource {
  async loadQuestions(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    return new Map(ids.filter((i) => IDS.includes(i)).map((i) => [i, { question: { ...base, id: i }, schemes: { [i]: baseScheme } } as unknown as BijakQuestionBundle]))
  }
}

let t: AttemptsTestApp
let me: Client
beforeAll(async () => {
  t = await bootAttemptsApp({}, { plugPorts: false })
  const ports = t.app.get(BijakAttemptPorts)
  ports.providePaperSource(new FortyPapers())
  ports.provideQuestionSource(new FortyQuestions())
  ports.provideReward(t.reward)
  ports.provideAggregate(t.aggregate)
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

describe('AC-MUR-13-25: a 40-MCQ sitting', () => {
  it('writes exactly 40 simulasi rows once, and a second Hantar leaves 40', async () => {
    const id = await startAttempt(me, '700', 'exam')
    const changes = IDS.map((q, i) => change(q, { choice: i % 2 === 0 ? baseScheme.correct : 'Z' }))
    const first = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'k40-1', changes })
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    const rows = t.answerLog.entries.filter((e) => e.attemptId === id)
    expect(rows).toHaveLength(COUNT)
    expect(new Set(rows.map((r) => r.questionId)).size).toBe(COUNT)
    expect(rows.every((r) => r.mode === 'simulasi' && r.partRef === null && r.marksMax === 1 && r.userId === me.userId)).toBe(true)
    expect(rows.filter((r) => r.isCorrect)).toHaveLength(COUNT / 2)
    expect(t.aggregate.calls.filter((c) => c.attemptId === id)).toHaveLength(1)

    const second = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'k40-2', changes: [] })
    expect(second.status).toBe(200)
    expect(t.answerLog.entries.filter((e) => e.attemptId === id)).toHaveLength(COUNT) // no new write
  })
})
