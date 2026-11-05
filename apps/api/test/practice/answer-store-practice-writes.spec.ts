import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnswerLogPort, type AnswerLogEntry, validateAnswerEntry, writableModeOf } from '../../src/modules/practice/answer-log.port'
import { PracticeRepository } from '../../src/modules/practice/practice.repository'
import {
  type Client,
  type PracticeTestApp,
  type World,
  bootPracticeApp,
  checkAnswer,
  countRows,
  fillBank,
  loadWorld,
  loginAs,
  loginModPelajar,
  play,
  resetPractice,
  START,
  startSession,
  userIdByEmail,
} from './helpers'

/** S5-T15 part 2: the practice writers go through `AnswerLogPort.record` inside the submit transaction. */
let t: PracticeTestApp
let w: World
let pelajar: Client
let userId: string
let bank: ReturnType<typeof fillBank>

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  userId = await userIdByEmail(t.db, 'pelajar@demo.test')
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
  t.reward.calls.length = 0
  t.reward.failWith = null
  t.ramalan.sets.clear()
  bank = fillBank(t.bank, w)
})

afterEach(() => {
  vi.restoreAllMocks()
})

interface Row {
  mode: string
  attempt_id: string
  session_id: string
  marks_awarded: number
  marks_max: number
  selected_label: string | null
  question_version_no: number | null
  subject_id: string | null
  is_test: boolean
  is_correct: boolean
  historical: boolean
}
const rowsOf = (sessionId: string) =>
  t.db.query<Row>(
    `select mode, attempt_id::text, session_id::text, marks_awarded::float8, marks_max::float8, selected_label, question_version_no,
            subject_id::text, is_test, is_correct, historical
       from practice_answers where session_id = $1 order by id`,
    [sessionId],
  )

describe('a drill submit writes through the port', () => {
  it('writes mode, attempt_id = session_id, marks, label, version and dimensions', async () => {
    const { started, submit } = await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 }, 2)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    const rows = await rowsOf(started.sessionId)
    expect(rows).toHaveLength(started.questions.length)
    for (const [i, r] of rows.entries()) {
      expect(r).toMatchObject({ mode: 'chapter', attempt_id: started.sessionId, session_id: started.sessionId, marks_max: 1, question_version_no: 1, subject_id: w.subject.math, is_test: false, historical: false })
      expect(r.marks_awarded).toBe(r.is_correct ? 1 : 0)
      expect(r.selected_label).toMatch(/^[A-H]$/)
      expect(r.is_correct).toBe(i < 2)
    }
  })

  it('a second record with the same key updates the row (no second row)', async () => {
    const { started } = await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 }, 2)
    const before = await countRows(t.db, 'practice_answers')
    const qid = started.questions[0]?.id as string
    const res = await t.app.get(AnswerLogPort).record({
      userId, attemptId: started.sessionId, questionId: qid, partRef: null, mode: 'chapter', isCorrect: false, marksAwarded: 0, marksMax: 1,
      answeredAt: new Date(), isTest: false, selectedLabel: 'D', timeSeconds: 7,
    })
    expect(res.created).toBe(false)
    expect(await countRows(t.db, 'practice_answers')).toBe(before)
    const r = await t.db.query<{ selected_label: string; time_seconds: number; is_correct: boolean }>(
      'select selected_label, time_seconds, is_correct from practice_answers where session_id = $1 and question_id = $2', [started.sessionId, qid])
    expect(r[0]).toEqual({ selected_label: 'D', time_seconds: 7, is_correct: false })
    // The session is completed: a second submit is refused and writes nothing.
    const again = await pelajar.post(`/api/practice/sessions/${started.sessionId}/submit`, { timeSpent: 1 })
    expect(again.status).toBe(409)
    expect(await countRows(t.db, 'practice_answers')).toBe(before)
  })

  it('does not copy the session clientUuid onto the rows', async () => {
    const clientUuid = '2a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
    await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 5, clientUuid }, 1)
    expect(await countRows(t.db, 'practice_answers', 'client_uuid is not null')).toBe(0)
  })

  it('Mod Pelajar rows keep is_test = true', async () => {
    const admin = await loginModPelajar(t, 'admin@demo.test')
    const { started } = await play(admin, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 }, 2)
    const rows = await rowsOf(started.sessionId)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.is_test)).toBe(true)
  })

  it('rolls everything back when the port throws: no rows, session still open', async () => {
    const s = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })
    for (const [i, q] of s.questions.entries()) await checkAnswer(pelajar, s.sessionId, t.bank, q.id, i < 2)
    const port = t.app.get(AnswerLogPort)
    const real = port.record.bind(port)
    let calls = 0
    vi.spyOn(port, 'record').mockImplementation(async (e) => {
      if (++calls === 3) throw new Error('boom')
      return real(e)
    })
    const res = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 30 })
    expect(res.status).toBe(500)
    expect(calls).toBe(3)
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
    expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [s.sessionId])).toBe(5)
    const st = await t.db.query<{ status: string }>('select status from practice_sessions where id = $1', [s.sessionId])
    expect(st[0]?.status).toBe('in_progress')
  })
})

describe('legacy session modes are written under a writable mode', () => {
  it('writableModeOf maps the three legacy modes and keeps the rest', () => {
    expect(writableModeOf('past_year')).toBe('databank')
    expect(writableModeOf('ramalan')).toBe('tracking_a')
    expect(writableModeOf('random')).toBe('latih_tubi')
    expect(writableModeOf('mission')).toBe('mission')
  })

  it.each([
    ['past_year', 'databank'],
    ['ramalan', 'tracking_a'],
    ['random', 'latih_tubi'],
  ])('a %s session writes %s', async (mode, written) => {
    const body: Record<string, unknown> =
      mode === 'past_year'
        ? { mode, subjectCode: 'SEJ', count: 5 }
        : mode === 'ramalan'
          ? { mode, subjectCode: 'MATH', year: 2026, setNo: 1 }
          : { mode, subjectCode: 'MATH', levelId: w.level.d1, count: 5 }
    if (mode === 'ramalan') t.ramalan.set(w.subject.math, 2026, 1, bank.random.slice(0, 4))
    const { started, submit } = await play(pelajar, t.bank, body, 1)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    const rows = await rowsOf(started.sessionId)
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(rows.map((r) => r.mode))).toEqual(new Set([written]))
    const s = await t.db.query<{ mode: string }>('select mode from practice_sessions where id = $1', [started.sessionId])
    expect(s[0]?.mode).toBe(mode)
  })
})

describe('PKSK direct completion', () => {
  it('writes pksk rows with attempt_id = the new session id and the label from optionIndex', async () => {
    const repo = t.app.get(PracticeRepository)
    const ids = bank.random.slice(0, 3)
    const { done } = await repo.completeDirect(
      {
        userId, isTest: false, domainCode: 'D1', level: 'T1', startedAt: new Date(START), completedAt: new Date('2026-10-19T09:05:00+08:00'),
        answers: [
          { questionId: ids[0] as string, isCorrect: true, optionIndex: 0 },
          { questionId: ids[1] as string, isCorrect: false, optionIndex: 2 },
          { questionId: ids[2] as string, isCorrect: false, optionIndex: null },
        ],
      },
      async () => null,
    )
    const rows = await rowsOf(done.session.id)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.selected_label)).toEqual(['A', 'C', null])
    expect(rows.map((r) => r.marks_awarded)).toEqual([1, 0, 0])
    for (const r of rows) expect(r).toMatchObject({ mode: 'pksk', attempt_id: done.session.id, marks_max: 1, is_test: false, historical: false })
  })
})

describe('PKSK direct completion, 10 rows (AC-MUR-19-5)', () => {
  it('a 10-question practice submit writes exactly 10 rows with mode pksk', async () => {
    const repo = t.app.get(PracticeRepository)
    const ids = bank.random.slice(0, 10)
    expect(ids).toHaveLength(10)
    const { done } = await repo.completeDirect(
      {
        userId, isTest: false, domainCode: 'D1', level: 'T1', startedAt: new Date(START), completedAt: new Date('2026-10-19T09:05:00+08:00'),
        answers: ids.map((q, i) => ({ questionId: q as string, isCorrect: i % 2 === 0, optionIndex: i % 4 })),
      },
      async () => null,
    )
    const rows = await rowsOf(done.session.id)
    expect(rows).toHaveLength(10)
    expect(new Set(rows.map((r) => r.mode))).toEqual(new Set(['pksk']))
  })
})

describe('the optional pass-through fields are validated', () => {
  const base: AnswerLogEntry = {
    userId: '1', attemptId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', questionId: '2', partRef: null, mode: 'chapter',
    isCorrect: true, marksAwarded: 1, marksMax: 1, answeredAt: new Date(), isTest: false,
  }
  it('accepts absent, null and valid values', () => {
    expect(() => validateAnswerEntry(base)).not.toThrow()
    expect(() => validateAnswerEntry({ ...base, selectedLabel: null, timeSeconds: null, questionVersionNo: null })).not.toThrow()
    expect(() => validateAnswerEntry({ ...base, selectedLabel: 'H', timeSeconds: 0, questionVersionNo: 2 })).not.toThrow()
  })
  it.each([{ selectedLabel: 'I' }, { selectedLabel: 'a' }, { timeSeconds: -1 }, { timeSeconds: 1.5 }, { questionVersionNo: 0 }])('refuses %o', (extra) => {
    expect(() => validateAnswerEntry({ ...base, ...extra })).toThrow()
  })
  it('an explicit questionVersionNo wins over the question live version', async () => {
    const q = bank.random[0] as string
    const row = await t.db.query<{ n: number }>('select count(*)::int n from question_versions where question_id = $1', [q])
    expect(row.length).toBe(1) // sanity: the table is reachable
    const attempt = '3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
    await t.app.get(AnswerLogPort).record({ ...base, userId, attemptId: attempt, questionId: q, questionVersionNo: 7 })
    const r = await t.db.query<{ question_version_no: number | null }>('select question_version_no from practice_answers where attempt_id = $1', [attempt])
    expect(r[0]?.question_version_no).toBe(7)
  })
})
