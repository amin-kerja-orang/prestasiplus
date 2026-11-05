/**
 * S3-T04 part 9 (FR-PA-17, AC-PA-08 rows, API-BIJAK-06, DM-44): the Kuiz writes its answer rows through the one `AnswerLogPort` with mode
 * `kuiz` while the session stays `latih_tubi` / `legacy_paper = 'bijak_kuiz'`. Finish (200 again on a second call), the 2 h idle sweep
 * (rows kept, session `abandoned`, nothing paid) and the per-paper check [PROPOSED]. Real wiring, rows read from the database.
 */
import { BijakKuizResultSchema, BijakKuizSessionSchema, type BijakKuizItem } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AttemptSweeper } from '../../src/modules/bijak/attempts/attempt-sweeper'
import { paperKuizAttemptId } from '../../src/modules/bijak/kuiz/kuiz.service'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from '../bijak-integration/helpers'

process.env.THROTTLE_BIJAK_KUIZ_START_PER_MINUTE = '100'

let t: IntegrationApp
let student: Client
const ids = new Map<string, string>()
const id = (ref: string): string => ids.get(ref)!

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  const rows = await t.db.query<{ id: string; ref: string }>(
    `select q.id::text as id, v.number_label as ref from questions q
       join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no
      where v.number_label like 'SEED-%'`,
  )
  for (const r of rows) ids.set(r.ref, r.id)
}, 180_000)
afterAll(async () => {
  await t.close()
})

async function keyOf(questionId: string): Promise<string> {
  const rows = await t.db.query<{ correct: string }>(
    `select k.content->>'correct' as correct from answer_keys k join question_parts p on p.id = k.part_id
       join questions q on q.id = $1::bigint join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no and v.id = p.question_version_id
      where p.mode = 'mcq'`,
    [questionId],
  )
  return rows[0]!.correct
}
const wrongLabel = (item: BijakKuizItem, correct: string): string => item.options.find((o) => o.id !== correct)!.id

async function startQuiz(who: Client, subject = 'BM', count = 5): Promise<{ sessionId: string; items: BijakKuizItem[] }> {
  const res = await who.post('/api/bijak/kuiz/sessions', { subject, count })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return BijakKuizSessionSchema.parse(res.body.data)
}
/** Checks the first `right` items correctly and the next `wrong` items wrongly. */
async function check(who: Client, s: { sessionId: string; items: BijakKuizItem[] }, right: number, wrong: number): Promise<void> {
  for (const [i, item] of s.items.slice(0, right + wrong).entries()) {
    const key = await keyOf(item.id)
    const res = await who.post(`/api/bijak/kuiz/sessions/${s.sessionId}/check`, { itemId: item.id, optionId: i < right ? key : wrongLabel(item, key) })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  }
}
const answerRows = (attemptId: string) =>
  t.db.query<{ question_id: string; mode: string; is_correct: boolean; session_id: string | null; selected_label: string | null }>(
    `select question_id::text, mode, is_correct, session_id::text, selected_label from practice_answers where attempt_id = $1::uuid order by id`,
    [attemptId],
  )
const session = async (sid: string) =>
  (await t.db.query<{ status: string; mode: string; legacy_paper: string | null; coins_earned: number; points_earned: number; completed_at: Date | null }>(
    `select status, mode, legacy_paper, coins_earned, points_earned, completed_at from practice_sessions where id = $1::uuid`,
    [sid],
  ))[0]!
const paid = async (sid: string) => ({
  credits: (await t.db.query(`select 1 from session_credits where session_id = $1::uuid`, [sid])).length,
  ledger: (await t.db.query(`select 1 from coin_ledger where source_id = $1`, [sid])).length,
})

describe('random Kuiz finish writes mode kuiz rows (FR-PA-17)', () => {
  it('rows are mode kuiz with the session as attempt, the session stays latih_tubi / bijak_kuiz, and a second finish is 200 with the same result', async () => {
    const s = await startQuiz(student)
    await check(student, s, 1, 1)
    const res = await student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/finish`, { timeSpent: 30 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const first = BijakKuizResultSchema.parse(res.body.data)
    expect(first).toMatchObject({ score: 1, answered: 2 })

    const rows = await answerRows(s.sessionId)
    expect(rows.map((r) => [r.question_id, r.mode, r.is_correct, r.session_id])).toEqual([
      [s.items[0]!.id, 'kuiz', true, s.sessionId],
      [s.items[1]!.id, 'kuiz', false, s.sessionId],
    ])
    expect(await session(s.sessionId)).toMatchObject({ status: 'completed', mode: 'latih_tubi', legacy_paper: 'bijak_kuiz' })
    expect((await t.db.query(`select 1 from practice_answers where session_id = $1::uuid and mode <> 'kuiz'`, [s.sessionId])).length).toBe(0)

    const before = { paid: await paid(s.sessionId), wallet: await t.db.query(`select current_syiling, xp from wallets where user_id = $1::bigint`, [student.userId]) }
    const again = await student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/finish`, {})
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(BijakKuizResultSchema.parse(again.body.data)).toMatchObject({ score: first.score, total: first.total, answered: first.answered })
    expect(await answerRows(s.sessionId)).toEqual(rows)
    expect({ paid: await paid(s.sessionId), wallet: await t.db.query(`select current_syiling, xp from wallets where user_id = $1::bigint`, [student.userId]) }).toEqual(before)
    // a Latih Tubi session that is not a kuiz is still 404 on a second finish
    const other = await t.db.query<{ id: string }>(`select id::text from practice_sessions where legacy_paper is distinct from 'bijak_kuiz' and status <> 'in_progress' limit 1`)
    if (other[0]) expect((await student.post(`/api/bijak/kuiz/sessions/${other[0].id}/finish`, {})).status).toBe(404)
  })
})

describe('Kuiz idle sweep (API-BIJAK-06, P-5)', () => {
  it('closes only a kuiz session idle for more than 2 h: rows kept as kuiz, status abandoned, nothing paid; a later finish is 200 and pays nothing', async () => {
    const idle = await startQuiz(student)
    await check(student, idle, 1, 1)
    const fresh = await startQuiz(student, 'MATH', 3)
    t.clock.advance(60 * 60_000)
    await check(student, fresh, 1, 0) // activity on this session after 1 h
    t.clock.advance(61 * 60_000) // idle: 2 h 1 min since its last check; fresh: 1 h 1 min
    const walletBefore = await t.db.query(`select current_syiling, xp from wallets where user_id = $1::bigint`, [student.userId])

    expect(await t.app.get(AttemptSweeper).sweep()).toBe(1)
    expect(await session(idle.sessionId)).toMatchObject({ status: 'abandoned', mode: 'latih_tubi', legacy_paper: 'bijak_kuiz', coins_earned: 0, points_earned: 0, completed_at: null })
    expect((await answerRows(idle.sessionId)).map((r) => [r.question_id, r.mode, r.is_correct])).toEqual([
      [idle.items[0]!.id, 'kuiz', true],
      [idle.items[1]!.id, 'kuiz', false],
    ])
    expect(Number((await t.db.query(`select count(*) n from practice_checks where session_id = $1::uuid`, [idle.sessionId]))[0]!.n)).toBe(2) // checks kept
    expect(await paid(idle.sessionId)).toEqual({ credits: 0, ledger: 0 })
    expect(await t.db.query(`select current_syiling, xp from wallets where user_id = $1::bigint`, [student.userId])).toEqual(walletBefore)
    expect((await session(fresh.sessionId)).status).toBe('in_progress')
    expect(await answerRows(fresh.sessionId)).toHaveLength(0)

    // a second pass changes nothing
    expect(await t.app.get(AttemptSweeper).sweep()).toBe(0)
    expect(await answerRows(idle.sessionId)).toHaveLength(2)

    // a later finish: 200, the stored result, nothing paid
    const me = await loginAs(t, STUDENT) // the cookie did not outlive the clock jump
    const res = await me.post(`/api/bijak/kuiz/sessions/${idle.sessionId}/finish`, {})
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(BijakKuizResultSchema.parse(res.body.data)).toMatchObject({ score: 1, answered: 2, gamification: { coinsEarned: 0, pointsEarned: 0 } })
    expect(await paid(idle.sessionId)).toEqual({ credits: 0, ledger: 0 })
    expect((await session(idle.sessionId)).status).toBe('abandoned')
  })

  it('heals a kuiz session the practice sweeper already abandoned (checks kept, no rows)', async () => {
    const s = await startQuiz(student)
    await check(student, s, 2, 0)
    await t.db.query(`update practice_sessions set status = 'abandoned' where id = $1::uuid`, [s.sessionId])
    expect(await answerRows(s.sessionId)).toHaveLength(0)
    expect(await t.app.get(AttemptSweeper).sweep()).toBe(1)
    expect((await answerRows(s.sessionId)).map((r) => r.mode)).toEqual(['kuiz', 'kuiz'])
    expect(await t.app.get(AttemptSweeper).sweep()).toBe(0)
  })
})

describe('per-paper Kuiz check writes a kuiz row [PROPOSED]', () => {
  it('one row per pupil, paper and question on a deterministic attempt id; a re-check updates it', async () => {
    const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
    const paper = await t.db.prisma.paper.create({
      data: {
        kind: 'pilihan',
        title: 'Kuiz kertas baris',
        subjectId: subject.id,
        kertas: 1,
        paperCode: '1449/1',
        printedDurationMin: 60,
        status: 'published',
        publishedAt: new Date(START),
        sections: { create: [{ position: 1, label: 'A', instruction: null, questionCount: 1, markBudget: 0, placements: { create: [{ questionId: BigInt(id('SEED-MCQ-MATH-T4')), position: 1 }] } }] },
      },
    })
    const paperId = paper.id.toString()
    const q = id('SEED-MCQ-MATH-T4')
    const key = await keyOf(q)
    const attemptId = paperKuizAttemptId(student.userId, paperId)
    const wrong = ['A', 'B', 'C', 'D'].find((l) => l !== key)!

    expect((await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: q, optionId: wrong })).status).toBe(200)
    expect((await answerRows(attemptId)).map((r) => [r.question_id, r.mode, r.is_correct, r.session_id, r.selected_label])).toEqual([[q, 'kuiz', false, null, wrong]])
    expect((await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: q, optionId: key })).status).toBe(200)
    expect((await answerRows(attemptId)).map((r) => [r.is_correct, r.selected_label])).toEqual([[true, key]])
    // no session, check or revision row is created by a paper kuiz
    expect((await t.db.query(`select 1 from practice_sessions where id = $1::uuid`, [attemptId])).length).toBe(0)
  })
})
