/**
 * Reads of the Command Center board S2 / S3 (SRS M17 v1.13 §6.4 named queries Q-M17-*, §7 #3–#5; M17-T1b).
 * Every figure is computed per request from the owners' stores through their public entries (D11, D12):
 * M01 `users`, M02 `schools` / `schoolSubscriptions`, M03 `curriculum`, M05 `practice` / `practiceAnswers`,
 * M08 `schoolSpmHistory`, M10 `classrooms` / `questionSets`, M12 `feedback`, M14 `learnerBadges` /
 * `achievements` and the F-33 `moodCheckins` store. Nothing is stored here.
 *
 * One scope, two views (BR-M17-34): the **platform** (the pupils of P, BR-M17-03; the fixture schools
 * 900001–900099 are out, BR-M17-02) or **one school** (the active students of the session's school, fixture
 * school included, FR-M17-105). A `BoardCtx` holds the scope and the request clock; the per-user tallies are
 * memoised in it for the length of one request only (never across requests: the answer log changes at runtime).
 *
 * Cost model (M05 owns the log of 478,499 answers): all-time per-user tallies come from `groupCount('userId')`
 * of the P named queries (about 100 ms); a window (today, week, month, 30 d) is one pass of a `match` over the
 * cheap fields `userId`, `answeredAtMs`, `isCorrect` (no row is derived, the predicate accumulates); only the
 * 10 feed rows and the subject bars derive rows. A fixture school's pupils are outside P, so their answers
 * are read per pupil (a handful of pupils).
 */

import { DAY_MS, dayRange, formatDateKey, monthRange, weekRange } from '@/lib/time'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { isFixtureSchoolId, schoolSubscriptions, schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice, practiceAnswers, type AnswerRow } from '@/modules/m05-practice/mock'
import { schoolSpmHistory } from '@/modules/m08-student-performance/mock'
import { classrooms, questionSets } from '@/modules/m10-teacher-class/mock'
import { feedback } from '@/modules/m12-kirkpatrick/mock'
import { achievements, learnerBadges } from '@/modules/m14-gamification/mock'

import type { CcBadgeRow, CcMood, CcMoodCounts } from '../../api/command-center-board-types'
import { moodCheckinsRepo } from '../repository/provisional-mood'
import type { DateWindow } from '../repository/provisional-types'
import { studentsOf } from './command-center-drill-data'

// --- scope and request context -------------------------------------------------------------------

/** `schoolId` null = the platform view (admin); a number = the school view (school admin, BR-M17-34). */
export interface BoardScope {
  readonly schoolId: number | null
}

export const PLATFORM_SCOPE: BoardScope = Object.freeze({ schoolId: null })

export interface BoardCtx {
  readonly now: number
  readonly scope: BoardScope
  /** Active students of the school; `null` on the platform view (all of P). */
  readonly pupilIds: ReadonlySet<number> | null
  /** The school is a reserved fixture school: its pupils are outside P (BR-M17-02). */
  readonly fixture: boolean
  readonly memo: Map<string, unknown>
}

export function boardCtx(scope: BoardScope, now: number): BoardCtx {
  const memo = new Map<string, unknown>()
  if (scope.schoolId === null) return { now, scope, pupilIds: null, fixture: false, memo }
  const ids = new Set(
    studentsOf(scope.schoolId)
      .filter((u) => u.isActive)
      .map((u) => u.id),
  )
  return { now, scope, pupilIds: ids, fixture: isFixtureSchoolId(scope.schoolId), memo }
}

function memoised<T>(ctx: BoardCtx, key: string, compute: () => T): T {
  if (ctx.memo.has(key)) return ctx.memo.get(key) as T
  const value = compute()
  ctx.memo.set(key, value)
  return value
}

export const isSchoolView = (ctx: BoardCtx): boolean => ctx.scope.schoolId !== null

export function schoolName(schoolId: number | null): string | null {
  return schoolId === null ? null : (schools.get(schoolId)?.name ?? null)
}

// --- windows (BR-M17-01, MYT) --------------------------------------------------------------------

/** `all` = the whole log; `today`, `week`, `month`, `30d`, `7d`, `3m` follow M05 `Q-ANS-P`'s periods. */
export type Win = 'all' | 'today' | 'week' | 'month' | '30d' | '7d' | '3m'

/** The start of a window in epoch ms (`null` = no lower bound). */
export function winStart(win: Win, now: number): number | null {
  switch (win) {
    case 'all':
      return null
    case 'today':
      return dayRange(now).start
    case 'week':
      return weekRange(now).start
    case 'month':
      return monthRange(now).start
    case '30d':
      return now - 30 * DAY_MS
    case '7d':
      return now - 7 * DAY_MS
    case '3m': {
      const d = new Date(now + 8 * 3_600_000)
      const t = Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth() - 3,
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
      )
      return t - 8 * 3_600_000
    }
  }
}

/** The MYT day keys a mood window spans (`YYYY-MM-DD`). */
function moodWindow(win: Win, now: number): DateWindow | undefined {
  const from = winStart(win, now)
  return from === null ? undefined : { from: formatDateKey(from), to: formatDateKey(now) }
}

// --- answers --------------------------------------------------------------------------------------

export interface UserTally {
  answers: number
  correct: number
  /** Latest answer in the window (epoch ms); 0 for an `all` tally (the group counts carry no time). */
  lastMs: number
}

type Visit = (userId: number, answeredAtMs: number, isCorrect: boolean) => void

interface CheapAnswer {
  userId: number
  answeredAtMs: number
  isCorrect: boolean
}

/** The options `repo.query` forwards to the dataset (`matchFields` is a dataset option, see M05 `distinctUsers`). */
const asOptions = (o: object): never => o as never

/**
 * One pass over the P answers of a named period (`win` ≠ `all`) with a predicate over the cheap fields only
 * (no row is derived, ≤ 100 ms per pass). The predicate accumulates through `visit` and returns false, so no
 * row is kept. No `cacheKey` is given on purpose: a cache hit would skip the predicate.
 */
function scanP(ctx: BoardCtx, win: Win, visit: Visit): void {
  const want = ctx.pupilIds
  const match = (r: CheapAnswer): boolean => {
    if (want === null || want.has(r.userId)) visit(r.userId, r.answeredAtMs, r.isCorrect)
    return false
  }
  const options = asOptions({
    match,
    matchFields: ['userId', 'answeredAtMs', 'isCorrect'],
    page: 1,
    pageSize: 1,
  })
  if (win === 'all') practiceAnswers.query('Q-ANS-P', options)
  else practiceAnswers.query('Q-ANS-P', options, win)
}

/**
 * The answers of the scope from the start of the earliest of "this month" and "the last 30 days", one memoised
 * pass per request: today, week, month, 30 d, 7 d, the previous ISO week and the hours / days of the board are
 * all inside it (the previous Monday is at most 13 days back). A fixture school's pupils are outside P, so their
 * answers are read per pupil (a handful of pupils).
 */
interface Events {
  readonly from: number
  readonly userIds: number[]
  readonly ms: number[]
  readonly ok: boolean[]
}

function events(ctx: BoardCtx): Events {
  return memoised(ctx, 'events', () => {
    const month = winStart('month', ctx.now) ?? 0
    const thirty = winStart('30d', ctx.now) ?? 0
    const useMonth = month <= thirty
    const out: Events = { from: Math.min(month, thirty), userIds: [], ms: [], ok: [] }
    const push: Visit = (id, ms, ok) => {
      if (ms < out.from || ms > ctx.now) return
      out.userIds.push(id)
      out.ms.push(ms)
      out.ok.push(ok)
    }
    if (ctx.fixture) {
      for (const id of ctx.pupilIds ?? []) {
        for (const a of practice.answers(id)) push(id, a.answeredAtMs, a.isCorrect)
      }
    } else scanP(ctx, useMonth ? 'month' : '30d', push)
    return out
  })
}

function addTally(out: Map<number, UserTally>, id: number, ms: number, correct: boolean): void {
  const t = out.get(id) ?? { answers: 0, correct: 0, lastMs: 0 }
  t.answers++
  if (correct) t.correct++
  if (ms > t.lastMs) t.lastMs = ms
  out.set(id, t)
}

/** Windows `tallies` serves: the whole log, or a window inside the events pass. */
export type TallyWin = Exclude<Win, '3m'>

/** Answers and correct answers per pupil of the scope in a window (Q-M17-ANS / Q-M17-CORRECT by user). */
export function tallies(ctx: BoardCtx, win: TallyWin): Map<number, UserTally> {
  return memoised(ctx, `tally:${win}`, () => {
    const out = new Map<number, UserTally>()
    if (win === 'all') {
      if (ctx.fixture) {
        for (const id of ctx.pupilIds ?? []) {
          for (const a of practice.answers(id)) {
            if (a.answeredAtMs <= ctx.now) addTally(out, id, a.answeredAtMs, a.isCorrect)
          }
        }
        return out
      }
      const answers = practiceAnswers.groupCount('Q-ANS-P', 'userId')
      const correct = practiceAnswers.groupCount('Q-ANS-P-CORRECT', 'userId')
      for (const [id, n] of answers) {
        if (ctx.pupilIds !== null && !ctx.pupilIds.has(id)) continue
        out.set(id, { answers: n, correct: correct.get(id) ?? 0, lastMs: 0 })
      }
      // Honour the clock: take away the answers dated after `now` (one cheap-field pass).
      scanP(ctx, 'all', (id, ms, ok) => {
        if (ms <= ctx.now) return
        const t = out.get(id)
        if (!t) return
        t.answers--
        if (ok) t.correct--
        if (t.answers <= 0) out.delete(id)
      })
      return out
    }
    const from = winStart(win, ctx.now) ?? 0
    const ev = events(ctx)
    for (let i = 0; i < ev.ms.length; i++) {
      const ms = ev.ms[i] as number
      if (ms >= from) addTally(out, ev.userIds[i] as number, ms, ev.ok[i] as boolean)
    }
    return out
  })
}

export interface Sum {
  answers: number
  correct: number
}

export function sumOf(t: ReadonlyMap<number, UserTally>): Sum {
  const sum: Sum = { answers: 0, correct: 0 }
  for (const x of t.values()) {
    sum.answers += x.answers
    sum.correct += x.correct
  }
  return sum
}

/** correct ÷ answers × 100 with one decimal, 0 when nothing was answered (BR-M17-04, BR-M17-06). */
export const accuracyOf = (correct: number, answers: number): number =>
  answers === 0 ? 0 : Math.round((correct / answers) * 1000) / 10

/** Answers of the previous ISO week (Monday 00:00 to Sunday 23:59:59): Q-M17-ANS(last week). */
export function answersLastWeek(ctx: BoardCtx): number {
  const to = weekRange(ctx.now).start
  const from = to - 7 * DAY_MS
  let n = 0
  for (const ms of events(ctx).ms) if (ms >= from && ms < to) n++
  return n
}

/** BR-M17-07: round((week − last week) ÷ last week × 100), 0 when last week is 0; half away from zero. */
export function weekChangeOf(week: number, lastWeek: number): number {
  if (lastWeek === 0) return 0
  const pct = ((week - lastWeek) / lastWeek) * 100
  return pct < 0 ? -Math.round(-pct) : Math.round(pct)
}

/** Derived rows of the scope's answers in a window, newest first (`limit` rows; every row without a limit). */
export function answerRows(ctx: BoardCtx, win: Win, limit?: number): AnswerRow[] {
  if (ctx.fixture) {
    const from = winStart(win, ctx.now)
    const rows: AnswerRow[] = []
    for (const id of ctx.pupilIds ?? []) {
      for (const a of practice.answers(id)) {
        if (from !== null && a.answeredAtMs < from) continue
        if (a.answeredAtMs > ctx.now) continue
        rows.push(a)
      }
    }
    rows.sort((a, b) => b.answeredAtMs - a.answeredAtMs || b.id - a.id)
    return limit === undefined ? rows : rows.slice(0, limit)
  }
  const want = ctx.pupilIds
  // Answers after the clock are dropped BEFORE the limit (a feed never shows the future).
  const now = ctx.now
  const options = asOptions({
    match: (r: { userId: number; answeredAtMs: number }) =>
      r.answeredAtMs <= now && (want === null || want.has(r.userId)),
    matchFields: ['userId', 'answeredAtMs'],
    sort: [
      { field: 'answeredAtMs', dir: 'desc' },
      { field: 'id', dir: 'desc' },
    ],
    page: 1,
    pageSize: limit ?? 1_000_000,
  })
  return (
    win === 'all'
      ? practiceAnswers.query('Q-ANS-P', options)
      : practiceAnswers.query('Q-ANS-P', options, win)
  ).rows
}

/** The newest `limit` answers of the scope: the narrowest window that holds enough rows (live feed). */
export function latestAnswers(ctx: BoardCtx, limit: number): AnswerRow[] {
  const wins: Win[] = ['today', 'week', 'month', '3m', 'all']
  let rows: AnswerRow[] = []
  for (const win of wins) {
    rows = answerRows(ctx, win, limit)
    if (rows.length >= limit) break
  }
  return rows
}

/** Answers per day for the `days` MYT days ending today (oldest first): the school view's "Engagement". */
export function answersPerDay(ctx: BoardCtx, days: number): Map<string, number> {
  const start = dayRange(ctx.now).start - (days - 1) * DAY_MS
  const out = new Map<string, number>()
  for (let i = 0; i < days; i++) out.set(formatDateKey(start + i * DAY_MS), 0)
  for (const ms of events(ctx).ms) {
    if (ms < start) continue
    const key = formatDateKey(ms)
    out.set(key, (out.get(key) ?? 0) + 1)
  }
  return out
}

/** Answers per MYT hour of a window (0–23): the heatmap of "Hari Ini". */
export function answersPerHour(ctx: BoardCtx, win: TallyWin): number[] {
  const hours = new Array<number>(24).fill(0)
  const from = winStart(win, ctx.now) ?? 0
  for (const ms of events(ctx).ms) {
    if (ms < from) continue
    const h = Math.floor(((ms + 8 * 3_600_000) % DAY_MS) / 3_600_000)
    hours[h] = (hours[h] ?? 0) + 1
  }
  return hours
}

// --- subjects (BR-M17-26) -------------------------------------------------------------------------

/** Short subject names by M03 subject code (the live codes MATEMATIK … and the admin codes MATH …). */
const SHORT_SUBJECT: Readonly<Record<string, string>> = Object.freeze({
  MATEMATIK: 'Matematik',
  MATH: 'Matematik',
  BAHASA_MELAYU: 'BM',
  BM: 'BM',
  BAHASA_INGGERIS: 'BI',
  BI: 'BI',
  SAINS: 'Sains',
  SCI: 'Sains',
  PENDIDIKAN_ISLAM: 'P.Islam',
  PI: 'P.Islam',
  SEJARAH: 'Sejarah',
  SEJ: 'Sejarah',
  GEOGRAFI: 'Geo',
  GEO: 'Geo',
  PENDIDIKAN_MORAL: 'Moral',
  PM: 'Moral',
})

/** `{code, shortName}` of an answer's subject; no subject = mixed free practice "UMUM" / "Latihan Bebas". */
export function subjectInfo(subjectId: number | null): { code: string; shortName: string } {
  const subject = subjectId === null ? undefined : curriculum.subject(subjectId)
  if (!subject) return { code: 'UMUM', shortName: 'Latihan Bebas' }
  return { code: subject.code, shortName: SHORT_SUBJECT[subject.code] ?? subject.name }
}

/** One bar per subject of the window's answers, most answers first (ties: code A→Z). */
export function subjectBars(
  ctx: BoardCtx,
  win: Win,
): { code: string; shortName: string; answers: number }[] {
  const by = new Map<string, { code: string; shortName: string; answers: number }>()
  for (const row of answerRows(ctx, win)) {
    if (row.answeredAtMs > ctx.now) continue
    const info = subjectInfo(row.subjectId)
    const bar = by.get(info.code) ?? { ...info, answers: 0 }
    bar.answers++
    by.set(info.code, bar)
  }
  return [...by.values()].sort((a, b) => b.answers - a.answers || a.code.localeCompare(b.code))
}

// --- schools and registers ------------------------------------------------------------------------

/** Active students of P (Q-M17-PUPILS): the platform count, or the school's active students. */
export function pupilCount(ctx: BoardCtx): number {
  return ctx.pupilIds === null
    ? users.outsideFixtureSchools({ role: 'student', isActive: true })
    : ctx.pupilIds.size
}

/** Schools with an `active` M02 subscription whose period holds `now` (Q-M17-SUBSCRIBED), fixtures out. */
export function subscribedSchoolIds(now: number): Set<number> {
  const out = new Set<number>()
  for (const s of schoolSubscriptions.all()) {
    if (s.status !== 'active') continue
    if (Date.parse(s.startsAt) <= now && now <= Date.parse(s.endsAt)) out.add(s.schoolId)
  }
  return out
}

/** Q-M17-SUBSCRIBED: platform count (fixtures out) or 1 / 0 for the school view (INFERRED from live). */
export function subscribedCount(ctx: BoardCtx): number {
  const ids = subscribedSchoolIds(ctx.now)
  if (ctx.scope.schoolId !== null) return ids.has(ctx.scope.schoolId) ? 1 : 0
  let n = 0
  for (const id of ids) if (!isFixtureSchoolId(id)) n++
  return n
}

/** Q-M17-SCHOOLS: schools outside the fixtures with at least one student (57). */
export function schoolsWithPupils(): number {
  let n = 0
  for (const key of users.groupCount('U-ROLE', 'schoolId', 'student').keys()) {
    if (typeof key === 'number' && !isFixtureSchoolId(key)) n++
  }
  return n
}

/** The school of a user (the answer's school is the pupil's current school, BR-M17-04). */
export function schoolOfUser(userId: number): number | null {
  return users.get(userId)?.schoolId ?? null
}

/** Q-M17-GPS-OVERALL / Q-M17-GPS: mean subject GPS of the year's SPM rows of the scope, 3 decimals (0 when none). */
export function gpsOf(ctx: BoardCtx): number {
  const year = Number(formatDateKey(ctx.now).slice(0, 4))
  const rows = schoolSpmHistory
    .all()
    .filter((r) => r.schoolId !== null && r.year === year && r.subjects.length > 0)
  const mean = (r: (typeof rows)[number]): number =>
    r.subjects.reduce((a, s) => a + s.gps, 0) / r.subjects.length
  let row: (typeof rows)[number] | undefined
  if (ctx.scope.schoolId !== null) row = rows.find((r) => r.schoolId === ctx.scope.schoolId)
  else {
    // The top school: the one with the most SPM candidates (the only one at the seed), ties by id.
    row = [...rows].sort(
      (a, b) => b.candidates - a.candidates || (a.schoolId ?? 0) - (b.schoolId ?? 0),
    )[0]
  }
  return row ? Math.round(mean(row) * 1000) / 1000 : 0
}

/** Q-M12-T1 for the scope: responses and the satisfaction mean on its 1–5 scale. */
export function satisfactionOf(ctx: BoardCtx): { value: number; count: number } {
  const a = feedback.aggregates(ctx.scope.schoolId ?? undefined)
  return { value: a.satisfaction, count: a.responses }
}

// --- logins (Q-M17-LOGINS) -----------------------------------------------------------------------

/** Users of the scope with `lastLoginAt` in `[window start, now]`, newest first (ties by id). */
export function loginsIn(ctx: BoardCtx, win: Win): UserRow[] {
  return memoised(ctx, `logins:${win}`, () => {
    const from = winStart(win, ctx.now) ?? 0
    const now = ctx.now
    const school = ctx.scope.schoolId
    const match = (r: { lastLoginAt: string | null; schoolId: number | null }): boolean => {
      if (r.lastLoginAt === null) return false
      const ms = Date.parse(r.lastLoginAt)
      if (ms < from || ms > now) return false
      if (school !== null) return r.schoolId === school
      return r.schoolId === null || !isFixtureSchoolId(r.schoolId)
    }
    const options = asOptions({
      match,
      matchFields: ['lastLoginAt', 'schoolId'],
      sort: [{ field: 'lastLoginAt', dir: 'desc' }, 'id'],
      page: 1,
      pageSize: 1_000_000,
    })
    return users.query('U-ALL', options).rows
  })
}

const ROLE_ORDER = ['student', 'teacher', 'parent', 'admin', 'school_admin'] as const

/** "{role}: {n}" counts for roles with at least one login: the fixed order, then the others A→Z (FR-M17-38). */
export function loginsByRole(rows: readonly UserRow[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const u of rows) counts.set(u.role, (counts.get(u.role) ?? 0) + 1)
  const out: Record<string, number> = {}
  for (const role of ROLE_ORDER) {
    const n = counts.get(role)
    if (n !== undefined) out[role] = n
  }
  for (const role of [...counts.keys()].sort()) {
    if (!(role in out)) out[role] = counts.get(role) ?? 0
  }
  return out
}

/** BR-M17-24 package chip, in this precedence. */
export function packageChip(user: UserRow, subscribed: ReadonlySet<number>): string {
  if (user.role === 'admin') return 'ADMIN'
  if (user.role === 'parent') return 'PARENT'
  if (user.subscriptionPackage !== 'none') return 'AKTIF'
  if (user.hasPkskSubscription) return 'PKSK'
  if (user.schoolId !== null && subscribed.has(user.schoolId)) return 'SEKOLAH'
  if (user.isComplimentary) return 'BEBAS'
  return 'FREE'
}

// --- mood, missions, sessions, badges, question sets --------------------------------------------

/** Q-M17-MOOD(window): check-ins per mood of the scope (the F-33 store, owner M26). */
export function moodCounts(ctx: BoardCtx, win: Win): CcMoodCounts {
  const window = moodWindow(win, ctx.now)
  if (ctx.pupilIds === null) return moodCheckinsRepo.countByMood(window)
  const out: CcMoodCounts = { happy: 0, okay: 0, sad: 0, stressed: 0 }
  for (const id of ctx.pupilIds) {
    const c = moodCheckinsRepo.countByMood(window, id)
    for (const mood of Object.keys(out) as CcMood[]) out[mood] += c[mood]
  }
  return out
}

export interface SessionStats {
  completed: number
  started: number
  seconds: number
  /** Completed sessions linked to an M10 mission (Q-M17-MISSIONS). */
  missions: number
}

/** Q-M17-SESS / Q-M17-MISSIONS: completed sessions of the scope's pupils in a window (`started` = completed). */
export function sessionStats(ctx: BoardCtx, win: Win): SessionStats {
  const out: SessionStats = { completed: 0, started: 0, seconds: 0, missions: 0 }
  const add = (timeSpent: number, missionId: number | null): void => {
    out.completed++
    out.started++
    out.seconds += timeSpent
    if (missionId !== null) out.missions++
  }
  if (ctx.fixture) {
    const from = winStart(win, ctx.now) ?? 0
    for (const id of ctx.pupilIds ?? []) {
      for (const s of practice.history(id, { from, to: ctx.now + 1 })) add(s.timeSpent, s.missionId)
    }
    return out
  }
  const want = ctx.pupilIds
  const match = (r: { userId: number; timeSpent: number; missionId: number | null }): boolean => {
    if (want === null || want.has(r.userId)) add(r.timeSpent, r.missionId)
    return false
  }
  practice.query(
    'Q-SESS-P',
    asOptions({ match, matchFields: ['userId', 'timeSpent', 'missionId'], page: 1, pageSize: 1 }),
    win as never,
  )
  return out
}

/** Pupils of the scope as `{id, name}` for the badge loops (platform: every pupil of P). */
function badgePupils(ctx: BoardCtx): UserRow[] {
  return memoised(ctx, 'badge-pupils', () => {
    if (ctx.pupilIds !== null) return users.getMany([...ctx.pupilIds])
    return users
      .adminList({ role: 'student', isActive: true, page: 1, pageSize: 100_000 })
      .rows.filter((u) => u.schoolId === null || !isFixtureSchoolId(u.schoolId))
  })
}

/** Q-M17-BADGES(window): badge awards (M14 `LearnerBadgeHolding`) and achievement unlocks, newest first. */
export function badgesIn(ctx: BoardCtx, win: Win): CcBadgeRow[] {
  const from = winStart(win, ctx.now) ?? 0
  const inWindow = (iso: string): boolean => {
    const ms = Date.parse(iso)
    return ms >= from && ms <= ctx.now
  }
  const catalogue = new Map(achievements.catalogue().map((a) => [a.id, a]))
  const rows: CcBadgeRow[] = []
  for (const user of badgePupils(ctx)) {
    for (const b of learnerBadges.forUser(user.id)) {
      if (inWindow(b.awardedAt)) {
        rows.push({
          userId: user.id,
          name: user.name,
          badgeName: b.name,
          icon: b.icon,
          awardedAt: b.awardedAt,
        })
      }
    }
    for (const u of achievements.query('Q-ACH-UNLOCKED', {}, user.id).rows) {
      const a = catalogue.get(u.achievementId)
      if (a && inWindow(u.unlockedAt)) {
        rows.push({
          userId: user.id,
          name: user.name,
          badgeName: a.name,
          icon: a.icon,
          awardedAt: u.unlockedAt,
        })
      }
    }
  }
  return rows.sort(
    (a, b) => Date.parse(b.awardedAt) - Date.parse(a.awardedAt) || a.userId - b.userId,
  )
}

/** Q-M17-QSETS(window): M10 question sets created in the window by teachers of the scope. */
export function questionSetsIn(ctx: BoardCtx, win: Win): number {
  const from = winStart(win, ctx.now) ?? 0
  let n = 0
  for (const teacherId of classrooms.owners()) {
    const teacher = users.get(teacherId)
    if (!teacher) continue
    if (ctx.scope.schoolId !== null) {
      if (teacher.schoolId !== ctx.scope.schoolId) continue
    } else if (teacher.schoolId !== null && isFixtureSchoolId(teacher.schoolId)) continue
    for (const set of questionSets.forTeacher(teacherId)) {
      const ms = Date.parse(set.createdAt)
      if (ms >= from && ms <= ctx.now) n++
    }
  }
  return n
}
