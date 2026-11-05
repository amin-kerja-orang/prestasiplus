import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import { mayOpenStudent, viewerSchoolId } from '../domain/access-policy'
import {
  COUNTED_MODES,
  DEFAULT_SUBJECT_COLOR,
  HEATMAP_DAYS,
  SESSION_MODES,
  STUDENT_TREND_WEEKS,
  WEAK_TOPIC_BELOW,
  WEAK_TOPIC_MIN_ATTEMPTS,
} from '../domain/constants'
import { START_SUGGESTION, subjectSuggestion } from '../domain/labels'
import { figuresOf } from '../domain/reduce'
import { compareIds, round } from '../domain/rules'
import { lastDays, lastWeeks, mytMidnight } from '../domain/windows'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import { pairStatus } from '../headcount/headcount.rules'
import { DIRECTORY_PORT, PerformancePorts, type AnswerFactRow, type ClassInfo, type DirectoryPort, type PupilRef } from '../ports'
import type { HeadcountEntryView, HeadcountFacts, HeadcountScope } from './headcount-facts.types'
import { groupBy } from './support'
import type { Ctx, PerformanceStudent } from './types'

const sum = <T>(list: readonly T[], f: (x: T) => number): number => list.reduce((n, x) => n + f(x), 0)

/** Pooled accuracy: correct / answered x 100, ONE decimal on the wire (decision 11; a whole value has no fraction). */
const accuracyPct = (correct: number, answered: number): number => round((correct / answered) * 100, 1)

/** Prestasi 360 (S6). Throws NOT_FOUND (404) for an unknown pupil AND for a pupil the caller may not open: one outcome, no existence leak (OQ-1). */
@Injectable()
export class StudentPerformanceService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Optional() @Inject(HeadcountFactsService) protected readonly facts?: HeadcountFacts,
  ) {}

  async student(ctx: Ctx, userId: string): Promise<PerformanceStudent> {
    const pupil = (await this.directory.users([userId])).get(userId)
    if (!pupil || !(await this.mayOpen(ctx, pupil))) throw ApiError.of('NOT_FOUND')

    const now = this.clock.now()
    const weeks = lastWeeks(now, STUDENT_TREND_WEEKS)
    const own = { userIds: [userId] } as const
    // The pooled figures come from the one answer store (S10-T01 shared reader): every mode answers, game modes add no session.
    const [rows, trendRows, sessionRows, sessionCounts, sittings, practiceDays] = await Promise.all([
      this.ports.answerFacts.answerFacts(own),
      this.ports.answerFacts.weeklyFacts({ ...own, from: mytMidnight(weeks[0] as string), to: now }),
      this.ports.answerFacts.weeklyFacts({ ...own, modes: SESSION_MODES }),
      // One grouped distinct count: a session that crosses Monday 00:00 is one session, not one per week.
      this.ports.answerFacts.sessionCounts({ ...own, modes: SESSION_MODES }),
      // The day map, the practice days and the time spent come from the Bijak sittings AND the practice sessions
      // (the answer reader carries no per-day or duration figure). A Bijak sitting is not a `practice_sessions` row, so nothing is counted twice.
      this.ports.bijak.sittings({ userIds: [userId], modes: COUNTED_MODES.student }),
      this.ports.practice.dailyActivity(userId),
    ])

    const answered = sum(rows, (r) => r.attempts)
    const accuracy = answered === 0 ? null : accuracyPct(sum(rows, (r) => r.correct), answered)
    const sessions = sessionCounts.find((r) => r.subjectId === null)?.sessions ?? 0
    const subjectSessions = new Map(sessionCounts.flatMap((r) => (r.subjectId === null ? [] : [[r.subjectId, r.sessions] as const])))

    const bySubject = groupBy(
      rows.filter((r) => r.subjectId !== '0'),
      (r) => r.subjectId,
    )
    const subjects = await this.directory.subjectsOfIds([...bySubject.keys()])
    const mastery = [...bySubject]
      .flatMap(([id, list]) => {
        const subject = subjects.get(id)
        if (!subject) return []
        const n = sum(list, (r) => r.attempts)
        return [
          {
            subjectCode: subject.code,
            subjectName: subject.name,
            color: DEFAULT_SUBJECT_COLOR,
            accuracy: accuracyPct(sum(list, (r) => r.correct), n),
            sessions: subjectSessions.get(id) ?? 0,
            answered: n,
          },
        ]
      })
      .sort((a, b) => b.answered - a.answered || a.subjectCode.localeCompare(b.subjectCode))

    const perDay = new Map<string, number>()
    for (const s of sittings) {
      const d = mytDay(s.submittedAt)
      perDay.set(d, (perDay.get(d) ?? 0) + 1)
    }
    for (const p of practiceDays) perDay.set(p.day, (perDay.get(p.day) ?? 0) + p.sessions)
    const heatmap = lastDays(now, HEATMAP_DAYS).map((date) => ({ date, sessions: perDay.get(date) ?? 0 }))

    const suggestions: PerformanceStudent['suggestions'] =
      answered === 0
        ? [{ kind: 'start', text: START_SUGGESTION }]
        : [...mastery]
            .filter((m) => m.accuracy < 70)
            .sort((a, b) => a.accuracy - b.accuracy)
            .map((m) => ({ kind: 'subject', text: subjectSuggestion(m.subjectName, m.accuracy) }))

    const [profile, badges, headcount, weakTopics] = await Promise.all([
      this.ports.gamification.profile(userId),
      this.ports.gamification.badges(userId),
      this.headcountCards(ctx, userId),
      this.weakTopics(rows),
    ])

    const trendByWeek = new Map(trendRows.map((r) => [r.weekStart, r]))
    const sessionsByWeek = new Map(sessionRows.map((r) => [r.weekStart, r.sessions]))
    const trend = weeks.map((week, i) => {
      const t = trendByWeek.get(week)
      return {
        week,
        label: `Mgg ${String(i + 1)}`,
        accuracy: t && t.attempts > 0 ? accuracyPct(t.correct, t.attempts) : null,
        sessions: sessionsByWeek.get(week) ?? 0,
      }
    })

    return {
      user: { id: pupil.id, name: pupil.name, initial: (pupil.name.trim()[0] ?? '?').toUpperCase() },
      heroAccuracy: accuracy === null ? null : Math.round(accuracy),
      streak: profile?.streak.current ?? 0,
      stats: { sessions, accuracy, answered, seconds: figuresOf(sittings).seconds + sum(practiceDays, (p) => p.seconds) },
      headcount,
      mastery,
      activity: {
        streakCurrent: profile?.streak.current ?? 0,
        streakBest: profile?.streak.best ?? 0,
        koinTotal: profile?.syiling ?? 0,
        practiceDays: perDay.size,
      },
      // The gamification port carries a name only, so the icon stays empty.
      badges: badges.map((b) => ({ icon: b.icon, name: b.name })),
      heatmap,
      weakTopics,
      suggestions,
      trend,
    }
  }

  /**
   * Weak topics (FR-MUR-4-8): all time and all modes, at least 2 attempts and an accuracy below 60. The topic of an
   * answer is its own `topic_id` (the DSKP SP), else its `chapter_id`; a row with neither is skipped.
   * `focusCount` is 0 in part 1 (no servable count until S5-T03; the tile shows without a button).
   */
  private async weakTopics(rows: readonly AnswerFactRow[]): Promise<PerformanceStudent['weakTopics']> {
    const by = new Map<string, { kind: 'topic' | 'chapter'; id: string; attempts: number; correct: number }>()
    for (const r of rows) {
      const kind = r.topicId !== null ? 'topic' : 'chapter'
      const id = r.topicId ?? r.chapterId
      if (id === null) continue
      const t = by.get(`${kind}:${id}`) ?? { kind, id, attempts: 0, correct: 0 }
      t.attempts += r.attempts
      t.correct += r.correct
      by.set(`${kind}:${id}`, t)
    }
    const weak = [...by.values()]
      .map((t) => ({ ...t, accuracy: accuracyPct(t.correct, t.attempts) }))
      // compared on the exact ratio, not the one-decimal value: 59.96% is weak (FR-MUR-4-8)
      .filter((t) => t.attempts >= WEAK_TOPIC_MIN_ATTEMPTS && t.correct * 100 < WEAK_TOPIC_BELOW * t.attempts)
    if (weak.length === 0) return []
    const info = await this.ports.answerFacts.spInfo({
      topicIds: weak.filter((t) => t.kind === 'topic').map((t) => t.id),
      chapterIds: weak.filter((t) => t.kind === 'chapter').map((t) => t.id),
    })
    const infoOf = new Map(info.map((i) => [`${i.kind}:${i.id}`, i]))
    return weak
      .flatMap((t) => {
        const i = infoOf.get(`${t.kind}:${t.id}`)
        if (!i) return []
        return [
          {
            spId: t.id,
            label: i.label,
            code: i.code,
            subjectCode: i.subjectCode,
            levelId: i.levelId,
            attempts: t.attempts,
            accuracy: t.accuracy,
            // Part 1: no servable count yet (S5-T03 exposes it), so the tile shows without a button.
            focusCount: 0,
          },
        ]
      })
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || compareIds(a.spId, b.spId))
  }

  /** Headcount cards (BR-M08-24): the pupil's live entries in the configs the viewer may see, newest config first. */
  private async headcountCards(ctx: Ctx, userId: string): Promise<PerformanceStudent['headcount']> {
    if (!this.facts) return []
    const scope = this.factsScope(ctx, userId)
    if (scope === null) return []
    const entries = (await this.facts.entriesOfStudent(userId, scope)).filter((e) => !e.dropped)
    if (entries.length === 0) return []
    const classes = new Map((await this.ports.classes.classesByIds([...new Set(entries.map((e) => e.classroomId))])).map((c) => [c.id, c]))
    return [...entries]
      .sort((a, b) => b.configUpdatedAt.getTime() - a.configUpdatedAt.getTime() || compareIds(b.configId, a.configId))
      .map((e) => this.card(e, classes.get(e.classroomId)))
  }

  private card(e: HeadcountEntryView, cls: ClassInfo | undefined): PerformanceStudent['headcount'][number] {
    const chips: PerformanceStudent['headcount'][number]['chips'] = [{ label: 'TOV', value: e.tov, tone: 'none' }]
    e.actuals.forEach((ar, i) => {
      if (ar === null) return
      const target = e.targets[i] ?? null
      chips.push({ label: `OTR${String(i + 1)}`, value: ar, tone: target !== null && ar >= target ? 'on' : 'below' })
    })
    chips.push({ label: 'ETR', value: e.etr, tone: 'none' })
    return {
      configId: e.configId,
      subject: e.subjectName ?? (cls && cls.subjectId === e.subjectId ? (cls.subjectName ?? '') : ''),
      className: cls?.name ?? '',
      year: e.academicYear,
      status: pairStatus(e),
      tov: e.tov,
      chips,
      etr: e.etr,
    }
  }

  /** The viewer's slice of the pupil's entries: the pupil themself and admin all, a teacher the own configs, a school admin the own school. */
  private factsScope(ctx: Ctx, userId: string): HeadcountScope | null {
    if (ctx.userId === userId || ctx.role === 'admin') return { kind: 'platform' }
    if (ctx.role === 'teacher') return { kind: 'teacher', teacherId: ctx.userId }
    const schoolId = viewerSchoolId(ctx)
    return ctx.role === 'school_admin' && schoolId !== null ? { kind: 'school', schoolId } : null
  }

  private async mayOpen(ctx: Ctx, pupil: PupilRef): Promise<boolean> {
    if (!pupil.isStudent) return false
    const teaches = ctx.role === 'teacher' && ctx.userId !== pupil.id && (await this.ports.classes.isMemberOfTeacher(ctx.userId, pupil.id))
    return mayOpenStudent(ctx, pupil, { teaches })
  }
}
