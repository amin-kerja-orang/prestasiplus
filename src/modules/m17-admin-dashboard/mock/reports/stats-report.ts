/**
 * `buildStatsReport(range, { schoolId })`: the pure builder of the M17 S11 "Laporan Statistik" report
 * (SRS M17 §7 #18 `StatsReport`, FR-M17-86…96, BR-M17-01…05, 20, 22, DV-M17-16…19) with the school
 * restriction of M27 XR-M27-15 / BR-M27-26. No screen, no route, no store: every figure is computed per call
 * from the owners' public entries (D11, D12): M01 `users`, M02 `schools` / `schoolSubscriptions`, M04
 * `questions` / `structured`, M05 `practice` / `practiceAnswers`, M08 `headcount`, M10 `classrooms`, M14
 * `wallet` / `teacherWallet`, M16 `battles` / `gameResults`.
 *
 * Scope: **platform** (`schoolId` omitted): P = active students and T = active teachers outside the fixture
 * schools 900001–900099 (BR-M17-02, BR-M17-03); **one school**: the school's active students and teachers, a
 * fixture school included (BR-M27-26). In the school scope `schools` is empty and `overview.score` /
 * `structuredScore` are `null` (DC-M17-06 is a platform constant).
 *
 * Windows (BR-M17-01): range N = [00:00 MYT of today − (N − 1) days, now].
 *
 * Cost model: all-time session totals come from `practice.sessionTotals` (one scan of the sessions), the
 * per-day activity from one cheap-field pass over `Q-SESS-P` (no row is derived), answer tallies for the
 * listed pupils only from `practice.answerFacts` (never a per-row loop over the 478k answers). A fixture
 * school's pupils are outside P, so their sessions are read per pupil (a handful of pupils).
 */

import { CLOCK_ANCHOR_ISO, DAY_MS, dayRange, formatDateKey, toIsoMyt } from '@/lib/time'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { isFixtureSchoolId, schools } from '@/modules/m02-users-schools/mock'
import { questions, structured } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { headcount } from '@/modules/m08-student-performance/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'
import { teacherWallet, wallet } from '@/modules/m14-gamification/mock'
import { battles, gameResults } from '@/modules/m16-battle-games/mock'

import { DC_M17_06 } from '../constants/stats-report-display'
import { studentsOf, tallyOf, teachersOf } from '../handlers/command-center-drill-data'
import { boardCtx, subscribedSchoolIds, tallies } from '../handlers/command-center-live-reads'
import type {
  StatsBreakdown,
  StatsPupilLists,
  StatsPupilRow,
  StatsRange,
  StatsReport,
  StatsReportOptions,
  StatsSchoolRow,
  StatsSchoolStatus,
  StatsTeacherRow,
} from './stats-report-types'

/** Rows per pupil pill (DV-M17-18 "Top 200"). */
const PUPIL_LIST_LIMIT = 200
const TOP_PUPILS = 10
const NEVER_LOGGED_LIMIT = 20

const asOptions = (o: object): never => o as never

/** FR-M17-87: 7, 30 or 90; anything else gives 30. */
export function normaliseRange(range: unknown): StatsRange {
  const n = typeof range === 'string' ? Number(range) : range
  return n === 7 || n === 90 ? n : 30
}

const round1 = (n: number): number => Math.round(n * 10) / 10
const byName = (a: { name: string; id: number }, b: { name: string; id: number }): number =>
  a.name.localeCompare(b.name) || a.id - b.id

const lastLoginMs = (u: UserRow): number => (u.lastLoginAt === null ? 0 : Date.parse(u.lastLoginAt))

/** "dd/mm" of an MYT day key `yyyy-MM-dd`. */
const labelOf = (dayKey: string): string => `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`

// --- populations ------------------------------------------------------------------------------------

interface Population {
  pupils: UserRow[]
  teachers: UserRow[]
  fixture: boolean
}

const outsideFixtures = (u: UserRow): boolean => u.schoolId === null || !isFixtureSchoolId(u.schoolId)

function populationOf(schoolId: number | null): Population {
  if (schoolId !== null) {
    return {
      pupils: studentsOf(schoolId).filter((u) => u.isActive),
      teachers: teachersOf(schoolId).filter((u) => u.isActive),
      fixture: isFixtureSchoolId(schoolId),
    }
  }
  const list = (role: 'student' | 'teacher'): UserRow[] =>
    users
      .adminList({ role, isActive: true, page: 1, pageSize: 100_000 })
      .rows.filter(outsideFixtures)
  return { pupils: list('student'), teachers: list('teacher'), fixture: false }
}

// --- activity (sessions, structured, battles, games) --------------------------------------------------

interface ActivityEvent {
  userId: number
  ms: number
}

/** Completed sessions of the pupils whose completion falls in [from, now] (cheap-field pass). */
function sessionEvents(
  pupilIds: ReadonlySet<number>,
  fixture: boolean,
  from: number,
  now: number,
): ActivityEvent[] {
  const out: ActivityEvent[] = []
  if (fixture) {
    for (const id of pupilIds) {
      for (const s of practice.history(id, { from, to: now + 1 })) {
        out.push({ userId: id, ms: s.completedAtMs })
      }
    }
    return out
  }
  const match = (r: { userId: number; completedAtMs: number }): boolean => {
    if (r.completedAtMs >= from && r.completedAtMs <= now && pupilIds.has(r.userId)) {
      out.push({ userId: r.userId, ms: r.completedAtMs })
    }
    return false
  }
  practice.query(
    'Q-SESS-P',
    asOptions({ match, matchFields: ['userId', 'completedAtMs'], page: 1, pageSize: 1 }),
  )
  return out
}

/** Structured attempts per pupil: all-time count and the in-window event times. */
function structuredOf(
  pupilIds: Iterable<number>,
  from: number,
  now: number,
): { allTime: Map<number, number>; events: ActivityEvent[] } {
  const allTime = new Map<number, number>()
  const events: ActivityEvent[] = []
  for (const id of pupilIds) {
    const rows = practice.structuredAttempts(id)
    if (rows.length === 0) continue
    let n = 0
    for (const r of rows) {
      const ms = Date.parse(r.submittedAt)
      if (ms > now) continue
      n++
      if (ms >= from) events.push({ userId: id, ms })
    }
    if (n > 0) allTime.set(id, n)
  }
  return { allTime, events }
}

interface SocialActivity {
  battleAll: Map<number, number>
  gameAll: Map<number, number>
  battleEvents: ActivityEvent[]
  gameEvents: ActivityEvent[]
}

/**
 * Battles (a battle counts for P when its first player is a pupil of P, as M16 `windowCounts`; every
 * participant of P gets the battle in the all-time tally) and submitted game results of P.
 */
function socialOf(pupilIds: ReadonlySet<number>, from: number, now: number): SocialActivity {
  const out: SocialActivity = {
    battleAll: new Map(),
    gameAll: new Map(),
    battleEvents: [],
    gameEvents: [],
  }
  const bump = (m: Map<number, number>, id: number): void => {
    m.set(id, (m.get(id) ?? 0) + 1)
  }
  for (const b of battles.all()) {
    if (b.createdAtMs > now) continue
    if (pupilIds.has(b.playerA)) {
      bump(out.battleAll, b.playerA)
      if (b.createdAtMs >= from) out.battleEvents.push({ userId: b.playerA, ms: b.createdAtMs })
    }
    if (b.playerB !== b.playerA && pupilIds.has(b.playerB)) bump(out.battleAll, b.playerB)
  }
  const games = gameResults.query('Q-GAME-SUBMITTED', { page: 1, pageSize: 1_000_000 }).rows
  for (const g of games) {
    if (g.submittedAtMs === null || g.submittedAtMs > now || !pupilIds.has(g.userId)) continue
    bump(out.gameAll, g.userId)
    if (g.submittedAtMs >= from) out.gameEvents.push({ userId: g.userId, ms: g.submittedAtMs })
  }
  return out
}

// --- the builder -------------------------------------------------------------------------------------

/** The S11 report for a range (7 / 30 / 90, else 30) and an optional school restriction. */
export function buildStatsReport(range: number | string, options: StatsReportOptions = {}): StatsReport {
  const days = normaliseRange(range)
  const now = options.now ?? Date.parse(CLOCK_ANCHOR_ISO)
  const schoolId = options.schoolId ?? null
  const from = dayRange(now).start - (days - 1) * DAY_MS
  const pop = populationOf(schoolId)
  const pupilIds = new Set(pop.pupils.map((u) => u.id))
  const schoolName = (id: number | null): string | null =>
    id === null ? null : (schools.get(id)?.name ?? null)

  // Activity of P: sessions, structured, battles, games.
  const totals = practice.sessionTotals(pupilIds)
  const sessionsOf = (id: number): number => totals.get(id)?.all.sessions ?? 0
  const sessionEv = sessionEvents(pupilIds, pop.fixture, from, now)
  const struct = structuredOf(pupilIds, from, now)
  const social = socialOf(pupilIds, from, now)

  const breakdown: StatsBreakdown = {
    quiz: sessionEv.length,
    structured: struct.events.length,
    battle: social.battleEvents.length,
    game: social.gameEvents.length,
  }
  const perDay = new Map<string, number>()
  for (let i = 0; i < days; i++) perDay.set(formatDateKey(from + i * DAY_MS), 0)
  for (const list of [sessionEv, struct.events, social.battleEvents, social.gameEvents]) {
    for (const e of list) {
      const key = formatDateKey(e.ms)
      if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1)
    }
  }
  const trend = [...perDay].map(([key, value]) => ({ label: labelOf(key), value }))

  // Practised (all time) and the all-time activity per pupil.
  let practised = 0
  const activities = new Map<number, number>()
  for (const id of pupilIds) {
    const s = sessionsOf(id)
    const st = struct.allTime.get(id) ?? 0
    if (s > 0 || st > 0) practised++
    const total = s + st + (social.battleAll.get(id) ?? 0) + (social.gameAll.get(id) ?? 0)
    if (total > 0) activities.set(id, total)
  }
  const nameOf = new Map(pop.pupils.map((u) => [u.id, u]))
  const topPupils = [...activities]
    .map(([id, n]) => ({ user: nameOf.get(id) as UserRow, activities: n }))
    .sort((a, b) => b.activities - a.activities || byName(a.user, b.user))
    .slice(0, TOP_PUPILS)
    .map((r) => ({ userId: r.user.id, name: r.user.name, activities: r.activities }))

  // Teachers.
  const withHeadcount = new Set(headcount.configs().map((c) => c.teacherId))
  // One facet group-count per store (O(cells)); a per-teacher query costs about 30 ms each.
  const mcqBy = questions.groupCount('Q-ALL', 'createdBy')
  const structuredBy = structured.groupCount('Q-STRUCT-ALL', 'createdBy')
  const teacherRows: StatsTeacherRow[] = [...pop.teachers].sort(byName).map((t) => ({
    userId: t.id,
    name: t.name,
    email: t.email,
    schoolName: schoolName(t.schoolId),
    loggedIn: t.lastLoginAt !== null,
    mcq: mcqBy.get(t.id) ?? 0,
    structured: structuredBy.get(t.id) ?? 0,
    coins: teacherWallet.get(t.id)?.balance ?? 0,
    hasHeadcount: withHeadcount.has(t.id),
    lastLoginAt: t.lastLoginAt,
  }))
  const teachersLogged = pop.teachers.filter((t) => t.lastLoginAt !== null).length
  const teachersNeverLogged = [...pop.teachers]
    .filter((t) => t.lastLoginAt === null)
    .sort(byName)
    .slice(0, NEVER_LOGGED_LIMIT)
    .map((t) => ({ userId: t.id, name: t.name, email: t.email }))

  // Pupil lists (DV-M17-18): answers are tallied for the listed rows only.
  const isPractised = (u: UserRow): boolean => sessionsOf(u.id) > 0 || struct.allTime.has(u.id)
  const bySessions = (a: UserRow, b: UserRow): number =>
    sessionsOf(b.id) - sessionsOf(a.id) || byName(a, b)
  const semuaUsers = [...pop.pupils].sort(bySessions).slice(0, PUPIL_LIST_LIMIT)
  const aktifUsers = pop.pupils.filter(isPractised).sort(bySessions).slice(0, PUPIL_LIST_LIMIT)
  const loginSahajaUsers = pop.pupils
    .filter((u) => u.lastLoginAt !== null && !isPractised(u))
    .sort((a, b) => lastLoginMs(b) - lastLoginMs(a) || byName(a, b))
    .slice(0, PUPIL_LIST_LIMIT)
  const belumLoginUsers = pop.pupils
    .filter((u) => u.lastLoginAt === null && !isPractised(u))
    .sort(byName)
    .slice(0, PUPIL_LIST_LIMIT)

  const listed = new Set<number>()
  for (const list of [semuaUsers, aktifUsers, loginSahajaUsers, belumLoginUsers]) {
    for (const u of list) listed.add(u.id)
  }
  const tally = tallyOf([...listed])
  const pupilRow = (u: UserRow): StatsPupilRow => {
    const t = tally.get(u.id)
    return {
      userId: u.id,
      name: u.name,
      schoolName: schoolName(u.schoolId),
      className: classrooms.forStudent(u.id)[0]?.name ?? null,
      sessions: sessionsOf(u.id),
      accuracy: t === undefined || t.answers === 0 ? 0 : round1((t.correct / t.answers) * 100),
      seconds: totals.get(u.id)?.all.seconds ?? 0,
      coins: wallet.get(u.id)?.currentSyiling ?? 0,
      lastLoginAt: u.lastLoginAt,
    }
  }
  const pupils: StatsPupilLists = {
    semua: semuaUsers.map(pupilRow),
    aktif: aktifUsers.map(pupilRow),
    loginSahaja: loginSahajaUsers.map(pupilRow),
    belumLogin: belumLoginUsers.map(pupilRow),
  }
  let aktifAnswers = 0
  let aktifCorrect = 0
  let aktifSessions = 0
  for (const u of aktifUsers) {
    aktifSessions += sessionsOf(u.id)
    aktifAnswers += tally.get(u.id)?.answers ?? 0
    aktifCorrect += tally.get(u.id)?.correct ?? 0
  }

  const schoolRows = schoolId === null ? schoolTable(pop, totals, now) : []
  const tileSchools = { aktif: 0, kurang: 0, tidak: 0 }
  for (const s of schoolRows) tileSchools[s.status]++

  const score = schoolId === null
  return {
    range: days,
    schoolId,
    generatedAt: toIsoMyt(now),
    overview: {
      pupils: pop.pupils.length,
      pupilsLogged: pop.pupils.filter((u) => u.lastLoginAt !== null).length,
      teachers: pop.teachers.length,
      teachersLogged,
      practised,
      activity: breakdown.quiz + breakdown.structured + breakdown.battle + breakdown.game,
      score: score ? DC_M17_06.score : null,
      structuredScore: score ? DC_M17_06.structured : null,
    },
    trend,
    breakdown,
    topPupils,
    teachersNeverLogged,
    schools: schoolRows,
    teachers: teacherRows,
    pupils,
    tiles: {
      schools: tileSchools,
      teachers: {
        total: pop.teachers.length,
        logged: teachersLogged,
        questions: questions.teacherContributions(schoolId ?? undefined),
        coins: teacherRows.reduce((sum, t) => sum + t.coins, 0),
      },
      pupils: {
        total: pop.pupils.length,
        practised: aktifUsers.length,
        sessions: aktifSessions,
        accuracy: aktifAnswers === 0 ? 0 : round1((aktifCorrect / aktifAnswers) * 100),
      },
    },
  }
}

// --- Sekolah tab (platform only) -------------------------------------------------------------------

/**
 * Q-M17-S11-SCHOOLS: schools outside 900001–900099 with at least one user of any role. "Aktif" = an answer
 * of P or a login of the school's users in the last 7 days (BR-M17-21; "Kurang" has no rule, none at the
 * seed). Order (BR-M17-22): Aktif first, each group by latest login desc, never-logged last by name.
 */
function schoolTable(
  pop: Population,
  totals: ReturnType<typeof practice.sessionTotals>,
  now: number,
): StatsSchoolRow[] {
  const ctx = boardCtx({ schoolId: null }, now)
  const weekAgo = now - 7 * DAY_MS
  const subscribed = subscribedSchoolIds(now)

  const latestLogin = new Map<number, number>()
  const loginIn7d = new Set<number>()
  const usersBySchool = users.groupCount('U-ALL', 'schoolId')
  users.query(
    'U-ALL',
    asOptions({
      match: (r: { schoolId: number | null; lastLoginAt: string | null }) => {
        if (r.schoolId === null || r.lastLoginAt === null) return false
        const ms = Date.parse(r.lastLoginAt)
        if (ms > (latestLogin.get(r.schoolId) ?? 0)) latestLogin.set(r.schoolId, ms)
        if (ms >= weekAgo && ms <= now) loginIn7d.add(r.schoolId)
        return false
      },
      matchFields: ['schoolId', 'lastLoginAt'],
      page: 1,
      pageSize: 1,
    }),
  )
  const answered7d = new Set<number>()
  for (const id of tallies(ctx, '7d').keys()) {
    const sid = users.get(id)?.schoolId
    if (sid != null) answered7d.add(sid)
  }
  const allStudents = users.groupCount('U-ROLE', 'schoolId', 'student')

  const perSchool = new Map<number, StatsSchoolRow>()
  const rowOf = (sid: number): StatsSchoolRow => {
    let row = perSchool.get(sid)
    if (!row) {
      const total = questions.teacherContributions(sid)
      const str = structured.count('Q-TEACHER-CONTRIB-STR', sid)
      row = {
        schoolId: sid,
        name: schools.get(sid)?.name ?? '',
        teachersLogged: 0,
        teachers: 0,
        pupilsLogged: 0,
        pupils: Number(allStudents.get(sid) ?? 0),
        sessions: 0,
        questions: { total, mcq: total - str, structured: str },
        subscription: subscribed.has(sid) ? 'Aktif' : 'Tiada',
        status: 'tidak',
        lastLoginAt: null,
      }
      perSchool.set(sid, row)
    }
    return row
  }
  for (const [key, n] of usersBySchool) {
    if (typeof key === 'number' && n > 0 && !isFixtureSchoolId(key)) rowOf(key)
  }
  for (const t of pop.teachers) {
    if (t.schoolId === null || !perSchool.has(t.schoolId)) continue
    const row = rowOf(t.schoolId)
    row.teachers++
    if (t.lastLoginAt !== null) row.teachersLogged++
  }
  for (const p of pop.pupils) {
    if (p.schoolId === null || !perSchool.has(p.schoolId)) continue
    const row = rowOf(p.schoolId)
    if (p.lastLoginAt !== null) row.pupilsLogged++
    row.sessions += totals.get(p.id)?.all.sessions ?? 0
  }
  const rows = [...perSchool.values()]
  for (const row of rows) {
    const last = latestLogin.get(row.schoolId)
    row.lastLoginAt = last === undefined ? null : toIsoMyt(last)
    const status: StatsSchoolStatus =
      answered7d.has(row.schoolId) || loginIn7d.has(row.schoolId) ? 'aktif' : 'tidak'
    row.status = status
  }
  const ms = (r: StatsSchoolRow): number => (r.lastLoginAt === null ? 0 : Date.parse(r.lastLoginAt))
  const rank = (r: StatsSchoolRow): number => (r.status === 'aktif' ? 0 : r.lastLoginAt === null ? 2 : 1)
  return rows.sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    if (rank(a) === 2) return a.name.localeCompare(b.name) || a.schoolId - b.schoolId
    return ms(b) - ms(a) || a.name.localeCompare(b.name) || a.schoolId - b.schoolId
  })
}
