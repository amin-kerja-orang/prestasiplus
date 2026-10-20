import { Inject, Injectable, Optional } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, mytDay, type Clock } from '../../../../db/clock'
import { canOpenClassDashboard } from '../domain/access-policy'
import { ACTIVE_DAYS, ATTENTION_BELOW, COUNTED_MODES, TREND_WINDOW_DAYS } from '../domain/constants'
import { addFact, emptyFigures, figuresOf, type Figures } from '../domain/reduce'
import { accuracyOf, compareIds, round } from '../domain/rules'
import { startOfDaysAgo } from '../domain/windows'
import { HeadcountFactsService } from '../headcount/headcount-facts.service'
import { meanOrNull } from '../headcount/headcount.rules'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort } from '../ports'
import { classBadge, liveEntries, newestConfigId } from './headcount-figures'
import type { HeadcountFacts } from './headcount-facts.types'
import { groupBy, nameMap, toCard } from './support'
import type { Ctx, PerformanceClassCard, PerformanceClassDashboard } from './types'

interface MemberRow {
  userId: string
  f: Figures
  last: Date | null
  /** null when nothing graded yet. */
  accuracy: number | null
  rawAccuracy: number
}

/** Prestasi kelas (S4, S5). classDashboard throws NOT_FOUND for an unknown, school-kind or not-openable class. */
@Injectable()
export class ClassPerformanceService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Optional() @Inject(HeadcountFactsService) protected readonly facts?: HeadcountFacts,
  ) {}

  async ownClasses(ctx: Ctx): Promise<PerformanceClassCard[]> {
    if (ctx.role !== 'teacher') return []
    const classes = await this.ports.classes.classesForTeacher(ctx.userId)
    return classes.filter((c) => c.kind === 'classroom' && c.isActive).map(toCard)
  }

  /**
   * The newest config of the class (BR-M08-08 rule 2): above and on track both read "on"; members without a live entry are
   * "no data"; dropped pupils are left out. Null when the class has no entries (the config is then not visible to this reader).
   */
  private async headcountBlock(
    classId: string,
    members: readonly string[],
  ): Promise<{ block: PerformanceClassDashboard['headcount']; badges: Map<string, 'on' | 'below' | 'na'> }> {
    const badges = new Map<string, 'on' | 'below' | 'na'>()
    if (!this.facts) return { block: null, badges }
    const all = await this.facts.entriesOfClasses([classId])
    const configId = newestConfigId(all.filter((e) => e.classroomId === classId))
    if (configId === null) return { block: null, badges }
    const ofConfig = all.filter((e) => e.configId === configId)
    const dropped = new Set(ofConfig.filter((e) => e.dropped).map((e) => e.studentId))
    const live = liveEntries(ofConfig)
    const byStudent = new Map(live.map((e) => [e.studentId, e]))
    const roster = [...new Set([...members.filter((m) => !dropped.has(m)), ...byStudent.keys()])]
    let on = 0
    let below = 0
    let none = 0
    for (const id of roster) {
      const b = classBadge(byStudent.get(id))
      badges.set(id, b)
      if (b === 'on') on++
      else if (b === 'below') below++
      else none++
    }
    const total = roster.length
    const share = (n: number): number => (total === 0 ? 0 : round((n / total) * 100, 1))
    return {
      block: {
        configId,
        onTrack: on,
        below,
        noData: none,
        pct: { on: share(on), below: share(below), none: share(none) },
        avgTov: meanOrNull(live.map((e) => e.tov)),
        avgEtr: meanOrNull(live.map((e) => e.etr)),
      },
      badges,
    }
  }

  async classDashboard(ctx: Ctx, id: string): Promise<PerformanceClassDashboard> {
    const cls = await this.ports.classes.classById(id)
    if (!cls || !canOpenClassDashboard(ctx, cls)) throw ApiError.of('NOT_FOUND')

    const members = await this.ports.classes.memberIds(cls.id)
    const facts =
      members.length === 0
        ? []
        : await this.ports.bijak.sittings({
            userIds: members,
            ...(cls.subjectId !== null ? { subjectId: cls.subjectId } : {}),
            modes: COUNTED_MODES.class,
          })
    const now = this.clock.now()

    const byUser = groupBy(facts, (s) => s.userId)
    const rows: MemberRow[] = members.map((userId) => {
      const list = byUser.get(userId) ?? []
      const f = list.reduce((acc, s) => addFact(acc, s), emptyFigures())
      const last = list.reduce<Date | null>((m, s) => (m === null || s.submittedAt > m ? s.submittedAt : m), null)
      return {
        userId,
        f,
        last,
        accuracy: f.gradedMax === 0 ? null : accuracyOf(f.gradedScore, f.gradedMax),
        rawAccuracy: f.gradedMax === 0 ? 0 : (f.gradedScore / f.gradedMax) * 100,
      }
    })

    const total = figuresOf(facts)
    const activeFrom = startOfDaysAgo(now, ACTIVE_DAYS - 1)
    const active7d = new Set(facts.filter((s) => s.submittedAt >= activeFrom).map((s) => s.userId)).size

    const trendFrom = startOfDaysAgo(now, TREND_WINDOW_DAYS - 1)
    const byDay = groupBy(
      facts.filter((s) => s.submittedAt >= trendFrom),
      (s) => mytDay(s.submittedAt),
    )
    const trend = [...byDay]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => {
        const f = figuresOf(list)
        return {
          date,
          sessions: f.sittings,
          avgAccuracy: accuracyOf(f.gradedScore, f.gradedMax),
          activeStudents: new Set(list.map((s) => s.userId)).size,
        }
      })

    const hc = await this.headcountBlock(cls.id, members)
    const names = await nameMap(this.directory, members)
    const nameOf = (id: string): string => names.get(id) ?? ''
    // Accuracy descending (uncapped for the order), ties by user id; members without graded marks last.
    const order = [...rows].sort((a, b) => {
      if (a.accuracy === null && b.accuracy === null) return compareIds(a.userId, b.userId)
      if (a.accuracy === null) return 1
      if (b.accuracy === null) return -1
      return b.rawAccuracy - a.rawAccuracy || compareIds(a.userId, b.userId)
    })
    const ranking = order.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: nameOf(r.userId),
      sessions: r.f.sittings,
      answered: r.f.max,
      accuracy: r.accuracy,
      headcount: hc.badges.get(r.userId) ?? ('na' as const),
      lastActiveAt: r.last ? toMytTimestamp(r.last) : null,
    }))
    const attention = [
      ...order
        .filter((r) => r.accuracy !== null && r.rawAccuracy < ATTENTION_BELOW)
        .map((r) => ({ userId: r.userId, name: nameOf(r.userId), sessions: r.f.sittings, accuracy: r.accuracy })),
      ...rows
        .filter((r) => r.f.sittings === 0)
        .sort((a, b) => compareIds(a.userId, b.userId))
        .map((r) => ({ userId: r.userId, name: nameOf(r.userId), sessions: 0, accuracy: null })),
    ]

    const school = await this.directory.school(cls.schoolId)
    return {
      class: { id: cls.id, name: cls.name, school: school?.name ?? '', subject: cls.subjectName, year: cls.year, joinCode: cls.joinCode },
      stats: {
        students: members.length,
        accuracy: accuracyOf(total.gradedScore, total.gradedMax),
        sessions: total.sittings,
        answered: total.max,
        avgMinutes: total.sittings === 0 ? 0 : round(total.seconds / total.sittings / 60, 1),
        active7d,
      },
      headcount: hc.block,
      attention,
      trend,
      ranking,
    }
  }
}
