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

import { formatMyt, toIsoMyt } from '@/lib/time'
import { ok, route, type MockRequest, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import type {
  CcDailyPoint,
  CcFeedRow,
  CcLiveData,
  CcTopSchool,
  CcTopStudent,
} from '../../api/command-center-board-types'
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
