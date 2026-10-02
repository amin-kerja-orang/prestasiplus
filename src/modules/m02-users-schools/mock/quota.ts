/**
 * The school student quota (SRS v1.28 BR-16, BR-24, BR-25; §7 #14; used by the S5 DELIMa import,
 * BR-15).
 *
 * - `hasSubscription` = the school has a subscription with status `active` (INFERRED: or `grace`);
 * - `quota` = the `studentQuota` of the latest such subscription (latest `startsAt`, then id);
 * - `used` = the users with role `student` at the school, **active and inactive** (DV-M02-15);
 * - `remaining` = max(0, quota − used).
 *
 * **Seam with M02-T3 (XR-M02-T2-01).** The `SchoolSubscription` table belongs to M02-T3. Until it
 * exists this module reads subscriptions through `setSubscriptionSource`: M02-T3 registers a
 * function over its `schoolSubscriptions` repository once (module load or plugin seed). With no
 * source registered no school has a subscription, so an import is refused (BR-15).
 */

import { users } from '@/modules/m01-authentication/mock'

export type QuotaSubscriptionStatus = 'active' | 'grace' | 'expired' | 'cancelled'

/** The fields of a `SchoolSubscription` (DATA-M02-06) the quota rules read. */
export interface QuotaSubscription {
  id: number
  schoolId: number
  status: QuotaSubscriptionStatus
  studentQuota: number
  /** ISO 8601. */
  startsAt: string
}

export type SubscriptionSource = (schoolId: number) => readonly QuotaSubscription[]

const NO_SUBSCRIPTIONS: SubscriptionSource = () => []

let source: SubscriptionSource = NO_SUBSCRIPTIONS

/** Registers the reader of the M02-T3 subscriptions store (`null` restores "none", for tests). */
export function setSubscriptionSource(next: SubscriptionSource | null): void {
  source = next ?? NO_SUBSCRIPTIONS
}

export interface SchoolQuota {
  hasSubscription: boolean
  quota?: number
  used?: number
  remaining?: number
}

/** BR-24: every student of the school, active or not. */
export function studentsAt(schoolId: number): number {
  return users.countWhere({ role: 'student', schoolId })
}

/** The subscription that grants the quota: latest active (or grace) one. */
function grantingSubscription(schoolId: number): QuotaSubscription | undefined {
  return source(schoolId)
    .filter((s) => s.status === 'active' || s.status === 'grace')
    .reduce<QuotaSubscription | undefined>((best, s) => {
      if (!best) return s
      const a = Date.parse(s.startsAt)
      const b = Date.parse(best.startsAt)
      return a > b || (a === b && s.id > best.id) ? s : best
    }, undefined)
}

/** §7 #14 payload of `schoolId` (the school must exist; the caller checks). */
export function schoolQuota(schoolId: number): SchoolQuota {
  const sub = grantingSubscription(schoolId)
  if (!sub) return { hasSubscription: false }
  const used = studentsAt(schoolId)
  return {
    hasSubscription: true,
    quota: sub.studentQuota,
    used,
    remaining: Math.max(0, sub.studentQuota - used),
  }
}
