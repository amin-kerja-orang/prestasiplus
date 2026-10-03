/**
 * SRS M17 v1.13 §7 #4 and #5: the daily-activity board S3 (FR-M17-34…47, FR-M17-116; M17-T1b).
 *
 * | # | Path | Guard |
 * |---|---|---|
 * | 4 | `GET /api/command-center/daily-activity?period=` | **AS**: admin, or school admin forced to the session school (`schools` list omitted) |
 * | 5 | `GET /api/command-center/daily-activity/school/{id}?period=` | admin only (a school admin gets 403), 404 for an unknown school |
 *
 * `period` is `today`, `week` or `month`; any other value (or none) answers with today's figures and the
 * raw value is echoed in `period` (as live, FR-M17-35). Every figure is read at `ctx.clock.now()`
 * (BR-M17-01 windows, MYT) through the named queries of `command-center-live-reads.ts`.
 */

import { diffForHumans, formatDateEnUnpadded, toIsoMyt } from '@/lib/time'
import { int, notFound, ok, queryString, requireRole, route, type RouteDef } from '@/mock/define'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  CcDailyActivity,
  CcDailyFeedRow,
  CcDailyTopStudent,
  CcDrillLogin,
  CcDrillStudent,
  CcDrillTeacher,
  CcLoginRow,
  CcPeriod,
  CcSchoolActivity,
  CcSchoolDrill,
} from '../../api/command-center-board-types'
import { adminOrSchoolAdmin } from './command-center-drill-scope'
import { boardSchool, boardScopeOf } from './command-center-live'
import {
  accuracyOf,
  answerRows,
  answersPerHour,
  badgesIn,
  boardCtx,
  isSchoolView,
  loginsByRole,
  loginsIn,
  moodCounts,
  packageChip,
  pupilCount,
  questionSetsIn,
  schoolName,
  schoolOfUser,
  schoolsWithPupils,
  sessionStats,
  subjectBars,
  subjectInfo,
  subscribedSchoolIds,
  sumOf,
  tallies,
  type BoardCtx,
  type BoardScope,
  type UserTally,
} from './command-center-live-reads'

const PERIODS: readonly CcPeriod[] = ['today', 'week', 'month']

/** An unknown or missing `period` is today (FR-M17-35). */
export function periodOf(raw: string): CcPeriod {
  return (PERIODS as readonly string[]).includes(raw) ? (raw as CcPeriod) : 'today'
}

function labelOf(period: CcPeriod, now: number): string {
  if (period === 'week') return 'Minggu Ini'
  if (period === 'month') return 'Bulan Ini'
  return `Hari Ini (${formatDateEnUnpadded(now)})`
}

/** The answering pupils of a window ordered by answers desc, accuracy desc, id asc (rank lists). */
function ranked(t: ReadonlyMap<number, UserTally>): [number, UserTally][] {
  return [...t.entries()].sort(
    (a, b) =>
      b[1].answers - a[1].answers ||
      b[1].correct / b[1].answers - a[1].correct / a[1].answers ||
      a[0] - b[0],
  )
}

/**
 * Teachers owning a class (M10) with an active enrolment of one of `pupilIds`: teacher → those pupils
 * (BR-M17-11 "{n} GURU" = Q-M17-SCH-TEACHERS, BR-M17-12 drill rows).
 */
function teacherPupils(pupilIds: Iterable<number>): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>()
  for (const pupilId of pupilIds) {
    for (const e of classrooms.enrolmentsOf(pupilId)) {
      if (e.status !== 'active' || e.classroomKind !== 'classroom') continue
      const cls = classrooms.get('classroom', e.classroomId)
      if (cls?.teacherId == null) continue
      const set = out.get(cls.teacherId) ?? new Set<number>()
      set.add(pupilId)
      out.set(cls.teacherId, set)
    }
  }
  return out
}

function loginRow(user: UserRow, subscribed: ReadonlySet<number>, now: number): CcLoginRow {
  const at = user.lastLoginAt ?? ''
  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    lastLoginAt: at,
    schoolId: user.schoolId,
    schoolName: schoolName(user.schoolId),
    package: packageChip(user, subscribed),
    timeAgo: diffForHumans(at, now),
  }
}

function schoolRows(
  ctx: BoardCtx,
  t: ReadonlyMap<number, UserTally>,
  logins: readonly UserRow[],
): CcSchoolActivity[] {
  interface Acc {
    pupils: number[]
    answers: number
    correct: number
    lastMs: number
  }
  const bySchool = new Map<number, Acc>()
  for (const [userId, x] of t) {
    const school = schoolOfUser(userId)
    if (school === null) continue
    const acc = bySchool.get(school) ?? { pupils: [], answers: 0, correct: 0, lastMs: 0 }
    acc.pupils.push(userId)
    acc.answers += x.answers
    acc.correct += x.correct
    acc.lastMs = Math.max(acc.lastMs, x.lastMs)
    bySchool.set(school, acc)
  }
  const loginsBySchool = new Map<number, { n: number; lastMs: number }>()
  for (const u of logins) {
    if (u.schoolId === null || u.lastLoginAt === null) continue
    const acc = loginsBySchool.get(u.schoolId) ?? { n: 0, lastMs: 0 }
    acc.n++
    acc.lastMs = Math.max(acc.lastMs, Date.parse(u.lastLoginAt))
    loginsBySchool.set(u.schoolId, acc)
  }
  const ids = new Set([...bySchool.keys(), ...loginsBySchool.keys()])
  const rows = [...ids].map((schoolId): { row: CcSchoolActivity; answered: boolean } => {
    const a = bySchool.get(schoolId)
    const l = loginsBySchool.get(schoolId)
    const lastMs = Math.max(a?.lastMs ?? 0, l?.lastMs ?? 0)
    const teachers = a ? new Set([...teacherPupils(a.pupils).keys()]).size : 0
    return {
      answered: a !== undefined,
      row: {
        schoolId,
        schoolName: schoolName(schoolId) ?? '',
        activeStudents: a?.pupils.length ?? 0,
        totalAnswers: a?.answers ?? 0,
        accuracy: a ? accuracyOf(a.correct, a.answers) : null,
        activeTeachers: teachers,
        loginCount: l?.n ?? 0,
        lastActive: lastMs > 0 ? toIsoMyt(lastMs) : null,
        lastActiveHuman: lastMs > 0 ? diffForHumans(lastMs, ctx.now) : '',
      },
    }
  })
  // BR-M17-11: schools with answers by active pupils desc (ties answers desc, id asc), then login-only by id.
  rows.sort((x, y) => {
    if (x.answered !== y.answered) return x.answered ? -1 : 1
    if (x.answered) {
      return (
        y.row.activeStudents - x.row.activeStudents ||
        y.row.totalAnswers - x.row.totalAnswers ||
        x.row.schoolId - y.row.schoolId
      )
    }
    return x.row.schoolId - y.row.schoolId
  })
  return rows.map((r) => r.row)
}

function topPupils(t: ReadonlyMap<number, UserTally>): CcDailyTopStudent[] {
  return ranked(t)
    .slice(0, 5)
    .map(([id, x]) => {
      const schoolId = schoolOfUser(id)
      return {
        userId: id,
        name: users.get(id)?.name ?? '',
        schoolId,
        schoolName: schoolName(schoolId),
        answers: x.answers,
        accuracy: accuracyOf(x.correct, x.answers),
      }
    })
}

function feedRows(ctx: BoardCtx, win: CcPeriod): CcDailyFeedRow[] {
  return answerRows(ctx, win, 10).map((a) => {
    const schoolId = schoolOfUser(a.userId)
    return {
      studentId: a.userId,
      student: users.get(a.userId)?.name ?? '',
      subject: subjectInfo(a.subjectId).shortName,
      correct: a.isCorrect,
      time: toIsoMyt(a.answeredAtMs).slice(11, 16),
      schoolId,
      schoolName: schoolName(schoolId),
    }
  })
}

/** The whole `DailyActivity` of the scope for a period at the request clock (SRS §7 response shapes). */
export function buildDailyActivity(
  scope: BoardScope,
  rawPeriod: string,
  now: number,
): CcDailyActivity {
  const period = periodOf(rawPeriod)
  const ctx = boardCtx(scope, now)
  const school = isSchoolView(ctx)
  const t = tallies(ctx, period)
  const sum = sumOf(t)
  const sessions = sessionStats(ctx, period)
  const logins = loginsIn(ctx, period)
  const subscribed = subscribedSchoolIds(now)
  const mood = moodCounts(ctx, period)
  const badges = badgesIn(ctx, period)

  let activeSchools = 0
  if (school) activeSchools = t.size > 0 ? 1 : 0
  else {
    const seen = new Set<number>()
    for (const id of t.keys()) {
      const s = schoolOfUser(id)
      if (s !== null) seen.add(s)
    }
    activeSchools = seen.size
  }

  const heat: Record<string, number> = {}
  if (period === 'today') {
    answersPerHour(ctx, 'today').forEach((n, h) => {
      heat[String(h)] = n
    })
  }

  return {
    period: rawPeriod,
    label: labelOf(period, now),
    scope: school ? 'school' : 'platform',
    school: boardSchool(ctx),
    logins: {
      total: logins.length,
      byRole: loginsByRole(logins),
      recent: logins.slice(0, 10).map((u) => loginRow(u, subscribed, now)),
    },
    practice: {
      totalAnswers: sum.answers,
      correctAnswers: sum.correct,
      accuracy: accuracyOf(sum.correct, sum.answers),
      activeStudents: t.size,
      sessionsStarted: sessions.started,
      sessionsCompleted: sessions.completed,
      avgSessionSeconds:
        sessions.completed === 0 ? 0 : Math.floor(sessions.seconds / sessions.completed),
    },
    engagement: {
      moodCheckins: mood.happy + mood.okay + mood.sad + mood.stressed,
      moodDist: mood,
      missionsCompleted: sessions.missions,
      badgesEarned: badges.length,
      recentBadges: badges.slice(0, 10),
      quizSetsCreated: questionSetsIn(ctx, period),
    },
    summary: {
      activeSchools,
      totalSchools: school ? 1 : schoolsWithPupils(),
      activeStudents: t.size,
      totalStudents: pupilCount(ctx),
      totalLogins: logins.length,
    },
    ...(school ? {} : { schools: schoolRows(ctx, t, logins) }),
    topStudents: topPupils(t),
    subjectBreakdown: subjectBars(ctx, period),
    hourlyHeatmap: heat,
    liveFeed: feedRows(ctx, period),
  }
}

/** The drill of one school for a period (BR-M17-12), `null` for an unknown school (404). */
export function buildSchoolDrill(
  schoolId: number,
  rawPeriod: string,
  now: number,
): CcSchoolDrill | null {
  const school = schools.get(schoolId)
  if (!school) return null
  const period = periodOf(rawPeriod)
  const ctx = boardCtx({ schoolId }, now)
  const t = tallies(ctx, period)

  const teachers: CcDrillTeacher[] = [...teacherPupils(t.keys()).entries()]
    .map(([userId, pupils]) => {
      let answers = 0
      let correct = 0
      let lastMs = 0
      for (const id of pupils) {
        const x = t.get(id)
        if (!x) continue
        answers += x.answers
        correct += x.correct
        lastMs = Math.max(lastMs, x.lastMs)
      }
      return {
        userId,
        name: users.get(userId)?.name ?? '',
        students: pupils.size,
        accuracy: accuracyOf(correct, answers),
        lastActiveHuman: lastMs > 0 ? diffForHumans(lastMs, now) : '',
      }
    })
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name) || a.userId - b.userId)

  const students: CcDrillStudent[] = ranked(t).map(([userId, x]) => ({
    userId,
    name: users.get(userId)?.name ?? '',
    answers: x.answers,
    accuracy: accuracyOf(x.correct, x.answers),
    lastActiveHuman: x.lastMs > 0 ? diffForHumans(x.lastMs, now) : '',
  }))

  const logins: CcDrillLogin[] = loginsIn(ctx, period).map((u) => ({
    userId: u.id,
    name: u.name,
    role: u.role,
    timeAgo: diffForHumans(u.lastLoginAt ?? '', now),
  }))

  return {
    school: { id: school.id, name: school.name },
    period: rawPeriod,
    teachers,
    students,
    logins,
  }
}

export const commandCenterDailyRoutes: RouteDef[] = [
  route('GET', '/api/command-center/daily-activity', [adminOrSchoolAdmin], (req, ctx) =>
    ok(
      buildDailyActivity(
        boardScopeOf(req),
        queryString(req.query, 'period') ?? 'today',
        ctx.clock.now(),
      ),
    ),
  ),

  route(
    'GET',
    '/api/command-center/daily-activity/school/:id',
    [requireRole('admin')],
    (req, ctx) => {
      const data = buildSchoolDrill(
        req.params.id as number,
        queryString(req.query, 'period') ?? 'today',
        ctx.clock.now(),
      )
      return data ? ok(data) : notFound()
    },
    { params: { id: int() } },
  ),
]
