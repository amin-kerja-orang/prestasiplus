/**
 * F-26: the shared practice store (owner M05; SRS M05 v1.16 §6.12, §6.14, §7 #4–#6, #23, BR-06/07/
 * 09/14/16/18/19/20/21/30/31/34/35; build plan v1.8 F-26 "Accept"; overview §6.6–§6.8). Booted with
 * the real core, M01, M02, M03, M04, M05 and M14, at the project clock 2026-09-25 15:40 MYT.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { toEpochMs } from '@/lib/time'
import { mulberry32 } from '@/mock/determinism'
import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { achievements, challenges, streak, wallet } from '@/modules/m14-gamification/mock'

import { practice, practiceAnswers, type AnswerRow, type SessionRow } from '../../mock'
import { WINDOW_FROM, PIN_NOW } from '../../mock/datasets/calendar'
import { sessionsDataset } from '../../mock/datasets/sessions'
import { BEFORE_M1, M11_AKTIF, M11_WEEKLY } from '../../mock/datasets/m11-cells'
import { practicePrimeOrNull } from '../../mock/datasets/prime'
import { useOfferedLevels } from '../../mock/repository/rules'
import { setPracticeSeamsForTests, type GamificationInput } from '../../mock/repository/seams'
import { bootPractice, request } from './helpers'

let runtime: MockRuntime

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
}

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootPractice()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const pct1 = (n: number) => Math.round(n * 10) / 10
const DAY = 86_400_000

// ---------------------------------------------------------------------------------------------
// Named queries and dataset pins (§6.14.1, §6.14.2)
// ---------------------------------------------------------------------------------------------

describe('answer log and sessions: §6.14.2 named queries at the clock', () => {
  it('Q-ANS-ALL 478,499 · Q-ANS-CORRECT 396,391 (82.8 %) · Q-ANS-NOSESSION 6,604 · Q-ANS-OTHER 6,128', () => {
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(478_499)
    expect(practiceAnswers.count('Q-ANS-CORRECT')).toBe(396_391)
    expect(pct1((396_391 / 478_499) * 100)).toBe(82.8)
    expect(practiceAnswers.count('Q-ANS-NOSESSION')).toBe(6_604)
    expect(practiceAnswers.count('Q-ANS-OTHER')).toBe(6_128)
    // Session answers 471,895 (§6.14.1).
    expect(practiceAnswers.count('Q-ANS-ALL') - practiceAnswers.count('Q-ANS-NOSESSION')).toBe(
      471_895,
    )
  })

  it('P (M17): 477,743 answers, 395,873 correct (82.9 %); non-P 756 with 518 correct', () => {
    expect(practiceAnswers.count('Q-ANS-P')).toBe(477_743)
    expect(practiceAnswers.count('Q-ANS-P-CORRECT')).toBe(395_873)
    expect(pct1((395_873 / 477_743) * 100)).toBe(82.9)
    expect(practiceAnswers.count('Q-ANS-NON-P')).toBe(756)
    expect(practiceAnswers.count('Q-ANS-CORRECT') - practiceAnswers.count('Q-ANS-P-CORRECT')).toBe(
      518,
    )
  })

  it('Q-ANS-SEG 472,371 · 7d 7,651 · 30d 22,207 · 3m 86,697 (M11 BR-M11-10 at the clock)', () => {
    expect(practiceAnswers.count('Q-ANS-SEG')).toBe(472_371)
    expect(practiceAnswers.count('Q-ANS-SEG', '7d')).toBe(7_651)
    expect(practiceAnswers.count('Q-ANS-SEG', '30d')).toBe(22_207)
    expect(practiceAnswers.count('Q-ANS-SEG', '3m')).toBe(86_697)
  })

  it('every observed M11 weekly cell (school × M1–M32) and the 12 answers before M1 at 8765', () => {
    for (const [school, weeks] of Object.entries(M11_WEEKLY)) {
      const s = Number(school)
      weeks.forEach((n, i) => {
        expect(
          practiceAnswers.count('Q-ANS-SEG', '', s, i + 1),
          `${school} M${String(i + 1)}`,
        ).toBe(n)
      })
      const before = BEFORE_M1[s] ?? 0
      expect(practiceAnswers.count('Q-ANS-SEG', '', s, 0)).toBe(before)
      expect(practiceAnswers.count('Q-ANS-SEG', '', s)).toBe(
        weeks.reduce((a, b) => a + b, 0) + before,
      )
    }
    expect(practiceAnswers.count('Q-ANS-SEG', '', 8765)).toBe(222)
    expect(practiceAnswers.count('Q-ANS-SEG', '', 8880)).toBe(10_196)
  })

  it('M11 S2 "Aktif" per school: all / 7d / 30d / 3m distinct answering pupils', () => {
    const from = { d7: WINDOW_FROM.d7, d30: WINDOW_FROM.d30, m3: WINDOW_FROM.m3 }
    for (const [school, [all, d7, d30, m3]] of Object.entries(M11_AKTIF)) {
      const s = Number(school)
      const count = (f?: number) =>
        practice.distinctUsers({
          by: 'answers',
          population: 'segment',
          schoolId: s,
          ...(f !== undefined ? { from: f } : {}),
        })
      expect([count(), count(from.d7), count(from.d30), count(from.m3)], school).toEqual([
        all,
        d7,
        d30,
        m3,
      ])
    }
    // Σ 1,462 · 44 · 89 · 298 (M11 §6.7 totals).
    expect(practice.distinctUsers({ by: 'answers', population: 'segment' })).toBe(1_462)
  })

  it('Q-SESS-ALL 32,122; Q-SESS-MEAN-ACC 79.8 %; Q-SESS-LINK 7103 → 5, 7104 → 3', () => {
    expect(practice.count('Q-SESS-ALL')).toBe(32_122)
    expect(pct1(practice.sessionMeanAccuracy())).toBe(79.8)
    expect(practice.count('Q-SESS-LINK', 7103)).toBe(5)
    expect(practice.count('Q-SESS-LINK', 7104)).toBe(3)
    expect(practice.count('Q-SESS-LINK', 7101)).toBe(0)
    expect(practice.count('Q-SESS-LINK-REMEDIAL', 7601)).toBe(0)
    expect(practice.count('Q-SESS-LINK-SET', 7402)).toBe(0)
    // Every seeded session is completed; no `pksk` session in the seed (feas C14).
    expect(sessionsDataset.count({ mode: 'pksk' })).toBe(0)
    expect(sessionsDataset.count({ status: 'in_progress' })).toBe(0)
  })

  it('M17 pins over P at the clock: answers, correct, sessions, engaged, missions', () => {
    expect(practiceAnswers.count('Q-ANS-P', 'today')).toBe(340)
    expect(practiceAnswers.count('Q-ANS-P', 'week')).toBe(2_508)
    expect(practiceAnswers.count('Q-ANS-P', 'month')).toBe(20_206)
    expect(practiceAnswers.count('Q-ANS-P-CORRECT', 'today')).toBe(264)
    expect(practiceAnswers.count('Q-ANS-P-CORRECT', 'week')).toBe(2_122)
    expect(practiceAnswers.count('Q-ANS-P-CORRECT', 'month')).toBe(17_667)
    expect(practice.count('Q-SESS-P', 'today')).toBe(17)
    expect(practice.count('Q-SESS-P', 'week')).toBe(152)
    expect(practice.count('Q-SESS-P', 'month')).toBe(1_250)
    const engaged = (from?: number) =>
      practice.distinctUsers({
        by: 'answers',
        population: 'P',
        ...(from !== undefined ? { from } : {}),
      })
    expect([
      engaged(WINDOW_FROM.today),
      engaged(WINDOW_FROM.week),
      engaged(WINDOW_FROM.month),
      engaged(),
    ]).toEqual([4, 32, 86, 1_563])
    // Q-M17-MISSIONS: week 3, month 8, today 0.
    const missions = (from: number) =>
      [7103, 7104].reduce(
        (a, id) => a + practiceMissionSessions(id).filter((s) => s.completedAtMs >= from).length,
        0,
      )
    expect([
      missions(WINDOW_FROM.today),
      missions(WINDOW_FROM.week),
      missions(WINDOW_FROM.month),
    ]).toEqual([0, 3, 8])
  })

  it('M08 S20: 46 distinct users with a completed session since Mon 21 Sep', () => {
    expect(practice.distinctUsers({ by: 'sessions', from: WINDOW_FROM.week })).toBe(46)
  })

  it('nothing is dated after the clock; generated sessions group answers of one user and day', () => {
    const p = practicePrimeOrNull()
    if (!p) throw new Error('not primed')
    let late = 0
    for (let k = 1; k < p.aMs.length; k++) if ((p.aMs[k] as number) > PIN_NOW) late++
    expect(late).toBe(0)
    // A sample of generated sessions: size, correct, user and day agree with their answers.
    for (const key of [1, 2, 3, 500, 1_000, 5_000, 12_345, 20_000, 31_000]) {
      const s = practice.session(`g${String(key)}`)
      if (!s) continue
      const answers = practice.sessionAnswers(s.id)
      expect(answers).toHaveLength(s.questionCount)
      expect(answers.filter((a) => a.isCorrect)).toHaveLength(s.correctCount)
      expect(new Set(answers.map((a) => a.userId))).toEqual(new Set([s.userId]))
      expect(answers.map((a) => a.questionId)).toEqual(s.questionIds)
      const day = (iso: string) => iso.slice(0, 10)
      expect(new Set(answers.map((a) => day(a.answeredAt)))).toEqual(
        new Set([day(s.completedAt as string)]),
      )
      expect(answers.every((a) => a.answeredAtMs <= s.completedAtMs)).toBe(true)
      expect(answers.every((a) => a.subjectId === s.subjectId)).toBe(true)
    }
  })
})

/** Sessions linked to a mission (all users). */
function practiceMissionSessions(missionId: number): SessionRow[] {
  const out: SessionRow[] = []
  // Q-SESS-LINK rows (facet), read through the named query.
  for (const row of practice.query('Q-SESS-LINK', {}, missionId).rows) out.push(row)
  return out
}

// ---------------------------------------------------------------------------------------------
// Inactive users never practise (M02 v1.23; F-23 hand-over)
// ---------------------------------------------------------------------------------------------

describe('inactive users', () => {
  it('no answer or session belongs to an inactive user — the 18 login-only pupils of 8090 included', () => {
    const answerUsers = new Set<number>()
    const p = practicePrimeOrNull()
    if (!p) throw new Error('not primed')
    for (let k = 1; k < p.aUser.length; k++) {
      const u = p.aUser[k] as number
      if (u > 0) answerUsers.add(u)
    }
    for (let k = 1; k < p.sUser.length; k++) {
      const u = p.sUser[k] as number
      if (u > 0) answerUsers.add(u)
    }
    const inactive = [...answerUsers].filter((id) => users.get(id)?.isActive !== true)
    expect(inactive).toEqual([])
    const loginOnly8090 = users
      .query('U-SCHOOL', { sort: 'id' }, 8090)
      .rows.filter((u) => u.role === 'student' && !u.isActive && u.hasLoggedIn)
    expect(loginOnly8090.length).toBeGreaterThanOrEqual(18)
    for (const u of loginOnly8090) {
      expect(practiceAnswers.count('Q-ANS-USER', u.id), String(u.id)).toBe(0)
      expect(practice.count('Q-SESS-USER', u.id), String(u.id)).toBe(0)
    }
  })

  it('a contributed anchor of an inactive user is refused (the boot stops)', async () => {
    const { defineMockModule } = await import('@/mock/define')
    const { bootMock } = await import('@/mock/index')
    const { createClock } = await import('@/lib/time')
    const m01 = (await import('@/modules/m01-authentication/mock')).default
    const m02 = (await import('@/modules/m02-users-schools/mock')).default
    const m03 = (await import('@/modules/m03-curriculum/mock')).default
    const m04 = (await import('@/modules/m04-question-bank/mock')).default
    const m05 = (await import('../../mock')).default
    const inactive = users
      .query('U-SCHOOL', { sort: 'id' }, 8090)
      .rows.find((u) => u.role === 'student' && !u.isActive && u.hasLoggedIn)
    if (!inactive) throw new Error('no inactive 8090 pupil')
    const contributor = defineMockModule({
      id: 'M08',
      dependsOn: ['M05'],
      seed(ctx) {
        practice.contributeAnswers(ctx, [
          {
            id: 510_001,
            userId: inactive.id,
            questionId: 600_001,
            isCorrect: true,
            answeredAt: '2026-09-20T10:00:00+08:00',
          },
        ])
      },
    })
    await expect(
      bootMock({
        mode: 'test',
        plugins: [m01, m02, m03, m04, m05, contributor],
        clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
        latencyMs: 0,
        onWarn: null,
      }),
    ).rejects.toThrow(/inactive and never practises/)
    // Restore this file's runtime.
    runtime = (await bootPractice()).runtime
  }, 120_000)
})

// ---------------------------------------------------------------------------------------------
// Contributions of other modules (anchors replace generated rows; nothing is added)
// ---------------------------------------------------------------------------------------------

describe('contributed anchors (D11: "fixtures are anchors, not additions")', () => {
  it('an answer and a session of Student A (2008, 8080) replace generated rows; every pin holds', async () => {
    const { defineMockModule } = await import('@/mock/define')
    const { bootMock } = await import('@/mock/index')
    const { createClock } = await import('@/lib/time')
    const m01 = (await import('@/modules/m01-authentication/mock')).default
    const m02 = (await import('@/modules/m02-users-schools/mock')).default
    const m03 = (await import('@/modules/m03-curriculum/mock')).default
    const m04 = (await import('@/modules/m04-question-bank/mock')).default
    const m05 = (await import('../../mock')).default
    const q = 600_001
    const contributor = defineMockModule({
      id: 'M11',
      dependsOn: ['M05'],
      seed(ctx) {
        practice.contributeSessions(ctx, [
          {
            id: 'SA1',
            userId: 2008,
            mode: 'random',
            completedAt: '2026-06-16T14:19:00+08:00',
            questionCount: 2,
            correctCount: 1,
            subjectId: 1,
            timeSpent: 60,
          },
        ])
        practice.contributeAnswers(ctx, [
          {
            id: 520_001,
            userId: 2008,
            questionId: q,
            isCorrect: true,
            answeredAt: '2026-06-16T14:18:00+08:00',
            sessionId: 'SA1',
          },
          {
            id: 520_002,
            userId: 2008,
            questionId: q + 1,
            isCorrect: false,
            answeredAt: '2026-06-16T14:19:00+08:00',
            sessionId: 'SA1',
          },
        ])
      },
    })
    await bootMock({
      mode: 'test',
      plugins: [m01, m02, m03, m04, m05, contributor],
      clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
      latencyMs: 0,
      onWarn: null,
    })
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(478_499)
    expect(practiceAnswers.count('Q-ANS-SEG', '', 8080, 18)).toBe(37_748)
    expect(practice.count('Q-SESS-ALL')).toBe(32_122)
    expect(practice.answers(2008).map((a) => [a.id, a.sessionId, a.isCorrect])).toEqual([
      [520_001, 'SA1', true],
      [520_002, 'SA1', false],
    ])
    expect(practice.history(2008).map((s) => s.id)).toEqual(['SA1'])
    // The contributed pupil counts once in 8080's Aktif; the generated pupils fill the rest.
    expect(practice.distinctUsers({ by: 'answers', population: 'segment', schoolId: 8080 })).toBe(
      174,
    )
    expect(pct1(practice.sessionMeanAccuracy())).toBe(79.8)
    // BR-14: the anchor user's queue is stored from the anchors.
    expect(practice.queueAll(2008).map((x) => x.questionId)).toEqual([q + 1])
    runtime = (await bootPractice()).runtime
  }, 120_000)
})

// ---------------------------------------------------------------------------------------------
// Canonical accounts (§6.12 resulting anchors; the M14 hand-over)
// ---------------------------------------------------------------------------------------------

describe('canonical accounts (§6.12)', () => {
  it('admin: S8 `all` 119 / 38.7 % / 4 / "4m"; BM 79 · 32, SEJ 40 · 14; chart 19/02, 11/05, 19/05', () => {
    const answers = practice.answers(1)
    expect(answers).toHaveLength(119)
    const correct = answers.filter((a) => a.isCorrect).length
    expect(correct).toBe(46)
    expect(pct1((correct / 119) * 100)).toBe(38.7)
    const by = (subjectId: number) => answers.filter((a) => a.subjectId === subjectId)
    expect([by(1).length, by(1).filter((a) => a.isCorrect).length]).toEqual([79, 32])
    expect([by(5).length, by(5).filter((a) => a.isCorrect).length]).toEqual([40, 14])
    const byDay = new Map<string, AnswerRow[]>()
    for (const a of answers)
      byDay.set(a.answeredAt.slice(0, 10), [...(byDay.get(a.answeredAt.slice(0, 10)) ?? []), a])
    const chart = [...byDay].map(([d, list]) => [
      d,
      list.length,
      pct1((list.filter((a) => a.isCorrect).length / list.length) * 100),
    ])
    expect(chart).toEqual([
      ['2026-02-19', 35, 57.1],
      ['2026-05-11', 74, 33.8],
      ['2026-05-19', 10, 10],
    ])
    const sessions = practice.history(1)
    expect(sessions.map((s) => s.id)).toEqual(['A5', 'A4', 'A3', 'A2'])
    expect(Math.floor(sessions.reduce((a, s) => a + s.timeSpent, 0) / 60)).toBe(4)
    // 35 sessionless (live), BM D1 chapters + 2 BM D2.
    expect(answers.filter((a) => a.sessionId === null)).toHaveLength(35)
  })

  it('admin: S9 4 / 84 / 21.8 % / 26 coins; S6 BM 46 / SEJ 26 / 72; the repeated question "Salah 2x"', () => {
    const page = practice.historyPage(1, {
      modes: [
        'random',
        'chapter',
        'revision',
        'past_year',
        'latih_tubi',
        'ramalan',
        'mission',
        'remedial',
        'question_set',
        'pksk',
      ],
    })
    expect(page.stats).toEqual({ sessions: 4, avgAccuracyPct: 21.8, coins: 26, answered: 84 })
    const queue = practice.queueAll(1)
    expect(queue.filter((q) => q.subjectId === 1)).toHaveLength(46)
    expect(queue.filter((q) => q.subjectId === 5)).toHaveLength(26)
    expect(queue).toHaveLength(72)
    expect(queue.filter((q) => q.wrongTimes === 2)).toHaveLength(1)
    expect(practice.queue(1)).toHaveLength(72)
    expect(practice.mastery(1)).toEqual([
      { subjectId: 1, correct: 46, answered: 94, lastAnsweredAt: '2026-05-19T03:49:00+08:00' },
      { subjectId: 5, correct: 14, answered: 40, lastAnsweredAt: '2026-05-11T14:22:00+08:00' },
    ])
  })

  it('admin: S5 BM D1 Bab 1 18/320 44.4 %, Bab 2 5/317 60 %, Bab 3 10/321 80 %; S11 May 74 · 25', () => {
    const s = (ch: number) => practice.chapterStats(1, ch)
    expect(s(35)).toMatchObject({ total: 320, answered: 18, remaining: 302 })
    expect(pct1(s(35).scorePct)).toBe(44.4)
    expect(s(36)).toMatchObject({ total: 317, answered: 5, scorePct: 60 })
    expect(s(2)).toMatchObject({ total: 321, answered: 10, scorePct: 80 })
    // BR-18: the questions first answered in May, excluding `past_year` answers: 74, 25 correct.
    const may = practice
      .answers(1, {
        from: toEpochMs('2026-05-01T00:00:00+08:00'),
        to: toEpochMs('2026-06-01T00:00:00+08:00'),
      })
      .filter((a) => ['A2', 'A3'].includes(a.sessionId ?? ''))
    expect(may).toHaveLength(74)
    expect(may.filter((a) => a.isCorrect)).toHaveLength(25)
    expect(new Set(may.map((a) => a.questionId)).size).toBe(74)
  })

  it('pelajar: P1–P4 as the M14 hand-over; S9 4 / 94 / 65.4 % / 70; S8 30 days 94 / 74.5 % / "30m"; S6 24', () => {
    const rows = practice.history(2).reverse()
    expect(rows.map((s) => [s.id, s.mode, s.completedAt, s.correct, s.total, s.timeSpent])).toEqual(
      [
        ['P1', 'past_year', '2026-09-22T19:00:00+08:00', 4, 10, 300],
        ['P2', 'latih_tubi', '2026-09-24T20:15:00+08:00', 26, 34, 360],
        ['P3', 'past_year', '2026-09-24T20:40:00+08:00', 6, 10, 270],
        ['P4', 'ramalan', '2026-09-25T08:30:00+08:00', 34, 40, 900],
      ],
    )
    const page = practice.historyPage(2, { modes: ['past_year', 'latih_tubi', 'ramalan'] })
    expect(page.stats).toEqual({ sessions: 4, avgAccuracyPct: 65.4, coins: 70, answered: 94 })
    const a30 = practice.answers(2, { from: PIN_NOW - 29 * DAY - (PIN_NOW % DAY) })
    expect(a30).toHaveLength(94)
    expect(pct1((a30.filter((a) => a.isCorrect).length / 94) * 100)).toBe(74.5)
    expect(Math.floor(rows.reduce((a, s) => a + s.timeSpent, 0) / 60)).toBe(30)
    const q = practice.queueAll(2)
    const by = (s: number) => q.filter((x) => x.subjectId === s).length
    expect([by(1), by(3), by(5), by(21), q.length]).toEqual([8, 6, 4, 6, 24])
    expect(practice.mastery(2).map((m) => [m.subjectId, m.correct, m.answered])).toEqual([
      [1, 26, 34],
      [3, 4, 10],
      [5, 6, 10],
      [21, 34, 40],
    ])
    expect(practice.spmTargets(2).map((t) => [t.subjectId, t.targetGrade])).toEqual([
      [1, 'A'],
      [3, 'B+'],
      [5, 'A-'],
    ])
  })

  it('pelajarmaju: M1–M4 as the M14 hand-over; M3 / M4 answers on MATH D1 chapters 1, 143, 136', () => {
    const rows = practice.history(4).reverse()
    expect(rows.map((s) => [s.id, s.mode, s.completedAt, s.correct, s.total, s.timeSpent])).toEqual(
      [
        ['M1', 'chapter', '2026-09-23T16:10:00+08:00', 8, 10, 260],
        ['M2', 'chapter', '2026-09-24T17:05:00+08:00', 9, 10, 230],
        ['M3', 'random', '2026-09-25T09:15:00+08:00', 6, 10, 310],
        ['M4', 'revision', '2026-09-25T10:00:00+08:00', 3, 7, 150],
      ],
    )
    const chapters = (id: string) => new Set(practice.sessionAnswers(id).map((a) => a.chapterId))
    expect(chapters('M1')).toEqual(new Set([1]))
    expect(chapters('M3')).toEqual(new Set([143, 136]))
    expect(chapters('M4')).toEqual(new Set([1, 143, 136]))
    // S5: Bab 1 20/464 95 % (open, 444 baki), Bab 2 5/302 60 % (locked), Bab 3 5/316 80 % (locked).
    expect(practice.chapterStats(4, 1)).toMatchObject({
      total: 464,
      answered: 20,
      scorePct: 95,
      remaining: 444,
    })
    expect(practice.chapterStats(4, 143)).toMatchObject({ total: 302, answered: 5, scorePct: 60 })
    expect(practice.chapterStats(4, 136)).toMatchObject({ total: 316, answered: 5, scorePct: 80 })
    // S6 MATH 4, each "Salah 2x"; S12 MATH 26 / 37; S8 30 days 37 / 70.3 % / "15m".
    expect(practice.queue(4).map((q) => q.wrongTimes)).toEqual([2, 2, 2, 2])
    expect(practice.mastery(4).map((m) => [m.subjectId, m.correct, m.answered])).toEqual([
      [3, 26, 37],
    ])
    const all = practice.answers(4)
    expect([all.length, pct1((all.filter((a) => a.isCorrect).length / all.length) * 100)]).toEqual([
      37, 70.3,
    ])
    expect(Math.floor(rows.reduce((a, s) => a + s.timeSpent, 0) / 60)).toBe(15)
    // S11 September 2026: 30 questions, 76.7 → 86.7 (BR-18).
    const first = new Map<number, boolean>()
    const later = new Set<number>()
    for (const a of all) {
      if (!first.has(a.questionId)) first.set(a.questionId, a.isCorrect)
      else if (a.isCorrect) later.add(a.questionId)
    }
    const before = [...first.values()].filter(Boolean).length
    const corrected = [...first].filter(([q, ok]) => !ok && later.has(q)).length
    expect([
      first.size,
      pct1((before / 30) * 100),
      pct1(((before + corrected) / 30) * 100),
    ]).toEqual([30, 76.7, 86.7])
  })

  it('pelajar2: every empty state (no session, answer, queue or counter)', () => {
    expect(practice.history(3)).toEqual([])
    expect(practice.answers(3)).toEqual([])
    expect(practice.queue(3)).toEqual([])
    expect(practice.mastery(3)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// The M14 read contract (F-26b hand-over; Delivery Lead)
// ---------------------------------------------------------------------------------------------

describe('M14 read contract', () => {
  it('history by date and by modes: plain arrays with id, mode, status, correct, total, completedAt, timeSpent', () => {
    const today = practice.history(4, { date: '2026-09-25' })
    expect(Array.isArray(today)).toBe(true)
    expect(today.map((s) => s.id)).toEqual(['M4', 'M3'])
    expect(today[0]).toMatchObject({
      id: 'M4',
      mode: 'revision',
      status: 'completed',
      correct: 3,
      total: 7,
      correctCount: 3,
      questionCount: 7,
      completedAt: '2026-09-25T10:00:00+08:00',
      timeSpent: 150,
      subjectId: 3,
    })
    expect(practice.history(4, { modes: ['random', 'chapter', 'revision'] })).toHaveLength(4)
    expect(practice.history(2, { modes: ['random', 'chapter', 'revision'] })).toEqual([])
  })

  it('answers by date carry chapterId, subjectId, isCorrect, answeredAt; mastery has numeric subject ids', () => {
    const rows = practice.answers(4, { date: '2026-09-25' })
    expect(rows).toHaveLength(17)
    for (const a of rows) {
      expect(typeof a.chapterId).toBe('number')
      expect(a.subjectId).toBe(3)
      expect(typeof a.isCorrect).toBe('boolean')
      expect(a.answeredAt.startsWith('2026-09-25')).toBe(true)
    }
    expect(practice.mastery(4)).toEqual([
      { subjectId: 3, correct: 26, answered: 37, lastAnsweredAt: '2026-09-25T10:00:00+08:00' },
    ])
  })

  it('M14 reads them: "Pelajar Rajin" 4/10, practisedToday and quests 4 / 10 for pelajarmaju', () => {
    const rajin = achievements.forUser(4).items.find((a) => a.name === 'Pelajar Rajin')
    expect(rajin?.progress).toEqual({ value: 4, target: 10 })
    expect(streak.get(4).practisedToday).toBe(true)
    // M05 AC-06.3: quests 4 / 10 (M14 BR-M14-13 over the M05 reads).
    expect(challenges.today(4)).toMatchObject({ completed: 4, active: 10 })
  })

  it('GET /api/me/gamification-summary for account 2 still returns 370 / 916 / 2', async () => {
    const res = await request(runtime, 'GET', '/api/me/gamification-summary', setUser(2).token)
    expect(res.body).toEqual({ data: { coins: 370, points: 916, streakDays: 2 } })
    expect(wallet.summary(4)).toMatchObject({ currentSyiling: 267, xp: 432 })
  })
})

// ---------------------------------------------------------------------------------------------
// The write path (§7 #4–#6, BR-31)
// ---------------------------------------------------------------------------------------------

describe('write path (BR-31)', () => {
  // D72: the chapter data is Darjah-only, so the Darjah levels are offered alongside T4 / T5 here.
  beforeEach(() => {
    useOfferedLevels([1, 2, 3, 4, 10, 11])
  })
  afterEach(() => {
    useOfferedLevels()
  })

  const calls: GamificationInput[] = []
  beforeEach(async () => {
    await runtime.reset()
    runtime.clock.setNow('2026-09-26T09:00:00+08:00')
    calls.length = 0
  }, 120_000)
  afterEach(() => setPracticeSeamsForTests(null))

  /** Spy on the M14 call, delegating to the real M14. */
  async function spyM14() {
    const { seams } = await import('../../mock/repository/seams')
    const base = seams()
    const real = (input: GamificationInput) => base.onSessionCompleted(input)
    setPracticeSeamsForTests({
      onSessionCompleted: (input) => {
        calls.push(input)
        return real(input)
      },
    })
  }

  /** Starts, checks every question (the first `correct` right) and submits through the HTTP API. */
  async function play(token: string, body: Record<string, unknown>, correct: number) {
    const start = await request(runtime, 'POST', '/api/practice/sessions', token, body)
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const data = (start.body as { data: { sessionId: string; questions: { id: number }[] } }).data
    let i = 0
    for (const q of data.questions) {
      const key = questions.get(q.id)?.correctAnswer ?? 0
      const pick = i++ < correct ? key : (key + 1) % 4
      const check = await request(
        runtime,
        'POST',
        `/api/practice/sessions/${data.sessionId}/check-answer`,
        token,
        {
          questionId: q.id,
          selectedOptionId: pick,
        },
      )
      expect(check.status).toBe(200)
    }
    const submit = await request(
      runtime,
      'POST',
      `/api/practice/sessions/${data.sessionId}/submit`,
      token,
      {
        answers: [],
        timeSpent: 120,
      },
    )
    return { data, submit }
  }

  const MODES: readonly [string, number, Record<string, unknown>][] = [
    ['random', 3, { mode: 'random', subjectCode: 'MATH', levelId: 10, count: 5 }],
    ['chapter', 4, { mode: 'chapter', chapterId: 1, count: 5 }],
    ['revision', 4, { mode: 'revision', subjectCode: 'MATH', count: 20 }],
    ['past_year', 3, { mode: 'past_year', subjectCode: 'SEJ', count: 5 }],
    ['latih_tubi', 3, { mode: 'latih_tubi', subjectCode: 'PERNIAGA', count: 5 }],
    ['ramalan', 4, { mode: 'ramalan', subjectCode: 'AKAUN', year: 2026, setNo: 1 }],
  ]

  for (const [mode, user, body] of MODES) {
    it(`${mode}: one completion updates the log, the queue and the counters, and calls M14 once`, async () => {
      await spyM14()
      if (mode === 'ramalan') {
        const ids = questions
          .spmPool({ subjectId: 21 })
          .sample(4, mulberry32(5))
          .map((q) => q.id)
        setPracticeSeamsForTests({
          ramalanQuestions: () => ids,
          onSessionCompleted: (input) => {
            calls.push(input)
            return null
          },
        })
      }
      const token = setUser(user).token
      const logBefore = practiceAnswers.count('Q-ANS-ALL')
      const sessionsBefore = practice.count('Q-SESS-ALL')
      const queueBefore = practice.queueAll(user)
      const masteryBefore = practice.mastery(user)
      const { data, submit } = await play(token, body, 2)
      expect(submit.status, JSON.stringify(submit.body)).toBe(200)
      const n = data.questions.length
      const result = (
        submit.body as {
          data: {
            results: {
              score: number
              total: number
              gamification: { coinsEarned: number; pointsEarned: number }
            }
          }
        }
      ).data.results
      expect([result.score, result.total]).toEqual([2, n])
      expect(result.gamification.pointsEarned).toBe(20)
      // BR-06: the log grows by the checked answers; Q-SESS-ALL by one.
      expect(practiceAnswers.count('Q-ANS-ALL')).toBe(logBefore + n)
      expect(practice.count('Q-SESS-ALL')).toBe(sessionsBefore + 1)
      const s = practice.session(data.sessionId) as SessionRow
      expect(s).toMatchObject({
        status: 'completed',
        correctCount: 2,
        questionCount: n,
        pointsEarned: 20,
        mode,
      })
      // BR-09 (MJ-1): the session keeps coins = correct; M14's credit is in the response only.
      expect(s.coinsEarned).toBe(2)
      expect(typeof result.gamification.coinsEarned).toBe('number')
      const answers = practice.sessionAnswers(s.id)
      expect(answers).toHaveLength(n)
      // M14 called once with the session totals.
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        userId: user,
        sessionId: s.id,
        mode,
        correct: 2,
        total: n,
        pointsEarned: 20,
      })
      expect(calls[0]?.coinsPerCorrect).toBeUndefined()
      // BR-14: wrong answers queued (wrongTimes + 1), correct ones removed.
      const queue = new Map(practice.queueAll(user).map((q) => [q.questionId, q]))
      const before = new Map(queueBefore.map((q) => [q.questionId, q]))
      for (const a of answers) {
        if (a.isCorrect) expect(queue.has(a.questionId)).toBe(false)
        else
          expect(queue.get(a.questionId)?.wrongTimes).toBe(
            (before.get(a.questionId)?.wrongTimes ?? 0) + 1,
          )
      }
      // BR-20: counters += the session's answers per subject.
      const after = new Map(practice.mastery(user).map((m) => [m.subjectId, m]))
      const prev = new Map(masteryBefore.map((m) => [m.subjectId, m]))
      const subjects = new Set(answers.map((a) => a.subjectId))
      for (const sid of subjects) {
        if (sid === null) continue
        const add = answers.filter((a) => a.subjectId === sid)
        expect(after.get(sid)?.answered).toBe((prev.get(sid)?.answered ?? 0) + add.length)
        expect(after.get(sid)?.correct).toBe(
          (prev.get(sid)?.correct ?? 0) + add.filter((a) => a.isCorrect).length,
        )
      }
      // History (#23) lists it first.
      const list = await request(runtime, 'GET', `/api/practice/sessions?modes=${mode}`, token)
      expect((list.body as { data: { id: string }[] }).data[0]?.id).toBe(s.id)
    })
  }

  it('pksk (BR-34 direct): session with subject null, answers without subject, M14 once, no queue / counters / trial', async () => {
    await spyM14()
    const trialBefore = users.trial(3, toEpochMs('2026-09-26T09:00:00+08:00')).used
    const pksk = questions.sampleKeyless(
      { pkskDomainId: 7, pkskTargetLevel: 'T4' },
      3,
      mulberry32(7),
    )
    const r = practice.completeSession({
      userId: 3,
      mode: 'pksk',
      pkskDomainId: 7,
      pkskTargetLevel: 'T4',
      answers: pksk.map((q, i) => ({ questionId: q.id, isCorrect: i === 0, selected: null })),
      startedAt: '2026-09-26T08:50:00+08:00',
      completedAt: '2026-09-26T09:00:00+08:00',
    })
    expect(r.session).toMatchObject({
      mode: 'pksk',
      subjectId: null,
      questionCount: 3,
      correctCount: 1,
      timeSpent: 600,
      status: 'completed',
    })
    expect(
      practice
        .sessionAnswers(r.session.id)
        .every((a) => a.subjectId === null && a.selectedOptionId === null),
    ).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ mode: 'pksk', correct: 1, total: 3 })
    expect(calls[0]?.coinsPerCorrect).toBeUndefined()
    expect(practice.queueAll(3)).toEqual([])
    expect(practice.mastery(3)).toEqual([])
    expect(users.trial(3, toEpochMs('2026-09-26T09:00:00+08:00')).used).toBe(trialBefore)
  })

  it('mission: coinsPerCorrect 3 is passed; a completed mission answers 409; an open one resumes', async () => {
    await spyM14()
    const ids = questions
      .practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: 4, seed: 'm' })
      .map((q) => q.id)
    const { seams } = await import('../../mock/repository/seams')
    const base = seams()
    const real = (input: GamificationInput) => base.onSessionCompleted(input)
    setPracticeSeamsForTests({
      missionsForStudent: () => [{ id: 9001, subjectId: 3, coinsPerCorrect: 3 }],
      missionQuestionIds: () => ids,
      onSessionCompleted: (input) => {
        calls.push(input)
        // M14's own credit differs from BR-09 here, to show which value goes where.
        const r = real(input)
        return r ? { ...r, coinsEarned: 99 } : r
      },
    })
    const token = setUser(4).token
    const open1 = await request(runtime, 'POST', '/api/practice/sessions', token, {
      mode: 'mission',
      missionId: 9001,
    })
    const open2 = await request(runtime, 'POST', '/api/practice/sessions', token, {
      mode: 'mission',
      missionId: 9001,
    })
    const id1 = (open1.body as { data: { sessionId: string } }).data.sessionId
    expect((open2.body as { data: { sessionId: string } }).data.sessionId).toBe(id1)
    for (const qid of ids) {
      await request(runtime, 'POST', `/api/practice/sessions/${id1}/check-answer`, token, {
        questionId: qid,
        selectedOptionId: questions.get(qid)?.correctAnswer ?? 0,
      })
    }
    const done = await request(runtime, 'POST', `/api/practice/sessions/${id1}/submit`, token, {
      answers: [],
      timeSpent: 60,
    })
    expect(done.status).toBe(200)
    expect(calls[0]).toMatchObject({ mode: 'mission', correct: 4, coinsPerCorrect: 3 })
    expect(
      (done.body as { data: { results: { gamification: { coinsEarned: number } } } }).data.results
        .gamification.coinsEarned,
    ).toBe(99)
    // BR-09: 3 × 4 correct stored on the session (Delivery Lead MJ-1).
    expect(practice.session(id1)?.coinsEarned).toBe(12)
    const again = await request(runtime, 'POST', '/api/practice/sessions', token, {
      mode: 'mission',
      missionId: 9001,
    })
    expect(again.status).toBe(409)
    expect((again.body as { error: { code: string } }).error.code).toBe('ALREADY_COMPLETED')
    // Unknown mission, remedial test and question set (M10 not built): 404.
    setPracticeSeamsForTests(null)
    for (const b of [
      { mode: 'mission', missionId: 7101 },
      { mode: 'remedial', remedialTestId: 7601 },
      { mode: 'question_set', questionSetId: 7402 },
    ]) {
      expect((await request(runtime, 'POST', '/api/practice/sessions', token, b)).status).toBe(404)
    }
  })

  it('a throwing M14 call rolls the whole completion back', async () => {
    const token = setUser(3).token
    const start = await request(runtime, 'POST', '/api/practice/sessions', token, {
      mode: 'random',
      subjectCode: 'MATH',
      count: 5,
    })
    const data = (start.body as { data: { sessionId: string; questions: { id: number }[] } }).data
    for (const q of data.questions) {
      await request(
        runtime,
        'POST',
        `/api/practice/sessions/${data.sessionId}/check-answer`,
        token,
        {
          questionId: q.id,
          selectedOptionId: ((questions.get(q.id)?.correctAnswer ?? 0) + 1) % 4,
        },
      )
    }
    const logBefore = practiceAnswers.count('Q-ANS-ALL')
    setPracticeSeamsForTests({
      onSessionCompleted: () => {
        throw new Error('M14 failure')
      },
    })
    const failed = await request(
      runtime,
      'POST',
      `/api/practice/sessions/${data.sessionId}/submit`,
      token,
      { answers: [], timeSpent: 60 },
    )
    expect(failed.status).toBe(500)
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(logBefore)
    expect(practice.session(data.sessionId)?.status).toBe('in_progress')
    expect(practice.queueAll(3)).toEqual([])
    expect(practice.mastery(3)).toEqual([])
    expect(practice.history(3)).toEqual([])
    // The stored checks survive, so the retry completes the same session.
    setPracticeSeamsForTests(null)
    const retry = await request(
      runtime,
      'POST',
      `/api/practice/sessions/${data.sessionId}/submit`,
      token,
      { answers: [], timeSpent: 60 },
    )
    expect(retry.status).toBe(200)
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(logBefore + 5)
    expect(practice.queueAll(3)).toHaveLength(5)
  })

  it('an abandoned session writes nothing (BR-06); a second submit answers 409', async () => {
    const token = setUser(3).token
    const logBefore = practiceAnswers.count('Q-ANS-ALL')
    const start = await request(runtime, 'POST', '/api/practice/sessions', token, {
      mode: 'random',
      subjectCode: 'BM',
      count: 5,
    })
    const data = (start.body as { data: { sessionId: string; questions: { id: number }[] } }).data
    const q = data.questions[0] as { id: number }
    await request(runtime, 'POST', `/api/practice/sessions/${data.sessionId}/check-answer`, token, {
      questionId: q.id,
      selectedOptionId: 0,
    })
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(logBefore)
    expect(practice.history(3)).toEqual([])
    expect(practice.queueAll(3)).toEqual([])
    expect(practice.mastery(3)).toEqual([])
    expect(practice.count('Q-SESS-ALL')).toBe(32_122)
    // Submit once, then again.
    const first = await request(
      runtime,
      'POST',
      `/api/practice/sessions/${data.sessionId}/submit`,
      token,
      { answers: [], timeSpent: 10 },
    )
    expect(first.status).toBe(200)
    // Only the checked question is recorded (BR-30).
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(logBefore + 1)
    const second = await request(
      runtime,
      'POST',
      `/api/practice/sessions/${data.sessionId}/submit`,
      token,
      { answers: [], timeSpent: 10 },
    )
    expect(second.status).toBe(409)
    // Another user's session: 403 (check) / 403 (submit).
    const other = setUser(2).token
    expect(
      (
        await request(runtime, 'POST', `/api/practice/sessions/${data.sessionId}/submit`, other, {
          answers: [],
        })
      ).status,
    ).toBe(403)
    expect(
      (await request(runtime, 'POST', '/api/practice/sessions/s_unknown/submit', token, {})).status,
    ).toBe(404)
  })

  it('trial: +1 per check while not subscribed (a repeated check does not count); none when subscribed; TRIAL_EXHAUSTED at 0', async () => {
    const at = () => runtime.clock.now()
    const token3 = setUser(3).token
    expect(users.trial(3, at())).toMatchObject({ used: 0, remaining: 50, active: true })
    const s = await request(runtime, 'POST', '/api/practice/sessions', token3, {
      mode: 'random',
      subjectCode: 'MATH',
      count: 5,
    })
    const data = (s.body as { data: { sessionId: string; questions: { id: number }[] } }).data
    for (const [i, q] of data.questions.slice(0, 3).entries()) {
      await request(
        runtime,
        'POST',
        `/api/practice/sessions/${data.sessionId}/check-answer`,
        token3,
        { questionId: q.id, selectedOptionId: 0 },
      )
      expect(users.trial(3, at()).used).toBe(i + 1)
    }
    const again = await request(
      runtime,
      'POST',
      `/api/practice/sessions/${data.sessionId}/check-answer`,
      token3,
      {
        questionId: (data.questions[0] as { id: number }).id,
        selectedOptionId: 1,
      },
    )
    expect(again.status).toBe(200)
    expect(users.trial(3, at()).used).toBe(3)
    // Subscribed pelajarmaju: unchanged.
    const token4 = setUser(4).token
    const used4 = users.trial(4, at()).used
    const s4 = await request(runtime, 'POST', '/api/practice/sessions', token4, {
      mode: 'random',
      subjectCode: 'MATH',
      count: 5,
    })
    const d4 = (s4.body as { data: { sessionId: string; questions: { id: number }[] } }).data
    await request(runtime, 'POST', `/api/practice/sessions/${d4.sessionId}/check-answer`, token4, {
      questionId: (d4.questions[0] as { id: number }).id,
      selectedOptionId: 0,
    })
    expect(users.trial(4, at()).used).toBe(used4)
    // The admin has used 50 of 50: 402 TRIAL_EXHAUSTED.
    const admin = await request(runtime, 'POST', '/api/practice/sessions', setUser(1).token, {
      mode: 'random',
      subjectCode: 'MATH',
      count: 5,
    })
    expect(admin.status).toBe(402)
    expect((admin.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'TRIAL_EXHAUSTED',
      message: 'Baki percubaan percuma anda telah habis.',
    })
  })

  it('start validation: unknown subject 404, bad count 422, locked chapter 409, empty revision 422', async () => {
    const token = setUser(4).token
    const post = (b: unknown) => request(runtime, 'POST', '/api/practice/sessions', token, b)
    expect((await post({ mode: 'random', subjectCode: 'XXX', count: 5 })).status).toBe(404)
    expect((await post({ mode: 'random', subjectCode: 'MATH', count: 7 })).status).toBe(422)
    const locked = await post({ mode: 'chapter', chapterId: 143, count: 5 })
    expect(locked.status).toBe(409)
    expect((locked.body as { error: { code: string } }).error.code).toBe('CHAPTER_LOCKED')
    const none = await request(runtime, 'POST', '/api/practice/sessions', setUser(3).token, {
      mode: 'revision',
      subjectCode: 'MATH',
      count: 20,
    })
    expect(none.status).toBe(422)
    expect((none.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'NO_WRONG_QUESTIONS',
      message: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.',
    })
    // Revision serves the 4 queued MATH questions ("Salah 2x"), with revisionMeta.
    const rev = await post({ mode: 'revision', subjectCode: 'MATH', count: 20 })
    const body = (
      rev.body as {
        data: { revisionMeta: unknown; questions: { wrongTimes: number; options: unknown[] }[] }
      }
    ).data
    expect(body.revisionMeta).toEqual({ selected: 4, totalWrong: 4 })
    expect(body.questions.map((q) => q.wrongTimes)).toEqual([2, 2, 2, 2])
    expect(body.questions[0]?.options).toHaveLength(4)
  })

  it('GET /api/practice/sessions (#23): admin SPM history 4 / 21.8 / 26 / 84; `type` narrows the rows only; 422 on an unknown mode', async () => {
    const token = setUser(1).token
    const all = await request(
      runtime,
      'GET',
      '/api/practice/sessions?modes=past_year,latih_tubi,ramalan',
      token,
    )
    const body = all.body as {
      data: { id: string; percent: number; subjectCode: string }[]
      meta: Record<string, unknown>
    }
    expect(body.data.map((r) => r.id)).toEqual(['A5', 'A4', 'A3', 'A2'])
    expect(body.data.map((r) => r.percent)).toEqual([0, 20, 32, 35])
    expect(body.data.map((r) => r.subjectCode)).toEqual(['BM', 'BM', 'BM', 'SEJ'])
    expect(body.meta).toMatchObject({
      activeType: null,
      stats: { sessions: 4, avgAccuracyPct: 21.8, coins: 26, answered: 84 },
      totalItems: 4,
    })
    const typed = await request(
      runtime,
      'GET',
      '/api/practice/sessions?modes=past_year,latih_tubi,ramalan&type=past_year',
      token,
    )
    const tb = typed.body as { data: { id: string }[]; meta: Record<string, unknown> }
    expect(tb.data.map((r) => r.id)).toEqual(['A5', 'A4'])
    expect(tb.meta).toMatchObject({ activeType: 'past_year', stats: { sessions: 4 } })
    const paged = await request(
      runtime,
      'GET',
      '/api/practice/sessions?modes=past_year,latih_tubi&page=2&pageSize=3',
      token,
    )
    expect(
      (paged.body as { data: { id: string }[]; meta: Record<string, unknown> }).data.map(
        (r) => r.id,
      ),
    ).toEqual(['A2'])
    expect((await request(runtime, 'GET', '/api/practice/sessions?modes=spm', token)).status).toBe(
      422,
    )
    expect(
      (await request(runtime, 'GET', '/api/practice/sessions?modes=random', setUser(3).token)).body,
    ).toMatchObject({ data: [] })
  })

  /** Starts a session and returns its id and question ids. */
  async function startIds(token: string, body: Record<string, unknown>) {
    const res = await request(runtime, 'POST', '/api/practice/sessions', token, body)
    const data = (res.body as { data?: { sessionId: string; questions: { id: number }[] } }).data
    return { res, id: data?.sessionId ?? '', qids: data?.questions.map((q) => q.id) ?? [] }
  }

  it('BR-30: the stored timeSpent is capped at 3 × 60 s per question', async () => {
    const token = setUser(4).token
    const { id, qids } = await startIds(token, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await request(runtime, 'POST', `/api/practice/sessions/${id}/check-answer`, token, {
      questionId: qids[0],
      selectedOptionId: 0,
    })
    await request(runtime, 'POST', `/api/practice/sessions/${id}/submit`, token, {
      answers: [],
      timeSpent: 99_999,
    })
    expect(practice.session(id)?.timeSpent).toBe(5 * 180)
    const { id: id2 } = await startIds(token, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await request(runtime, 'POST', `/api/practice/sessions/${id2}/submit`, token, {
      answers: [],
      timeSpent: -5,
    })
    expect(practice.session(id2)?.timeSpent).toBe(0)
  })

  it('#5: 422 for a question outside the session, an option out of range or a missing field', async () => {
    const token = setUser(3).token
    const { id, qids } = await startIds(token, { mode: 'random', subjectCode: 'MATH', count: 5 })
    const check = (body: unknown) =>
      request(runtime, 'POST', `/api/practice/sessions/${id}/check-answer`, token, body)
    const outside = await check({ questionId: 600_001, selectedOptionId: 0 })
    expect(outside.status).toBe(422)
    expect((outside.body as { error: { message: string } }).error.message).toBe(
      'Jawapan tidak sah.',
    )
    expect((await check({ questionId: qids[0], selectedOptionId: 7 })).status).toBe(422)
    expect((await check({ questionId: qids[0], selectedOptionId: -1 })).status).toBe(422)
    expect((await check({ questionId: qids[0] })).status).toBe(422)
    // Refused checks store nothing: the trial counter has not moved.
    expect(users.trial(3, runtime.clock.now()).used).toBe(0)
    expect((await check({ questionId: qids[0], selectedOptionId: 0 })).status).toBe(200)
    expect(users.trial(3, runtime.clock.now()).used).toBe(1)
  })

  it('BR-31 step 8: a remedial session completes its M10 test; a completed test answers 409', async () => {
    const ids = questions
      .practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: 4, seed: 'r' })
      .map((q) => q.id)
    const completes: { id: number; input: { afterAccuracy: number; completedAt: string } }[] = []
    let status = 'active'
    setPracticeSeamsForTests({
      remedialTestsForStudent: (userId) =>
        userId === 4 ? [{ id: 7699, studentId: 4, status, subjectId: 3, questionIds: ids }] : [],
      remedialComplete: (id, input) => {
        completes.push({ id, input })
        status = 'completed'
      },
    })
    const token = setUser(4).token
    // A test outside the student's own list: 404.
    const other = await startIds(setUser(3).token, { mode: 'remedial', remedialTestId: 7699 })
    expect(other.res.status).toBe(404)
    const { id } = await startIds(token, { mode: 'remedial', remedialTestId: 7699 })
    for (const [i, qid] of ids.entries()) {
      const key = questions.get(qid)?.correctAnswer ?? 0
      await request(runtime, 'POST', `/api/practice/sessions/${id}/check-answer`, token, {
        questionId: qid,
        selectedOptionId: i < 3 ? key : (key + 1) % 4,
      })
    }
    await request(runtime, 'POST', `/api/practice/sessions/${id}/submit`, token, {
      answers: [],
      timeSpent: 30,
    })
    expect(completes).toEqual([
      { id: 7699, input: { afterAccuracy: 75, completedAt: '2026-09-26T09:00:00+08:00' } },
    ])
    expect(practice.count('Q-SESS-LINK-REMEDIAL', 7699)).toBe(1)
    const again = await startIds(token, { mode: 'remedial', remedialTestId: 7699 })
    expect(again.res.status).toBe(409)
  })

  it('question_set: NO_ATTEMPTS_LEFT once maxAttempts sessions are completed; timeLimitSec copied', async () => {
    const ids = questions
      .practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: 3, seed: 'qs' })
      .map((q) => q.id)
    setPracticeSeamsForTests({
      questionSetsVisible: () => [
        { id: 7499, subjectId: 3, questionIds: ids, maxAttempts: 1, timeLimitMinutes: 10 },
      ],
    })
    const token = setUser(4).token
    const first = await startIds(token, { mode: 'question_set', questionSetId: 7499 })
    expect(first.res.status).toBe(201)
    expect((first.res.body as { data: { timeLimitSec: number } }).data.timeLimitSec).toBe(600)
    await request(runtime, 'POST', `/api/practice/sessions/${first.id}/submit`, token, {
      answers: [],
      timeSpent: 10,
    })
    const second = await startIds(token, { mode: 'question_set', questionSetId: 7499 })
    expect(second.res.status).toBe(409)
    expect((second.res.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'NO_ATTEMPTS_LEFT',
      message: 'Tiada percubaan lagi untuk set ini.',
    })
    const unknown = await startIds(token, { mode: 'question_set', questionSetId: 1 })
    expect(unknown.res.status).toBe(404)
  })

  it('latih_tubi targetQuestionId (M04 BR-M04-17): one eligible SPM-pool question of the subject, count 1', async () => {
    const q = questions.spmPool({ subjectId: 23 }).sample(1, mulberry32(3))[0]
    if (!q) throw new Error('no PERNIAGA pool row')
    const token = setUser(4).token
    const good = await startIds(token, {
      mode: 'latih_tubi',
      subjectCode: 'PERNIAGA',
      count: 1,
      targetQuestionId: q.id,
    })
    expect(good.res.status).toBe(201)
    expect(good.qids).toEqual([q.id])
    expect(practice.session(good.id)).toMatchObject({ targetQuestionId: q.id, questionCount: 1 })
    const status = (body: Record<string, unknown>) =>
      startIds(token, body).then((r) => r.res.status)
    const lt = { mode: 'latih_tubi' }
    expect(await status({ ...lt, subjectCode: 'PERNIAGA', count: 2, targetQuestionId: q.id })).toBe(
      422,
    )
    expect(await status({ ...lt, subjectCode: 'SEJ', count: 1, targetQuestionId: q.id })).toBe(422)
    expect(
      await status({ ...lt, subjectCode: 'PERNIAGA', count: 1, targetQuestionId: 600_001 }),
    ).toBe(422)
    // A subject with a target (SEJ 40, BR-M06-04) accepts only that count.
    expect(await status({ ...lt, subjectCode: 'SEJ', count: 10 })).toBe(422)
  })
})

// ---------------------------------------------------------------------------------------------
// Generation rules over the prime
// ---------------------------------------------------------------------------------------------

describe('prime', () => {
  it('SRS L549 generator rule: every generated user with ≥ 3 sessions has a session that is not fully correct', () => {
    const p = practicePrimeOrNull()
    if (!p) throw new Error('not primed')
    const byUser = new Map<number, number[]>()
    let answers = 0
    for (let k = 1; k < p.sUser.length; k++) {
      const u = p.sUser[k] as number
      if (u <= 0) continue
      byUser.set(u, [...(byUser.get(u) ?? []), k])
      answers += p.sCount[k] as number
    }
    const offenders = [...byUser]
      .filter(([, keys]) => keys.length >= 3)
      .filter(([, keys]) => keys.every((k) => p.sCorrect[k] === p.sCount[k]))
      .map(([u]) => u)
    expect(offenders).toEqual([])
    // The swaps move no count: generated sessions hold exactly the generated session answers.
    const anchorSessionAnswers = [1, 2, 4, 4627]
      .flatMap((u) => practice.answers(u))
      .filter((a) => a.sessionId !== null).length
    expect(answers).toBe(
      practiceAnswers.count('Q-ANS-ALL') -
        practiceAnswers.count('Q-ANS-NOSESSION') -
        anchorSessionAnswers,
    )
    expect(practiceAnswers.count('Q-ANS-CORRECT')).toBe(396_391)
  })

  it('the fitted λ stays in a sane band and the session mean is 79.8 %', () => {
    const { lambda, meanAccuracy } = practice.primeFit()
    expect(lambda).toBeGreaterThan(0)
    expect(lambda).toBeLessThan(3)
    expect(Math.round(meanAccuracy * 1000) / 10).toBe(79.8)
    expect(pct1(practice.sessionMeanAccuracy())).toBe(79.8)
  })
})
