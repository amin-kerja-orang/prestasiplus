/**
 * M07-T1a student endpoints (SRS M07 v1.7 §7 #1-#6, #21-#23): happy paths and the key failures
 * (401, 403 without access, 404 level / code, 422). Reads run first on the seeded accounts; the
 * writes use other accounts (Ibu Bapa Demo 6 for practice, Pelajar Maju Demo 4 for exams), so the
 * seeded figures of Pelajar Demo stay intact.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

import type {
  PkskAccess,
  PkskDashboard,
  PkskDomain,
  PkskDomainSection,
  PkskExam,
  PkskExamAttempt,
  PkskPractice,
  PkskPracticeResult,
} from '../../api/types'
import { pkskProgress } from '../../mock'
import { m07Hooks } from '../../mock/hooks'
import { displayStatusOf } from '../../mock/repository/rules'
import {
  ADMIN,
  bootPksk,
  call,
  type ErrorBody,
  GURU,
  IBUBAPA,
  MAJU,
  MemoryStorage,
  PELAJAR,
  PELAJAR2,
} from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootPksk()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const get = <T>(userId: number | null, url: string) =>
  call<{ data: T } & ErrorBody>(runtime, 'GET', url, userId)
const post = <T>(userId: number | null, url: string, body?: unknown) =>
  call<{ data: T } & ErrorBody>(runtime, 'POST', url, userId, body)

/** The option index the key marks correct (the test reads the M04 row, the client never can). */
function correctAnswer(questionId: number): {
  questionId: number
  optionIndex?: number
  text?: string
} {
  const q = questions.pkskGet(questionId)
  if (!q) throw new Error(`no PKSK question ${String(questionId)}`)
  if (q.questionType === 'essay') return { questionId, text: 'x'.repeat(60) }
  return { questionId, optionIndex: (q.pkskOptions ?? []).findIndex((o) => o.isCorrect) }
}

describe('#1 GET /api/pksk/me/access', () => {
  it('answers 401 without a session', async () => {
    expect((await get(null, '/api/pksk/me/access')).status).toBe(401)
  })

  it.each([
    [ADMIN, { T1: true, T4: true }, 'admin role (BR-M07-07 c)'],
    [PELAJAR, { T1: true, T4: true }, 'Kombo grant'],
    [MAJU, { T1: true, T4: true }, 'Kombo grant'],
    [IBUBAPA, { T1: true, T4: true }, 'Kombo grant of the parent account'],
    [PELAJAR2, { T1: false, T4: false }, 'no grant'],
    [GURU, { T1: false, T4: false }, 'other roles are grant-based'],
  ])('user %i -> %j (%s)', async (userId, expected) => {
    const r = await get<PkskAccess>(userId, '/api/pksk/me/access')
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual(expected)
  })
})

describe('#2 GET /api/pksk-domains', () => {
  it('lists the 15 domains by order, shipped as live', async () => {
    const r = await get<PkskDomain[]>(PELAJAR2, '/api/pksk-domains')
    expect(r.status).toBe(200)
    expect(r.body.data).toHaveLength(15)
    expect(r.body.data.map((d) => d.order)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(r.body.data[14]).toMatchObject({
      code: 'PKSK_ESSAY',
      bahagian: 'C',
      nameEn: 'Writing Articulation',
      isActive: true,
    })
  })

  it('answers 401 without a session', async () => {
    expect((await get(null, '/api/pksk-domains')).status).toBe(401)
  })
})

describe('#3 GET /api/pksk/levels/:level/dashboard', () => {
  it('shows 55% / C / 2 / 59.7% and the Bahagian B mastery of Pelajar Demo at T1', async () => {
    const r = await get<PkskDashboard>(PELAJAR, '/api/pksk/levels/T1/dashboard')
    expect(r.status).toBe(200)
    const d = r.body.data
    expect(d.level).toBe('T1')
    expect(d.readiness).toEqual({ scorePct: 55, grade: 'C' })
    expect(d.examCount).toBe(2)
    expect(d.bahagianBAvgPct).toBe(59.7)
    expect(d.domains.map((x) => x.id)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(d.domains.map((x) => x.masteryPct)).toEqual([70, 55, 80, 40, 65, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(d.domains[0]).toEqual({
      id: 2,
      code: 'PKSK_MATH',
      name: 'Matematik',
      icon: 'fa-calculator',
      color: '#3b82f6',
      masteryPct: 70,
    })
  })

  it('shows the zero state 0% / E / 0 / 0.0 at T4 and for an account without exams', async () => {
    for (const [user, level] of [
      [PELAJAR, 'T4'],
      [MAJU, 'T1'],
    ] as const) {
      const r = await get<PkskDashboard>(user, `/api/pksk/levels/${level}/dashboard`)
      expect(r.status).toBe(200)
      expect(r.body.data.readiness).toEqual({ scorePct: 0, grade: 'E' })
      expect(r.body.data.examCount).toBe(0)
      expect(r.body.data.bahagianBAvgPct).toBe(0)
      expect(r.body.data.domains.every((x) => x.masteryPct === 0)).toBe(true)
    }
  })

  it('opens both levels for an admin', async () => {
    expect((await get(ADMIN, '/api/pksk/levels/T1/dashboard')).status).toBe(200)
    expect((await get(ADMIN, '/api/pksk/levels/T4/dashboard')).status).toBe(200)
  })

  it('answers 401, 403 without access and 404 for an unknown level (404 first)', async () => {
    expect((await get(null, '/api/pksk/levels/T1/dashboard')).status).toBe(401)
    const denied = await get(PELAJAR2, '/api/pksk/levels/T1/dashboard')
    expect(denied.status).toBe(403)
    expect(denied.body.error.code).toBe('FORBIDDEN')
    for (const level of ['T9', 'ALL', 't1', 'T2']) {
      const r = await get(PELAJAR2, `/api/pksk/levels/${level}/dashboard`)
      expect(r.status, level).toBe(404)
      expect(r.body.error.code).toBe('NOT_FOUND')
    }
  })
})

describe('#4 GET /api/pksk/levels/:level/domains', () => {
  it('returns the three Bahagian sections with approved counts and mastery', async () => {
    const r = await get<PkskDomainSection[]>(PELAJAR, '/api/pksk/levels/T1/domains')
    expect(r.status).toBe(200)
    const s = r.body.data
    expect(s.map((x) => [x.bahagian, x.name, x.subtitle])).toEqual([
      ['A', 'Kecerdasan Insaniah', 'Nilai, akhlak & sahsiah'],
      ['B', 'Kecerdasan Intelek', 'Kognitif & penaakulan'],
      ['C', 'Artikulasi Penulisan', 'Penulisan kreatif'],
    ])
    expect(s.map((x) => x.domains.length)).toEqual([1, 13, 1])
    const sum = (i: number) => (s[i]?.domains ?? []).reduce((a, d) => a + d.questionCount, 0)
    expect([sum(0), sum(1), sum(2)]).toEqual([80, 288, 15])
    expect(s[0]?.domains[0]).toMatchObject({
      code: 'PKSK_INSANIAH',
      questionCount: 80,
      masteryPct: 60,
    })
    expect(s[2]?.domains[0]).toMatchObject({
      code: 'PKSK_ESSAY',
      questionCount: 15,
      masteryPct: 50,
    })
  })

  it('counts per level (T4 Sejarah Malaysia 24; T4 total 380)', async () => {
    const r = await get<PkskDomainSection[]>(PELAJAR, '/api/pksk/levels/T4/domains')
    const all = r.body.data.flatMap((x) => x.domains)
    expect(all.find((d) => d.code === 'PKSK_SEJ')?.questionCount).toBe(24)
    expect(all.reduce((a, d) => a + d.questionCount, 0)).toBe(380)
  })

  it('answers 401, 403 and 404', async () => {
    expect((await get(null, '/api/pksk/levels/T1/domains')).status).toBe(401)
    expect((await get(PELAJAR2, '/api/pksk/levels/T4/domains')).status).toBe(403)
    expect((await get(PELAJAR, '/api/pksk/levels/T9/domains')).status).toBe(404)
  })
})

describe('#6 GET /api/pksk/levels/:level/exam-attempts', () => {
  it('lists the own attempts newest first with the observed scores and grades', async () => {
    const r = await get<PkskExamAttempt[]>(PELAJAR, '/api/pksk/levels/T1/exam-attempts')
    expect(r.status).toBe(200)
    expect(r.body.data.map((a) => [a.completedAt, a.scorePct, a.grade])).toEqual([
      ['2026-09-20T20:00:00+08:00', 64, 'C'],
      ['2026-09-10T20:00:00+08:00', 46, 'D'],
    ])
    expect(Object.keys(r.body.data[0] ?? {}).sort()).toEqual([
      'completedAt',
      'grade',
      'id',
      'scorePct',
    ])
  })

  it('is empty at T4 and for other users, never leaking another account', async () => {
    expect(
      (await get<PkskExamAttempt[]>(PELAJAR, '/api/pksk/levels/T4/exam-attempts')).body.data,
    ).toEqual([])
    expect(
      (await get<PkskExamAttempt[]>(MAJU, '/api/pksk/levels/T1/exam-attempts')).body.data,
    ).toEqual([])
  })

  it('answers 401, 403 and 404', async () => {
    expect((await get(null, '/api/pksk/levels/T1/exam-attempts')).status).toBe(401)
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/exam-attempts')).status).toBe(403)
    expect((await get(PELAJAR, '/api/pksk/levels/T3/exam-attempts')).status).toBe(404)
  })
})

describe('#5 GET /api/pksk/levels/:level/domains/:code', () => {
  it('serves 10 approved questions of the domain and level without any key', async () => {
    const r = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_MATH')
    expect(r.status).toBe(200)
    expect(r.body.data.domain).toEqual({
      id: 2,
      code: 'PKSK_MATH',
      name: 'Matematik',
      bahagian: 'B',
    })
    expect(r.body.data.questions).toHaveLength(10)
    for (const q of r.body.data.questions) {
      const row = questions.pkskGet(q.id)
      expect(row).toMatchObject({ pkskDomainId: 2, pkskTargetLevel: 'T1', status: 'approved' })
      expect(q.options).toHaveLength(4)
      expect(Object.keys(q).sort()).toEqual(['id', 'options', 'questionText'])
    }
    // SEC-M07-07: no isCorrect anywhere in the payload.
    expect(JSON.stringify(r.body)).not.toContain('isCorrect')
    expect(new Set(r.body.data.questions.map((q) => q.id)).size).toBe(10)
  })

  it('serves a text area item set for Bahagian C (no options) and a random order per call', async () => {
    const c = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T4/domains/PKSK_ESSAY')
    expect(c.body.data.questions).toHaveLength(10)
    expect(c.body.data.questions.every((q) => q.options.length === 0)).toBe(true)
    const a = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_INSANIAH')
    const b = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_INSANIAH')
    expect(a.body.data.questions.map((q) => q.id)).not.toEqual(
      b.body.data.questions.map((q) => q.id),
    )
  })

  it('answers 401, 403 (even for an unknown code), 404 level, 404 unknown or lower-case code', async () => {
    expect((await get(null, '/api/pksk/levels/T1/domains/PKSK_MATH')).status).toBe(401)
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/domains/PKSK_MATH')).status).toBe(403)
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/domains/NOPE')).status).toBe(403)
    expect((await get(IBUBAPA, '/api/pksk/levels/T9/domains/PKSK_MATH')).status).toBe(404)
    expect((await get(IBUBAPA, '/api/pksk/levels/T1/domains/NOPE')).status).toBe(404)
    expect((await get(IBUBAPA, '/api/pksk/levels/T1/domains/pksk_math')).status).toBe(404)
  })
})

describe('#21 POST /api/pksk/levels/:level/domains/:code/practice-sessions', () => {
  it('records one completed M05 session with mode pksk and sets the mastery (BR-M07-26)', async () => {
    const served = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_SCI')
    const ids = served.body.data.questions.map((q) => q.id)
    const answers = ids.map((id, i) =>
      i < 7 ? correctAnswer(id) : { questionId: id, optionIndex: 99 },
    )
    const queueBefore = practice.queueAll(IBUBAPA).length
    const masteryBefore = practice.mastery(IBUBAPA).length
    const r = await post<PkskPracticeResult>(
      IBUBAPA,
      '/api/pksk/levels/T1/domains/PKSK_SCI/practice-sessions',
      { answers },
    )
    expect(r.status).toBe(201)
    const d = r.body.data
    expect(d.masteryPct).toBe(70)
    expect(typeof d.sessionId).toBe('string')
    expect(Object.keys(d.gamification).sort()).toEqual([
      'coinsEarned',
      'pointsEarned',
      'streakCount',
      'totalBalance',
    ])
    // The session lives in M05, never in M07.
    const s = practice.session(d.sessionId)
    expect(s).toMatchObject({
      userId: IBUBAPA,
      mode: 'pksk',
      subjectId: null,
      pkskDomainId: 3,
      pkskTargetLevel: 'T1',
      questionCount: 10,
      correctCount: 7,
      status: 'completed',
    })
    expect(s?.questionIds).toEqual(ids)
    const rows = practice.sessionAnswers(d.sessionId)
    expect(rows).toHaveLength(10)
    expect(rows.filter((a) => a.isCorrect)).toHaveLength(7)
    expect(rows.every((a) => a.subjectId === null)).toBe(true)
    // M14 credited syiling at the tier's PKSK rate for the correct answers (M14 step 6).
    expect(d.gamification.coinsEarned).toBeGreaterThan(0)
    expect(d.gamification.pointsEarned).toBeGreaterThan(0)
    // No revision-queue or subject-mastery change (BR-M07-26 (3), (4)).
    expect(practice.queueAll(IBUBAPA)).toHaveLength(queueBefore)
    expect(practice.mastery(IBUBAPA)).toHaveLength(masteryBefore)
    // M07 keeps the mastery itself, and the dashboard shows it.
    expect(pkskProgress.mastery(IBUBAPA, 'T1', 3)).toBe(70)
    const dash = await get<PkskDashboard>(IBUBAPA, '/api/pksk/levels/T1/dashboard')
    expect(dash.body.data.domains.find((x) => x.id === 3)?.masteryPct).toBe(70)
    expect(dash.body.data.domains.find((x) => x.id === 2)?.masteryPct).toBe(0)
  })

  it('replaces the mastery with the latest session and scores unanswered items wrong', async () => {
    const served = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_SCI')
    const ids = served.body.data.questions.map((q) => q.id)
    const r = await post<PkskPracticeResult>(
      IBUBAPA,
      '/api/pksk/levels/T1/domains/PKSK_SCI/practice-sessions',
      { answers: [correctAnswer(ids[0] as number), { questionId: ids[1] as number }] },
    )
    expect(r.status).toBe(201)
    expect(r.body.data.masteryPct).toBe(50)
    expect(practice.session(r.body.data.sessionId)).toMatchObject({
      questionCount: 2,
      correctCount: 1,
    })
    expect(pkskProgress.mastery(IBUBAPA, 'T1', 3)).toBe(50)
  })

  it('marks a Bahagian C essay with the simulated marker (long text passes, short fails)', async () => {
    const served = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T4/domains/PKSK_ESSAY')
    const [a, b] = served.body.data.questions.map((q) => q.id) as [number, number]
    const r = await post<PkskPracticeResult>(
      IBUBAPA,
      '/api/pksk/levels/T4/domains/PKSK_ESSAY/practice-sessions',
      {
        answers: [
          { questionId: a, text: 'a'.repeat(80) },
          { questionId: b, text: 'pendek' },
        ],
      },
    )
    expect(r.status).toBe(201)
    expect(r.body.data.masteryPct).toBe(50)
    expect(practice.session(r.body.data.sessionId)).toMatchObject({
      mode: 'pksk',
      pkskDomainId: 15,
      pkskTargetLevel: 'T4',
    })
  })

  it('answers 422 for a bad body, a question of another domain or level, a duplicate', async () => {
    const url = '/api/pksk/levels/T1/domains/PKSK_MATH/practice-sessions'
    const served = await get<PkskPractice>(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_MATH')
    const own = served.body.data.questions[0]?.id as number
    const otherDomain = questions.pkskList({ domainIds: [3], targetLevel: 'T1' }).rows[0]
      ?.id as number
    const otherLevel = questions.pkskList({ domainIds: [2], targetLevel: 'T4' }).rows[0]
      ?.id as number
    const m04Row = 1
    for (const body of [
      undefined,
      {},
      { answers: [] },
      { answers: 'x' },
      { answers: [{ questionId: 'a' }] },
      { answers: [{ questionId: own, optionIndex: 1.5 }] },
      { answers: [{ questionId: own, text: 7 }] },
      { answers: [{ questionId: own }, { questionId: own }] },
      { answers: [{ questionId: otherDomain }] },
      { answers: [{ questionId: otherLevel }] },
      { answers: [{ questionId: m04Row }] },
      { answers: [{ questionId: 999_999_999 }] },
    ]) {
      const r = await post(IBUBAPA, url, body)
      expect(r.status, JSON.stringify(body)).toBe(422)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
      expect(r.body.error.fields?.answers).toBeTruthy()
    }
  })

  it('does not record a session for a refused request', async () => {
    const before = practice.history(IBUBAPA).length
    await post(IBUBAPA, '/api/pksk/levels/T1/domains/PKSK_MATH/practice-sessions', { answers: [] })
    expect(practice.history(IBUBAPA)).toHaveLength(before)
  })

  it('answers 401, 403 and 404 (level, code)', async () => {
    const url = (l: string, c: string) => `/api/pksk/levels/${l}/domains/${c}/practice-sessions`
    const body = { answers: [{ questionId: 177698 }] }
    expect((await post(null, url('T1', 'PKSK_MATH'), body)).status).toBe(401)
    expect((await post(PELAJAR2, url('T1', 'PKSK_MATH'), body)).status).toBe(403)
    expect((await post(IBUBAPA, url('T9', 'PKSK_MATH'), body)).status).toBe(404)
    expect((await post(IBUBAPA, url('T1', 'NOPE'), body)).status).toBe(404)
  })
})

describe('#22 GET /api/pksk/levels/:level/exam', () => {
  it.each(['T1', 'T4'])('serves 30 A + 70 B + 1 C at %s without any key', async (level) => {
    const r = await get<PkskExam>(MAJU, `/api/pksk/levels/${level}/exam`)
    expect(r.status).toBe(200)
    const sections = r.body.data.sections
    expect(sections.map((s) => [s.bahagian, s.weightPct, s.questions.length])).toEqual([
      ['A', 20, 30],
      ['B', 70, 70],
      ['C', 10, 1],
    ])
    const domainsOf = (i: number) =>
      new Set((sections[i]?.questions ?? []).map((q) => questions.pkskGet(q.id)?.pkskDomainId))
    expect([...domainsOf(0)]).toEqual([1])
    expect([...domainsOf(2)]).toEqual([15])
    expect([...domainsOf(1)].every((d) => (d as number) >= 2 && (d as number) <= 14)).toBe(true)
    for (const q of sections.flatMap((s) => s.questions)) {
      expect(questions.pkskGet(q.id)).toMatchObject({ pkskTargetLevel: level, status: 'approved' })
    }
    expect(new Set(sections.flatMap((s) => s.questions.map((q) => q.id))).size).toBe(101)
    expect(sections[2]?.questions[0]?.options).toEqual([])
    expect(JSON.stringify(r.body)).not.toContain('isCorrect')
  })

  it('answers 401, 403 and 404', async () => {
    expect((await get(null, '/api/pksk/levels/T1/exam')).status).toBe(401)
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/exam')).status).toBe(403)
    expect((await get(MAJU, '/api/pksk/levels/T9/exam')).status).toBe(404)
  })
})

describe('#23 POST /api/pksk/levels/:level/exam-attempts', () => {
  const url = '/api/pksk/levels/T1/exam-attempts'

  it('stores a full-marks attempt (100, A) and shows it in the history and the dashboard', async () => {
    const exam = await get<PkskExam>(MAJU, '/api/pksk/levels/T1/exam')
    const answers = exam.body.data.sections.flatMap((s) =>
      s.questions.map((q) => correctAnswer(q.id)),
    )
    const r = await post<PkskExamAttempt>(MAJU, url, { answers })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({ scorePct: 100, grade: 'A' })
    expect(r.body.data.completedAt).toBe('2026-09-25T15:40:00+08:00')
    const list = await get<PkskExamAttempt[]>(MAJU, url)
    expect(list.body.data.map((a) => a.id)).toEqual([r.body.data.id])
    const dash = await get<PkskDashboard>(MAJU, '/api/pksk/levels/T1/dashboard')
    expect(dash.body.data.readiness).toEqual({ scorePct: 100, grade: 'A' })
    expect(dash.body.data.examCount).toBe(1)
    expect(dash.body.data.bahagianBAvgPct).toBe(100)
    // Exam attempts are M07 records, not M05 sessions, and credit no syiling (SQ-M07-03).
    expect(practice.history(MAJU).some((s) => s.mode === 'pksk')).toBe(false)
  })

  it('scores a partial attempt per Bahagian with the 20/70/10 weights (BR-M07-09, BR-M07-10)', async () => {
    const exam = await get<PkskExam>(MAJU, '/api/pksk/levels/T1/exam')
    const a = exam.body.data.sections[0]?.questions.slice(0, 15) ?? []
    const r = await post<PkskExamAttempt>(MAJU, url, {
      answers: a.map((q) => correctAnswer(q.id)),
    })
    expect(r.status).toBe(201)
    // A 15/30 = 50%, B 0, C 0 -> 0.2 x 50 = 10.0 -> E.
    expect(r.body.data).toMatchObject({ scorePct: 10, grade: 'E' })
    const stored = pkskProgress.attempts(MAJU, 'T1').find((x) => x.id === r.body.data.id)
    expect(stored).toMatchObject({ bahagianAPct: 50, bahagianBPct: 0, bahagianCPct: 0 })
    const list = await get<PkskExamAttempt[]>(MAJU, url)
    expect(list.body.data.map((x) => x.scorePct)).toEqual([10, 100])
  })

  it('answers 422 for a bad body, a wrong-level question or more items than the exam holds', async () => {
    const t4 = questions.pkskList({ targetLevel: 'T4' }).rows[0]?.id as number
    const t1A = questions.pkskList({ domainIds: [1], targetLevel: 'T1', pageSize: 40 }).rows
    for (const body of [
      undefined,
      { answers: [] },
      { answers: [{ questionId: t4 }] },
      { answers: t1A.slice(0, 31).map((q) => ({ questionId: q.id })) },
      { answers: [{ questionId: 1 }] },
    ]) {
      const r = await post(MAJU, url, body)
      expect(r.status, JSON.stringify(body)?.slice(0, 40)).toBe(422)
      expect(r.body.error.fields?.answers).toBeTruthy()
    }
    expect(pkskProgress.attempts(MAJU, 'T1')).toHaveLength(2)
  })

  it('answers 401, 403 and 404', async () => {
    const body = { answers: [{ questionId: 177698 }] }
    expect((await post(null, url, body)).status).toBe(401)
    expect((await post(PELAJAR2, url, body)).status).toBe(403)
    expect((await post(MAJU, '/api/pksk/levels/T9/exam-attempts', body)).status).toBe(404)
  })
})

describe('access rules (BR-M07-07, BR-M07-16) on the level gate', () => {
  it('treats an expiry date as valid through the end of that day', () => {
    const today = Date.parse('2026-09-25T23:59:00+08:00')
    expect(displayStatusOf({ status: 'active', expiresAt: '2026-09-25' }, today)).toBe('active')
    expect(displayStatusOf({ status: 'active', expiresAt: '2026-09-24' }, today)).toBe('expired')
    expect(displayStatusOf({ status: 'active', expiresAt: null }, today)).toBe('active')
    expect(displayStatusOf({ status: 'revoked', expiresAt: null }, today)).toBe('revoked')
  })

  it('opens both levels from the M02 flag (hasPkskSubscription) without any grant', async () => {
    const before = await get<PkskAccess>(11, '/api/pksk/me/access')
    expect(before.body.data).toEqual({ T1: false, T4: false })
    // M02 PUT /api/admin/users/:id (SRS M02 §7 #5) sets the flag; M07 reads it, never writes it.
    const put = await call<ErrorBody>(runtime, 'PUT', '/api/admin/users/11', ADMIN, {
      name: 'Pelajar Tidak Aktif Demo',
      email: 'tidakaktif@demo.test',
      role: 'student',
      grade: 7,
      hasPkskSubscription: true,
    })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    const after = await get<PkskAccess>(11, '/api/pksk/me/access')
    expect(after.body.data).toEqual({ T1: true, T4: true })
    expect((await get(11, '/api/pksk/levels/T4/dashboard')).status).toBe(200)
  })

  it('ignores an expired and a revoked grant (edge-case fixture, provisional)', async () => {
    expect(m07Hooks.seedPkskAccessEdgeCases()).toBe(2)
    const r = await get<PkskAccess>(PELAJAR2, '/api/pksk/me/access')
    expect(r.body.data).toEqual({ T1: false, T4: false })
    expect((await get(PELAJAR2, '/api/pksk/levels/T1/dashboard')).status).toBe(403)
    expect(() => m07Hooks.seedPkskAccessEdgeCases()).toThrow(/already present/)
  })
})
