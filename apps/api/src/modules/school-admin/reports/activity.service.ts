import { Inject, Injectable } from '@nestjs/common'
import type { SchoolAdminActivityPupilRow, SchoolAdminActivityReport } from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { ClassesPorts, ClassesRepository } from '../../classes'
import { DAY_MS, byName, ddmm, dayKey, rangeOf, statusOf } from '../../reports/analytics/domain/rules'
import { WalletService } from '../../wallet'
import { K_COHORT } from '../school-admin.constants'
import { SchoolPopulation, type PupilFact } from './population'
import { accuracyOf, activityWindow } from './windows'

/** At most this many teacher question-stat reads run at the same time. */
const STATS_POOL = 8

/** Maps with at most `limit` calls in flight; the result keeps the input order. */
async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i] as T)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** Rows of one pupil pill (contract max). */
const PILL_MAX = 200

const stamp = (d: Date | null) => (d === null ? null : toMytTimestamp(d))

/**
 * S3 activity report (mock `activity`, the M17 statistics in the school scope). It is NOT BE-20's teacher-scoped
 * `ReportService`: only the pure rules (`rangeOf`, `mytDayStart` through `activityWindow`, `statusOf`) are shared. The
 * platform-only figures (`score`, `structuredScore`, `schoolName`, the schools list) never exist here.
 *
 * Sources: pupils from the users owner, sessions and answers from BE-20's `AnalyticsRepository` (completed non-test sessions,
 * clean answer log), class names from `ClassesRepository` (own-school classes only), teacher question counts from the
 * `ClassesPorts` question provider, coins from BE-11's `WalletService.balancesOf` (the current balance, as the mock; one batched read; no SQL on wallet
 * tables). Struktur, Battle and Permainan have no source in this build and stay 0 (as BE-20).
 *
 * Privacy: the per-pupil rows are in the contract and stay (the route is `no-store`); the school pupil accuracy tile is 0 when
 * fewer than `K_COHORT` pupils contributed answers.
 */
@Injectable()
export class ActivityService {
  constructor(
    @Inject(SchoolPopulation) private readonly population: SchoolPopulation,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(ClassesPorts) private readonly ports: ClassesPorts,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async report(schoolId: string, rawRange: string | undefined): Promise<SchoolAdminActivityReport> {
    const nowDate = this.clock.now()
    const now = nowDate.getTime()
    const range = rangeOf(rawRange)
    const w = activityWindow(range, now)
    const [pupils, teachers] = await Promise.all([this.population.pupils(schoolId), this.population.teachers(schoolId)])
    const ids = pupils.map((p) => p.id)

    const rows = await this.population.sessions(ids, w.from, w.to)
    const perDay = new Map<string, number>()
    const per = new Map<string, { sessions: number; correct: number; questions: number }>()
    let quiz = 0
    let correct = 0
    let questions = 0
    const contributing = new Set<string>()
    for (const r of rows) {
      quiz += r.sessions
      correct += r.correct
      questions += r.questions
      if (r.questions > 0) contributing.add(r.userId)
      perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.sessions)
      const p = per.get(r.userId) ?? { sessions: 0, correct: 0, questions: 0 }
      p.sessions += r.sessions
      p.correct += r.correct
      p.questions += r.questions
      per.set(r.userId, p)
    }

    const trend: SchoolAdminActivityReport['trend'] = []
    for (let d = range - 1; d >= 0; d--) {
      const day = w.today - d * DAY_MS
      trend.push({ label: ddmm(day), value: perDay.get(dayKey(day)) ?? 0 })
    }

    const [stats, practised, seconds, classNames] = await Promise.all([
      this.population.stats(ids),
      this.population.practised(ids),
      this.population.seconds(ids, w.from, w.to),
      this.classNamesOf(schoolId, ids),
    ])

    // Pills use the all-time answer log, as BE-20 (statusOf: answers > 0 is "aktif", else a login, else never).
    const base = pupils.map((p) => ({ p, status: statusOf(stats.get(p.id)?.answers ?? 0, p.lastLoginAt) }))
    const buckets = {
      semua: base.slice(0, PILL_MAX),
      aktif: base
        .filter((b) => b.status === 'aktif')
        .sort((a, b) => (per.get(b.p.id)?.sessions ?? 0) - (per.get(a.p.id)?.sessions ?? 0) || byName(a.p, b.p))
        .slice(0, PILL_MAX),
      loginSahaja: base.filter((b) => b.status === 'login').slice(0, PILL_MAX),
      belumLogin: base.filter((b) => b.status === 'never').slice(0, PILL_MAX),
    }
    const shown = new Set<string>()
    for (const list of Object.values(buckets)) for (const b of list) shown.add(b.p.id)

    const coins = await this.coinsOf([...shown, ...teachers.map((t) => t.id)])
    const rowOf = (p: PupilFact): SchoolAdminActivityPupilRow => {
      const u = per.get(p.id)
      return {
        userId: p.id,
        name: p.name,
        className: classNames.get(p.id) ?? null,
        sessions: u?.sessions ?? 0,
        accuracy: u ? (accuracyOf(u.correct, u.questions) ?? 0) : 0,
        seconds: seconds.get(p.id) ?? 0,
        coins: coins.get(p.id) ?? 0,
        lastLoginAt: stamp(p.lastLoginAt),
      }
    }
    const cache = new Map<string, SchoolAdminActivityPupilRow>()
    const pill = (list: { p: PupilFact }[]) =>
      list.map(({ p }) => {
        const hit = cache.get(p.id) ?? rowOf(p)
        cache.set(p.id, hit)
        return hit
      })

    const headcount = await this.headcountTeachers(schoolId)
    const teacherRows = await this.teacherRows(teachers, coins, headcount)
    const teacherQuestions = teacherRows.reduce((n, t) => n + t.mcq + t.structured, 0)
    const teacherCoins = teacherRows.reduce((n, t) => n + t.coins, 0)
    const teachersLogged = teachers.filter((t) => t.lastLoginAt !== null).length

    return {
      range,
      schoolId,
      generatedAt: toMytTimestamp(nowDate),
      overview: {
        pupils: pupils.length,
        pupilsLogged: pupils.filter((p) => p.lastLoginAt !== null).length,
        teachers: teachers.length,
        teachersLogged,
        practised: practised.size,
        activity: quiz,
      },
      trend,
      breakdown: { quiz, structured: 0, battle: 0, game: 0 },
      topPupils: pupils
        .map((p) => ({ userId: p.id, name: p.name, activities: per.get(p.id)?.sessions ?? 0 }))
        .filter((p) => p.activities > 0)
        .sort((a, b) => b.activities - a.activities || byName(a, b))
        .slice(0, 10),
      teachersNeverLogged: teachers
        .filter((t) => t.lastLoginAt === null)
        .sort(byName)
        .map((t) => ({ userId: t.id, name: t.name, email: t.email })),
      teachers: teacherRows,
      pupils: {
        semua: pill(buckets.semua),
        aktif: pill(buckets.aktif),
        loginSahaja: pill(buckets.loginSahaja),
        belumLogin: pill(buckets.belumLogin),
      },
      tiles: {
        teachers: { total: teachers.length, logged: teachersLogged, questions: teacherQuestions, coins: teacherCoins },
        pupils: {
          total: pupils.length,
          practised: practised.size,
          sessions: quiz,
          accuracy: contributing.size >= K_COHORT ? (accuracyOf(correct, questions) ?? 0) : 0,
        },
      },
    }
  }

  /** The first active classroom of the school each pupil is in (never a class of another school). */
  private async classNamesOf(schoolId: string, pupilIds: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (let i = 0; i < pupilIds.length; i += 1000) {
      for (const e of await this.classes.enrolmentsOfStudents(pupilIds.slice(i, i + 1000))) {
        if (e.status !== 'active' || !e.classroom.isActive || e.classroom.schoolId !== schoolId) continue
        if (!out.has(e.studentId)) out.set(e.studentId, e.classroom.name)
      }
    }
    return out
  }

  /** Teachers of the school who own at least one active classroom that has members. */
  private async headcountTeachers(schoolId: string): Promise<Set<string>> {
    const own = (await this.classes.schoolClasses(schoolId)).filter((c) => c.kind === 'classroom' && c.isActive && c.teacherId !== null)
    const counts = await this.classes.memberCounts(own.map((c) => c.id))
    return new Set(own.filter((c) => (counts.get(c.id) ?? 0) > 0).map((c) => c.teacherId as string))
  }

  private async teacherRows(
    teachers: Awaited<ReturnType<SchoolPopulation['teachers']>>,
    coins: Map<string, number>,
    headcount: Set<string>,
  ): Promise<SchoolAdminActivityReport['teachers']> {
    const sorted = [...teachers].sort(byName)
    const stats = await mapPool(sorted, STATS_POOL, (t) => this.ports.questions.statsOf(t.id))
    return sorted.map((t, i) => ({
      userId: t.id,
      name: t.name,
      email: t.email,
      loggedIn: t.lastLoginAt !== null,
      mcq: stats[i]?.total ?? 0,
      structured: 0,
      coins: coins.get(t.id) ?? 0,
      hasHeadcount: headcount.has(t.id),
      lastLoginAt: stamp(t.lastLoginAt),
    }))
  }

  /** Current coin balance per user (the mock's `currentSyiling` / wallet balance, not windowed): one batched wallet read. */
  private async coinsOf(userIds: readonly string[]): Promise<Map<string, number>> {
    return this.wallet.balancesOf(userIds)
  }
}
