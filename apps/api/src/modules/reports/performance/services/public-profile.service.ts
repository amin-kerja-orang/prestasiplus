import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { firstNameOf } from '../domain/ranking'
import { accuracyOf } from '../domain/rules'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort, type TimelinePostView } from '../ports'
import type { PerformancePublicProfile, PerformanceTimelinePost } from './types'

const DAY_MS = 86_400_000

/**
 * Uniform response-time floor of the anonymous profile (security L5): an unknown id returns before any query
 * while a valid pupil runs 3, so every outcome (200 or the 404) is held until this many ms after the start,
 * with a timer (no CPU), the way the login failure floor is held. Not an env key: it only needs to exceed the
 * slowest normal answer.
 */
export const PUBLIC_PROFILE_FLOOR_MS = 150

async function holdUntil(started: number, floorMs: number): Promise<void> {
  const wait = floorMs - (performance.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

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
 * school is null, and every refusal (unknown id, not a student, inactive, suspended) is the same 404, after
 * the same response-time floor as a found profile. The route is anonymous, so `posts` is always [] (OQ-5):
 * timeline posts are read through the signed-in `GET /timeline` only. Mod Pelajar data is excluded in the
 * practice and gamification adapters (users have no `is_test` column).
 */
@Injectable()
export class PublicProfileService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
    @Inject(CLOCK) protected readonly clock: Clock,
  ) {}

  async profile(userId: string): Promise<PerformancePublicProfile> {
    const started = performance.now()
    try {
      return await this.load(userId)
    } finally {
      await holdUntil(started, PUBLIC_PROFILE_FLOOR_MS)
    }
  }

  private async load(userId: string): Promise<PerformancePublicProfile> {
    const pupil = (await this.directory.users([userId])).get(userId)
    if (!pupil || !pupil.isStudent || !pupil.isActive || pupil.isSuspended === true) throw ApiError.of('NOT_FOUND')

    const [g, totals, days] = await Promise.all([
      this.ports.gamification.profile(userId),
      this.ports.practice.userTotals({ userIds: [userId] }),
      this.ports.practice.practiceDays(userId),
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
      posts: [],
    }
  }
}
