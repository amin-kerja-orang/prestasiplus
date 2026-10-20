/**
 * BE-16 attempts: HTTP port of the mock `BijakServer` tests. Mock test -> API test:
 *
 * | mock test (server.test.ts / server-late.test.ts)                     | here                                    |
 * | serves a paper without keys and refuses the result before submit     | "reveal rules" 1, 2, 3                  |
 * | reveals the scheme per question in Latihan only after Semak          | "reveal rules" 4                        |
 * | keeps one student from reading another student attempt               | "ownership"                             |
 * | counts an answer that was typed but never autosaved                  | "submit" 1                              |
 * | is idempotent: a repeat records one submission and the same result   | "submit" 2, 3                           |
 * | never lets an older revision overwrite a newer saved one             | "autosave" 1                            |
 * | ignores parts that are not in the served composition                 | "autosave" 2                            |
 * | stores a server deadline and accepts a late submit                   | "timer" 1, 2                            |
 * | closes an unattended attempt from the last saved answers             | "timer" 3 (sweeper), 4 (on access)      |
 * | has no deadline in Latihan                                           | "timer" 5                               |
 * | offers resume, restart abandons the old sitting                      | "start and resume"                      |
 * | choose-N, structured Matematik K2, provisional                       | golden.spec.ts                          |
 * | closes at deadline plus grace, caps lateness, says closed on save    | "late sync" 1                           |
 * | accepts answers saved before the deadline, grades again              | "late sync" 2                           |
 * | refuses answers stamped after the deadline / device clock in future  | "late sync" 3                           |
 * | stops late sync after 24 hours                                       | "late sync" 4                           |
 * | a submit after the sweep reports closed, carries early answers       | "late sync" 5                           |
 * | a submitted attempt says closed and is not changed by a later save   | "late sync" 6                           |
 * | offline resubmit records one submission                              | "submit" 3                              |
 * | no answer key leaves the server before submit (3 papers)             | "reveal rules" 1                        |
 * | locks a question after three checks (Latihan cap)                    | "latihan Semak"                         |
 */
import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BijakAttemptHistoryRowSchema,
  BijakAttemptInProgressSchema,
  BijakAttemptPaperViewSchema,
  BijakAttemptQuestionResultSchema,
  BijakAttemptResultViewSchema,
  BijakAttemptSaveResultSchema,
  BijakAttemptSubmitResultSchema,
} from '@pp/contract'

import { BANK } from '../../../../src/modules/m28-bijak-spm/data/registry'
import { leavesOf } from '../../src/modules/bijak/attempts/exam-core.adapter'
import {
  ADMIN,
  SCHOOL_ADMIN,
  allKeys,
  type AttemptsTestApp,
  bootAttemptsApp,
  change,
  type Client,
  correctChoice,
  expectError,
  loginAs,
  MIN,
  OTHER_STUDENT,
  PAPER,
  questionIdsOfView,
  START,
  startAttempt,
  STUDENT,
  TEACHER,
} from './helpers'

const GRACE = 300
const iso = (ms: number) => new Date(ms).toISOString()
const T0 = new Date(START).getTime()

let t: AttemptsTestApp
let me: Client
let other: Client

beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
  other = await loginAs(t, OTHER_STUDENT)
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  t.clock.set(START)
  await t.db.query('truncate exam_attempts cascade')
  t.reward.calls.length = 0
  t.aggregate.calls.length = 0
  t.reward.fail = false
})

const view = async (c: Client, id: string) => {
  const res = await c.get(`/api/bijak/attempts/${id}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptPaperViewSchema.parse(res.body.data)
}
const result = async (c: Client, id: string) => {
  const res = await c.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data)
}
const save = (c: Client, id: string, body: object) => c.put(`/api/bijak/attempts/${id}/answers`, body)
const submit = (c: Client, id: string, body: object) => c.post(`/api/bijak/attempts/${id}/submit`, body)

/** Keys of the mark scheme must never be a JSON key in anything served before the reveal. */
const SCHEME_KEYS = ['correctOption', 'correctLetter', 'acceptedText', 'scheme', 'rubric', 'explanation', 'finalDisplay', 'tolerance', 'reason', 'accept', 'correct', 'model', 'points', 'mustContain']

function schemeStrings(qids: string[]): string[] {
  const out: string[] = []
  for (const qid of qids) {
    const q = BANK.questions.get(qid)!
    const ids = q.mcq ? [q.id] : leavesOf(q.parts ?? []).map((l) => l.id)
    for (const id of ids) {
      const s = BANK.schemes.get(id)!
      const texts = s.kind === 'option' ? [s.reason] : s.kind === 'points' ? [s.model, s.final?.display] : s.kind === 'rubric' ? s.notes ?? [] : []
      for (const x of texts) if (x && x.length >= 15) out.push(JSON.stringify(x).slice(1, -1))
    }
  }
  return out
}

describe('reveal rules (US-15, AC3)', () => {
  it.each([PAPER.matK2, PAPER.sainsK2, PAPER.matK1, PAPER.sejK2])('1. paper %s: no key, scheme or scheme text in the view, the start answer or any PUT response', async (paperId) => {
    const id = await startAttempt(me, paperId, 'exam')
    const v = await view(me, id)
    const qids = questionIdsOfView(v)
    const put = await save(me, id, { changes: [change(qids[0]!, { choice: 'x' })] })
    const bodies = [JSON.stringify(v), JSON.stringify(put.body)]
    for (const body of bodies) {
      const keys = allKeys(JSON.parse(body))
      for (const k of SCHEME_KEYS) expect(keys.has(k), k).toBe(false)
      for (const text of schemeStrings(qids)) expect(body).not.toContain(text)
    }
    expect(v.checks).toEqual([])
  })

  it('2. the result is refused before submit with 409 NOT_SUBMITTED', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    expectError(await me.get(`/api/bijak/attempts/${id}/result`), 'NOT_SUBMITTED', 'Skema hanya didedahkan selepas Hantar')
  })

  it('3. "Semak" in exam mode is 403 with the exact message and reveals nothing', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    const q = questionIdsOfView(await view(me, id))[0]!
    const res = await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, {})
    expectError(res, 'FORBIDDEN', 'Skema hanya didedahkan selepas Hantar')
    expect(JSON.stringify(res.body)).not.toContain('correct')
  })

  it('4. latihan: the scheme of ONE question appears only after its Semak, and stays in the view', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const v0 = await view(me, id)
    expect(v0.checks).toHaveLength(0)
    const [q, q2] = questionIdsOfView(v0) as [string, string]
    const res = await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, { changes: [change(q, { choice: correctChoice(q) })] })
    expect(res.status).toBe(200)
    const r = BijakAttemptQuestionResultSchema.parse(res.body.data)
    expect(r.awarded).toBe(1)
    expect(r.parts[0]!.scheme.correctOption).toBe(correctChoice(q))
    const v1 = await view(me, id)
    expect(v1.checks.map((c) => c.questionId)).toEqual([q])
    // the other question stays closed
    expect(JSON.stringify(v1.questions.find((x) => x.id === q2))).not.toContain(correctChoice(q2) + '"correct')
    expect(v1.attempt.checked).toEqual([q])
    expect(v1.attempt.checkCounts).toEqual({ [q]: 1 })
  })

  it('5. a submitted attempt GET view still carries no scheme (only /result does)', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    await submit(me, id, { idempotencyKey: 'k', changes: [] })
    const v = await view(me, id)
    const keys = allKeys(v)
    for (const k of SCHEME_KEYS) expect(keys.has(k), k).toBe(false)
    expect(v.checks).toEqual([])
    const r = await result(me, id)
    expect(allKeys(r).has('correctOption')).toBe(true)
  })
})

describe('start and resume (AC-12.x)', () => {
  it('offers resume, returns the same sitting without restart, and restart abandons the old one', async () => {
    const first = await me.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam' })
    expect(first.status).toBe(201)
    const id1 = first.body.data.attemptId as string
    expect(id1).toMatch(/^[0-9a-f-]{36}$/)
    let info = BijakAttemptInProgressSchema.parse((await me.get(`/api/bijak/papers/${PAPER.matK1}/in-progress`)).body.data)
    expect(info).toMatchObject({ attemptId: id1, fresh: true, mode: 'exam', elapsedSeconds: 0 })
    t.clock.advance(5 * MIN)
    info = BijakAttemptInProgressSchema.parse((await me.get(`/api/bijak/papers/${PAPER.matK1}/in-progress`)).body.data)
    expect(info).toMatchObject({ attemptId: id1, fresh: false, elapsedSeconds: 300 })
    const again = await me.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam' })
    expect(again.status).toBe(200)
    expect(again.body.data.attemptId).toBe(id1)
    const second = await me.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam', restart: true })
    expect(second.status).toBe(201)
    expect(second.body.data.attemptId).not.toBe(id1)
    const rows = (await me.get('/api/bijak/history')).body.data as { attemptId: string; status: string }[]
    expect(rows.find((r) => r.attemptId === id1)!.status).toBe('abandoned')
    expect(rows.find((r) => r.attemptId === second.body.data.attemptId)!.status).toBe('in_progress')
  })

  it('no open attempt: in-progress is { data: null }; an unknown paper is 404 "Kertas tidak ditemui"; a malformed paper id too', async () => {
    expect((await me.get(`/api/bijak/papers/${PAPER.matK1}/in-progress`)).body).toEqual({ data: null })
    expect((await me.get('/api/bijak/papers/not-a-number/in-progress')).body).toEqual({ data: null })
    expectError(await me.post('/api/bijak/attempts', { paperId: '555', mode: 'exam' }), 'NOT_FOUND', 'Kertas tidak ditemui')
    expectError(await me.post('/api/bijak/attempts', { paperId: 'abc', mode: 'exam' }), 'NOT_FOUND', 'Kertas tidak ditemui')
  })

  it('a paper the caller may not sit is 403; an invalid body is 422', async () => {
    expectError(await me.post('/api/bijak/attempts', { paperId: PAPER.notEligible, mode: 'exam' }), 'FORBIDDEN')
    expectError(await me.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'sprint' }), 'VALIDATION_ERROR')
    expectError(await me.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam', extra: 1 }), 'VALIDATION_ERROR')
  })

  it('two simultaneous starts create one sitting', async () => {
    const [a, b] = await Promise.all([
      me.post('/api/bijak/attempts', { paperId: PAPER.matK2, mode: 'exam' }),
      me.post('/api/bijak/attempts', { paperId: PAPER.matK2, mode: 'exam' }),
    ])
    expect(a.body.data.attemptId).toBe(b.body.data.attemptId)
    expect([a.status, b.status].sort()).toEqual([200, 201])
  })

  it('freezes the composition and snapshots the paper (title, subject, code) in the attempt', async () => {
    const id = await startAttempt(me, PAPER.matK2, 'exam')
    const rows = await t.db.query<{ title: string; subject: string; paper_code: string; composition: unknown[]; paper_id: string; is_test: boolean }>(
      'select title, subject, paper_code, composition, paper_id::text, is_test from exam_attempts where id = $1',
      [id],
    )
    expect(rows[0]).toMatchObject({ subject: 'MAT', paper_code: '1449/2', paper_id: PAPER.matK2, is_test: false })
    expect(rows[0]!.composition).toHaveLength(3)
  })
})

describe('autosave (AC2, per-part revision)', () => {
  it('1. never lets an older (or equal) revision overwrite a newer saved one', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const q = questionIdsOfView(await view(me, id))[0]!
    await save(me, id, { changes: [change(q, { choice: 'B' }, 3)] })
    await save(me, id, { changes: [change(q, { choice: 'A' }, 2)] })
    await save(me, id, { changes: [change(q, { choice: 'C' }, 3)] })
    const v = await view(me, id)
    expect(v.attempt.answers[q]).toMatchObject({ answer: { choice: 'B' }, rev: 3 })
  })

  it('2. ignores parts that are not in the served composition; flags, picks and position replace the stored values', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const q = questionIdsOfView(await view(me, id))[0]!
    const res = await save(me, id, {
      changes: [change('sn2-osmosis-a', { text: 'x' }), change(q, { choice: 'A' })],
      flags: [q],
      picks: { s1: [q] },
      position: 4,
    })
    expect(BijakAttemptSaveResultSchema.parse(res.body.data)).toEqual({ savedAt: iso0(res.body.data.savedAt) })
    const v = await view(me, id)
    expect(Object.keys(v.attempt.answers)).toEqual([q])
    expect(v.attempt).toMatchObject({ flags: [q], picks: { s1: [q] }, position: 4 })
  })

  it('3. the device clock never moves the stored save time into the future', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const q = questionIdsOfView(await view(me, id))[0]!
    t.clock.advance(2 * MIN)
    await save(me, id, { changes: [change(q, { choice: 'A' }, 1, '2999-01-01T00:00:00Z')] })
    const rows = await t.db.query<{ saved_at: Date }>('select saved_at from attempt_answers where part_id = $1', [q])
    expect(rows[0]!.saved_at.getTime()).toBe(T0 + 2 * MIN)
  })

  it('4. an attempt that is not the caller\'s, or unknown, or malformed: 403 / 404', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    expectError(await save(other, id, { changes: [] }), 'FORBIDDEN', 'Akses ditolak')
    expectError(await save(me, '00000000-0000-4000-8000-000000000000', { changes: [] }), 'NOT_FOUND', 'Percubaan tidak ditemui')
    expectError(await save(me, 'not-a-uuid', { changes: [] }), 'NOT_FOUND', 'Percubaan tidak ditemui')
  })

  it('5. caps: too many changes, an over-long answer and an int4-overflowing rev are 422', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    const p = 'mat2-segitiga-v1-q1-a'
    expectError(await save(me, id, { changes: Array.from({ length: 301 }, (_, i) => change(`p${i}`, { choice: 'A' })) }), 'VALIDATION_ERROR')
    expectError(await save(me, id, { changes: [change(p, { text: 'x'.repeat(8001) })] }), 'VALIDATION_ERROR')
    expectError(await save(me, id, { changes: [change(p, { final: '1'.repeat(1001) })] }), 'VALIDATION_ERROR')
    expectError(await save(me, id, { changes: [change(p, { choice: 'A' }, 2_000_000_001)] }), 'VALIDATION_ERROR')
    expectError(await save(me, id, { changes: [], position: 1_000_000 }), 'VALIDATION_ERROR')
  })
})

describe('submit (AC6, idempotency)', () => {
  it('1. grades the union of saved and carried answers (AC-13.2)', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const [q1, q2] = questionIdsOfView(await view(me, id)) as [string, string]
    await save(me, id, { changes: [change(q1, { choice: correctChoice(q1) })] })
    const res = await submit(me, id, {
      idempotencyKey: 'k1',
      changes: [],
      answers: { [q2]: { answer: { choice: correctChoice(q2) }, rev: 1, savedAt: START } },
    })
    expect(BijakAttemptSubmitResultSchema.parse(res.body.data)).toEqual({ attemptId: id, late: 0 })
    const r = await result(me, id)
    expect(r.result.score).toBe(2)
    expect(r.result.max).toBe(10)
    expect(r.attempt.status).toBe('submitted')
    expect(r.attempt.idempotencyKey).toBe('k1')
    expect(r.paper.checks).toEqual([])
  })

  it('2. a replay records one submission and the same result; the stored result is not recomputed', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const payload = { idempotencyKey: 'same', changes: [] }
    const first = await submit(me, id, payload)
    const a = await result(me, id)
    const again = await submit(me, id, { ...payload, answers: { x: { answer: { choice: 'y' }, rev: 9, savedAt: START } } })
    expect(again.status).toBe(200)
    expect(again.body.data).toEqual({ ...first.body.data, closed: true })
    const b = await result(me, id)
    expect(b.result).toEqual(a.result)
    const rows = (await me.get('/api/bijak/history')).body.data as { status: string }[]
    expect(rows.filter((h) => h.status === 'submitted')).toHaveLength(1)
    expect(Number((await t.db.query('select count(*) n from attempt_results'))[0]!.n)).toBe(1)
    // reward and analytics fire once, for the first close only
    expect(t.reward.calls).toHaveLength(1)
    expect(t.aggregate.calls).toHaveLength(1)
  })

  it('3. two simultaneous submits with the same key produce ONE attempt_results row (row lock + primary key)', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const q = questionIdsOfView(await view(me, id))[0]!
    const body = { idempotencyKey: 'race', changes: [change(q, { choice: correctChoice(q) })] }
    const rs = await Promise.all([submit(me, id, body), submit(me, id, body), submit(me, id, body)])
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200])
    expect(rs.filter((r) => r.body.data.closed === true)).toHaveLength(2)
    expect(rs.map((r) => r.body.data.attemptId)).toEqual([id, id, id])
    expect(Number((await t.db.query('select count(*) n from attempt_results where attempt_id = $1', [id]))[0]!.n)).toBe(1)
    expect(t.reward.calls).toHaveLength(1)
    // the unique primary key is the last line of defence
    await expect(t.db.query(`insert into attempt_results (attempt_id, score, max_score, graded) values ($1, 0, 0, '{}')`, [id])).rejects.toThrow()
  })

  it('4. the client may submit with auto (zero time): status auto_submitted', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const v = await view(me, id)
    t.clock.set(iso(new Date(v.attempt.deadline!).getTime() - 5000)) // inside the 30 s tolerance
    await submit(me, id, { idempotencyKey: 'auto', changes: [], auto: true })
    expect((await result(me, id)).attempt.status).toBe('auto_submitted')
  })

  it('5. a failing reward port never fails the submit', async () => {
    t.reward.fail = true
    const id = await startAttempt(me, PAPER.matK1)
    const res = await submit(me, id, { idempotencyKey: 'k', changes: [] })
    expect(res.status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
  })

  it('5b. a throwing reward and aggregate port is logged at error level with the attemptId; the submit still succeeds', async () => {
    t.reward.fail = true
    const aggregate = t.aggregate
    const original = aggregate.recordGraded.bind(aggregate)
    aggregate.recordGraded = async () => {
      throw new Error('aggregate down')
    }
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      const id = await startAttempt(me, PAPER.matK1)
      const res = await submit(me, id, { idempotencyKey: 'k', changes: [] })
      expect(res.status).toBe(200)
      const errors = errorSpy.mock.calls.map((c) => String(c[0]))
      expect(errors.some((m) => m.includes('Reward port failed') && m.includes(id))).toBe(true)
      expect(errors.some((m) => m.includes('Aggregate port failed') && m.includes(id))).toBe(true)
      expect(warnSpy.mock.calls.map((c) => String(c[0])).some((m) => m.includes('port failed'))).toBe(false)
    } finally {
      errorSpy.mockRestore()
      warnSpy.mockRestore()
      aggregate.recordGraded = original
    }
  })

  it('5c. the aggregate input carries paperKind, startedAt and submittedAt (BE-12 start_type and duration_sec)', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    await submit(me, id, { idempotencyKey: 'k', changes: [] })
    const row = (await t.db.query<{ paper_kind: string; started_at: Date; submitted_at: Date }>('select paper_kind, started_at, submitted_at from exam_attempts where id = $1', [id]))[0]!
    const call = t.aggregate.calls.at(-1)!
    expect(call.paperKind).toBe(row.paper_kind)
    expect(call.startedAt?.getTime()).toBe(new Date(row.started_at).getTime())
    expect(call.submittedAt?.getTime()).toBe(new Date(row.submitted_at).getTime())
  })

  it('6. validation: idempotencyKey is required (1 to 64 characters)', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    expectError(await submit(me, id, { changes: [] }), 'VALIDATION_ERROR')
    expectError(await submit(me, id, { idempotencyKey: 'k'.repeat(65), changes: [] }), 'VALIDATION_ERROR')
  })

  it('7. abandon: in_progress becomes abandoned, 204; any other status changes nothing; no result', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    expect((await me.post(`/api/bijak/attempts/${id}/abandon`, {})).status).toBe(204)
    expect(((await me.get('/api/bijak/history')).body.data as { status: string }[])[0]!.status).toBe('abandoned')
    expect((await me.post(`/api/bijak/attempts/${id}/abandon`, {})).status).toBe(204)
    expectError(await me.get(`/api/bijak/attempts/${id}/result`), 'NOT_SUBMITTED')
    const id2 = await startAttempt(me, PAPER.matK1)
    await submit(me, id2, { idempotencyKey: 'x', changes: [] })
    expect((await me.post(`/api/bijak/attempts/${id2}/abandon`, {})).status).toBe(204)
    expect((await result(me, id2)).attempt.status).toBe('submitted')
    expectError(await other.post(`/api/bijak/attempts/${id2}/abandon`, {}), 'FORBIDDEN', 'Akses ditolak')
  })
})

describe('timer (AC2, AC-05.x)', () => {
  it('1. the deadline is the SERVER start plus the duration; serverNow is returned; the client clock moves nothing', async () => {
    const id = await startAttempt(me, PAPER.sainsK2)
    const v = await view(me, id)
    expect(new Date(v.attempt.deadline!).getTime()).toBe(new Date(v.attempt.startedAt).getTime() + 60 * MIN)
    expect(v.serverNow).toBe(v.attempt.startedAt)
    t.clock.advance(10 * MIN)
    expect((await view(me, id)).serverNow).not.toBe(v.serverNow)
    // a client savedAt far in the future does not extend the deadline
    const q = questionIdsOfView(v)[0]!
    await save(me, id, { changes: [change(q, { choice: 'A' }, 1, '2999-01-01T00:00:00Z')] })
    expect((await view(me, id)).attempt.deadline).toBe(v.attempt.deadline)
  })

  it('2. a late submit within grace is accepted with late_by_seconds', async () => {
    const id = await startAttempt(me, PAPER.sainsK2)
    t.clock.advance(60 * MIN + 90_000)
    const out = await submit(me, id, { idempotencyKey: 'late', changes: [] })
    expect(out.body.data).toEqual({ attemptId: id, late: 90 })
    const r = await result(me, id)
    expect(r.attempt.status).toBe('submitted')
    expect(r.attempt.lateBySeconds).toBe(90)
  })

  it('3. the sweeper closes an unattended attempt GRACE_SECONDS after the deadline from the last saved answers', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const q = questionIdsOfView(await view(me, id))[0]!
    await save(me, id, { changes: [change(q, { choice: correctChoice(q) })] })
    t.clock.advance(75 * MIN + (GRACE - 1) * 1000)
    expect(await t.sweeper.sweep()).toBe(0)
    expect(((await t.db.query('select status from exam_attempts'))[0] as { status: string }).status).toBe('in_progress')
    t.clock.advance(2000)
    expect(await t.sweeper.sweep()).toBe(1)
    expect(await t.sweeper.sweep()).toBe(0)
    const row = ((await me.get('/api/bijak/history')).body.data as { status: string; score: number }[])[0]!
    expect(row).toMatchObject({ status: 'auto_submitted', score: 1 })
    const r = await result(me, id)
    expect(r.attempt.lateBySeconds).toBeLessThanOrEqual(GRACE)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.aggregate.calls[0]).toMatchObject({ status: 'auto_submitted', score: 1, regraded: false })
    expect(t.aggregate.calls[0]!.paperKind).toBe('pilihan')
    expect(t.aggregate.calls[0]!.startedAt).toBeInstanceOf(Date)
    expect(t.aggregate.calls[0]!.submittedAt).toBeInstanceOf(Date)
  })

  it('4. without any sweep run, touching an expired attempt closes it (correctness never depends on the timer)', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    t.clock.advance(75 * MIN + (GRACE + 1) * 1000)
    const r = await result(me, id)
    expect(r.attempt.status).toBe('auto_submitted')
  })

  it('5. latihan has no deadline and is never swept', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    expect((await view(me, id)).attempt.deadline).toBeNull()
    t.clock.advance(4 * 60 * MIN)
    expect(await t.sweeper.sweep()).toBe(0)
    expect((await view(await loginAs(t, STUDENT), id)).attempt.status).toBe('in_progress')
  })

  it('6. the sweeper is safe to run twice at once and with a student request: one result row', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    t.clock.advance(75 * MIN + (GRACE + 1) * 1000)
    await Promise.all([t.sweeper.sweep(), t.sweeper.sweep(), result(me, id), submit(me, id, { idempotencyKey: 'z', changes: [] })])
    expect(Number((await t.db.query('select count(*) n from attempt_results'))[0]!.n)).toBe(1)
    expect(t.reward.calls).toHaveLength(1)
  })
})

describe('late sync (AC-05.4)', () => {
  async function swept() {
    const id = await startAttempt(me, PAPER.matK1)
    const v = await view(me, id)
    const q = questionIdsOfView(v)
    const deadline = new Date(v.attempt.deadline!).getTime()
    t.clock.set(iso(deadline + (GRACE + 5) * 1000))
    return { id, q, deadline }
  }

  it('1. closes at the deadline plus grace, caps the recorded lateness, and says closed on save', async () => {
    const { id, q } = await swept()
    t.clock.advance(30 * MIN)
    const res = await save(me, id, { changes: [change(q[0]!, { choice: correctChoice(q[0]!) }, 1, iso(t.clock.now().getTime() - 10 * MIN))] })
    expect(res.body.data.closed).toBe(true)
    expect(res.body.data.regraded).toBeUndefined()
    const r = await result(me, id)
    expect(r.attempt.status).toBe('auto_submitted')
    expect(r.attempt.lateBySeconds).toBeLessThanOrEqual(GRACE)
  })

  it('2. accepts answers saved before the deadline when they sync later, and grades again', async () => {
    const { id, q, deadline } = await swept()
    expect((await view(me, id)).attempt.status).toBe('auto_submitted') // closed, scheme not yet shown
    const res = await save(me, id, {
      changes: [change(q[0]!, { choice: correctChoice(q[0]!) }, 1, iso(deadline - 5000)), change(q[1]!, { choice: correctChoice(q[1]!) }, 1, iso(deadline - 1000))],
    })
    expect(BijakAttemptSaveResultSchema.parse(res.body.data)).toMatchObject({ closed: true, regraded: true })
    expect((await result(me, id)).result.score).toBe(2)
    expect(t.aggregate.calls.at(-1)).toMatchObject({ regraded: true, score: 2 })
    expect(t.reward.calls).toHaveLength(1)
    // and the same payload again changes nothing (not regraded)
    const again = await save(me, id, { changes: [change(q[0]!, { choice: correctChoice(q[0]!) }, 1, iso(deadline - 5000))] })
    expect(again.body.data.regraded).toBeUndefined()
  })

  it('3. refuses answers stamped after the deadline, and a device clock in the future', async () => {
    const { id, q, deadline } = await swept()
    const res = await save(me, id, {
      changes: [change(q[0]!, { choice: correctChoice(q[0]!) }, 1, iso(deadline + 1000)), change(q[1]!, { choice: correctChoice(q[1]!) }, 1, '2999-01-01T00:00:00Z')],
    })
    expect(res.body.data.closed).toBe(true)
    expect(res.body.data.regraded).toBeUndefined()
    expect((await result(me, id)).result.score).toBe(0)
  })

  it('4. stops late sync after 24 hours', async () => {
    const { id, q, deadline } = await swept()
    t.clock.set(iso(deadline + 24 * 60 * MIN + MIN))
    const later = await loginAs(t, STUDENT) // the session of `me` expired on the moved clock
    const res = await save(later, id, { changes: [change(q[0]!, { choice: correctChoice(q[0]!) }, 1, iso(deadline - 1000))] })
    expect(res.body.data.closed).toBe(true)
    expect(res.body.data.regraded).toBeUndefined()
    expect((await result(later, id)).result.score).toBe(0)
  })

  it('5. a submit after the sweep reports closed and still carries the early answers', async () => {
    const { id, q, deadline } = await swept()
    const out = await submit(me, id, {
      idempotencyKey: 'late',
      changes: [],
      auto: true,
      answers: { [q[0]!]: { answer: { choice: correctChoice(q[0]!) }, rev: 1, savedAt: iso(deadline - 2000) } },
    })
    expect(BijakAttemptSubmitResultSchema.parse(out.body.data)).toMatchObject({ closed: true, regraded: true })
    expect((await result(me, id)).result.score).toBe(1)
  })

  it('6. a submitted attempt says closed and is not changed by a later save', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    await submit(me, id, { idempotencyKey: 'k', changes: [] })
    const q = questionIdsOfView(await view(me, id))[0]!
    const res = await save(me, id, { changes: [change(q, { choice: correctChoice(q) })] })
    expect(res.body.data.closed).toBe(true)
    expect(res.body.data.regraded).toBeUndefined()
    expect((await result(me, id)).result.score).toBe(0)
  })
})

describe('latihan Semak (AC3, NFR-05)', () => {
  it('locks a question after three checks; a 4th check returns the result but ignores the payload', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const q = questionIdsOfView(await view(me, id))[0]!
    const right = correctChoice(q)
    const body = (choice: string, rev: number) => ({ changes: [change(q, { choice }, rev)] })
    for (let i = 1; i <= 3; i++) {
      const r = await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, body(`${q}-wrong`, i))
      expect(BijakAttemptQuestionResultSchema.parse(r.body.data).awarded).toBe(0)
    }
    await save(me, id, body(right, 9)) // locked: ignored by the autosave too
    const fourth = await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, { ...body(right, 10), position: 7 })
    const r4 = BijakAttemptQuestionResultSchema.parse(fourth.body.data)
    expect(r4.awarded).toBe(0)
    expect(r4.parts[0]!.scheme.correctOption).toBe(right)
    const v = await view(me, id)
    expect(v.attempt.answers[q]!.answer.choice).toBe(`${q}-wrong`)
    expect(v.attempt.checkCounts).toEqual({ [q]: 3 })
    expect(v.attempt.position).toBe(0)
  })

  it('a question not on the attempt is 404 "Soalan tidak ditemui"; a closed attempt is 409 "Percubaan sudah tamat"', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    expectError(await me.post(`/api/bijak/attempts/${id}/questions/sn2-osmosis/check`, {}), 'NOT_FOUND', 'Soalan tidak ditemui')
    const q = questionIdsOfView(await view(me, id))[0]!
    await submit(me, id, { idempotencyKey: 'k', changes: [] })
    expectError(await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, {}), 'CONFLICT', 'Percubaan sudah tamat')
    expectError(await other.post(`/api/bijak/attempts/${id}/questions/${q}/check`, {}), 'FORBIDDEN', 'Akses ditolak')
  })

  it('an empty body is "no payload"; a malformed one is 422', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const q = questionIdsOfView(await view(me, id))[0]!
    expect((await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`)).status).toBe(200)
    expectError(await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, { changes: 'x' }), 'VALIDATION_ERROR')
  })
})

describe('result and history', () => {
  it('history lists the caller attempts newest first with score and max, in every status', async () => {
    const a = await startAttempt(me, PAPER.matK1, 'exam')
    t.clock.advance(MIN)
    const b = await startAttempt(me, PAPER.sainsK2, 'latihan')
    await submit(me, a, { idempotencyKey: 'a', changes: [] })
    await startAttempt(other, PAPER.matK1, 'exam')
    const rows = ((await me.get('/api/bijak/history')).body.data as unknown[]).map((r) => BijakAttemptHistoryRowSchema.parse(r))
    expect(rows.map((r) => r.attemptId)).toEqual([b, a])
    expect(rows[1]).toMatchObject({ status: 'submitted', score: 0, max: 10, subject: 'MAT', subjectName: 'Matematik', kertas: 1, kind: 'pilihan', mode: 'exam', durationSeconds: 60 })
    expect(rows[0]).toMatchObject({ status: 'in_progress', mode: 'latihan' })
    expect(rows[0]!.score).toBeUndefined()
  })

  it('the result view carries the attempt, the stored result and the paper without checks', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    await submit(me, id, { idempotencyKey: 'k', changes: [] })
    const r = await result(me, id)
    expect(r.result.max).toBe(9 + 6 + 6)
    expect(r.paper.attempt.id).toBe(id)
    expect(r.paper.questions.length).toBeGreaterThan(0)
  })
})

describe('ownership, roles, CSRF (AC7, AC10)', () => {
  it('another user\'s attempt is 403 "Akses ditolak" on every attempt route (D54b); an unknown id is 404', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const q = questionIdsOfView(await view(me, id))[0]!
    const calls = [
      other.get(`/api/bijak/attempts/${id}`),
      other.put(`/api/bijak/attempts/${id}/answers`, { changes: [] }),
      other.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'k', changes: [] }),
      other.post(`/api/bijak/attempts/${id}/abandon`, {}),
      other.post(`/api/bijak/attempts/${id}/questions/${q}/check`, {}),
      other.get(`/api/bijak/attempts/${id}/result`),
    ]
    for (const res of await Promise.all(calls)) expectError(res, 'FORBIDDEN', 'Akses ditolak')
    expectError(await other.get('/api/bijak/attempts/00000000-0000-4000-8000-000000000000'), 'NOT_FOUND', 'Percubaan tidak ditemui')
    // nothing changed
    expect((await view(me, id)).attempt.status).toBe('in_progress')
    // history is only the caller's
    expect(((await other.get('/api/bijak/history')).body.data as unknown[]).length).toBe(0)
  })

  it('no session is 401; a teacher is 403 (D43); a missing CSRF token is 403 CSRF_INVALID on every write', async () => {
    const anon = await t.http().get('/api/bijak/history')
    expectError(anon, 'UNAUTHORIZED')
    const teacher = await loginAs(t, TEACHER)
    expectError(await teacher.get('/api/bijak/history'), 'FORBIDDEN')
    expectError(await teacher.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam' }), 'FORBIDDEN')
    const id = await startAttempt(me, PAPER.matK1)
    expectError(await me.noCsrf.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam' }), 'CSRF_INVALID')
    expectError(await me.noCsrf.put(`/api/bijak/attempts/${id}/answers`, { changes: [] }), 'CSRF_INVALID')
    expectError(await me.noCsrf.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'k', changes: [] }), 'CSRF_INVALID')
    expectError(await me.noCsrf.post(`/api/bijak/attempts/${id}/abandon`), 'CSRF_INVALID')
    expectError(await me.noCsrf.post(`/api/bijak/attempts/${id}/questions/x/check`), 'CSRF_INVALID')
  })

  it('an admin outside Mod Pelajar is 403; inside it the attempt is stamped is_test and the ports see isTest', async () => {
    const adminPlain = await loginAs(t, ADMIN)
    expectError(await adminPlain.get('/api/bijak/history'), 'FORBIDDEN')
    const adminMod = await loginAs(t, ADMIN, true)
    const id = await startAttempt(adminMod, PAPER.matK1)
    const rows = await t.db.query<{ is_test: boolean }>('select is_test from exam_attempts where id = $1', [id])
    expect(rows[0]!.is_test).toBe(true)
    expect(t.papers.calls.at(-1)).toMatchObject({ isTest: true })
    await submit(adminMod, id, { idempotencyKey: 'k', changes: [] })
    expect(t.reward.calls[0]).toMatchObject({ isTest: true, attemptId: id })
    expect(t.aggregate.calls[0]).toMatchObject({ isTest: true })
    // a student's own attempts are not test data
    const mine = await startAttempt(me, PAPER.matK1)
    expect((await t.db.query<{ is_test: boolean }>('select is_test from exam_attempts where id = $1', [mine]))[0]!.is_test).toBe(false)
  })

  it('a school_admin in Mod Pelajar can start and submit; the attempt is stamped is_test and the ports see isTest', async () => {
    const sa = await loginAs(t, SCHOOL_ADMIN, true)
    const id = await startAttempt(sa, PAPER.matK1)
    expect((await t.db.query<{ is_test: boolean }>('select is_test from exam_attempts where id = $1', [id]))[0]!.is_test).toBe(true)
    expect((await submit(sa, id, { idempotencyKey: 'k', changes: [] })).status).toBe(200)
    expect(t.reward.calls.at(-1)).toMatchObject({ isTest: true, attemptId: id })
    expect(t.aggregate.calls.at(-1)).toMatchObject({ isTest: true, attemptId: id })
  })

  it('responses are Cache-Control: no-store', async () => {
    const res = await me.get('/api/bijak/history')
    expect(res.headers['cache-control']).toBe('no-store')
  })
})

describe('rate limits (D57a)', () => {
  it('writes answer 429 RATE_LIMITED with Retry-After once the minute is used up', async () => {
    const lim = await bootAttemptsApp({ THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE: '3', THROTTLE_BIJAK_CHECK_PER_MINUTE: '1' })
    try {
      const c = await loginAs(lim, STUDENT)
      const id = await startAttempt(c, PAPER.matK1, 'latihan')
      for (let i = 0; i < 3; i++) expect((await save(c, id, { changes: [] })).status).toBe(200)
      const res = await save(c, id, { changes: [] })
      const err = expectError(res, 'RATE_LIMITED')
      expect(err.retryAfter).toBeGreaterThan(0)
      expect(res.headers['retry-after']).toBeDefined()
      const q = questionIdsOfView(await view(c, id))[0]!
      expect((await c.post(`/api/bijak/attempts/${id}/questions/${q}/check`, {})).status).toBe(200)
      expectError(await c.post(`/api/bijak/attempts/${id}/questions/${q}/check`, {}), 'RATE_LIMITED')
    } finally {
      await lim.close()
    }
  })
})

describe('hardening', () => {
  it('a paper whose questions cannot be loaded is a 500 and creates no attempt', async () => {
    const orig = t.questions.loadQuestions.bind(t.questions)
    t.questions.loadQuestions = async () => new Map()
    try {
      expectError(await me.post('/api/bijak/attempts', { paperId: PAPER.matK1, mode: 'exam' }), 'SERVER_ERROR')
    } finally {
      t.questions.loadQuestions = orig
    }
    expect(Number((await t.db.query('select count(*) n from exam_attempts'))[0]!.n)).toBe(0)
  })

  it('latihan: a locked question cannot be changed by a later submit either', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const q = questionIdsOfView(await view(me, id))[0]!
    for (let i = 1; i <= 3; i++) await me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, { changes: [change(q, { choice: 'wrong' }, i)] })
    await submit(me, id, { idempotencyKey: 'k', changes: [change(q, { choice: correctChoice(q) }, 50)], answers: { [q]: { answer: { choice: correctChoice(q) }, rev: 60, savedAt: START } } })
    const r = await result(me, id)
    expect(r.attempt.answers[q]!.answer.choice).toBe('wrong')
    expect(r.result.score).toBe(0)
  })

  it('carried answers for parts that are not on the attempt are ignored', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    await submit(me, id, { idempotencyKey: 'k', changes: [], answers: { 'sn2-osmosis-a': { answer: { text: 'x' }, rev: 1, savedAt: START } } })
    expect(Number((await t.db.query('select count(*) n from attempt_answers'))[0]!.n)).toBe(0)
  })

  it('a save in the grace window (after the deadline, before deadline + 300 s) is still stored; the sweeper then takes over', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const q = questionIdsOfView(await view(me, id))[0]!
    t.clock.advance(75 * MIN + 100_000)
    expect((await save(me, id, { changes: [change(q, { choice: correctChoice(q) })] })).body.data.closed).toBeUndefined()
    t.clock.advance(250_000)
    expect((await save(me, id, { changes: [] })).body.data.closed).toBe(true)
    expect((await result(me, id)).result.score).toBe(1)
  })

  it('there is no list-all route for attempts (history is the callers own)', async () => {
    expect((await me.get('/api/bijak/attempts')).status).toBe(404)
  })
})

function iso0(s: string): string {
  return s
}
