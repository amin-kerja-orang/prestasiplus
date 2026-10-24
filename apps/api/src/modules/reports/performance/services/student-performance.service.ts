import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import { mayOpenStudent, viewerSchoolId } from '../domain/access-policy'
import { COUNTED_MODES, DEFAULT_SUBJECT_COLOR, HEATMAP_DAYS } from '../domain/constants'
import { START_SUGGESTION, subjectSuggestion } from '../domain/labels'
import { figuresOf } from '../domain/reduce'
import { accuracyOf, compareIds } from '../domain/rules'
import { lastDays } from '../domain/windows'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import { pairStatus } from '../headcount/headcount.rules'
import { DIRECTORY_PORT, PerformancePorts, type BijakSittingFact, type ClassInfo, type DirectoryPort, type PupilRef } from '../ports'
import type { HeadcountEntryView, HeadcountFacts, HeadcountScope } from './headcount-facts.types'
import { groupBy } from './support'
import type { Ctx, PerformanceStudent } from './types'

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

    const facts = await this.ports.bijak.sittings({ userIds: [userId], modes: COUNTED_MODES.student })
    const f = figuresOf(facts)
    const accuracy = accuracyOf(f.gradedScore, f.gradedMax)

    // One row per curriculum subject: sittings of the same subject can carry different Bijak codes (SW13-08).
    const idOfCode = await this.directory.subjectIdsOfCodes([...new Set(facts.map((s) => s.subjectCode))])
    const mastery = [...groupBy(facts, (s) => idOfCode.get(s.subjectCode) ?? s.subjectId).values()]
      .map((list) => {
        const first = list[0] as BijakSittingFact
        const sf = figuresOf(list)
        return {
          subjectCode: first.subjectCode,
          subjectName: first.subjectName,
          color: DEFAULT_SUBJECT_COLOR,
          accuracy: accuracyOf(sf.gradedScore, sf.gradedMax),
          sessions: sf.sittings,
          answered: sf.answered,
        }
      })
      .sort((a, b) => b.answered - a.answered || a.subjectCode.localeCompare(b.subjectCode))

    const perDay = new Map<string, number>()
    for (const s of facts) {
      const d = mytDay(s.submittedAt)
      perDay.set(d, (perDay.get(d) ?? 0) + 1)
    }
    const heatmap = lastDays(this.clock.now(), HEATMAP_DAYS).map((date) => ({ date, sessions: perDay.get(date) ?? 0 }))

    const suggestions: PerformanceStudent['suggestions'] =
      facts.length === 0
        ? [{ kind: 'start', text: START_SUGGESTION }]
        : [...mastery]
            .filter((m) => m.accuracy < 70)
            .sort((a, b) => a.accuracy - b.accuracy)
            .map((m) => ({ kind: 'subject', text: subjectSuggestion(m.subjectName, m.accuracy) }))

    const [profile, badges, headcount] = await Promise.all([
      this.ports.gamification.profile(userId),
      this.ports.gamification.badges(userId),
      this.headcountCards(ctx, userId),
    ])

    return {
      user: { id: pupil.id, name: pupil.name, initial: (pupil.name.trim()[0] ?? '?').toUpperCase() },
      heroAccuracy: Math.round(accuracy),
      streak: profile?.streak.current ?? 0,
      stats: { sessions: f.sittings, accuracy, answered: f.answered, seconds: f.seconds },
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
      weakTopics: [],
      suggestions,
    }
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
