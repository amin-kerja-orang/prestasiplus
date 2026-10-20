import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { firstNameOf } from '../domain/ranking'
import { accuracyOf } from '../domain/rules'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort, type TimelinePostView } from '../ports'
import type { Ctx, PerformancePublicProfile, PerformanceTimelinePost } from './types'

const DAY_MS = 86_400_000

export const toWirePost = (p: TimelinePostView): PerformanceTimelinePost => ({
  id: p.id,
  userId: p.userId,
  title: p.title,
  category: p.category,
  eventDate: p.eventDate,
  story: p.story,
  photos: p.photos.map((x) => ({ url: x.url, caption: x.caption })),
  createdAt: toMytTimestamp(p.createdAt),
})

/**
 * Public student profile (S18), no session required. Privacy (OQ-8): the name is the FIRST NAME only, the
 * school is null, and every refusal (unknown id, not a student, inactive, suspended) is the same 404. Posts
 * are listed only to a signed-in viewer (`viewer`, OQ-5); the public route passes null.
 */
@Injectable()
export class PublicProfileService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
  ) {}

  async profile(userId: string, viewer: Ctx | null): Promise<PerformancePublicProfile> {
    const pupil = (await this.directory.users([userId])).get(userId)
    if (!pupil || !pupil.isStudent || !pupil.isActive || pupil.isSuspended === true) throw ApiError.of('NOT_FOUND')

    const [g, totals, days, posts] = await Promise.all([
      this.ports.gamification.profile(userId),
      this.ports.practice.userTotals({ userIds: [userId] }),
      this.ports.practice.practiceDays(userId),
      viewer ? this.ports.timeline.postsOf(userId) : Promise.resolve([] as TimelinePostView[]),
    ])
    const t = totals.find((x) => x.userId === userId)
    const now = this.clock.now()
    const joined = pupil.createdAt ?? now
    const tier = g?.tier
    return {
      id: pupil.id,
      name: firstNameOf(pupil.name),
      firstName: firstNameOf(pupil.name),
      schoolName: null,
      levelName: pupil.levelName ?? '',
      joinedAt: toMytTimestamp(joined),
      daysWith: Math.max(0, Math.floor((now.getTime() - joined.getTime()) / DAY_MS)),
      tier: {
        key: tier?.key ?? '',
        name: tier?.name ?? '',
        emoji: tier?.emoji ?? '',
        level: g?.level ?? 1,
        ordinal: tier?.ordinal ?? 1,
        progressPct: tier?.progressPct ?? 0,
        toNext: tier?.toNext ?? null,
        nextName: tier?.nextName ?? null,
        nextKey: tier?.nextKey ?? null,
      },
      syiling: g?.syiling ?? 0,
      streak: { current: g?.streak.current ?? 0, best: g?.streak.best ?? 0 },
      accuracy: accuracyOf(t?.correct ?? 0, t?.questions ?? 0),
      activity: { sessions: t?.sessions ?? 0, practiceDays: days.length, correct: t?.correct ?? 0, bestStreak: g?.streak.best ?? 0 },
      posts: posts.map(toWirePost),
    }
  }
}
