import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { leavesOfGraded, modeOfAttempt, runBackfill, runLegacyMode, type SkipReason } from '../../scripts/uat-ops/backfill-bijak-answers'
import { PrismaService } from '../../src/db/prisma.service'
import { ANSWER_MODES, AnswerLogPort, type AnswerLogEntry, WRITABLE_ANSWER_MODES } from '../../src/modules/practice/answer-log.port'
import { type PracticeTestApp, type World, bootPracticeApp, countRows, fillBank, loadWorld, resetPractice, userIdByEmail } from './helpers'

let t: PracticeTestApp
let w: World
let port: AnswerLogPort
let prisma: PrismaService
let u1: string
let u2: string
let bank: ReturnType<typeof fillBank>
const AT = new Date('2026-10-19T01:00:00Z')

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  port = t.app.get(AnswerLogPort)
  prisma = t.app.get(PrismaService)
  u1 = await userIdByEmail(t.db, 'pelajar@demo.test')
  u2 = await userIdByEmail(t.db, 'pelajarmaju@demo.test')
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  await resetPractice(t.db)
  t.bank.reset()
  bank = fillBank(t.bank, w)
})

const q = (): string => bank.chapters.c1[0] as string

function entry(over: Partial<AnswerLogEntry> = {}): AnswerLogEntry {
  return {
    userId: u1,
    attemptId: randomUUID(),
    questionId: q(),
    partRef: null,
    mode: 'simulasi',
    isCorrect: true,
    marksAwarded: 1,
    marksMax: 1,
    answeredAt: AT,
    isTest: false,
    ...over,
  }
}

const rowsOf = (attemptId: string) =>
  t.db.query<Record<string, unknown>>(
    `select id::text, session_id::text, attempt_id::text, user_id::text, question_id::text, question_version_no, part_ref, mode,
            subject_id::text, education_level_id::text, chapter_id::text, difficulty, question_type, is_correct,
            marks_awarded::float8, marks_max::float8, is_test, historical
       from practice_answers where attempt_id = $1 order by id`,
    [attemptId],
  )

async function drillSession(userId: string, questionId: string, versionNo = 1): Promise<string> {
  const id = randomUUID()
  await t.db.query(`insert into practice_sessions (id, user_id, mode, question_count, started_at) values ($1, $2, 'latih_tubi', 1, $3)`, [id, userId, AT])
  await t.db.query(`insert into practice_session_questions (session_id, position, question_id, question_version_no) values ($1, 0, $2, $3)`, [id, questionId, versionNo])
  return id
}

describe('the registry', () => {
  it('has 19 values, 16 of them writable (past_year, ramalan, random are legacy)', () => {
    expect(ANSWER_MODES).toHaveLength(19)
    expect(WRITABLE_ANSWER_MODES).toHaveLength(16)
    expect(WRITABLE_ANSWER_MODES).not.toContain('past_year')
    expect(WRITABLE_ANSWER_MODES).not.toContain('ramalan')
    expect(WRITABLE_ANSWER_MODES).not.toContain('random')
  })
})

describe('record', () => {
  it('drill: attemptId is the session id, session_id is set and the dimensions come from the served version', async () => {
    const sid = await drillSession(u1, q())
    const out = await port.record(entry({ attemptId: sid, mode: 'latih_tubi' }))
    expect(out.created).toBe(true)
    const [row] = await rowsOf(sid)
    expect(row).toMatchObject({
      id: out.id,
      session_id: sid,
      attempt_id: sid,
      user_id: u1,
      question_id: q(),
      question_version_no: 1,
      part_ref: null,
      mode: 'latih_tubi',
      subject_id: w.subject.math,
      education_level_id: w.level.d1,
      chapter_id: w.chapter.c1,
      difficulty: 1,
      question_type: 'mcq',
      is_correct: true,
      marks_awarded: 1,
      marks_max: 1,
      is_test: false,
      historical: false,
    })
  })

  it('uses the version the session served, not the live one', async () => {
    const sid = await drillSession(u1, q(), 1)
    t.bank.edit(q(), { text: 'edited' })
    await port.record(entry({ attemptId: sid, mode: 'latih_tubi' }))
    expect((await rowsOf(sid))[0]?.question_version_no).toBe(1)
  })

  it('outside a session it takes the current version and leaves session_id empty', async () => {
    t.bank.edit(q(), { text: 'edited' })
    const a = randomUUID()
    await port.record(entry({ attemptId: a }))
    expect(await rowsOf(a)).toEqual([expect.objectContaining({ session_id: null, question_version_no: 2, mode: 'simulasi' })])
  })

  it('does not link a session of somebody else', async () => {
    const sid = await drillSession(u2, q())
    await port.record(entry({ attemptId: sid, mode: 'latih_tubi' }))
    expect((await rowsOf(sid))[0]?.session_id).toBeNull()
  })

  it('simulasi and subjektif parts: part_ref and marks are stored', async () => {
    const a = randomUUID()
    await port.record(entry({ attemptId: a, mode: 'subjektif', partRef: '2.a.ii', isCorrect: false, marksAwarded: 3.5, marksMax: 5 }))
    await port.record(entry({ attemptId: a, mode: 'subjektif', partRef: '2.b', isCorrect: true, marksAwarded: 4, marksMax: 4 }))
    await port.record(entry({ attemptId: a, mode: 'subjektif', partRef: '2.c', isCorrect: false, marksAwarded: null, marksMax: 2 }))
    const rows = await rowsOf(a)
    expect(rows.map((r) => [r.part_ref, r.marks_awarded, r.marks_max, r.is_correct])).toEqual([
      ['2.a.ii', 3.5, 5, false],
      ['2.b', 4, 4, true],
      ['2.c', null, 2, false],
    ])
  })

  it('game: part_ref is <game_key>#<position>', async () => {
    const a = randomUUID()
    await port.record(entry({ attemptId: a, mode: 'game', partRef: 'papan-bijak#3' }))
    expect(await rowsOf(a)).toEqual([expect.objectContaining({ mode: 'game', part_ref: 'papan-bijak#3' })])
  })

  it.each(WRITABLE_ANSWER_MODES.map((m) => [m]))('writes mode %s', async (mode) => {
    const a = randomUUID()
    const out = await port.record(entry({ attemptId: a, mode }))
    expect(out.created).toBe(true)
    expect((await rowsOf(a))[0]?.mode).toBe(mode)
  })

  it('a repeat with the same key updates the row and returns created: false', async () => {
    const a = randomUUID()
    const first = await port.record(entry({ attemptId: a, partRef: '1.a', isCorrect: false, marksAwarded: null, marksMax: 3 }))
    const second = await port.record(entry({ attemptId: a, partRef: '1.a', isCorrect: true, marksAwarded: 3, marksMax: 3, isTest: true }))
    expect(first.created).toBe(true)
    expect(second).toEqual({ id: first.id, created: false })
    const rows = await rowsOf(a)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ is_correct: true, marks_awarded: 3, is_test: true })
  })

  it('a null part_ref and an empty one are the same key', async () => {
    const a = randomUUID()
    await port.record(entry({ attemptId: a, partRef: null }))
    const again = await port.record(entry({ attemptId: a, partRef: '' }))
    expect(again.created).toBe(false)
    expect(await rowsOf(a)).toHaveLength(1)
  })

  it('two pupils on one attempt (a game room) give two rows', async () => {
    const a = randomUUID()
    expect((await port.record(entry({ attemptId: a, userId: u1, mode: 'battle' }))).created).toBe(true)
    expect((await port.record(entry({ attemptId: a, userId: u2, mode: 'battle' }))).created).toBe(true)
    expect(await rowsOf(a)).toHaveLength(2)
  })

  it('stores isTest as given', async () => {
    const a = randomUUID()
    await port.record(entry({ attemptId: a, isTest: true }))
    expect((await rowsOf(a))[0]?.is_test).toBe(true)
  })

  it('an unknown question is stored without dimensions', async () => {
    const a = randomUUID()
    await port.record(entry({ attemptId: a, questionId: '999999' }))
    expect(await rowsOf(a)).toEqual([expect.objectContaining({ subject_id: null, question_version_no: null })])
  })
})

describe('refusals (nothing is written)', () => {
  it.each([['past_year'], ['ramalan'], ['random'], ['nonsense']])('mode %s', async (mode) => {
    const a = randomUUID()
    await expect(port.record(entry({ attemptId: a, mode: mode as never }))).rejects.toThrow(/not writable/)
    expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [a])).toBe(0)
  })

  it('bad attempt id, marksMax <= 0, marks above max', async () => {
    await expect(port.record(entry({ attemptId: 'not-a-uuid' }))).rejects.toThrow(/uuid/)
    await expect(port.record(entry({ marksMax: 0 }))).rejects.toThrow(/marksMax/)
    await expect(port.record(entry({ marksMax: 2, marksAwarded: 3 }))).rejects.toThrow(/above marksMax/)
    await expect(port.record(entry({ marksAwarded: -1 }))).rejects.toThrow(/0 or more/)
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
  })
})

describe('isCorrect follows the marks', () => {
  it.each([
    ['null marks but correct', { marksAwarded: null, isCorrect: true }],
    ['full marks but not correct', { marksAwarded: 1, marksMax: 1, isCorrect: false }],
    ['part marks but correct', { marksAwarded: 2, marksMax: 3, isCorrect: true }],
    ['zero marks but correct', { marksAwarded: 0, marksMax: 1, isCorrect: true }],
  ])('refuses %s', async (_name, over) => {
    const a = randomUUID()
    await expect(port.record(entry({ attemptId: a, ...over }))).rejects.toThrow(/isCorrect/)
    expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [a])).toBe(0)
  })
})

describe('unknown question', () => {
  it('warns once per call with the question id and mode (no user id) and still writes the row', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      const a = randomUUID()
      await port.record(entry({ attemptId: a, questionId: '999998', mode: 'game', partRef: 'papan-bijak#1' }))
      const lines = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('999998'))
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('mode game')
      expect(lines[0]).not.toContain(`user ${u1}`)
      expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [a])).toBe(1)
      warn.mockClear()
      await port.record(entry({ attemptId: randomUUID() }))
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('dimensions of questions the drill bridge refuses', () => {
  it('a structured question (refused by the drill bridge) keeps its subject, level, Bab, topic, difficulty and type', async () => {
    const id = (await t.db.query<{ id: string }>(`insert into questions (source_type, live_version_no, latest_version_no, is_active) values ('manual', 2, 2, true) returning id::text`))[0]?.id as string
    await t.db.query(
      `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, chapter_id, difficulty_tp)
       values ($1, 1, 'archived', 'structured', 'lama', $2, $3, $4, 2), ($1, 2, 'approved', 'structured', 'baru', $2, $3, $4, 6)`,
      [id, w.subject.math, w.level.d1, w.chapter.c2],
    )
    // The drill bridge (fake bank here, servableMcq in production) does not know it: only the table does.
    const a = randomUUID()
    await port.record(entry({ attemptId: a, questionId: id, mode: 'structured', partRef: '1.a', marksMax: 3, marksAwarded: 3 }))
    expect(await rowsOf(a)).toEqual([
      expect.objectContaining({ question_version_no: 2, subject_id: w.subject.math, education_level_id: w.level.d1, chapter_id: w.chapter.c2, difficulty: 5, question_type: 'structured' }),
    ])
    // A session that served version 1 pins it.
    const sid = await drillSession(u1, id, 1)
    await port.record(entry({ attemptId: sid, questionId: id, mode: 'latih_tubi' }))
    expect(await rowsOf(sid)).toEqual([expect.objectContaining({ question_version_no: 1, difficulty: 2, question_type: 'structured' })])
  })
})

describe('transactions', () => {
  it('joins the caller transaction: a rollback removes the row', async () => {
    const a = randomUUID()
    await expect(
      prisma.transaction(async () => {
        await port.record(entry({ attemptId: a }))
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [a])).toBe(0)
  })

  it('a commit keeps it', async () => {
    const a = randomUUID()
    await prisma.transaction(async () => {
      await port.record(entry({ attemptId: a }))
    })
    expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [a])).toBe(1)
  })
})

describe('backfill-bijak-answers (UAT script)', () => {
  const graded = {
    questions: [
      { questionId: '501', attempted: true, parts: [{ partId: '501', marks: 1, awarded: 1, status: 'betul' }] },
      { questionId: '502', attempted: true, parts: [{ partId: '502', marks: 1, awarded: 0, status: 'salah' }] },
      { questionId: '503', attempted: false, parts: [{ partId: '503', marks: 1, awarded: 0, status: 'kosong' }] },
      {
        questionId: '504',
        attempted: true,
        parts: [
          { partId: '504-a', marks: 3, awarded: 1, status: 'separa' },
          { partId: '504-b', marks: 2, awarded: 0, status: 'belum_dimarkah' },
          { partId: '504-c', marks: 2, awarded: 0, status: 'kosong' },
        ],
      },
      // Automatic grading says not attempted; the pupil then self-marked its part (the real persisted shape keeps this row).
      { questionId: '505', attempted: false, parts: [{ partId: '505', marks: 4, awarded: 0, status: 'belum_dimarkah' }] },
    ],
    selfMarks: { '504-b': { mark: 2 }, '505': { mark: 4, band: 'A' } },
  }

  it('maps the V3 attempt kinds to simulasi and nothing else', () => {
    expect(modeOfAttempt('pilihan')).toBe('simulasi')
    expect(modeOfAttempt('jana')).toBe('simulasi')
    expect(modeOfAttempt('subjektif')).toBeNull()
  })

  it('one leaf per answered part, self-mark applied, skips counted', () => {
    const skips = new Map<SkipReason, number>()
    const leaves = leavesOfGraded(graded.questions, graded.selfMarks, skips)
    expect(leaves.map((l) => [l.questionId, l.partRef, l.isCorrect, l.marksAwarded, l.marksMax])).toEqual([
      ['501', null, true, 1, 1],
      ['502', null, false, 0, 1],
      ['504', '504-a', false, 1, 3],
      ['504', '504-b', true, 2, 2],
      ['505', null, true, 4, 4],
    ])
    expect(Object.fromEntries(skips)).toEqual({ not_attempted: 1, blank_part: 1 })
  })

  it('dry run writes nothing; --apply writes once and a second run only updates', async () => {
    const attempt = randomUUID()
    await t.db.query(
      `insert into exam_attempts (id, user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, submitted_at, duration_min)
       values ($1, $2, 'pilihan', 't', 'MATH', 'Matematik', 1, '1449/1', 'exam', 'submitted', $3, $3, 60)`,
      [attempt, u1, AT],
    )
    await t.db.query(`insert into attempt_results (attempt_id, score, max_score, graded) values ($1, 4, 8, $2)`, [attempt, JSON.stringify(graded)])

    const dry = await runBackfill(prisma, { apply: false })
    expect(dry.attempts).toBe(1)
    expect(dry.rowsByMode.get('simulasi')).toBe(5)
    expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [attempt])).toBe(0)

    const first = await runBackfill(prisma, { apply: true })
    expect([first.created, first.updated]).toEqual([5, 0])
    const rows = await rowsOf(attempt)
    expect(rows.map((r) => [r.mode, r.question_id, r.part_ref, r.is_correct, r.marks_awarded, r.marks_max, r.session_id])).toEqual([
      ['simulasi', '501', null, true, 1, 1, null],
      ['simulasi', '502', null, false, 0, 1, null],
      ['simulasi', '504', '504-a', false, 1, 3, null],
      ['simulasi', '504', '504-b', true, 2, 2, null],
      ['simulasi', '505', null, true, 4, 4, null],
    ])
    const second = await runBackfill(prisma, { apply: true })
    expect([second.created, second.updated]).toEqual([0, 5])
    expect(await countRows(t.db, 'practice_answers', 'attempt_id = $1', [attempt])).toBe(5)
  })

  describe('--legacy-mode (U-OP-20)', () => {
    const modeOf = async (qid: number) => (await t.db.query<{ mode: string | null }>(`select mode from practice_answers where question_id = $1`, [qid]))[0]?.mode
    async function seedLegacy(): Promise<void> {
      const chapter = randomUUID()
      const pksk = randomUUID()
      for (const [id, mode] of [[chapter, 'chapter'], [pksk, 'pksk']] as const)
        await t.db.query(`insert into practice_sessions (id, user_id, mode, question_count, started_at) values ($1, $2, $3, 1, $4)`, [id, u1, mode, AT])
      const ins = (qid: number, sessionId: string | null, mode: string | null) =>
        t.db.query(`insert into practice_answers (user_id, session_id, question_id, mode, is_correct, answered_at) values ($1, $2, $3, $4, true, $5)`, [u1, sessionId, qid, mode, AT])
      await ins(901, chapter, null)
      await ins(902, chapter, null)
      await ins(903, pksk, null)
      await ins(904, null, null)
      await ins(905, null, null)
      await ins(906, chapter, 'kuiz') // already has a mode: must stay
    }

    it('dry run writes nothing and reports counts per mode', async () => {
      await seedLegacy()
      const r = await runLegacyMode(prisma, { apply: false, batch: 2 })
      expect(Object.fromEntries(r.rowsByMode)).toEqual({ chapter: 2, pksk: 1, latih_tubi: 2 })
      expect(r.updated).toBe(0)
      expect(await countRows(t.db, 'practice_answers', 'mode is null')).toBe(5)
    })

    it('--apply sets the session mode or latih_tubi, across several batches; rows with a mode are untouched; a re-run is a no-op', async () => {
      await seedLegacy()
      const r = await runLegacyMode(prisma, { apply: true, batch: 2 })
      expect(r.batches).toBe(3) // 5 null rows, 2 per batch
      expect(r.updated).toBe(5)
      expect(Object.fromEntries(r.rowsByMode)).toEqual({ chapter: 2, pksk: 1, latih_tubi: 2 })
      expect(await Promise.all([901, 902, 903, 904, 905, 906].map(modeOf))).toEqual(['chapter', 'chapter', 'pksk', 'latih_tubi', 'latih_tubi', 'kuiz'])
      const again = await runLegacyMode(prisma, { apply: true, batch: 2 })
      expect([again.updated, again.batches]).toEqual([0, 0])
      expect(await modeOf(906)).toBe('kuiz')
    })
  })
})
