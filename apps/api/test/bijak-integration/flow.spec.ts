/**
 * Bijak integration (BE-15 papers, BE-16 attempts, BE-12 aggregate, BE-11 wallet) on the REAL wiring of
 * `BijakIntegrationModule`: no port is plugged by the test.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema, BijakPaperSummarySchema } from '@pp/contract'

import { PracticeAggregateService } from '../../src/modules/practice/aggregate'
import { POC_BANK, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import { ADMIN, bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT, TEACHER } from './helpers'

const SOURCE = 'quiz_spm'
const T0 = new Date(START).getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const ELAPSED_SEC = 613

let t: IntegrationApp
let student: Client
let admin: Client
let teacher: Client
let aggregate: PracticeAggregateService

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  admin = await loginAs(t, ADMIN, true)
  teacher = await loginAs(t, TEACHER)
  aggregate = t.app.get(PracticeAggregateService)
})
afterAll(async () => {
  await t.close()
})

/** MCQ correct choice by the reserved question id (the PoC scheme). */
const correctByQuestionId = new Map<string, string>()
for (const q of POC_BANK.questions) {
  if (!q.mcq) continue
  const s = POC_BANK.schemes.find((x) => x.id === q.id)?.scheme as { kind: string; correct?: string } | undefined
  if (s?.kind === 'option' && s.correct) correctByQuestionId.set(pocQuestionId(q.id).toString(), s.correct)
}

async function paperId(c: Client, code: string, kertas: number): Promise<{ id: string; subject: string }> {
  const res = await c.get('/api/bijak/papers')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const list = (res.body.data as unknown[]).map((p) => BijakPaperSummarySchema.parse(p))
  expect(list.length).toBeGreaterThan(0)
  const p = list.find((x) => x.code === code && x.kertas === kertas)
  if (!p) throw new Error(`paper ${code} not listed`)
  return { id: p.id, subject: p.subject }
}

async function start(c: Client, id: string, mode: 'exam' | 'latihan') {
  const res = await c.post('/api/bijak/attempts', { paperId: id, mode })
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  const attemptId = (res.body as { data: { attemptId: string } }).data.attemptId
  const v = await c.get(`/api/bijak/attempts/${attemptId}`)
  expect(v.status, JSON.stringify(v.body)).toBe(200)
  return { attemptId, view: BijakAttemptPaperViewSchema.parse(v.body.data), raw: JSON.stringify(v.body) }
}

/** Saves the correct answer of the first MCQ of the paper; returns its question id. */
async function answerOne(c: Client, attemptId: string, questionIds: string[]): Promise<string> {
  const qid = questionIds.find((q) => correctByQuestionId.has(q))
  if (!qid) throw new Error('no PoC MCQ in the paper')
  const res = await c.put(`/api/bijak/attempts/${attemptId}/answers`, {
    changes: [{ partId: qid, answer: { choice: correctByQuestionId.get(qid)! }, rev: 1, savedAt: t.clock.now().toISOString() }],
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return qid
}

const submit = (c: Client, attemptId: string, key: string) => c.post(`/api/bijak/attempts/${attemptId}/submit`, { idempotencyKey: key, changes: [] })
const result = async (c: Client, attemptId: string) => {
  const res = await c.get(`/api/bijak/attempts/${attemptId}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data)
}
const aggRows = (attemptId: string) => t.db.query('select * from practice_attempt_aggregates where attempt_id = $1', [attemptId])
const ledgerRows = (attemptId: string) => t.db.query('select * from coin_ledger where source = $1 and source_id = $2', [SOURCE, attemptId])
const balance = async (userId: string) => Number((await t.db.query('select current_syiling from wallets where user_id = $1', [userId]))[0]?.current_syiling ?? 0)
const xpOf = async (userId: string) => Number((await t.db.query('select xp from wallets where user_id = $1', [userId]))[0]?.xp ?? 0)

describe('exam flow (student)', () => {
  let attemptId = ''
  let paper = { id: '', subject: '' }
  let startedAt = 0
  let before = 0
  let xpBefore = 0
  let streakDays = 0
  let points = 0
  let score = 0
  let max = 0
  let coins = 0

  it('1. lists papers, starts an exam, autosaves a correct MCQ, submits, and the result scores above zero', async () => {
    paper = await paperId(student, '1449/1', 1)
    before = await balance(student.userId)
    xpBefore = await xpOf(student.userId)
    const s = await start(student, paper.id, 'exam')
    attemptId = s.attemptId
    startedAt = t.clock.now().getTime()
    expect(startedAt).toBe(T0)
    expect(s.view.attempt.mode).toBe('exam')
    for (const k of ['correct', 'scheme', 'correctOption', 'explanation', 'rubric']) expect(s.raw).not.toContain(`"${k}"`)

    const questionIds = s.view.questions.map((q) => q.id)
    const qid = await answerOne(student, attemptId, questionIds)
    t.clock.set(iso(T0 + ELAPSED_SEC * 1000))
    const res = await submit(student, attemptId, 'integ-key-1')
    expect(res.status, JSON.stringify(res.body)).toBe(200)

    const r = await result(student, attemptId)
    expect(r.attempt.status).toBe('submitted')
    expect(r.result.score).toBeGreaterThan(0)
    expect(r.result.questions.find((q) => q.questionId === qid)?.awarded).toBeGreaterThan(0)
    score = r.result.score
    max = r.result.max
    coins = r.result.coins
    points = r.result.points
    expect(coins).toBeGreaterThan(0)
  })

  it('2. writes exactly one aggregate row with subject, kertas, marks, start type, duration and is_test false', async () => {
    const rows = await aggRows(attemptId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'bijak',
      user_id: student.userId,
      paper_id: paper.id,
      subject_code: paper.subject,
      kertas: 1,
      mode: 'exam',
      status: 'submitted',
      start_type: 'pilihan',
      duration_sec: ELAPSED_SEC,
      is_test: false,
    })
    expect(Number(rows[0]!.units_awarded)).toBe(score)
    expect(Number(rows[0]!.units_max)).toBe(max)
    expect(new Date(rows[0]!.started_at as string).getTime()).toBe(startedAt)
    expect(new Date(rows[0]!.submitted_at as string).getTime()).toBe(T0 + ELAPSED_SEC * 1000)
  })

  it('3. credits the wallet once: one quiz_spm ledger row with the result coins, is_test false, balance up by that amount', async () => {
    const rows = await ledgerRows(attemptId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_id: student.userId, amount: coins, is_test: false, type: 'earn' })
    expect(await balance(student.userId)).toBe(before + coins)
  })

  it('3b. adds the XP of the result once (10 per mark) and touches the streak (kombo)', async () => {
    expect(points).toBe(Math.floor(score * 10))
    expect(await xpOf(student.userId)).toBe(xpBefore + points)
    const streak = (await t.db.query<{ current: number }>('select current from streaks where user_id = $1', [student.userId]))[0]
    expect(streak?.current).toBeGreaterThanOrEqual(1)
    streakDays = streak!.current
  })

  it('4. replaying the submit (same key, then another key) is a replay: one ledger row, same balance, one aggregate row', async () => {
    const balanceBefore = await balance(student.userId)
    for (const key of ['integ-key-1', 'integ-key-replay']) {
      const res = await submit(student, attemptId, key)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ attemptId, closed: true })
    }
    expect(await ledgerRows(attemptId)).toHaveLength(1)
    expect(await balance(student.userId)).toBe(balanceBefore)
    expect(await aggRows(attemptId)).toHaveLength(1)
    expect(await xpOf(student.userId)).toBe(xpBefore + points)
    expect((await t.db.query<{ current: number }>('select current from streaks where user_id = $1', [student.userId]))[0]?.current).toBe(streakDays)
    const r = await result(student, attemptId)
    expect(r.result.score).toBe(score)
  })
})

describe('latihan (practice mode)', () => {
  it('5. writes an aggregate row but no ledger credit', async () => {
    const paper = await paperId(student, '1449/1', 1)
    const before = await balance(student.userId)
    const xp0 = await xpOf(student.userId)
    const s = await start(student, paper.id, 'latihan')
    expect(s.view.attempt.mode).toBe('latihan')
    await answerOne(student, s.attemptId, s.view.questions.map((q) => q.id))
    const res = await submit(student, s.attemptId, 'integ-latihan')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const r = await result(student, s.attemptId)
    expect(r.result.score).toBeGreaterThan(0)

    const rows = await aggRows(s.attemptId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ mode: 'latihan', start_type: 'pilihan', is_test: false })
    expect(Number(rows[0]!.units_awarded)).toBe(r.result.score)
    expect(await t.db.query('select 1 from coin_ledger where source_id = $1', [s.attemptId])).toHaveLength(0)
    expect(await balance(student.userId)).toBe(before)
    expect(await xpOf(student.userId)).toBe(xp0)
  })
})

describe('Mod Pelajar (admin in student mode)', () => {
  it('6. flags the attempt and aggregate is_test, credits NO reward (AC-20.3) and keeps them out of the shared aggregate reads', async () => {
    const paper = await paperId(admin, '1449/1', 1)
    const adminBefore = await balance(admin.userId)
    const adminXpBefore = await xpOf(admin.userId)
    const s = await start(admin, paper.id, 'exam')
    await answerOne(admin, s.attemptId, s.view.questions.map((q) => q.id))
    const res = await submit(admin, s.attemptId, 'integ-admin')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const r = await result(admin, s.attemptId)
    expect(r.result.score).toBeGreaterThan(0)

    const attempts = await t.db.query('select is_test from exam_attempts where id = $1', [s.attemptId])
    expect(attempts).toEqual([{ is_test: true }])
    const agg = await aggRows(s.attemptId)
    expect(agg).toHaveLength(1)
    expect(agg[0]).toMatchObject({ is_test: true, user_id: admin.userId })
    // AC-20.3: Mod Pelajar earns no rewards: no ledger row of any source, no balance change
    expect(await t.db.query('select 1 from coin_ledger where source_id = $1', [s.attemptId])).toHaveLength(0)
    expect(await balance(admin.userId)).toBe(adminBefore)
    expect(await xpOf(admin.userId)).toBe(adminXpBefore)

    expect(await aggregate.forStudents({ userIds: [admin.userId] })).toEqual([])
    expect(await aggregate.subjectSummary({ userIds: [admin.userId] })).toEqual([])
    expect(await aggregate.itemStats({ userIds: [admin.userId] })).toEqual([])
    // the student rows of the earlier tests are visible, the admin row is not
    const shared = await aggregate.forStudents({ userIds: [student.userId, admin.userId] })
    expect(shared.length).toBeGreaterThan(0)
    expect(shared.every((x) => x.userId === student.userId)).toBe(true)
    expect(shared.map((x) => x.attemptId)).not.toContain(s.attemptId)
    // the owner still sees it in their own history
    expect((await aggregate.ownHistory(admin.userId)).map((x) => x.attemptId)).toContain(s.attemptId)
  })
})

describe('roles', () => {
  it('7. a guru gets 403 on the paper list and on starting an attempt', async () => {
    const list = await teacher.get('/api/bijak/papers')
    expect(list.status, JSON.stringify(list.body)).toBe(403)
    const paper = await paperId(student, '1449/1', 1)
    const startRes = await teacher.post('/api/bijak/attempts', { paperId: paper.id, mode: 'exam' })
    expect(startRes.status, JSON.stringify(startRes.body)).toBe(403)
    expect(await t.db.query('select 1 from exam_attempts where user_id = $1', [teacher.userId])).toHaveLength(0)
  })
})
