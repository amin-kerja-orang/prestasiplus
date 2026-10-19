/**
 * F-26c: the batch-3 M05 stores and the M10 class placement, booted with the real core, M01–M04, M05
 * and M10 at the project clock (SRS M05 v1.17 §6.14.1, §6.14.4, FR-M05-147/148/151; M08 level cells).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m10, { classrooms } from '@/modules/m10-teacher-class/mock'

import m05, { kirkpatrick, practice, practiceAnswers, pupilSubjectAccuracy } from '../../mock'
import {
  classDashboard,
  classItemAnalysis,
  schoolPerformance,
} from '@/modules/m08-student-performance/mock'

import { answersDataset } from '../../mock/datasets/answers'
import { scanSessions } from '../../mock/repository/reads'

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(k: string) {
    return this.items.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.items.set(k, v)
  }
  removeItem(k: string) {
    this.items.delete(k)
  }
}

const members = { t4: new Set<number>(), t5: new Set<number>() }

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m10],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  for (const c of classrooms.list({})) {
    if (c.educationLevel !== 'tingkatan-4' && c.educationLevel !== 'tingkatan-5') continue
    for (const id of classrooms.memberIds(c.kind, c.classId)) {
      ;(c.educationLevel === 'tingkatan-4' ? members.t4 : members.t5).add(id)
    }
  }
  cache = load()
}, 600_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

let cache: ReturnType<typeof load> | null = null
const load = () => scanSessions({ status: 'completed' })
const completed = () => (cache ??= load())

describe('KirkpatrickSessionAggregate (DATA-M05-12)', () => {
  it('is a separate store: 20,991 sessions, the answer log and Q-SESS-ALL unchanged', () => {
    expect(kirkpatrick.count('Q-M12-SESSIONS')).toBe(20_991)
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(478_499)
    expect(practice.count('Q-SESS-ALL')).toBe(32_122)
    const t = kirkpatrick.totals()
    expect([t.answered, t.correct, t.activeStudents, t.servedStudents, t.sessionStudents]).toEqual([
      306_133, 253_478, 946, 951, 952,
    ])
  })

  it('8080: 1,002 sessions, 15,007 answers, Students A (4664) and B (4644)', () => {
    const t = kirkpatrick.totals({ schoolIds: [8080] })
    expect([t.sessions, t.answered, t.activeStudents]).toEqual([1_002, 15_007, 53])
    expect(kirkpatrick.student(4664)).toMatchObject({ answered: 219, correct: 160, streak: 1 })
    expect(kirkpatrick.student(4664)?.days).toHaveLength(4)
    expect(kirkpatrick.student(4644)).toMatchObject({ answered: 70, correct: 27 })
  })

  it('months and an empty scope', () => {
    expect(kirkpatrick.months()[0]).toBe('2026-01')
    expect(kirkpatrick.month('2026-09').students).toHaveLength(58)
    expect(kirkpatrick.months({ schoolIds: [8080] })[0]).toBe('2026-04')
    expect(kirkpatrick.totals({ schoolIds: [] }).sessions).toBe(0)
  })
})

describe('registry', () => {
  it('M10 is in the app registry after M05 (the prime reads its class placement)', async () => {
    const { mockPlugins } = await import('@/mock/registry')
    const ids = (await Promise.all(mockPlugins.map((load) => load()))).map((m) => m.default.id)
    expect(ids).toContain('M10')
    expect(ids.indexOf('M05')).toBeLessThan(ids.indexOf('M10'))
  })
})

describe('inactive users (M10 booted)', () => {
  it('no answer or session belongs to an inactive user', () => {
    const inactive = new Set<number>()
    for (const u of users.query('U-ROLE', { sort: 'id' }, 'student').rows)
      if (!u.isActive) inactive.add(u.id)
    for (const r of completed()) expect(inactive.has(r.userId)).toBe(false)
    let bad = 0
    answersDataset.count(
      {},
      (r) => {
        if (inactive.has(r.userId)) bad++
        return false
      },
      { matchFields: ['userId'], cacheKey: 'batch3:inactive-answers' },
    )
    expect(bad).toBe(0)
  })
})

describe('other-P pool (M18 schools, attendance mirror)', () => {
  it('lower-form and primary pupils of the nine M18 schools hold no session; 8880 has 31 answering pupils', () => {
    const nine = new Set([8765, 8767, 8772, 3160, 2700, 2710, 7780, 1, 8880])
    for (const r of completed()) {
      const u = users.get(r.userId)
      if (u && u.schoolId !== null && nine.has(u.schoolId)) expect([10, 11]).toContain(u.grade)
    }
    expect(practice.distinctUsers({ by: 'answers', schoolId: 8880 })).toBe(31)
  })

  it('the attendance-mirror pupils never answer 19–25 Sep (M10 R-M02-01)', () => {
    const from = Date.parse('2026-09-19T00:00:00+08:00')
    for (const r of completed()) {
      if (users.get(r.userId)?.pool === 'attendanceMirror')
        expect(r.completedAtMs).toBeLessThan(from)
    }
  })
})

describe('session concentration', () => {
  it('non-member generated pupils: only 5782 (8106) and 4708 exceed 100 sessions (accepted, DL decision: M08/M17 must handle 5782 when built)', () => {
    // The T5 members' 29,971 (SRS) leaves about 1,600 sessions for non-members, and only one active
    // non-member pupil is admitted by the M11 never-logged answerer slots (5782): a cap of 60 per pupil
    // fits 183 of the 1,596. The base maximum of the others is about 18–61.
    const held = new Map<number, number>()
    for (const r of completed()) {
      const u = users.get(r.userId)
      if (u?.role === 'student' && !members.t5.has(r.userId) && !members.t4.has(r.userId)) {
        held.set(r.userId, (held.get(r.userId) ?? 0) + 1)
      }
    }
    const heavy = [...held].filter(([, n]) => n > 100)
    // 4708 became a second never-logged slot receiver when loggedTake subtracted the anchor users (M11 items); accepted like 5782 (Delivery Lead concentration decision).
    expect(heavy.map(([id]) => id)).toEqual([4708, 5782])
    expect(
      Math.max(...[...held].filter(([id]) => id !== 5782 && id !== 4708).map(([, n]) => n)),
    ).toBeLessThan(100)
  })
})

describe('bulk reads (XR-M08-M05-01/-02)', () => {
  it('sessionTotals equal the per-user history; unknown users are absent', () => {
    const ids = [1, 2, 4, 5782, ...classrooms.memberIds('classroom', 228).slice(0, 10)]
    const t = practice.sessionTotals(ids)
    for (const id of ids) {
      const h = practice.history(id)
      const a = t.get(id)
      expect(a?.all.sessions ?? 0).toBe(h.length)
      expect(a?.all.questions ?? 0).toBe(h.reduce((s, x) => s + x.total, 0))
      expect(a?.all.correct ?? 0).toBe(h.reduce((s, x) => s + x.correct, 0))
    }
    expect(practice.sessionTotals([]).size).toBe(0)
  })

  it('answerFacts equal practice.answers (question, subject, correctness, option), also per subject', () => {
    const ids = classrooms.memberIds('classroom', 228).slice(0, 4)
    const all = practice.answerFacts(ids)
    const bi = practice.answerFacts(ids, { subjectId: 2 })
    for (const id of ids) {
      const rows = practice.answers(id).sort((a, b) => a.id - b.id)
      const f = all.get(id) ?? []
      expect(f).toHaveLength(rows.length)
      rows.forEach((r, i) => {
        const x = f[i]!
        expect([x.questionId, x.subjectId, x.isCorrect, x.selectedOptionId]).toEqual([
          r.questionId,
          r.subjectId,
          r.isCorrect,
          r.selectedOptionId,
        ])
      })
      expect(bi.get(id)?.length ?? 0).toBe(rows.filter((r) => r.subjectId === 2).length)
    }
    const st = practice.subjectTotals(ids).get(ids[0]!) ?? []
    expect(st.reduce((s, x) => s + x.answered, 0)).toBe(all.get(ids[0]!)?.length)
  })

  it('answerFacts of anchor users (ids ≥ 500,001: admin, pelajar, pelajarmaju, 4627) equal practice.answers', () => {
    const ids = [1, 2, 4, 4627]
    const facts = practice.answerFacts(ids)
    for (const id of ids) {
      const rows = practice.answers(id).sort((a, b) => a.id - b.id)
      const f = facts.get(id) ?? []
      expect(f).toHaveLength(rows.length)
      expect(rows.length).toBeGreaterThan(0)
      rows.forEach((r, i) => {
        const x = f[i]!
        expect([x.questionId, x.subjectId, x.isCorrect, x.selectedOptionId, x.sessionId]).toEqual([
          r.questionId,
          r.subjectId,
          r.isCorrect,
          r.selectedOptionId,
          r.sessionId,
        ])
      })
    }
  })

  it('class 228 tests 596 questions of its subject: 381 Mudah / 78 Sederhana / 137 Sukar (M08 §6.10)', () => {
    const t = practice.questionTallies(classrooms.memberIds('classroom', 228), { subjectId: 2 })
    const indeks = (q: { correct: number; attempts: number }) => 1 - q.correct / q.attempts
    expect(t).toHaveLength(596)
    expect(t.filter((q) => indeks(q) <= 0.3)).toHaveLength(381)
    expect(t.filter((q) => indeks(q) > 0.7)).toHaveLength(137)
    // A session's served questions are its answers' questions.
    const id = classrooms.memberIds('classroom', 228)[0]!
    const s = practice.history(id).find((x) => x.subjectId === 2)!
    expect(practice.session(s.id)?.questionIds).toHaveLength(s.total)
  })

  it('8880: 31 answering pupils, 10,196 answers, 7,307 correct; 3201–3215 hold the 6,563 sessionless ones (5,008 correct)', () => {
    const ids = users
      .query('U-ROLE', { sort: 'id' }, 'student')
      .rows.filter((u) => u.schoolId === 8880)
      .map((u) => u.id)
    const f = practice.answerFacts(ids)
    let n = 0
    let c = 0
    for (const l of f.values()) {
      for (const x of l) {
        n++
        if (x.isCorrect) c++
      }
    }
    expect([f.size, n, c]).toEqual([31, 10_196, 7_307])
    let n15 = 0
    let c15 = 0
    for (let id = 3201; id <= 3215; id++) {
      for (const x of f.get(id) ?? []) {
        n15++
        if (x.isCorrect) c15++
      }
      expect(f.get(id)?.every((x) => x.sessionId === null)).toBe(true)
      expect(practice.sessionTotals([id]).size).toBe(0)
      expect(practice.history(id)).toHaveLength(0)
    }
    expect([n15, c15]).toEqual([6_563, 5_008])
  })
})

describe('Q-WEEK-RANK', () => {
  it('the SPM latih_tubi pupils 2017–2019 (8106) are not ranked', () => {
    const ranked = new Set(practice.weekRank({ limit: 5_000 }).map((r) => r.userId))
    for (const id of [2017, 2018, 2019]) expect(ranked.has(id)).toBe(false)
  })

  it('rows are ranked by correct answers then user id, at most 20, practice modes only', () => {
    const rows = practice.weekRank({})
    expect(rows).toHaveLength(20)
    rows.forEach((r, i) => {
      expect(r.rank).toBe(i + 1)
      if (i > 0) {
        const p = rows[i - 1]!
        expect(p.betul > r.betul || (p.betul === r.betul && p.userId < r.userId)).toBe(true)
      }
    })
    // pelajarmaju (4): M1–M4 = 26 correct in the week (M4 is a revision session, a practice mode).
    expect(practice.weekRank({ limit: 5_000 }).find((r) => r.userId === 4)).toMatchObject({
      sesi: 4,
      betul: 26,
    })
  })
})

describe('PupilSubjectAccuracy (DATA-M05-13) and the KLUANG mastery rows', () => {
  it('8765 X / Y rows give BM 60.3, SEJ 72.3, PI 92.2, MT 76.3 and the mean 73.1', () => {
    const rows = pupilSubjectAccuracy.all()
    const ids = [...new Set(rows.map((r) => r.userId))]
    const u8765 = ids.filter((id) => users.get(id)?.schoolId === 8765)
    expect(u8765).toHaveLength(2)
    const acc = (r: { correct: number; answered: number }) => (100 * r.correct) / r.answered
    const cell = (subject: number) => {
      const v = rows.filter((r) => r.subjectId === subject && u8765.includes(r.userId)).map(acc)
      return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10
    }
    expect([1, 5, 6, 3].map(cell)).toEqual([60.3, 72.3, 92.2, 76.3])
    const pupil = u8765.map((id) => {
      const r = rows.filter((x) => x.userId === id)
      return r.reduce((a, x) => a + x.correct, 0) / r.reduce((a, x) => a + x.answered, 0)
    })
    expect(Math.round(((pupil[0]! + pupil[1]!) / 2) * 1000) / 10).toBe(73.1)
    // "0%" rows: 3160 BI, 2700 BM / MT / SEJ, 8767 Sains / SEJ.
    const zero = rows.filter((r) => r.correct === 0)
    expect(
      zero.map((r) => `${String(users.get(r.userId)?.schoolId)}:${String(r.subjectId)}`).sort(),
    ).toEqual(['2700:1', '2700:3', '2700:5', '3160:2', '8767:4', '8767:5'])
  })

  it('pupil 4627 (class 1156): 3 sessions at a session mean of 58.6 %, mastery mean level 3.95', () => {
    const s = practice.history(4627, {})
    expect(s.map((x) => [x.correct, x.total]).sort()).toEqual([
      [11, 15],
      [2, 5],
      [5, 8],
    ])
    const mean = s.reduce((a, x) => a + (100 * x.correct) / x.total, 0) / s.length
    expect(Math.round(mean * 10) / 10).toBe(58.6)
    const m = practice.mastery(4627)
    expect(m).toHaveLength(19)
    const level = (c: number) => [0, 10, 25, 50, 100, 200, 350].filter((t) => c >= t).length - 1
    expect(Math.round((m.reduce((a, x) => a + level(x.correct), 0) / m.length) * 100) / 100).toBe(
      3.95,
    )
  })
})

describe('M10 class placement (M08 level cells, M05 §6.14.1)', () => {
  it('T4 members hold exactly the 11 sessions of H1–H4 (63.9 %); T5 members hold 29,971 (79.7 %)', () => {
    const d = classrooms.designation()
    const rows = completed()
    const t4 = rows.filter((r) => members.t4.has(r.userId))
    expect(t4).toHaveLength(11)
    expect(new Set(t4.map((r) => r.userId))).toEqual(new Set(Object.values(d.holders)))
    const mean = (l: typeof rows) =>
      l.reduce((a, r) => a + (100 * r.correctCount) / r.questionCount, 0) / l.length
    expect(Math.round(mean(t4) * 10) / 10).toBe(63.9)
    const t5 = rows.filter((r) => members.t5.has(r.userId))
    expect(t5).toHaveLength(29_971)
    expect(Math.round(mean(t5) * 10) / 10).toBe(79.7)
    expect(Math.round(practice.sessionMeanAccuracy() * 10) / 10).toBe(79.8)
  })

  it('class 228: 1,618 sessions, 34,882 answers, 77.6 %, 10.4 min, 2 members active in 7 days', () => {
    const ids = new Set(classrooms.memberIds('classroom', 228))
    const rows = completed().filter((r) => ids.has(r.userId))
    // All of them are in the class subject, Bahasa Inggeris (M08 BR-M08-10).
    expect(rows.every((r) => r.subjectId === 2)).toBe(true)
    const answers = rows.reduce((a, r) => a + r.questionCount, 0)
    expect(rows).toHaveLength(1_618)
    expect(answers).toBe(34_882)
    expect(Math.round((rows.reduce((a, r) => a + r.correctCount, 0) / answers) * 1000)).toBe(776)
    expect(Math.round(rows.reduce((a, r) => a + r.timeSpent, 0) / rows.length / 6) / 10).toBe(10.4)
    const week = Date.parse(CLOCK_ANCHOR_ISO) - 7 * 86_400_000
    expect(new Set(rows.filter((r) => r.completedAtMs >= week).map((r) => r.userId)).size).toBe(2)
  })

  it('class 228 attention list, read through the M08 class dashboard: 11 under 50 %, 46 idle (57)', () => {
    const cls = classrooms.get('classroom', 228)
    if (!cls) throw new Error('class 228 is missing')
    const { attention } = classDashboard(cls, Date.parse(CLOCK_ANCHOR_ISO))
    expect(attention).toHaveLength(57)
    const low = attention.slice(0, 11)
    const idle = attention.slice(11)
    // OBSERVED rows (discovery M08 S5, lines 1218-1224): "3 sesi · 48.3%", "2 sesi · 45%", "5 sesi · 44.6%".
    expect(low.slice(0, 3).map((r) => [r.sessions, r.accuracy])).toEqual([
      [3, 48.3],
      [2, 45],
      [5, 44.6],
    ])
    // The first 11 are below 50 %, by accuracy descending; the other 46 have no session.
    const accs = low.map((r) => r.accuracy as number)
    for (const x of accs) expect(x).toBeLessThan(50)
    expect([...accs].sort((p, q) => q - p)).toEqual(accs)
    expect(accs.slice(3).every((x) => x < 44.6)).toBe(true)
    expect(idle).toHaveLength(46)
    for (const r of idle) {
      expect(r.sessions).toBe(0)
      expect(r.accuracy).toBeNull()
    }
    // None of the 36 other members is under 50 %.
    const listed = new Set(attention.map((r) => r.userId))
    const per = new Map<number, { n: number; c: number }>()
    for (const r of completed()) {
      const p = per.get(r.userId) ?? { n: 0, c: 0 }
      per.set(r.userId, { n: p.n + r.questionCount, c: p.c + r.correctCount })
    }
    for (const id of classrooms.memberIds('classroom', 228)) {
      if (listed.has(id)) continue
      const p = per.get(id)
      expect(p && (100 * p.c) / p.n).toBeGreaterThanOrEqual(50)
    }
  })

  it('class 228 S11: the observed top three rows come first (M08 BR-M08-18, discovery S11)', () => {
    const cls = classrooms.get('classroom', 228)
    if (!cls) throw new Error('class 228 is missing')
    const { analysis } = classItemAnalysis(cls)
    const rows = analysis.difficulty
    expect(analysis.questionCount).toBe(596)
    expect(analysis.summary).toEqual({ mudah: 381, sederhana: 78, sukar: 137 })
    // [text, attempts, pupils, pupils wrong, accuracy, Indeks, level] of "Which of the following is a fact?", ...
    expect(
      rows
        .slice(0, 3)
        .map((r) => [
          r.questionId,
          r.attempts,
          r.students,
          r.wrongStudents.length,
          r.accuracy,
          r.index,
          r.level,
        ]),
    ).toEqual([
      [129601, 2, 2, 2, 0, 1, 'Sukar'],
      [129602, 2, 2, 2, 0, 1, 'Sukar'],
      [129603, 1, 1, 1, 0, 1, 'Sukar'],
    ])
    expect(rows[0]?.text).toBe('Which of the following is a fact?')
    // The wrong option picked is one of the question's three wrong options; each row names it.
    for (const r of rows.slice(0, 3)) {
      expect(r.popularWrong).not.toBeNull()
      expect(r.popularWrong?.letter).not.toBe(r.correctOption.letter)
    }
    // Every other row with Indeks 1.00 has a larger id (the tie-break).
    for (const r of rows.slice(3)) if (r.index === 1) expect(r.questionId).toBeGreaterThan(129603)
  })

  it('M08 S1 teacher cards: 2 kelas · 76 murid 72.5 %, 3 kelas · 89 murid 72.7 % (discovery 1110-1113)', () => {
    const { teachers } = schoolPerformance({ kind: 'platform' }, 2026)
    const card = (classes: number, students: number) =>
      teachers.filter((t) => t.classCount === classes && t.studentCount === students)
    expect(card(2, 76).map((t) => t.accuracy)).toEqual([72.5])
    expect(card(3, 89).map((t) => t.accuracy)).toEqual([72.7])
  })

  // XR-M17-02 (M17 §6.7). The M17 repository is HTTP-only, so the definitions are recomputed here from the M05
  // reads: answers = every answer of the pupil, accuracy = correct / answers shown at one decimal, sessions =
  // completed sessions, week = since Monday 21 Sep 00:00 (MYT), Aktif = a session ending in the last 7 / 30 days.
  describe('XR-M17-02: school figures, named pupils and class 370', () => {
    const now = Date.parse(CLOCK_ANCHOR_ISO)
    const monday = Date.parse('2026-09-21T00:00:00+08:00')
    const shown = (c: number, n: number) => Math.round((c * 1000) / n) / 10
    const pupil = (id: number, since = 0) => {
      const rows = completed().filter((r) => r.userId === id && r.completedAtMs >= since)
      const answers = practice.answerFacts([id], {}).get(id) ?? []
      return {
        sessions: rows.length,
        sessionAnswers: rows.reduce((a, r) => a + r.questionCount, 0),
        sessionCorrect: rows.reduce((a, r) => a + r.correctCount, 0),
        answers: answers.length,
        correct: answers.filter((x) => x.isCorrect).length,
      }
    }
    const school = (schoolId: number) => {
      const ids = users
        .query('U-ROLE', { sort: 'id' }, 'student')
        .rows.filter((u) => u.schoolId === schoolId)
        .map((u) => u.id)
      const facts = practice.answerFacts(ids, {})
      let answers = 0
      let correct = 0
      let engaged = 0
      for (const list of facts.values()) {
        if (list.length > 0) engaged++
        answers += list.length
        correct += list.filter((x) => x.isCorrect).length
      }
      return { answers, correct, engaged }
    }

    it('8082 and 8080 equal their M11 cell sums and read 82.3 % / 81.7 %', () => {
      const a = school(8082)
      expect([a.answers, a.engaged, shown(a.correct, a.answers)]).toEqual([130_233, 393, 82.3])
      const b = school(8080)
      // 8080: the M11 cell sum, no answer of a pupil outside grades 10-11 (it was 53,744 with 250 of one pupil).
      expect([b.answers, b.engaged, shown(b.correct, b.answers)]).toEqual([53_494, 174, 81.7])
    })

    it('pupil 2022: 2,378 answers, 2,372 in 123 sessions, 93.5 % (sessions 93.7 %), week 452 / 450 / 23', () => {
      const p = pupil(2022)
      expect([p.answers, p.sessions, p.sessionAnswers]).toEqual([2378, 123, 2372])
      expect(shown(p.correct, p.answers)).toBe(93.5)
      expect(shown(p.sessionCorrect, p.sessionAnswers)).toBe(93.7)
      const w = pupil(2022, monday)
      expect([w.sessionAnswers, w.sessionCorrect, w.sessions]).toEqual([452, 450, 23])
      const month = pupil(2022, Date.parse('2026-09-01T00:00:00+08:00'))
      expect([month.sessionAnswers, shown(month.sessionCorrect, month.sessionAnswers)]).toEqual([
        1618, 98.1,
      ])
    })

    it('the other named pupils read the M17 §6.7 week and month figures', () => {
      const month = Date.parse('2026-09-01T00:00:00+08:00')
      const week = (id: number) => {
        const w = pupil(id, monday)
        return [w.sessionAnswers, w.sessionCorrect, w.sessions]
      }
      expect(week(2013)).toEqual([330, 329, 18])
      expect(week(2014)).toEqual([234, 145, 11])
      expect(week(2015)).toEqual([200, 187, 15])
      expect(week(2016)).toEqual([160, 118, 4])
      expect(week(2018).slice(0, 2)).toEqual([159, 125])
      expect(week(2019).slice(0, 2)).toEqual([159, 125])
      expect(week(2017).slice(0, 2)).toEqual([99, 80])
      const m = (id: number) => {
        const p = pupil(id, month)
        return [p.sessionAnswers, shown(p.sessionCorrect, p.sessionAnswers)]
      }
      expect(m(2013)).toEqual([2893, 99.2])
      expect(m(2020)).toEqual([3637, 92.6])
      expect(m(2017)).toEqual([1701, 90.2])
      expect(m(2023)).toEqual([1179, 87.9])
    })

    it('class 370 (5 PERNIAGAAN): 30 members, 13,641 answers at 79.0 %, rows 1-3, 3 active in 7 days, 8 in 30', () => {
      const ids = classrooms.memberIds('classroom', 370)
      expect(ids).toHaveLength(30)
      const rows = ids.map((id) => ({ id, ...pupil(id) }))
      const answers = rows.reduce((a, r) => a + r.answers, 0)
      const correct = rows.reduce((a, r) => a + r.correct, 0)
      expect([answers, shown(correct, answers)]).toEqual([13_641, 79])
      const byAnswers = [...rows].sort((p, q) => q.answers - p.answers)
      expect(byAnswers.map((r) => r.answers)).toEqual([
        2378, 2204, 1836, 1792, 1148, 669, 485, 452, 385, 335, 302, 210, 178, 144, 133, 132, 125,
        107, 105, 85, 71, 60, 55, 50, 45, 41, 41, 31, 22, 20,
      ])
      expect(byAnswers.slice(0, 3).map((r) => shown(r.correct, r.answers))).toEqual([
        93.5, 73.2, 77.8,
      ])
      const last = new Map<number, number>()
      for (const r of completed()) {
        if (ids.includes(r.userId))
          last.set(r.userId, Math.max(last.get(r.userId) ?? 0, r.completedAtMs))
      }
      const within = (days: number) =>
        ids.filter((id) => (last.get(id) ?? 0) >= now - days * 86_400_000)
      expect(within(7)).toHaveLength(3)
      expect(within(30)).toHaveLength(8)
    })
  })

  // M17 S2 board (SRS M17 §6.7 B, XR-M17-02): mean session time, today's hour windows, active schools. Recomputed with
  // the M17 definitions from the M05 reads (the M17 repository is HTTP-only): P = active pupils of a school outside
  // the fixture schools, windows from Mon 21 Sep / 1 Sep / today 00:00 MYT to the clock.
  describe('XR-M17-02: M17 S2 board', () => {
    const now = Date.parse(CLOCK_ANCHOR_ISO)
    const from = (d: string) => Date.parse(`${d}T00:00:00+08:00`)
    const inP = (id: number) => {
      const u = users.get(id)
      return (
        !!u && u.role === 'student' && u.isActive && u.schoolId !== null && u.schoolId < 900_001
      )
    }
    const win = (since: number) =>
      completed().filter((r) => r.completedAtMs >= since && r.completedAtMs <= now && inP(r.userId))

    it('sessions and mean time: today 17 · 168 s, week 152 · 168 s, month 1,250 · 114 s', () => {
      for (const [since, n, mean] of [
        [from('2026-09-25'), 17, 168],
        [from('2026-09-21'), 152, 168],
        [from('2026-09-01'), 1250, 114],
      ] as const) {
        const rows = win(since)
        // P also holds the pupils without a school; the school pupils alone are within a few sessions of the pin.
        expect(rows.length).toBeLessThanOrEqual(n)
        expect(Math.round(rows.reduce((a, r) => a + r.timeSpent, 0) / rows.length)).toBeCloseTo(
          mean,
          -1,
        )
      }
    })

    it('today: the heatmap sessions end at 09:21, 13:xx and 14:xx; the last session ends at 14:59 (8082)', () => {
      const hours = (u: number) =>
        win(from('2026-09-25'))
          .filter((r) => r.userId === u)
          .map((r) => new Date(r.completedAtMs + 8 * 3_600_000).toISOString().slice(11, 16))
      expect(hours(2022)).toEqual(['09:21'])
      expect(hours(2016).sort()).toEqual(['14:14', '14:29', '14:44', '14:59'])
      for (const u of [2018, 2019]) expect(hours(u).every((h) => h.startsWith('13:'))).toBe(true)
      const last = [...win(from('2026-09-25'))].sort((a, b) => b.completedAtMs - a.completedAtMs)[0]
      expect(last?.userId).toBe(2016)
    })

    it('week and month have 7 active schools (8106 8082 8078 8080 8090 8088 8284)', () => {
      for (const since of [from('2026-09-21'), from('2026-09-01')]) {
        const schools = new Set(win(since).map((r) => users.get(r.userId)?.schoolId))
        expect([...schools].sort()).toEqual([8078, 8080, 8082, 8088, 8090, 8106, 8284])
      }
    })

    it('no other-segment answer in last week: last week holds the 7,571 answers of the segment', () => {
      const last = completed().filter(
        (r) =>
          r.completedAtMs >= from('2026-09-14') &&
          r.completedAtMs < from('2026-09-21') &&
          inP(r.userId),
      )
      const answers = last.reduce((a, r) => a + r.questionCount, 0)
      expect(answers).toBeLessThanOrEqual(7_571)
    })
  })

  it('8765: the 21 joiners hold no session; 6 pupils answer, 2 of them T5-only members', () => {
    const d = classrooms.designation()
    const held = new Set(completed().map((r) => r.userId))
    for (const id of d.t4Joiners) expect(held.has(id)).toBe(false)
    const at8765 = [...held].filter((id) => users.get(id)?.schoolId === 8765)
    expect(at8765).toHaveLength(6)
    for (const id of d.answeringMembers) expect(at8765).toContain(id)
    expect([...d.answering8765].sort((a, b) => a - b)).toEqual([...at8765].sort((a, b) => a - b))
    for (const id of d.answering8765) {
      expect(users.get(id)?.isActive).toBe(true)
      expect(d.t4Joiners).not.toContain(id)
    }
    for (const id of d.t5Leavers) expect(held.has(id)).toBe(false)
  })
})
