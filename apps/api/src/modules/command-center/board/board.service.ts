import { Inject, Injectable } from '@nestjs/common'
import type {
  CommandCenterBadgeRow,
  CommandCenterDailyActivity,
  CommandCenterLiveData,
  CommandCenterLoginRow,
  CommandCenterMoodCounts,
  CommandCenterSchoolActivity,
  CommandCenterSchoolDrill,
  ServerStatus,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { notFound } from '../http/errors'
import type { Viewer } from '../http/viewer'
import { CommandCenterRepository, type LoginRow } from '../shared/command-center.repository'
import { BADGE_READ_PORT, type BadgeReadPort, FEEDBACK_PORT, type FeedbackReadPort, HEADCOUNT_PORT, type HeadcountReadPort, MOOD_PORT, type MoodReadPort, QUIZ_SET_PORT, type QuizSetReadPort } from '../shared/ports'
import { ScopeService } from '../shared/scope.service'
import { shortSubjectName } from '../shared/subjects'
import { addDays, boardWindows, dateKey, periodWindow, startOfDay, timeOfDay, toMytTimestamp, weekdayLabelBm, type Window } from '../shared/windows'
import { FEED_LIMIT, TOP_LIMIT } from '../command-center.constants'
import { diffForHumans } from './diff-for-humans'
import { BoardReads } from './reads'
import { ServerStatusService } from './server-status.service'

/** DC-M17-05 (platform "Engagement" buckets) and DC-M17-03 (platform "Pembetulan"): observed display constants (D11 exception), platform view only. */
const DC_M17_05 = Object.freeze({ champion: 29, consistent: 11, developing: 43, minimum: 3, disengaged: 2229 })
const DC_M17_03 = Object.freeze({ total: 899, avgImprovement: 0, improvedCount: 0 })

const ROLE_ORDER = ['student', 'teacher', 'parent', 'admin', 'school_admin'] as const
/** Which role a user with several roles is shown as in the login lists. */
const ROLE_SHOWN = ['admin', 'school_admin', 'teacher', 'parent', 'student'] as const
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** correct / answers as a percentage with one decimal; 0 when nothing was answered. */
const accuracyOf = (correct: number, answers: number): number => (answers === 0 ? 0 : Math.round((correct / answers) * 1000) / 10)

/** Half away from zero. */
function weekChangeOf(week: number, last: number): number {
  if (last === 0) return 0
  const pct = ((week - last) / last) * 100
  return pct < 0 ? -Math.round(-pct) : Math.round(pct)
}

const idCompare = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)

/** "Hari Ini (19 Oct 2026)": `d MMM yyyy` with the English month, in MYT. */
function todayLabel(now: Date): string {
  const key = dateKey(now)
  return `Hari Ini (${Number(key.slice(8, 10))} ${MONTHS_EN[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)})`
}

function packageChip(l: LoginRow): CommandCenterLoginRow['package'] {
  if (l.roles.includes('admin')) return 'ADMIN'
  if (l.roles.includes('parent')) return 'PARENT'
  if (l.hasPackage) return 'AKTIF'
  if (l.hasPksk) return 'PKSK'
  if (l.schoolSubscribed) return 'SEKOLAH'
  if (l.isComplimentary) return 'BEBAS'
  return 'FREE'
}

const roleShown = (roles: string[]): string => ROLE_SHOWN.find((r) => roles.includes(r)) ?? roles[0] ?? ''

/**
 * BOARD slice (routes 1, 2, 3, 18). The school of a school admin comes from the session viewer only. Population: active students,
 * `is_test` rows excluded everywhere. Mood, Kirkpatrick T1, GPS, badges and question sets come through the fail-closed ports
 * (empty until their owner cards bind an adapter). No fixture-school exclusion (working assumption, BE-22 deviation).
 */
@Injectable()
export class BoardService {
  private readonly reads: BoardReads

  constructor(
    @Inject(CommandCenterRepository) readonly repo: CommandCenterRepository,
    @Inject(ScopeService) readonly scope: ScopeService,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(ServerStatusService) private readonly host: ServerStatusService,
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(MOOD_PORT) private readonly mood: MoodReadPort,
    @Inject(FEEDBACK_PORT) private readonly feedback: FeedbackReadPort,
    @Inject(HEADCOUNT_PORT) private readonly headcount: HeadcountReadPort,
    @Inject(BADGE_READ_PORT) private readonly badges: BadgeReadPort,
    @Inject(QUIZ_SET_PORT) private readonly quizSets: QuizSetReadPort,
  ) {
    this.reads = new BoardReads(prisma)
  }

  /** Student ids of the school view (the ports take id lists); `null` on the platform view. */
  private async studentIds(schoolId: string | undefined): Promise<string[] | null> {
    if (schoolId === undefined) return null
    return (await this.repo.studentsOfSchool(schoolId)).map((s) => s.id)
  }

  /** GET /admin/command-center/live-data. `viewer.role` is admin (platform) or school_admin (viewer.schoolId, from the session). */
  async liveData(viewer: Viewer): Promise<CommandCenterLiveData> {
    const schoolId = viewer.role === 'school_admin' ? (viewer.schoolId ?? undefined) : undefined
    const school = schoolId !== undefined
    const now = this.clock.now()
    const w = boardWindows(now)
    const sevenFrom = addDays(startOfDay(now), -6)
    const sid = await this.studentIds(schoolId)
    const monthDay = new Date(`${dateKey(now)}T00:00:00Z`)

    const [schoolRef, tallies, totalStudents, totalSchools, topSchools, topStudents, feed, trend, mood, t1, gps] = await Promise.all([
      schoolId === undefined ? Promise.resolve(null) : this.repo.schoolRef(schoolId),
      this.reads.liveTallies({ now, schoolId, todayFrom: w.today.from, weekFrom: w.week.from, lastWeekFrom: w.lastWeek.from, d30From: w.last30d.from }),
      this.repo.studentCount({ schoolId }),
      this.repo.subscribedSchoolCount(monthDay, schoolId),
      school ? Promise.resolve([]) : this.reads.topSchools(now, TOP_LIMIT),
      this.reads.topUsers({ from: w.week.from, to: now, schoolId }, TOP_LIMIT),
      this.repo.latestAnswers({ to: now, schoolId }, FEED_LIMIT),
      school ? this.repo.dailyCounts({ from: sevenFrom, to: now, schoolId }) : Promise.resolve([]),
      this.mood.counts(sid),
      this.feedback.t1(sid),
      this.headcount.schoolGps(schoolId ?? null),
    ])

    const accuracy = accuracyOf(tallies.correct, tallies.answers)
    const byDay = new Map(trend.map((d) => [d.day, d.answers]))
    const dailyTrend = school
      ? Array.from({ length: 7 }, (_, i) => {
          const key = dateKey(addDays(sevenFrom, i))
          return { date: key, label: weekdayLabelBm(key), count: byDay.get(key) ?? 0 }
        })
      : []

    return {
      generatedAt: toMytTimestamp(now),
      scope: school ? 'school' : 'platform',
      school: schoolRef ? { id: schoolRef.id, name: schoolRef.name } : null,
      totalSchools,
      totalStudents,
      activeStudents: tallies.students,
      totalAnswered: tallies.answers,
      answeredToday: tallies.today,
      answeredWeek: tallies.week,
      answeredLastWeek: tallies.lastWeek,
      weekChange: weekChangeOf(tallies.week, tallies.lastWeek),
      accuracy,
      topSchools: topSchools.map((s) => ({ schoolId: s.schoolId, schoolName: s.schoolName, activeCount: s.students, totalAnswers: s.answers })),
      topStudents: topStudents.map((u) => ({ studentId: u.userId, name: u.name, schoolName: u.schoolName, answersCount: u.answers, accuracy: accuracyOf(u.correct, u.answers) })),
      gpsOverall: gps,
      kirk: { t1: { value: t1.value, scale: 5, count: t1.count }, t2Accuracy: accuracy, t3Active: tallies.active30d, t4Gps: gps },
      engagement: school ? { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 } : { ...DC_M17_05 },
      dailyTrend,
      mood,
      recentFeed: feed.map((f) => ({
        student: f.studentName,
        subject: shortSubjectName(f.subjectCode, f.subjectName),
        correct: f.isCorrect,
        time: timeOfDay(f.answeredAt),
        schoolId: f.schoolId,
        schoolName: f.schoolName,
      })),
      correction: school ? { total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] } : { ...DC_M17_03, topImprovers: [] },
    }
  }

  /** GET /command-center/daily-activity. `period` is the raw query text (any text; unknown = today; echo the raw value). */
  async dailyActivity(viewer: Viewer, period: string | undefined): Promise<CommandCenterDailyActivity> {
    const schoolId = viewer.role === 'school_admin' ? (viewer.schoolId ?? undefined) : undefined
    const school = schoolId !== undefined
    const now = this.clock.now()
    const { key, window } = periodWindow(period, now)
    const span = { from: window.from, to: window.to, schoolId }
    const sid = await this.studentIds(schoolId)
    const rawPeriod = period ?? 'today'

    const [schoolRef, tally, sessions, loginTotal, loginRoles, recent, mood, awards, quizSets, totalStudents, platformSchools, activeBySchool, topUsers, subjects, hours, feed] = await Promise.all([
      schoolId === undefined ? Promise.resolve(null) : this.repo.schoolRef(schoolId),
      this.repo.answerTally(span),
      this.repo.sessionTally({ from: window.from, to: window.to, schoolId }),
      this.repo.loginUserCount(window, schoolId),
      this.repo.loginCountsByRole(window, schoolId),
      this.repo.recentLogins(window, FEED_LIMIT, schoolId),
      this.mood.counts(sid, window),
      this.badges.awards(sid, { from: window.from, to: window.to }),
      this.quizSets.createdCount(schoolId ?? null, window),
      this.repo.studentCount({ schoolId }),
      school ? Promise.resolve(0) : this.repo.schoolsWithStudents(),
      school ? Promise.resolve([]) : this.reads.schoolActivity(span),
      this.reads.topUsers(span, TOP_LIMIT),
      this.repo.subjectTally(span),
      key === 'today' ? this.repo.hourlyCounts(span) : Promise.resolve([]),
      this.repo.latestAnswers(span, FEED_LIMIT),
    ])

    const byRoleCount = new Map(loginRoles.map((r) => [r.role, r.count]))
    const byRole: Record<string, number> = {}
    for (const role of ROLE_ORDER) {
      const c = byRoleCount.get(role)
      if (c !== undefined && c > 0) byRole[role] = c
    }
    for (const role of [...byRoleCount.keys()].sort()) if (!(role in byRole) && (byRoleCount.get(role) ?? 0) > 0) byRole[role] = byRoleCount.get(role) as number

    const recentRows: CommandCenterLoginRow[] = recent.map((l) => ({
      userId: l.userId,
      name: l.name,
      role: roleShown(l.roles),
      lastLoginAt: toMytTimestamp(l.lastLoginAt),
      schoolId: l.schoolId,
      schoolName: l.schoolName,
      package: packageChip(l),
      timeAgo: diffForHumans(l.lastLoginAt, now),
    }))

    const heat: Record<string, number> = {}
    if (key === 'today') {
      for (let h = 0; h < 24; h++) heat[String(h)] = 0
      for (const r of hours) heat[String(r.hour)] = r.answers
    }

    const moodCount = (m: CommandCenterMoodCounts): number => m.happy + m.okay + m.sad + m.stressed
    const badgeRows = await this.badgeRows(awards)

    const data: CommandCenterDailyActivity = {
      period: rawPeriod,
      label: key === 'week' ? 'Minggu Ini' : key === 'month' ? 'Bulan Ini' : todayLabel(now),
      scope: school ? 'school' : 'platform',
      school: schoolRef ? { id: schoolRef.id, name: schoolRef.name } : null,
      logins: { total: loginTotal, byRole, recent: recentRows },
      practice: {
        totalAnswers: tally.answers,
        correctAnswers: tally.correct,
        accuracy: accuracyOf(tally.correct, tally.answers),
        activeStudents: tally.students,
        sessionsStarted: sessions.completed,
        sessionsCompleted: sessions.completed,
        avgSessionSeconds: sessions.completed === 0 ? 0 : Math.floor(sessions.seconds / sessions.completed),
      },
      engagement: {
        moodCheckins: moodCount(mood),
        moodDist: mood,
        missionsCompleted: sessions.missions,
        badgesEarned: badgeRows.length,
        recentBadges: badgeRows.slice(0, FEED_LIMIT),
        quizSetsCreated: quizSets,
      },
      summary: {
        activeSchools: school ? (tally.students > 0 ? 1 : 0) : activeBySchool.length,
        totalSchools: school ? 1 : platformSchools,
        activeStudents: tally.students,
        totalStudents,
        totalLogins: loginTotal,
      },
      topStudents: topUsers.map((u) => ({ userId: u.userId, name: u.name, schoolId: u.schoolId, schoolName: u.schoolName, answers: u.answers, accuracy: accuracyOf(u.correct, u.answers) })),
      subjectBreakdown: this.subjectBars(subjects),
      hourlyHeatmap: heat,
      liveFeed: feed.map((f) => ({
        studentId: f.userId,
        student: f.studentName,
        subject: shortSubjectName(f.subjectCode, f.subjectName),
        correct: f.isCorrect,
        time: timeOfDay(f.answeredAt),
        schoolId: f.schoolId,
        schoolName: f.schoolName,
      })),
    }
    if (!school) data.schools = await this.schoolRows(window, activeBySchool, now)
    return data
  }

  private subjectBars(rows: { code: string | null; name: string | null; answers: number }[]): CommandCenterDailyActivity['subjectBreakdown'] {
    const by = new Map<string, { code: string; shortName: string; answers: number }>()
    for (const r of rows) {
      const code = r.code ?? 'UMUM'
      const bar = by.get(code) ?? { code, shortName: shortSubjectName(r.code, r.name), answers: 0 }
      bar.answers += r.answers
      by.set(code, bar)
    }
    return [...by.values()].sort((a, b) => b.answers - a.answers || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  }

  private async badgeRows(awards: { userId: string; badgeId: string; awardedAt: Date }[]): Promise<CommandCenterBadgeRow[]> {
    if (awards.length === 0) return []
    const [catalogue, names] = await Promise.all([this.badges.catalogue(), this.repo.userNames([...new Set(awards.map((a) => a.userId))])])
    const badge = new Map(catalogue.map((b) => [b.id, b]))
    return awards
      .filter((a) => badge.has(a.badgeId))
      .sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime() || idCompare(a.userId, b.userId))
      .map((a) => ({ userId: a.userId, name: names.get(a.userId) ?? '', badgeName: badge.get(a.badgeId)?.name ?? '', icon: badge.get(a.badgeId)?.icon ?? '', awardedAt: toMytTimestamp(a.awardedAt) }))
  }

  /**
   * Platform school rows: schools with answers (active pupils desc, answers desc, id) then schools with only logins (id).
   * `activeTeachers` = distinct class owners of the school's answering pupils.
   */
  private async schoolRows(window: Window, active: Awaited<ReturnType<BoardReads['schoolActivity']>>, now: Date): Promise<CommandCenterSchoolActivity[]> {
    const [logins, teachers] = await Promise.all([this.reads.loginsBySchool(window), this.reads.activeTeachersBySchool({ from: window.from, to: window.to })])
    const answered = new Set(active.map((a) => a.schoolId))
    const loginOnly = [...logins.keys()].filter((id) => !answered.has(id))
    const names = await this.repo.schoolRefs(loginOnly)
    const row = (schoolId: string, schoolName: string, a: (typeof active)[number] | undefined): CommandCenterSchoolActivity => {
      const l = logins.get(schoolId)
      const lastMs = Math.max(a?.lastAt.getTime() ?? 0, l?.lastAt.getTime() ?? 0)
      return {
        schoolId,
        schoolName,
        activeStudents: a?.pupils ?? 0,
        totalAnswers: a?.answers ?? 0,
        accuracy: a ? accuracyOf(a.correct, a.answers) : null,
        activeTeachers: a ? (teachers.get(schoolId) ?? 0) : 0,
        loginCount: l?.count ?? 0,
        lastActive: lastMs > 0 ? toMytTimestamp(new Date(lastMs)) : null,
        lastActiveHuman: lastMs > 0 ? diffForHumans(new Date(lastMs), now) : '',
      }
    }
    const first = [...active]
      .sort((x, y) => y.pupils - x.pupils || y.answers - x.answers || idCompare(x.schoolId, y.schoolId))
      .map((a) => row(a.schoolId, a.schoolName, a))
    const second = loginOnly
      .sort(idCompare)
      .filter((id) => names.has(id))
      .map((id) => row(id, names.get(id)?.name ?? '', undefined))
    return [...first, ...second]
  }

  /** GET /command-center/daily-activity/school/:id (admin only; unknown school 404). */
  async schoolDrill(viewer: Viewer, schoolId: string, period: string | undefined): Promise<CommandCenterSchoolDrill> {
    if (!viewer.isAdmin) throw notFound()
    const school = await this.repo.schoolRef(schoolId)
    if (!school) throw notFound()
    const now = this.clock.now()
    const { window } = periodWindow(period, now)
    const span = { from: window.from, to: window.to, schoolId }
    const [teachers, pupils, logins] = await Promise.all([this.reads.teacherDrill(span), this.repo.answerTallyByUser(span), this.repo.schoolLogins(schoolId, window)])
    return {
      school: { id: school.id, name: school.name },
      period: period ?? 'today',
      teachers: teachers
        .map((t) => ({ userId: t.teacherId, name: t.name, students: t.students, accuracy: accuracyOf(t.correct, t.answers), lastActiveHuman: t.lastAt ? diffForHumans(t.lastAt, now) : '' }))
        .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name) || idCompare(a.userId, b.userId)),
      students: pupils
        .map((p) => ({ userId: p.userId, name: p.name, answers: p.answers, accuracy: accuracyOf(p.correct, p.answers), lastActiveHuman: diffForHumans(p.lastAt, now) }))
        .sort((a, b) => b.answers - a.answers || b.accuracy - a.accuracy || idCompare(a.userId, b.userId)),
      logins: logins.map((l) => ({ userId: l.userId, name: l.name, role: roleShown(l.roles), timeAgo: diffForHumans(l.lastLoginAt, now) })),
    }
  }

  /** GET /admin/server-status (implemented by the skeleton). */
  serverStatus(): Promise<ServerStatus> {
    return this.host.status()
  }
}
