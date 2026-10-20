import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import { mayOpenStudent } from '../domain/access-policy'
import { COUNTED_MODES, DEFAULT_SUBJECT_COLOR, HEATMAP_DAYS } from '../domain/constants'
import { START_SUGGESTION, subjectSuggestion } from '../domain/labels'
import { figuresOf } from '../domain/reduce'
import { accuracyOf } from '../domain/rules'
import { lastDays } from '../domain/windows'
import { DIRECTORY_PORT, PerformancePorts, type BijakSittingFact, type DirectoryPort, type PupilRef } from '../ports'
import { groupBy } from './support'
import type { Ctx, PerformanceStudent } from './types'

/** Prestasi 360 (S6). Throws NOT_FOUND (404) for an unknown pupil AND for a pupil the caller may not open: one outcome, no existence leak (OQ-1). */
@Injectable()
export class StudentPerformanceService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
  ) {}

  async student(ctx: Ctx, userId: string): Promise<PerformanceStudent> {
    const pupil = (await this.directory.users([userId])).get(userId)
    if (!pupil || !(await this.mayOpen(ctx, pupil))) throw ApiError.of('NOT_FOUND')

    const facts = await this.ports.bijak.sittings({ userIds: [userId], modes: COUNTED_MODES.student })
    const f = figuresOf(facts)
    const accuracy = accuracyOf(f.gradedScore, f.gradedMax)

    const mastery = [...groupBy(facts, (s) => s.subjectId).values()]
      .map((list) => {
        const first = list[0] as BijakSittingFact
        const sf = figuresOf(list)
        return {
          subjectCode: first.subjectCode,
          subjectName: first.subjectName,
          color: DEFAULT_SUBJECT_COLOR,
          accuracy: accuracyOf(sf.gradedScore, sf.gradedMax),
          sessions: sf.sittings,
          answered: sf.max,
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

    return {
      user: { id: pupil.id, name: pupil.name, initial: (pupil.name.trim()[0] ?? '?').toUpperCase() },
      heroAccuracy: Math.round(accuracy),
      streak: 0,
      stats: { sessions: f.sittings, accuracy, answered: f.max, seconds: f.seconds },
      headcount: [],
      mastery,
      activity: { streakCurrent: 0, streakBest: 0, koinTotal: 0, practiceDays: perDay.size },
      badges: [],
      heatmap,
      weakTopics: [],
      suggestions,
    }
  }

  private async mayOpen(ctx: Ctx, pupil: PupilRef): Promise<boolean> {
    if (!pupil.isStudent) return false
    const teaches = ctx.role === 'teacher' && ctx.userId !== pupil.id && (await this.ports.classes.isMemberOfTeacher(ctx.userId, pupil.id))
    return mayOpenStudent(ctx, pupil, { teaches })
  }
}
