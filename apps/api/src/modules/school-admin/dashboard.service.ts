import { Inject, Injectable } from '@nestjs/common'
import { SCHOOL_ADMIN_ROLE_LABEL, type SchoolAdminDashboard, type SchoolAdminSubscriptionStatus } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { isOverloadError } from '../auth/auth.errors'
import { PerutusanRepository } from '../content/perutusan'
import { AUTHOR_ROLE_LABELS } from '../content/perutusan/perutusan.constants'
import { initialsOf } from '../content/perutusan/perutusan.service'
import { SchoolsRepository } from '../schools'
import { SubscriptionsRepository } from '../subscriptions'
import { mytDay } from '../subscriptions/dates'
import { UsersRepository } from '../users'
import type { Caller } from '../users/caller'
import { performanceBlock } from './dashboard.mapper'
import { DASHBOARD_PERUTUSAN_LIMIT } from './school-admin.constants'
import {
  SCHOOL_CLASS_COUNT_PORT,
  SCHOOL_PERFORMANCE_PORT,
  type SchoolClassCountPort,
  type SchoolPerformanceCtx,
  type SchoolPerformancePort,
} from './school-admin.ports'

/** Badge wording of the dashboard (mock `SUBSCRIPTION_LABEL`). */
export const SUBSCRIPTION_LABEL: Readonly<Record<SchoolAdminSubscriptionStatus, string>> = {
  none: 'Belum Ada',
  active: 'Aktif',
  grace: 'Tempoh Ihsan',
  expired: 'Tamat',
}

interface SubscriptionFacts {
  status: string
  startsOn: string
  endsOn: string
}

/**
 * BR-M27-14 (mock `currentSubscriptionStatus`): the `active` row whose period contains today, else `grace`, else `expired`
 * (an `active` row that has lapsed counts as expired); a `cancelled` row is not current; none gives `none`.
 */
export function currentSubscriptionStatus(rows: readonly SubscriptionFacts[], today: string): SchoolAdminSubscriptionStatus {
  if (rows.some((r) => r.status === 'active' && r.startsOn <= today && today <= r.endsOn)) return 'active'
  if (rows.some((r) => r.status === 'grace')) return 'grace'
  if (rows.some((r) => r.status === 'expired' || (r.status === 'active' && r.endsOn < today))) return 'expired'
  return 'none'
}

/** The school dashboard (M27 S0) of the school admin's own school. */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(PerutusanRepository) private readonly perutusan: PerutusanRepository,
    @Inject(SubscriptionsRepository) private readonly subscriptions: SubscriptionsRepository,
    @Inject(SCHOOL_PERFORMANCE_PORT) private readonly performance: SchoolPerformancePort,
    @Inject(SCHOOL_CLASS_COUNT_PORT) private readonly classes: SchoolClassCountPort,
  ) {}

  /**
   * `caller` is a school admin with a school (the controller checks). Nothing in the request chooses the school. No pupil name
   * is read or returned; the Bijak figures are BE-19's, k-cohort suppressed by the mapper.
   */
  async dashboard(caller: Caller, schoolId: string, perf: SchoolPerformanceCtx): Promise<SchoolAdminDashboard> {
    try {
      return await this.build(caller, schoolId, perf)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }

  private async build(caller: Caller, schoolId: string, perf: SchoolPerformanceCtx): Promise<SchoolAdminDashboard> {
    const now = this.clock.now()
    const school = await this.schools.get(schoolId)
    if (!school) throw ApiError.of('FORBIDDEN') // a school admin whose school vanished: fail closed
    const [counts, posts, subs, view, activeClasses] = await Promise.all([
      this.schools.memberCounts([schoolId]),
      this.perutusan.feed({ userId: caller.userId, isAdmin: false, schoolId }, now),
      this.subscriptions.list(caller, {}),
      this.performance.school(perf),
      this.classes.activeClasses(schoolId),
    ])
    const shown = posts.slice(0, DASHBOARD_PERUTUSAN_LIMIT)
    const authors = new Map<string, Awaited<ReturnType<UsersRepository['get']>>>()
    for (const id of new Set(shown.map((p) => p.authorId))) authors.set(id, await this.users.get(id))
    const status = currentSubscriptionStatus(subs.rows, mytDay(now))
    const member = counts.get(schoolId)

    return {
      school: {
        id: school.id,
        name: school.name,
        state: school.state ?? '',
        ppd: school.district && school.district !== '' ? school.district : null,
        code: school.code && school.code !== '' ? school.code : null,
      },
      roleLabel: SCHOOL_ADMIN_ROLE_LABEL,
      perutusan: shown.map((p) => {
        const author = authors.get(p.authorId) ?? null
        const role = author?.roles.find((r) => r in AUTHOR_ROLE_LABELS)
        return {
          id: p.id,
          title: p.title,
          createdAt: toMytTimestamp(p.createdAt),
          author: { initials: initialsOf(author?.name ?? ''), roleLabel: role ? (AUTHOR_ROLE_LABELS[role] as string) : '' },
        }
      }),
      cards: {
        pupils: member?.studentCount ?? 0,
        teachers: member?.teacherCount ?? 0,
        activeClasses,
        subscription: { status, label: SUBSCRIPTION_LABEL[status] },
      },
      performance: performanceBlock(view),
    }
  }
}
