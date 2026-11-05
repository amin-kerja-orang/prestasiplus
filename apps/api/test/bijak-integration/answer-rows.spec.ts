/**
 * S3-T04 part 9 (FR-MUR-13-21, AC-MUR-13-25, API-BIJAK-04 c, DM-44): every close path of a Bijak sitting writes one `practice_answers`
 * row per answered leaf through the one `AnswerLogPort`, mode `simulasi`, `attempt_id` = the attempt, in the closing transaction.
 * Real wiring (auth + BijakIntegrationModule + the PoC papers on decimal bank ids). The rows are read straight from the database.
 */
import { BijakAttemptPaperViewSchema, BijakPaperSummarySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { POC_BANK, pocQuestionId } from '../../prisma/seed/poc/export'
import { AttemptSweeper } from '../../src/modules/bijak/attempts/attempt-sweeper'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from './helpers'

let t: IntegrationApp
let student: Client

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
}, 180_000)
afterAll(async () => {
  await t.close()
})

const correct = new Map<string, string>()
for (const q of POC_BANK.questions) {
  if (!q.mcq) continue
  const s = POC_BANK.schemes.find((x) => x.id === q.id)?.scheme as { kind: string; correct?: string } | undefined
  if (s?.kind === 'option' && s.correct) correct.set(pocQuestionId(q.id).toString(), s.correct)
}

interface Row {
  question_id: string
  part_ref: string | null
  mode: string
  is_correct: boolean
  marks_awarded: string | null
  marks_max: string
  selected_label: string | null
  session_id: string | null
}
const rows = (attemptId: string) =>
  t.db.query<Row>(
    `select question_id::text, part_ref, mode, is_correct, marks_awarded::text, marks_max::text, selected_label, session_id::text
       from practice_answers where attempt_id = $1::uuid order by question_id`,
    [attemptId],
  )
const aggregates = (attemptId: string) => t.db.query<{ units_awarded: string }>(`select units_awarded::text from practice_attempt_aggregates where attempt_id = $1::uuid`, [attemptId])

async function paperId(): Promise<string> {
  const list = ((await student.get('/api/bijak/papers')).body.data as unknown[]).map((p) => BijakPaperSummarySchema.parse(p))
  return list.find((p) => p.code === '1449/1' && p.kertas === 1)!.id
}
async function start(mode: 'exam' | 'latihan' = 'exam'): Promise<{ id: string; mcq: string[] }> {
  const id = ((await student.post('/api/bijak/attempts', { paperId: await paperId(), mode })).body.data as { attemptId: string }).attemptId
  const view = BijakAttemptPaperViewSchema.parse((await student.get(`/api/bijak/attempts/${id}`)).body.data)
  return { id, mcq: view.questions.map((q) => q.id).filter((q) => correct.has(q)) }
}
const change = (partId: string, choice: string, rev = 1, savedAt?: string) => ({ partId, answer: { choice }, rev, savedAt: savedAt ?? t.clock.now().toISOString() })
const wrongOf = (qid: string) => ['A', 'B', 'C', 'D'].find((l) => l !== correct.get(qid))!
const submit = (id: string, key: string, changes: ReturnType<typeof change>[] = []) => student.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: key, changes })

describe('Bijak sitting answer rows (D-A1)', () => {
  it('submit writes one simulasi row per answered MCQ with the attempt id, once, and the aggregate summary still lands', async () => {
    const a = await start()
    expect(a.mcq.length).toBeGreaterThan(3)
    const changes = a.mcq.map((q, i) => change(q, i === 0 ? wrongOf(q) : correct.get(q)!))
    expect((await submit(a.id, 'k1', changes)).status).toBe(200)
    const got = await rows(a.id)
    expect(got).toHaveLength(a.mcq.length)
    expect(new Set(got.map((r) => r.mode))).toEqual(new Set(['simulasi']))
    expect(got.every((r) => r.part_ref === null && r.session_id === null && r.marks_max === '1.00')).toBe(true)
    expect(got.filter((r) => !r.is_correct)).toHaveLength(1)
    expect(got.find((r) => r.question_id === a.mcq[0])).toMatchObject({ is_correct: false, marks_awarded: '0.00', selected_label: wrongOf(a.mcq[0]!) })
    expect(await aggregates(a.id)).toHaveLength(1)

    // a second Hantar (another key) and a replay change nothing
    expect((await submit(a.id, 'k2')).status).toBe(200)
    expect((await submit(a.id, 'k1')).status).toBe(200)
    expect(await rows(a.id)).toEqual(got)
  })

  it('a blank question has no row; an unanswered sitting writes none', async () => {
    const a = await start()
    expect((await submit(a.id, 'blank')).status).toBe(200)
    expect(await rows(a.id)).toHaveLength(0)
  })

  it('the sweeper auto_submit writes the rows of the saved answers; a late sync re-grades them in place (still one row per question)', async () => {
    const a = await start()
    const [q1, q2] = a.mcq as [string, string]
    const saved = await student.put(`/api/bijak/attempts/${a.id}/answers`, { changes: [change(q1, wrongOf(q1))] })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    const deadline = t.clock.now().getTime()
    t.clock.advance(3 * 3600_000) // far past deadline + grace
    expect(await t.app.get(AttemptSweeper).sweep()).toBeGreaterThanOrEqual(1)
    const swept = await rows(a.id)
    expect(swept).toHaveLength(1)
    expect(swept[0]).toMatchObject({ question_id: q1, mode: 'simulasi', is_correct: false })

    // a late sync (saved before the deadline, within 24 h) fixes q1 and adds q2
    const again = await loginAs(t, STUDENT) // the session cookie did not outlive the clock jump
    const late = await again.put(`/api/bijak/attempts/${a.id}/answers`, {
      changes: [change(q1, correct.get(q1)!, 2, new Date(deadline).toISOString()), change(q2, correct.get(q2)!, 1, new Date(deadline).toISOString())],
    })
    expect(late.status, JSON.stringify(late.body)).toBe(200)
    expect(late.body.data.regraded).toBe(true)
    const after = await rows(a.id)
    expect(after).toHaveLength(2)
    expect(after.every((r) => r.is_correct && r.mode === 'simulasi')).toBe(true)
  })
})
