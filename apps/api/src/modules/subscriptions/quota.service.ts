import { Inject, Injectable } from '@nestjs/common'


import type { SchoolQuota } from './subscriptions.types'
import { SchoolsRepository } from '../schools'
import { notFound } from './subscriptions.errors'
import { SubscriptionsRepository } from './subscriptions.repository'

export interface QuotaFigures {
  quota: number
  used: number
  remaining: number
}

/**
 * The school student quota (mock `quota.ts`, BR-16, BR-24, BR-25):
 * - quota is `studentQuota` of the latest `active` (or `grace`) subscription, latest `starts_on`
 *   then id; a row with no student quota (migrated, OD-22) grants nothing;
 * - `used` counts the school's students, active and inactive;
 * - `remaining` is max(0, quota - used).
 * Read-only; `StudentImportService` reads it again under its lock before it inserts.
 */
@Injectable()
export class QuotaService {
  constructor(
    @Inject(SubscriptionsRepository) private readonly subscriptions: SubscriptionsRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
  ) {}

  /** Null when the school has no subscription that grants a quota. The school must exist. */
  async figures(schoolId: string): Promise<QuotaFigures | null> {
    const source = await this.subscriptions.quotaSource(schoolId)
    if (!source || source.studentQuota === null) return null
    const used = (await this.schools.memberCounts([schoolId])).get(schoolId)?.studentCount ?? 0
    return { quota: source.studentQuota, used, remaining: Math.max(0, source.studentQuota - used) }
  }

  /** `GET /admin/schools/:id/quota`: 404 for an unknown school. */
  async ofSchool(schoolId: string): Promise<SchoolQuota> {
    if (!(await this.schools.exists(schoolId))) throw notFound()
    const f = await this.figures(schoolId)
    return f ? { hasSubscription: true, ...f } : { hasSubscription: false }
  }
}
