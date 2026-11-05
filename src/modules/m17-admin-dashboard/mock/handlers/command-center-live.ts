/**
 * SRS M17 v1.13 §7 #3: `GET /api/admin/command-center/live-data`, the data of the live board S2
 * (FR-M17-21…32, FR-M17-101…111; M17-T1b).
 *
 * Guard **AS**: the admin sees the platform; a `school_admin` sees every field filtered to the session's
 * school (never the request's: a client `school_id` is ignored), `topSchools` empty, the shape unchanged
 * (BR-M17-34, FR-M17-105). 401 without a session, 403 for any other role and for a school admin without a
 * school (never platform figures). The display constants DC-M17-03 / DC-M17-05 belong to the platform view;
 * the school view gets zeros for "Pembetulan" and the five buckets, and its own 7 days of answers as
 * `dailyTrend` (OQ-M17-12).
 */

import { DAY_MS, formatMyt, toIsoMyt } from '@/lib/time'
import { ok, queryString, requireRole, route, type MockRequest, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { battles } from '@/modules/m16-battle-games/mock'

import type { AdminAnalytics, AdminDashboard, AdminLaporan, AdminRange } from '../../api/command-center'
import type {
  CcDailyPoint,
  CcFeedRow,
  CcLiveData,
  CcTopSchool,
  CcTopStudent,
} from '../../api/command-center-board-types'
import { buildStatsReport } from '../reports/stats-report'
import { DC_M17_03, DC_M17_05 } from '../constants/command-center-display'
import { adminOrSchoolAdmin } from './command-center-drill-scope'
import {
  PLATFORM_SCOPE,
  accuracyOf,
  answersLastWeek,
  answersPerDay,
  boardCtx,
  gpsOf,
  isSchoolView,
  latestAnswers,
  moodCounts,
  pupilCount,
  satisfactionOf,
  schoolName,
  schoolOfUser,
  subjectInfo,
  subscribedCount,
  sumOf,
  tallies,
  weekChangeOf,
  type BoardCtx,
  type BoardScope,
} from './command-center-live-reads'

/** The scope of the request's session (`adminOrSchoolAdmin` has run): the school comes from the session only. */
export function boardScopeOf(req: MockRequest): BoardScope {
  if (!req.session) throw new Error('adminOrSchoolAdmin must run first')
  if (req.session.role !== 'school_admin') return PLATFORM_SCOPE
  const schoolId = users.get(req.session.userId)?.schoolId
  if (schoolId == null)
    throw new Error('a school admin without a school must be refused by the guard')
  return { schoolId }
}

/** BM weekday abbreviations of the school view's 7-day bars (PROPOSED: the server's labels are locale-dependent). */
const WEEKDAY_BM = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'] as const

const weekdayLabel = (dateKey: string): string =>
  WEEKDAY_BM[new Date(`${dateKey}T00:00:00Z`).getUTCDay()] ?? ''

/** `{id, name}` of the viewer's school, `null` on the platform view. */
export function boardSchool(ctx: BoardCtx): { id: number; name: string } | null {
  const id = ctx.scope.schoolId
  if (id === null) return null
  return { id, name: schoolName(id) ?? '' }
}

function topSchools(ctx: BoardCtx): CcTopSchool[] {
  if (isSchoolView(ctx)) return []
  const bySchool = new Map<number, { active: number; answers: number }>()
  for (const [userId, t] of tallies(ctx, 'all')) {
    const school = schoolOfUser(userId)
    if (school === null) continue
    const row = bySchool.get(school) ?? { active: 0, answers: 0 }
    row.active++
    row.answers += t.answers
    bySchool.set(school, row)
  }
  return [...bySchool.entries()]
    .sort((a, b) => b[1].active - a[1].active || b[1].answers - a[1].answers || a[0] - b[0])
    .slice(0, 5)
    .map(([schoolId, v]) => ({
      schoolId,
      schoolName: schoolName(schoolId) ?? '',
      activeCount: v.active,
      totalAnswers: v.answers,
    }))
}

/** The 5 pupils with most answers in the ISO week (ties: accuracy desc, id asc), FR-M17-29. */
function topStudents(ctx: BoardCtx): CcTopStudent[] {
  return [...tallies(ctx, 'week').entries()]
    .sort(
      (a, b) =>
        b[1].answers - a[1].answers ||
        b[1].correct / b[1].answers - a[1].correct / a[1].answers ||
        a[0] - b[0],
    )
    .slice(0, 5)
    .map(([id, t]) => ({
      studentId: id,
      name: users.get(id)?.name ?? '',
      schoolName: schoolName(schoolOfUser(id)),
      answersCount: t.answers,
      accuracy: accuracyOf(t.correct, t.answers),
    }))
}

function recentFeed(ctx: BoardCtx): CcFeedRow[] {
  return latestAnswers(ctx, 10).map((a) => {
    const schoolId = schoolOfUser(a.userId)
    return {
      student: users.get(a.userId)?.name ?? '',
      subject: subjectInfo(a.subjectId).shortName,
      correct: a.isCorrect,
      time: formatMyt(a.answeredAtMs, 'HH:mm'),
      schoolId,
      schoolName: schoolName(schoolId),
    }
  })
}

function dailyTrend(ctx: BoardCtx): CcDailyPoint[] {
  if (!isSchoolView(ctx)) return []
  return [...answersPerDay(ctx, 7)].map(([date, count]) => ({
    date,
    label: weekdayLabel(date),
    count,
  }))
}

/** The whole `LiveData` of the scope at the request clock (SRS §7 response shapes). */
export function buildLiveData(scope: BoardScope, now: number): CcLiveData {
  const ctx = boardCtx(scope, now)
  const school = isSchoolView(ctx)
  const all = tallies(ctx, 'all')
  const total = sumOf(all)
  const week = sumOf(tallies(ctx, 'week'))
  const today = sumOf(tallies(ctx, 'today'))
  const lastWeek = answersLastWeek(ctx)
  const accuracy = accuracyOf(total.correct, total.answers)
  const gps = gpsOf(ctx)
  const t1 = satisfactionOf(ctx)
  const engaged30d = tallies(ctx, '30d').size

  return {
    generatedAt: toIsoMyt(now),
    scope: school ? 'school' : 'platform',
    school: boardSchool(ctx),
    totalSchools: subscribedCount(ctx),
    totalStudents: pupilCount(ctx),
    activeStudents: all.size,
    totalAnswered: total.answers,
    answeredToday: today.answers,
    answeredWeek: week.answers,
    answeredLastWeek: lastWeek,
    weekChange: weekChangeOf(week.answers, lastWeek),
    accuracy,
    topSchools: topSchools(ctx),
    topStudents: topStudents(ctx),
    gpsOverall: gps,
    kirk: {
      t1: { value: t1.value, scale: 5, count: t1.count },
      t2Accuracy: accuracy,
      t3Active: engaged30d,
      t4Gps: gps,
    },
    engagement: school
      ? { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 }
      : { ...DC_M17_05 },
    dailyTrend: dailyTrend(ctx),
    mood: moodCounts(ctx, 'all'),
    recentFeed: recentFeed(ctx),
    correction: school
      ? { total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] }
      : { ...DC_M17_03, topImprovers: [] },
  }
}

export const commandCenterLiveRoutes: RouteDef[] = [
  route('GET', '/api/admin/command-center/live-data', [adminOrSchoolAdmin], (req, ctx) =>
    ok(buildLiveData(boardScopeOf(req), ctx.clock.now())),
  ),
]

// --- Admin Pusat central pages (S6-T11): API-ADM-11 dashboard, API-ADM-12 analytics, API-ADM-13 laporan ---------

const adminOnly = requireRole('admin')
type Status = 'draft' | 'pending_review' | 'approved' | 'archived'
const STATUS_KEYS: [keyof AdminDashboard['questions']['byStatus'], Status][] = [
  ['draft', 'draft'],
  ['review', 'pending_review'],
  ['approved', 'approved'],
  ['archived', 'archived'],
]

/** Counts through the Studio list query (`adminList`), so the tiles and the Studio always agree (FR-ADM-M01.1). */
function questionStatusCounts(): AdminDashboard['questions']['byStatus'] {
  const out = { draft: 0, review: 0, approved: 0, archived: 0 }
  for (const [key, status] of STATUS_KEYS) {
    out[key] = questions.adminList({ status, page: 1, pageSize: 1 }).total
  }
  return out
}

/** Tingkatan levels only (Darjah is hidden, D72). */
const secondaryLevels = () => curriculum.levels({ active: true }).filter((l) => l.stage !== 'primary')

export function buildAdminDashboard(now: number): AdminDashboard {
  const levelIds = [...curriculum.levels().filter((l) => l.stage !== 'primary').map((l) => l.id), null]
  return {
    questions: {
      total: questions.adminList({ page: 1, pageSize: 1 }).total,
      byStatus: questionStatusCounts(),
      thisWeek: questions.countWhere({
        createdAtMs: { gte: now - 7 * DAY_MS },
        educationLevelId: levelIds,
      }),
    },
    subjects: {
      total: curriculum.subjects().length,
      active: curriculum.subjects({ active: true }).length,
    },
    levels: secondaryLevels().length,
    users: {
      total: users.countWhere({}),
      students: users.countWhere({ role: 'student' }),
      teachers: users.countWhere({ role: 'teacher' }),
    },
    battles: battles.m17Counts(),
  }
}

const rangeOf = (raw: string | undefined): AdminRange => (raw === '7d' || raw === '90d' ? raw : '30d')
const daysOf = (r: AdminRange): number => (r === '7d' ? 7 : r === '90d' ? 90 : 30)

export function buildAdminAnalytics(rangeRaw: string | undefined, now: number): AdminAnalytics {
  const range = rangeOf(rangeRaw)
  const ctx = boardCtx(PLATFORM_SCOPE, now)
  const report = buildStatsReport(daysOf(range), { now })
  const win = range === '7d' ? '7d' : range === '30d' ? '30d' : 'all'
  const inRange = tallies(ctx, win)
  const sum = sumOf(inRange)
  const bySchool = new Map<number, number>()
  for (const [userId, t] of inRange) {
    const school = schoolOfUser(userId)
    if (school !== null) bySchool.set(school, (bySchool.get(school) ?? 0) + t.answers)
  }
  const total = questions.adminList({ page: 1, pageSize: 1 }).total
  const tagged = questions.adminList({ dskpFilter: 'tagged', page: 1, pageSize: 1 }).total
  const approved = questions.adminList({ status: 'approved', page: 1, pageSize: 1 }).total
  return {
    range,
    platform: {
      schools: report.schools.length,
      activeSubscriptions: report.schools.filter((s) => s.subscription === 'Aktif').length,
      students: report.overview.pupils,
      activeStudents: report.overview.practised,
      answered: sum.answers,
      accuracy: sum.answers === 0 ? null : accuracyOf(sum.correct, sum.answers),
    },
    trend: [...answersPerDay(ctx, Math.min(daysOf(range), 30))].map(([date, answered]) => ({
      date,
      answered,
    })),
    topSchools: [...bySchool.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 10)
      .map(([id, answered]) => ({ schoolId: id, school: schoolName(id) ?? '', answered })),
    bank: {
      total,
      bySubject: curriculum
        .subjects({ active: true })
        .map((s) => ({ id: s.id, name: s.name, total: questions.visibleCount('Q-ALL', s.id) })),
      byLevel: secondaryLevels().map((l) => ({
        id: l.id,
        name: l.name,
        total: questions.adminList({ educationLevelId: l.id, page: 1, pageSize: 1 }).total,
      })),
      byStatus: questionStatusCounts(),
      dskpTaggedShare: total === 0 ? 0 : (tagged / total) * 100,
      chapterCoverage: 0,
      servability: { 'Latih Tubi': approved },
    },
  }
}

export function buildAdminLaporan(rangeRaw: string | undefined, now: number): AdminLaporan {
  const range = rangeRaw === '7' || rangeRaw === '90' ? Number(rangeRaw) : 30
  const r = buildStatsReport(range, { now })
  const named = (id: number): { id: number; name: string } | null => {
    const name = schoolName(schoolOfUser(id))
    const school = schoolOfUser(id)
    return school === null || name === null ? null : { id: school, name }
  }
  return {
    range,
    tiles: {
      schools: r.schools.length,
      teachers: r.overview.teachers,
      pupils: r.overview.pupils,
      pupilsAccessed: r.overview.pupilsLogged,
      teachersAccessed: r.overview.teachersLogged,
      pupilsPractised: r.overview.practised,
      activities: r.overview.activity,
      averageScore: r.overview.score,
    },
    trend: buildStatsReport(30, { now }).trend.slice(-14).map((p) => ({ date: p.label, count: p.value })),
    breakdown: [
      { type: 'kuiz' as const, label: 'Kuiz Objektif', count: r.breakdown.quiz },
      { type: 'struktur' as const, label: 'Soalan Berstruktur', count: r.breakdown.structured },
      { type: 'battle' as const, label: 'Battle Arena', count: r.breakdown.battle },
      { type: 'permainan' as const, label: 'Permainan', count: r.breakdown.game },
    ].filter((b) => b.count > 0),
    mostActive: r.topPupils.map((p) => ({
      id: p.userId,
      name: p.name,
      school: named(p.userId),
      activities: p.activities,
    })),
    schoolActivity: r.schools
      .filter((s) => s.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions || a.schoolId - b.schoolId)
      .slice(0, 10)
      .map((s) => ({ schoolId: s.schoolId, name: s.name, activities: s.sessions, activePupils: s.pupilsLogged })),
  }
}

export const adminCentralRoutes: RouteDef[] = [
  route('GET', '/api/admin/dashboard', [adminOnly], (_req, ctx) =>
    ok(buildAdminDashboard(ctx.clock.now())),
  ),
  route('GET', '/api/admin/analytics', [adminOnly], (req, ctx) =>
    ok(buildAdminAnalytics(queryString(req.query, 'range'), ctx.clock.now())),
  ),
  route('GET', '/api/admin/reports/laporan', [adminOnly], (req, ctx) =>
    ok(buildAdminLaporan(queryString(req.query, 'range'), ctx.clock.now())),
  ),
]
