import { GuruWeeklyReportSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { FixedClock } from '../../../../src/db/clock'
import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import { WeeklyReportService } from '../../../../src/modules/reports/performance/services'
import { InMemoryClasses } from '../fakes/in-memory-classes'

/** Thursday 2026-11-05 10:00 MYT: the week is 2026-11-02 .. 2026-11-08. */
const NOW = '2026-11-05T10:00:00+08:00'

interface Ans {
  user: string
  subject: string | null
  correct: boolean
  at: string
  test?: boolean
}

/** A fake Prisma client with `groupBy` / `findMany` stubs that honour the where clause used by the service. */
function fakePrisma(answers: Ans[], users: Record<string, string>, subjects: Record<string, string>) {
  const hit = (where: { userId: { in: bigint[] }; answeredAt: { gte: Date; lt: Date }; isTest: boolean; subjectId?: unknown }) =>
    answers.filter((a) => {
      const t = new Date(a.at).getTime()
      return (
        where.userId.in.includes(BigInt(a.user)) &&
        t >= where.answeredAt.gte.getTime() &&
        t < where.answeredAt.lt.getTime() &&
        (a.test === true) === where.isTest &&
        (where.subjectId === undefined || a.subject !== null)
      )
    })
  const group = (rows: Ans[], key: 'user' | 'subject') => {
    const m = new Map<string, { k: string; isCorrect: boolean; n: number }>()
    for (const a of rows) {
      const id = `${a[key]}|${a.correct}`
      const e = m.get(id) ?? { k: String(a[key]), isCorrect: a.correct, n: 0 }
      e.n += 1
      m.set(id, e)
    }
    return [...m.values()]
  }
  return {
    client: {
      practiceAnswer: {
        groupBy: async (args: { by: string[]; where: Parameters<typeof hit>[0] }) =>
          group(hit(args.where), args.by[0] === 'userId' ? 'user' : 'subject').map((g) => ({
            [args.by[0] as string]: BigInt(g.k),
            isCorrect: g.isCorrect,
            _count: { _all: g.n },
          })),
      },
      user: {
        findMany: async (args: { where: { id: { in: bigint[] } } }) =>
          args.where.id.in.map((id) => ({ id, name: users[String(id)] as string })),
      },
      subject: {
        findMany: async (args: { where: { id: { in: bigint[] } } }) =>
          args.where.id.in.map((id) => ({ id, name: subjects[String(id)] as string })),
      },
    },
  }
}

const TUE = '2026-11-03T10:00:00+08:00'
const LAST = '2026-10-28T10:00:00+08:00'

/** n answers of one pupil, `correct` of them right. */
function many(user: string, n: number, correct: number, at = TUE, subject: string | null = '1'): Ans[] {
  return Array.from({ length: n }, (_, i) => ({ user, subject, correct: i < correct, at }))
}

const NAMES: Record<string, string> = { '1': 'Aina Ujian', '2': 'Bakar Ujian', '3': 'Chong Ujian', '4': 'Devi Ujian', '5': 'Emir Ujian', '6': 'Farah Ujian', '7': 'Gita Ujian' }
const SUBJECTS: Record<string, string> = { '1': 'Matematik', '2': 'Sains', '3': 'Bahasa Melayu' }

let classes: InMemoryClasses
function service(answers: Ans[], now = NOW): WeeklyReportService {
  const clock = new FixedClock(now)
  const ports = new PerformancePorts(undefined, classes)
  return new WeeklyReportService(ports, clock, fakePrisma(answers, NAMES, SUBJECTS) as never)
}
const q = { classroomId: 'c1' }

beforeEach(() => {
  classes = new InMemoryClasses().add({ id: 'c1', schoolId: 's1', teacherId: 't1', name: '4 Amanah' }, ['1', '2', '3', '4', '5', '6', '7'])
  classes.add({ id: 'c2', schoolId: 's1', teacherId: 't2', name: '4 Cekap' }, [])
})

describe('Guru weekly report (API-GUR-21)', () => {
  it('week window and label for the current week, schema valid', async () => {
    const r = await service([]).guruReport('t1', q)
    expect(r.week).toEqual({ from: '2026-11-02', to: '2026-11-08', label: '02 Nov 2026 — 08 Nov 2026' })
    expect(r.classroom).toEqual({ id: 'c1', name: '4 Amanah' })
    GuruWeeklyReportSchema.parse(r)
  })

  it('week parameter across a month and year boundary', async () => {
    const r = await service([]).guruReport('t1', { ...q, week: '2026-12-31' })
    expect(r.week).toEqual({ from: '2026-12-28', to: '2027-01-03', label: '28 Dis 2026 — 03 Jan 2027' })
    const sunday = await service([]).guruReport('t1', { ...q, week: '2026-11-08' })
    expect(sunday.week.from).toBe('2026-11-02')
  })

  it('AC-GUR-43-2: three pupils answered 6, 8, 4: active 3, answered 18, top = the two with >= 5', async () => {
    const r = await service([...many('1', 6, 6), ...many('2', 8, 4), ...many('3', 4, 4)]).guruReport('t1', q)
    expect(r.summary).toMatchObject({ activePupils: 3, answered: 18 })
    expect(r.topPerformers.map((t) => [t.rank, t.name, t.answered, t.accuracy])).toEqual([
      [1, 'Aina Ujian', 6, 100],
      [2, 'Bakar Ujian', 8, 50],
    ])
  })

  it('AC-GUR-43-3: a subject at 45% is an attention subject and counted in the summary', async () => {
    const r = await service([...many('1', 20, 9, TUE, '2'), ...many('2', 10, 9, TUE, '1')]).guruReport('t1', q)
    expect(r.attentionSubjects).toEqual([{ subject: 'Sains', accuracy: 45, answered: 20 }])
    expect(r.summary.attentionSubjects).toBe(1)
  })

  it('AC-GUR-43-4: 50% last week and 70% this week is most improved +20', async () => {
    const r = await service([...many('1', 10, 5, LAST), ...many('1', 10, 7)]).guruReport('t1', q)
    expect(r.mostImproved).toEqual([{ name: 'Aina Ujian', previousAccuracy: 50, accuracy: 70, delta: 20 }])
    expect(r.summary.improvedPupils).toBe(1)
  })

  it('most improved needs answers in both weeks and a positive delta', async () => {
    const r = await service([...many('1', 10, 7), ...many('2', 10, 5, LAST), ...many('2', 10, 5), ...many('3', 10, 8, LAST), ...many('3', 10, 5)]).guruReport('t1', q)
    expect(r.mostImproved).toEqual([])
    expect(r.summary.improvedPupils).toBe(0)
  })

  it('AC-GUR-43-5: no activity gives zeros and empty lists', async () => {
    const r = await service([]).guruReport('t1', q)
    expect(r.summary).toEqual({ answered: 0, activePupils: 0, improvedPupils: 0, attentionSubjects: 0 })
    expect([r.topPerformers, r.mostImproved, r.attentionSubjects]).toEqual([[], [], []])
  })

  it("AC-GUR-43-6: another teacher's class and an unknown class are FORBIDDEN", async () => {
    await expect(service([]).guruReport('t1', { classroomId: 'c2' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service([]).guruReport('t1', { classroomId: 'nope' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('AC-GUR-43-10: answers from a session and outside any session / subject count (5 + 4)', async () => {
    const r = await service([...many('1', 5, 5), ...many('1', 4, 0, TUE, null)]).guruReport('t1', q)
    expect(r.summary.answered).toBe(9)
    expect(r.topPerformers[0]).toMatchObject({ name: 'Aina Ujian', answered: 9, accuracy: 55.6 })
    expect(r.attentionSubjects).toEqual([])
  })

  it('AC-GUR-43-11: 49.4% is listed (whole 49), 49.6% is not (whole 50)', async () => {
    // Pooled over the class: subject 1 = 247/500, subject 2 = 248/500.
    const low = [...many('1', 500, 247, TUE, '1')]
    const high = [...many('2', 500, 248, TUE, '2')]
    const r = await service([...low, ...high]).guruReport('t1', q)
    expect(r.attentionSubjects).toEqual([{ subject: 'Matematik', accuracy: 49.4, answered: 500 }])
  })

  it('test rows and pupils outside the class are excluded', async () => {
    const r = await service([...many('1', 5, 5), { user: '1', subject: '1', correct: true, at: TUE, test: true }, ...many('99', 5, 5)]).guruReport('t1', q)
    expect(r.summary).toMatchObject({ answered: 5, activePupils: 1 })
  })

  it('MYT boundary: Sunday 23:30 counts, next Monday 00:00 does not', async () => {
    const r = await service([
      { user: '1', subject: '1', correct: true, at: '2026-11-08T23:30:00+08:00' },
      { user: '1', subject: '1', correct: true, at: '2026-11-09T00:00:00+08:00' },
      { user: '2', subject: '1', correct: true, at: '2026-11-02T00:00:00+08:00' },
      { user: '3', subject: '1', correct: true, at: '2026-11-01T23:59:59+08:00' },
    ]).guruReport('t1', q)
    expect(r.summary.answered).toBe(2)
  })

  it('rounding: 4/6 is 66.7, 5/5 is the integer 100, 1/3 is 33.3; every accuracy has at most one decimal', async () => {
    const r = await service([...many('1', 6, 4), ...many('2', 5, 5), ...many('3', 7, 3), ...many('4', 9, 7), ...many('5', 3, 1, TUE, '2')]).guruReport('t1', q)
    expect(r.topPerformers.map((t) => t.accuracy)).toEqual([100, 77.8, 66.7, 42.9])
    expect(Number.isInteger(r.topPerformers[0]?.accuracy)).toBe(true)
    expect(JSON.stringify(r.topPerformers[0]?.accuracy)).toBe('100')
    expect(r.attentionSubjects).toEqual([{ subject: 'Sains', accuracy: 33.3, answered: 3 }])
    const all = [...r.topPerformers.map((t) => t.accuracy), ...r.attentionSubjects.map((x) => x.accuracy)]
    for (const x of all) expect(Math.round(x * 10) / 10).toBe(x)
  })

  it('sorting: whole accuracy desc, then answered desc, then name; capped at 5 with ranks 1..5', async () => {
    const r = await service([
      ...many('1', 10, 8), // 80
      ...many('2', 20, 16), // 80, more answers
      ...many('3', 10, 8), // 80, name after Aina
      ...many('4', 5, 5), // 100
      ...many('5', 5, 3), // 60
      ...many('6', 5, 2), // 40
    ]).guruReport('t1', q)
    expect(r.topPerformers.map((t) => [t.rank, t.name])).toEqual([
      [1, 'Devi Ujian'],
      [2, 'Bakar Ujian'],
      [3, 'Aina Ujian'],
      [4, 'Chong Ujian'],
      [5, 'Emir Ujian'],
    ])
    expect(r.summary.activePupils).toBe(6)
  })

  it('most improved: delta desc then name, capped at 5, summary counts all', async () => {
    const prev = ['1', '2', '3', '4', '5', '6'].flatMap((u) => many(u, 10, 5, LAST))
    const now = [
      ...many('1', 10, 6), // +10
      ...many('2', 10, 7), // +20
      ...many('3', 10, 6), // +10
      ...many('4', 10, 8), // +30
      ...many('5', 10, 9), // +40
      ...many('6', 10, 7), // +20
    ]
    const r = await service([...prev, ...now]).guruReport('t1', q)
    expect(r.mostImproved.map((m) => [m.name, m.delta])).toEqual([
      ['Emir Ujian', 40],
      ['Devi Ujian', 30],
      ['Bakar Ujian', 20],
      ['Farah Ujian', 20],
      ['Aina Ujian', 10],
    ])
    expect(r.summary.improvedPupils).toBe(6)
  })

  it('attention subjects sort by accuracy ascending', async () => {
    const r = await service([...many('1', 10, 4, TUE, '1'), ...many('2', 10, 2, TUE, '2'), ...many('3', 10, 3, TUE, '3')]).guruReport('t1', q)
    expect(r.attentionSubjects.map((s) => [s.subject, s.accuracy])).toEqual([
      ['Sains', 20],
      ['Bahasa Melayu', 30],
      ['Matematik', 40],
    ])
  })

  it('report() (API-RPT-13) still throws FORBIDDEN', () => {
    expect(() => service([]).report()).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }) as Error)
  })
})
