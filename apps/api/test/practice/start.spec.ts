import { StartSessionResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  type Client,
  type PracticeTestApp,
  type World,
  bootPracticeApp,
  checkAnswer,
  countRows,
  expectError,
  expectNoAnswerKeys,
  fillBank,
  loadWorld,
  loginAs,
  makeSubscribed,
  play,
  START,
  resetPractice,
  startSession,
  userIdByEmail,
} from './helpers'

let t: PracticeTestApp
let w: World
let pelajar: Client
let maju: Client
let ids: { pelajar: string; maju: string }

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  maju = await loginAs(t, 'pelajarmaju@demo.test')
  ids = { pelajar: await userIdByEmail(t.db, 'pelajar@demo.test'), maju: await userIdByEmail(t.db, 'pelajarmaju@demo.test') }
}, 120_000)

afterAll(async () => {
  await t.close()
})

let bank: ReturnType<typeof fillBank>
beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
  t.assignments.items.clear()
  t.ramalan.sets.clear()
  bank = fillBank(t.bank, w)
})

const post = (c: Client, body: unknown) => c.post('/api/practice/sessions', body)

describe('AC3 start: every module error with its exact status, code and BM message', () => {
  it('422 NOT_ENOUGH_QUESTIONS "Soalan tidak mencukupi." when the bank cannot fill the count', async () => {
    // SS has no level link: nothing to draw from (BR-11).
    const none = await post(pelajar, { mode: 'random', subjectCode: 'SS', count: 5 })
    expect(none.status).toBe(422)
    expect(none.body.error).toMatchObject({ code: 'NOT_ENOUGH_QUESTIONS', message: 'Soalan tidak mencukupi.' })
    // 30 MATH D1 questions: 20 fits, then only 4 are left eligible and a count of 5 does not.
    t.bank.reset()
    const few = Array.from({ length: 4 }, () => t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1 }))
    expect(few).toHaveLength(4)
    const res = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({ code: 'NOT_ENOUGH_QUESTIONS', message: 'Soalan tidak mencukupi.' })
  })

  it('count options 5, 10, 15 and 20 are served; anything else is 422 fields.count "Nilai tidak sah."', async () => {
    for (const count of [5, 10, 15, 20]) {
      const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count })
      expect(s.questions).toHaveLength(count)
    }
    for (const count of [7, 0, 25, 1]) {
      const res = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Nilai tidak sah.', fields: { count: 'Nilai tidak sah.' } })
    }
    const missing = await post(pelajar, { mode: 'random', subjectCode: 'MATH' })
    expect(missing.body.error.fields.count).toBe('Nilai tidak sah.')
  })

  it('validation of the other fields: mode, levelId, difficulty, subject', async () => {
    const mode = await post(pelajar, { mode: 'bogus', subjectCode: 'MATH', count: 5 })
    expect(mode.status).toBe(422)
    expect(mode.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Nilai tidak sah.' })
    expect(mode.body.error.fields.mode).toBe('Nilai tidak sah.')
    // pksk sessions are created by M07, never by this route.
    expect((await post(pelajar, { mode: 'pksk' })).status).toBe(422)
    // A level that is not offered (Tingkatan 4 and 5 only) for random.
    const level = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, levelId: w.level.t3 })
    expect(level.body.error.fields.levelId).toBe('Nilai tidak sah.')
    const difficulty = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, difficulty: 9 })
    expect(difficulty.status).toBe(422)
    expect(difficulty.body.error.fields.difficulty).toBe('Nilai tidak sah.')
    const noSubject = await post(pelajar, { mode: 'random', subjectCode: 'TIADA', count: 5 })
    expectError(noSubject, 'NOT_FOUND', 'Rekod tidak dijumpai.')
    expectError(await post(pelajar, { mode: 'random', count: 5 }), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    expect((await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, levelId: w.level.d1, difficulty: 3 })).status).toBe(201)
  })

  it('the body is strict (BE-33 AC1c, #100): an unknown field is 422 naming it, and no session is written', async () => {
    const before = await countRows(t.db, 'practice_sessions')
    for (const extra of [{ ownerId: ids.maju }, { userId: ids.maju }, { isTest: true, score: 100 }]) {
      const res = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, ...extra })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Nilai tidak sah.' })
      for (const key of Object.keys(extra)) expect(res.body.error.fields[key]).toBe('Nilai tidak sah.')
    }
    // A prototype key is refused and named like any other (sent as raw JSON so it is an own key).
    const proto = await pelajar.post('/api/practice/sessions', '{"mode":"random","subjectCode":"MATH","count":5,"__proto__":{"x":1}}').set('Content-Type', 'application/json')
    expect(proto.status, JSON.stringify(proto.body)).toBe(422)
    expect(Object.keys(proto.body.error.fields)).toContain('__proto__')
    // An unknown key next to a bad known field reports both.
    const both = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, difficulty: 9, ownerId: '1' })
    expect(both.body.error.fields).toMatchObject({ difficulty: 'Nilai tidak sah.', ownerId: 'Nilai tidak sah.' })
    expect(await countRows(t.db, 'practice_sessions')).toBe(before)
    // The same body without the extra field still starts.
    expect((await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })).status).toBe(201)
  })

  it('402 TRIAL_EXHAUSTED when no subscription and no trial left; a subscribed user is never limited (AC2)', async () => {
    await t.db.query('update users set trial_questions_used = 50 where id = $1', [ids.pelajar])
    const res = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    expect(res.status).toBe(402)
    expect(res.body.error).toMatchObject({ code: 'TRIAL_EXHAUSTED', message: 'Baki percubaan percuma anda telah habis.' })
    expect(await countRows(t.db, 'practice_sessions')).toBe(0)
    await t.db.query('update users set trial_questions_used = 50 where id = $1', [ids.maju])
    await makeSubscribed(t.db, ids.maju)
    expect((await post(maju, { mode: 'random', subjectCode: 'MATH', count: 5 })).status).toBe(201)
    await t.db.query('delete from comp_students')
  })
})

describe('AC4 selection and what is served', () => {
  it('the response parses as StartSessionResponse and carries no key, answer or explanation (recursive scan)', async () => {
    for (const body of [
      { mode: 'random', subjectCode: 'MATH', count: 10 },
      { mode: 'chapter', chapterId: w.chapter.c1, count: 5 },
      { mode: 'past_year', subjectCode: 'SEJ', count: 5 },
    ]) {
      const res = await post(pelajar, body)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(() => StartSessionResponseSchema.parse(res.body.data)).not.toThrow()
      expectNoAnswerKeys(res.body)
      const text = JSON.stringify(res.body)
      expect(text).not.toContain('Penjelasan soalan')
      expect(text).not.toContain('correctLabel')
    }
  })

  it('options are {id: index, label, text}, the subject and the contributor are mapped, ids are decimal strings', async () => {
    const id = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1, contributor: { name: 'Guru Contoh', profileUrl: null } })
    const s = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 20 })
    const q = s.questions.find((x) => x.id === id)
    expect(q).toBeDefined()
    expect(q?.contributor).toEqual({ name: 'Guru Contoh', profileUrl: null })
    expect(q?.options.map((o) => [o.id, o.label])).toEqual([[0, 'A'], [1, 'B'], [2, 'C'], [3, 'D']])
    expect(q?.hasDskp).toBe(true)
    expect(q?.wrongTimes).toBe(0)
    expect(s.body.subject).toMatchObject({ code: 'MATH' })
    expect(s.body.chapter).toMatchObject({ id: w.chapter.c1, number: 1 })
    expect(s.body.mode).toBe('chapter')
  })

  it('deactivated and unpublished questions are never served', async () => {
    const dead = [...bank.random.slice(0, 6), ...bank.chapters.c1.slice(0, 2)]
    for (const id of dead) t.bank.deactivate(id)
    const seen = new Set<string>()
    for (let i = 0; i < 12; i++) {
      for (const q of (await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 20 })).questions) seen.add(q.id)
      t.clock.advance(1000)
    }
    for (const id of dead) expect(seen.has(id)).toBe(false)
    // A question that goes dead between the draw and the load is dropped (the load is the second gate).
    const chapter = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 20 })
    for (const id of dead) expect(chapter.questions.map((q) => q.id)).not.toContain(id)
  })

  it('the draw is seeded: the same user, clock and history give the same questions', async () => {
    const a = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 10 })
    await resetPractice(t.db)
    const b = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 10 })
    expect(b.questions.map((q) => q.id)).toEqual(a.questions.map((q) => q.id))
    t.clock.advance(5000)
    const c = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 10 })
    expect(c.questions.map((q) => q.id)).not.toEqual(a.questions.map((q) => q.id))
  })
})

describe('AC11 the served list is stored in order with the version served', () => {
  it('10 questions read back as the same 10 ids in the same order, positions unique, delete cascades', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 10 })
    const rows = await t.db.query<{ position: number; question_id: string; question_version_no: number }>(
      'select position, question_id::text, question_version_no from practice_session_questions where session_id = $1 order by position',
      [s.sessionId],
    )
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(rows.map((r) => r.question_id)).toEqual(s.questions.map((q) => q.id))
    expect(rows.every((r) => r.question_version_no === 1)).toBe(true)
    await expect(
      t.db.query('insert into practice_session_questions (session_id, position, question_id, question_version_no) values ($1, 0, 999999, 1)', [s.sessionId]),
    ).rejects.toThrow(/uq_practice_session_questions_session_id_position/)
    await t.db.query('delete from practice_sessions where id = $1', [s.sessionId])
    expect(await countRows(t.db, 'practice_session_questions', 'session_id = $1', [s.sessionId])).toBe(0)
  })

  it('a question edited before the start is served and stored at its live version', async () => {
    const only = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c3 })
    t.bank.reset()
    const q = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1 })
    expect(only).not.toBe(q)
    t.bank.edit(q, { text: 'Soalan disunting' })
    const s = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })
    expect(s.questions[0]?.questionText).toBe('Soalan disunting')
    const stored = await t.db.query<{ question_version_no: number }>('select question_version_no from practice_session_questions where session_id = $1', [s.sessionId])
    expect(stored[0]?.question_version_no).toBe(2)
  })
})

describe('clientUuid replay (AC5)', () => {
  const clientUuid = '5f0c1a52-8b7e-4f4e-9d2a-3d3b1c9f7a10'

  it('the same clientUuid returns the same session with the same body (201) and creates nothing new', async () => {
    const first = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, clientUuid })
    expect(first.status).toBe(201)
    const sessionsBefore = await countRows(t.db, 'practice_sessions')
    const questionsBefore = await countRows(t.db, 'practice_session_questions')
    t.clock.advance(60_000)
    const second = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, clientUuid })
    expect(second.status).toBe(201)
    expect(second.body).toEqual(first.body)
    expect(await countRows(t.db, 'practice_sessions')).toBe(sessionsBefore)
    expect(await countRows(t.db, 'practice_session_questions')).toBe(questionsBefore)
    const row = await t.db.query<{ client_uuid: string }>('select client_uuid::text from practice_sessions where id = $1', [first.body.data.sessionId])
    expect(row[0]?.client_uuid).toBe(clientUuid)
  })

  it('a replay serves the version stored, even after the question was edited', async () => {
    const first = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5, clientUuid })
    const id = first.questions[0]?.id as string
    t.bank.edit(id, { text: 'Disunting selepas mula' })
    const again = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5, clientUuid })
    expect(again.questions.find((q) => q.id === id)?.questionText).toBe(first.questions[0]?.questionText)
  })

  it('parallel starts with one clientUuid give one session', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, clientUuid })))
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    expect(new Set(results.map((r) => r.body.data.sessionId)).size).toBe(1)
    expect(await countRows(t.db, 'practice_sessions')).toBe(1)
    expect(await countRows(t.db, 'practice_session_questions')).toBe(5)
  })

  it('the key is per user: another user with the same clientUuid gets their own session', async () => {
    const a = await post(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5, clientUuid })
    const b = await post(maju, { mode: 'random', subjectCode: 'MATH', count: 5, clientUuid })
    expect(a.body.data.sessionId).not.toBe(b.body.data.sessionId)
  })
})

describe('chapter mode: BR-15 chapters, BR-16 lock, BR-17 order', () => {
  it('chapter 1 is open; chapter 2 is 409 CHAPTER_LOCKED "Bab ini masih dikunci." until chapter 1 is complete with 70 percent', async () => {
    expect((await post(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })).status).toBe(201)
    const locked = await post(pelajar, { mode: 'chapter', chapterId: w.chapter.c2, count: 5 })
    expect(locked.status).toBe(409)
    expect(locked.body.error).toMatchObject({ code: 'CHAPTER_LOCKED', message: 'Bab ini masih dikunci.' })
    // 6 questions in chapter 1; answering all 6 with 4 right is 66.7 percent: still locked.
    await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 20 }, 4)
    expect((await post(pelajar, { mode: 'chapter', chapterId: w.chapter.c2, count: 5 })).status).toBe(409)
    // The latest answer per question counts: all 6 right on the second round is 100 percent.
    t.clock.advance(60_000)
    await play(pelajar, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 20 }, 6)
    const open = await post(pelajar, { mode: 'chapter', chapterId: w.chapter.c2, count: 5 })
    expect(open.status).toBe(201)
    // Another user is still locked out.
    expect((await post(maju, { mode: 'chapter', chapterId: w.chapter.c2, count: 5 })).status).toBe(409)
  })

  it('an unknown or inactive chapter is 404; a chapter without questions is 422 NOT_ENOUGH_QUESTIONS', async () => {
    expectError(await post(pelajar, { mode: 'chapter', chapterId: '999999999', count: 5 }), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    expectError(await post(pelajar, { mode: 'chapter', count: 5 }), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    t.bank.reset()
    const empty = await post(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })
    expect(empty.status).toBe(422)
    expect(empty.body.error).toMatchObject({ code: 'NOT_ENOUGH_QUESTIONS', message: 'Soalan tidak mencukupi.' })
  })

  it('BR-17: unanswered questions first in ascending id, then the answered ones by oldest last answer', async () => {
    const all = bank.chapters.c1
    const first = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })
    expect(first.questions.map((q) => q.id)).toEqual(all.slice(0, 5))
    // Answer questions 0..2 at different times (0 first).
    for (const id of all.slice(0, 3)) {
      await checkAnswer(pelajar, first.sessionId, t.bank, id, true)
      t.clock.advance(60_000)
    }
    await pelajar.post(`/api/practice/sessions/${first.sessionId}/submit`, { timeSpent: 10 })
    const next = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 10 })
    // Fresh ones (3, 4, 5) in id order, then the answered ones oldest first (0, 1, 2).
    expect(next.questions.map((q) => q.id)).toEqual([...all.slice(3, 6), ...all.slice(0, 3)])
  })
})

describe('revision mode: BR-14 queue, length 20', () => {
  const queue = async (userId: string, subjectId: string, questionId: string, wrongTimes: number, minute: number) =>
    t.db.query(
      `insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, $4, '2026-10-01T00:00:00Z'::timestamptz + ($5 || ' minutes')::interval)`,
      [userId, questionId, subjectId, wrongTimes, String(minute)],
    )

  it('an empty queue is 422 NO_WRONG_QUESTIONS "Maaf, terdapat masalah memuatkan kuiz ulang kaji."', async () => {
    const res = await post(pelajar, { mode: 'revision', subjectCode: 'MATH', count: 20 })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({ code: 'NO_WRONG_QUESTIONS', message: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.' })
  })

  it('serves the queue in BR-14 order with revisionMeta and wrongTimes; deactivated questions are left out', async () => {
    const [a, b, c, d] = bank.random as [string, string, string, string]
    await queue(ids.pelajar, w.subject.math, a, 1, 1)
    await queue(ids.pelajar, w.subject.math, b, 2, 2)
    await queue(ids.pelajar, w.subject.math, c, 2, 5)
    await queue(ids.pelajar, w.subject.math, d, 3, 0)
    t.bank.deactivate(d)
    const res = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH' })
    // wrongTimes desc, then the latest wrong answer first: c (2, minute 5), b (2, minute 2), a (1).
    expect(res.questions.map((q) => q.id)).toEqual([c, b, a])
    expect(res.questions.map((q) => q.wrongTimes)).toEqual([2, 2, 1])
    expect(res.body.revisionMeta).toEqual({ selected: 3, totalWrong: 3 })
  })

  it('serves at most 20 (REVISION_LENGTH) and totalWrong counts the whole queue; count other than 20 is 422', async () => {
    t.bank.reset()
    const many = Array.from({ length: 25 }, () => t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1 }))
    for (const [i, id] of many.entries()) await queue(ids.pelajar, w.subject.math, id, 1, i)
    const res = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH', count: 20 })
    expect(res.questions).toHaveLength(20)
    expect(res.body.revisionMeta).toEqual({ selected: 20, totalWrong: 25 })
    const bad = await post(pelajar, { mode: 'revision', subjectCode: 'MATH', count: 10 })
    expect(bad.body.error.fields.count).toBe('Nilai tidak sah.')
  })

  it('the queue is per user and per subject', async () => {
    await queue(ids.maju, w.subject.math, bank.random[0] as string, 1, 1)
    expect((await post(pelajar, { mode: 'revision', subjectCode: 'MATH' })).status).toBe(422)
    expect((await post(maju, { mode: 'revision', subjectCode: 'BM' })).status).toBe(422)
    expect((await post(maju, { mode: 'revision', subjectCode: 'MATH' })).status).toBe(201)
  })
})

describe('SPM modes: past_year, latih_tubi, ramalan', () => {
  it('past_year counts 5, 10 and 20; others are 422 fields.count; only SPM pool questions are served', async () => {
    const extra = Array.from({ length: 10 }, () => t.bank.add({ subjectId: w.subject.sej, levelId: w.level.t4, spmPool: true }))
    expect(extra).toHaveLength(10)
    const nonPool = t.bank.add({ subjectId: w.subject.sej, levelId: w.level.t4, spmPool: false })
    for (const count of [5, 10, 20]) {
      const s = await startSession(pelajar, { mode: 'past_year', subjectCode: 'SEJ', count })
      expect(s.questions).toHaveLength(Math.min(count, 22))
      expect(s.questions.map((q) => q.id)).not.toContain(nonPool)
    }
    expect((await post(pelajar, { mode: 'past_year', subjectCode: 'SEJ', count: 7 })).body.error.fields.count).toBe('Nilai tidak sah.')
    // No SPM pool for the subject: NOT_ENOUGH_QUESTIONS.
    expect((await post(pelajar, { mode: 'past_year', subjectCode: 'BM', count: 5 })).body.error.code).toBe('NOT_ENOUGH_QUESTIONS')
  })

  it('latih_tubi: the subject target is the only count (SEJ 40, ADDMATH 20); a pool smaller than the count serves what exists', async () => {
    expect((await post(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 10 })).body.error.fields.count).toBe('Nilai tidak sah.')
    const s = await startSession(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 40 })
    expect(s.questions).toHaveLength(12)
    expect((await post(pelajar, { mode: 'latih_tubi', subjectCode: 'ADDMATH', count: 10 })).body.error.fields.count).toBe('Nilai tidak sah.')
    // A subject without a target accepts the free counts.
    const perniaga = (await t.db.query<{ id: string }>(`select id::text from subjects where code = 'PERNIAGA'`))[0]?.id as string
    for (let i = 0; i < 6; i++) t.bank.add({ subjectId: perniaga, levelId: w.level.t4, spmPool: true })
    expect((await startSession(pelajar, { mode: 'latih_tubi', subjectCode: 'PERNIAGA', count: 5 })).questions).toHaveLength(5)
    expect((await post(pelajar, { mode: 'latih_tubi', subjectCode: 'PERNIAGA', count: 3 })).body.error.fields.count).toBe('Nilai tidak sah.')
  })

  it('latih_tubi levelId must be an SPM level and difficulty 2 to 5', async () => {
    expect((await post(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 40, levelId: w.level.t3 })).body.error.fields.levelId).toBe('Nilai tidak sah.')
    expect((await post(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 40, difficulty: 1 })).body.error.fields.difficulty).toBe('Nilai tidak sah.')
    const s = await startSession(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 40, levelId: w.level.t4, difficulty: 2 })
    for (const q of s.questions) expect(t.bank.get(q.id).difficulty).toBe(2)
  })

  it('"Buka Soalan Sama": targetQuestionId needs count 1 and an eligible SPM pool question of the subject', async () => {
    const target = bank.spm[0] as string
    const ok = await startSession(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 1, targetQuestionId: target })
    expect(ok.questions.map((q) => q.id)).toEqual([target])
    const stored = await t.db.query<{ target_question_id: string; question_count: number }>('select target_question_id::text, question_count from practice_sessions where id = $1', [ok.sessionId])
    expect(stored[0]).toEqual({ target_question_id: target, question_count: 1 })
    const post422 = async (body: Record<string, unknown>) => (await post(pelajar, { mode: 'latih_tubi', ...body })).body.error.fields
    expect(await post422({ subjectCode: 'SEJ', count: 2, targetQuestionId: target })).toEqual({ count: 'Nilai tidak sah.' })
    expect(await post422({ subjectCode: 'BM', count: 1, targetQuestionId: target })).toEqual({ targetQuestionId: 'Nilai tidak sah.' })
    expect(await post422({ subjectCode: 'SEJ', count: 1, targetQuestionId: '600001' })).toEqual({ targetQuestionId: 'Nilai tidak sah.' })
    t.bank.deactivate(target)
    expect(await post422({ subjectCode: 'SEJ', count: 1, targetQuestionId: target })).toEqual({ targetQuestionId: 'Nilai tidak sah.' })
  })

  it('ramalan: an unknown set is 404, an empty one 422 SET_NOT_READY, a ready one is served', async () => {
    expectError(await post(pelajar, { mode: 'ramalan', subjectCode: 'MATH', year: 2026, setNo: 1 }), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    expectError(await post(pelajar, { mode: 'ramalan', subjectCode: 'MATH', setNo: 1 }), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    t.ramalan.set(w.subject.math, 2026, 1, [])
    const empty = await post(pelajar, { mode: 'ramalan', subjectCode: 'MATH', year: 2026, setNo: 1 })
    expect(empty.status).toBe(422)
    expect(empty.body.error).toMatchObject({ code: 'SET_NOT_READY', message: 'Soalan tidak mencukupi.' })
    t.ramalan.set(w.subject.math, 2026, 2, bank.random.slice(0, 4))
    const ready = await startSession(pelajar, { mode: 'ramalan', subjectCode: 'MATH', year: 2026, setNo: 2 })
    expect(ready.questions.map((q) => q.id)).toEqual(bank.random.slice(0, 4))
    const stored = await t.db.query<{ year: number; set_no: number }>('select year, set_no from practice_sessions where id = $1', [ready.sessionId])
    expect(stored[0]).toEqual({ year: 2026, set_no: 2 })
  })
})

describe('assigned work: mission, remedial, question_set (BE-18 port)', () => {
  it('mission: not found 404, completed 409 ALREADY_COMPLETED "Misi ini sudah diselesaikan.", an open session is resumed (BR-32), coinsPerCorrect stored', async () => {
    const ids3 = bank.random.slice(0, 3)
    expectError(await post(pelajar, { mode: 'mission', missionId: '9001' }), 'NOT_FOUND', 'Rekod tidak dijumpai.')
    t.assignments.set('mission', '9001', { status: 'ok', subjectId: w.subject.math, questionIds: ids3, coinsPerCorrect: 5 })
    const first = await startSession(pelajar, { mode: 'mission', missionId: '9001' })
    const again = await startSession(pelajar, { mode: 'mission', missionId: '9001' })
    expect(again.sessionId).toBe(first.sessionId)
    expect(await countRows(t.db, 'practice_sessions')).toBe(1)
    const stored = await t.db.query<{ coins_per_correct: number; mission_id: string }>('select coins_per_correct, mission_id::text from practice_sessions where id = $1', [first.sessionId])
    expect(stored[0]).toEqual({ coins_per_correct: 5, mission_id: '9001' })
    // Parallel starts of one mission never create two sessions.
    await t.db.query('delete from practice_sessions')
    const racing = await Promise.all([1, 2, 3, 4].map(() => post(pelajar, { mode: 'mission', missionId: '9001' })))
    expect(new Set(racing.map((r) => r.body.data.sessionId)).size).toBe(1)
    expect(await countRows(t.db, 'practice_sessions')).toBe(1)
    const sessionId = racing[0]?.body.data.sessionId as string
    for (const id of ids3) await checkAnswer(pelajar, sessionId, t.bank, id, true)
    expect((await pelajar.post(`/api/practice/sessions/${sessionId}/submit`, { timeSpent: 30 })).status).toBe(200)
    const done = await post(pelajar, { mode: 'mission', missionId: '9001' })
    expect(done.status).toBe(409)
    expect(done.body.error).toMatchObject({ code: 'ALREADY_COMPLETED', message: 'Misi ini sudah diselesaikan.' })
  })

  it('mission: the default coin rate is 3 when the mission names none', async () => {
    t.assignments.set('mission', '9002', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 2) })
    const s = await startSession(pelajar, { mode: 'mission', missionId: '9002' })
    const stored = await t.db.query<{ coins_per_correct: number }>('select coins_per_correct from practice_sessions where id = $1', [s.sessionId])
    expect(stored[0]?.coins_per_correct).toBe(3)
  })

  it('remedial: another student is 404, a completed test is 409 "Ujian ini sudah selesai.", a ready one starts', async () => {
    expectError(await post(pelajar, { mode: 'remedial', remedialTestId: '7699' }), 'NOT_FOUND')
    t.assignments.set('remedial', '7699', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4), completed: true })
    const done = await post(pelajar, { mode: 'remedial', remedialTestId: '7699' })
    expect(done.status).toBe(409)
    expect(done.body.error).toMatchObject({ code: 'ALREADY_COMPLETED', message: 'Ujian ini sudah selesai.' })
    t.assignments.set('remedial', '7700', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4) })
    const s = await startSession(pelajar, { mode: 'remedial', remedialTestId: '7700' })
    expect(s.questions).toHaveLength(4)
    const stored = await t.db.query<{ remedial_test_id: string }>('select remedial_test_id::text from practice_sessions where id = $1', [s.sessionId])
    expect(stored[0]?.remedial_test_id).toBe('7700')
  })

  it('question_set: timeLimitSec is returned and stored; NO_ATTEMPTS_LEFT "Tiada percubaan lagi untuk set ini." once maxAttempts sessions are completed', async () => {
    t.assignments.set('question_set', '7499', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 3), maxAttempts: 1, timeLimitSec: 600 })
    const first = await startSession(pelajar, { mode: 'question_set', questionSetId: '7499' })
    expect(first.body.timeLimitSec).toBe(600)
    await pelajar.post(`/api/practice/sessions/${first.sessionId}/submit`, { timeSpent: 10 })
    const second = await post(pelajar, { mode: 'question_set', questionSetId: '7499' })
    expect(second.status).toBe(409)
    expect(second.body.error).toMatchObject({ code: 'NO_ATTEMPTS_LEFT', message: 'Tiada percubaan lagi untuk set ini.' })
    // maxAttempts 0 is unlimited.
    t.assignments.set('question_set', '7500', { status: 'ok', subjectId: null, questionIds: bank.random.slice(0, 3), maxAttempts: 0 })
    const a = await startSession(pelajar, { mode: 'question_set', questionSetId: '7500' })
    await pelajar.post(`/api/practice/sessions/${a.sessionId}/submit`, { timeSpent: 1 })
    const b = await startSession(pelajar, { mode: 'question_set', questionSetId: '7500' })
    expect(b.body.timeLimitSec).toBeNull()
    expect(b.body.subject).toMatchObject({ code: 'MATH' })
    expectError(await post(pelajar, { mode: 'question_set', questionSetId: '1' }), 'NOT_FOUND')
  })

  it('assigned questions that are no longer eligible are not served; none left is NOT_ENOUGH_QUESTIONS', async () => {
    const list = bank.random.slice(0, 3)
    t.assignments.set('remedial', '7701', { status: 'ok', subjectId: w.subject.math, questionIds: list })
    t.bank.deactivate(list[0] as string)
    const s = await startSession(pelajar, { mode: 'remedial', remedialTestId: '7701' })
    expect(s.questions.map((q) => q.id)).toEqual(list.slice(1))
    t.assignments.set('remedial', '7702', { status: 'ok', subjectId: w.subject.math, questionIds: [] })
    expect((await post(pelajar, { mode: 'remedial', remedialTestId: '7702' })).body.error.code).toBe('NOT_ENOUGH_QUESTIONS')
  })
})
