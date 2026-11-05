import { describe, expect, it } from 'vitest'

import type { ClassesRepository } from '../../src/modules/classes'
import type {
  ActivityDayRow,
  AnalyticsRepository,
} from '../../src/modules/reports/analytics/analytics.repository'
import { ReportService } from '../../src/modules/reports/analytics/services/report.service'

// DB-free unit test of the teacher report (FR-GUR-42-2 / -6, AC-GUR-42-3 / -6): a fake repository, no database.
const NOW = new Date('2026-10-20T10:00:00+08:00')
const NAMES = ['Aina', 'Bella', 'Chong', 'Devi', 'Esa', 'Farid', 'Gita']
const pupils = NAMES.map((name, i) => ({
  id: String(i + 1),
  name,
  email: `${name.toLowerCase()}@x.test`,
  grade: 10,
  lastLoginAt: i < 4 ? new Date('2026-10-01T00:00:00Z') : null,
  avatar: null,
}))

function build(opts: { activity: ActivityDayRow[]; practised: string[] }): ReportService {
  const repo = {
    studentsAmong: async () => pupils,
    activityByDay: async () => opts.activity,
    practisedAnyMode: async () => new Set(opts.practised),
  } as unknown as AnalyticsRepository
  const classes = {
    forTeacher: async () => [{ id: '10', name: '5 Bestari', kind: 'classroom', isActive: true }],
    teacherStudentIds: async () => pupils.map((p) => p.id),
    memberIds: async () => pupils.map((p) => p.id),
  } as unknown as ClassesRepository
  return new ReportService(repo, classes, { now: () => NOW } as never)
}
const ctx = { userId: '99', role: 'teacher', schoolId: '1' } as const
const row = (
  userId: string,
  mode: string,
  accuracySum: number,
  accuracyN = 1,
  sessions = 1,
): ActivityDayRow => ({ userId, mode, day: '2026-10-19', sessions, accuracySum, accuracyN })

describe('teacher report: every mode counts (FR-GUR-42-6)', () => {
  it('AC-GUR-42-6: a Bijak-only and a Set-Soalan-only pupil count as practised (2 / 7) and in Jumlah Aktiviti and the trend', async () => {
    const svc = build({
      activity: [row('1', 'bijak', 0.5), row('2', 'question_set', 1)],
      practised: ['1', '2'],
    })
    const r = await svc.report(ctx, {})
    expect(r.population).toEqual({ total: 7, loggedIn: 4, practised: 2 })
    expect(Math.round((r.population.practised / r.population.total) * 100)).toBe(29)
    expect(r.activity.total).toBe(2)
    expect(r.activity.byType.kuiz).toBe(2) // unknown modes stay counted (as Kuiz)
    expect(r.trend.reduce((n, x) => n + x.count, 0)).toBe(2)
    expect(r.notPractisedAll.map((s) => s.name)).toEqual(['Chong', 'Devi', 'Esa', 'Farid', 'Gita'])
    expect(r.mostActive.map((s) => s.id).sort()).toEqual(['1', '2'])
  })

  it('FR-GUR-42-3: the card count equals the list length (never practised = total - practised)', async () => {
    const r = await build({ activity: [row('1', 'random', 1)], practised: ['1', '3'] }).report(
      ctx,
      {},
    )
    expect(r.notPractisedAll).toHaveLength(r.population.total - r.population.practised)
    expect(r.notPractised).toHaveLength(Math.min(10, r.notPractisedAll.length))
  })

  it('answers-only pupils (no session) are practised but add no activity', async () => {
    const r = await build({ activity: [], practised: ['5'] }).report(ctx, {})
    expect(r.population.practised).toBe(1)
    expect(r.activity.total).toBe(0)
    expect(r.score.overall).toBeNull()
  })
})

describe('teacher report: Skor Purata is the mean of per-session accuracies (FR-GUR-42-2)', () => {
  it('is not pooled: a 1/1 session and a 5/10 session give 75, not 6/11 = 55', async () => {
    const r = await build({
      activity: [row('1', 'random', 1), row('2', 'random', 0.5)],
      practised: ['1', '2'],
    }).report(ctx, {})
    expect(r.score.overall).toBe(75)
    expect(r.score.byType.kuiz).toBe(75)
  })

  it('averages across types and is null when no session has questions', async () => {
    const mixed = await build({
      activity: [row('1', 'random', 1), row('2', 'latih_tubi', 0.5), row('3', 'ramalan', 0)],
      practised: [],
    }).report(ctx, {})
    expect(mixed.score.overall).toBe(50)
    expect(mixed.score.byType).toMatchObject({ kuiz: 100, latihTubi: 50, trackingA: 0 })
    const none = await build({ activity: [row('1', 'random', 0, 0)], practised: ['1'] }).report(
      ctx,
      {},
    )
    expect(none.score.overall).toBeNull()
    expect(none.activity.total).toBe(1)
  })
})
