/**
 * School subscription transform (BE-28, v2-data-migration.md 4.1; OD-22 decided by the lead 2026-10-20:
 * the .cloud `quota` is the v2 `student_quota`, `question_limit` stays null).
 */
import { SUBSCRIPTION_TIER_MAP, SUBSCRIPTION_TIER_SOURCE_CODES, packageCodeFor } from './enums'
import { enumKey, integer, ok, reject, stamps, text, type Outcome, type Staged } from './common'

export interface SubscriptionValues {
  school_id: string
  school_package_id: string
  package_tier: 'basic' | 'full'
  student_quota: number
  status: 'active' | 'expired'
  starts_on: string
  ends_on: string
  created_at: string
  updated_at: string
}

/** A date column staged as text (`YYYY-MM-DD`, possibly followed by a time); null when it is not a real date. */
export function dateOnly(value: string | null | undefined): string | null {
  const t = text(value)
  const m = t === null ? null : /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(t)
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}` ? null : `${m[1]}-${m[2]}-${m[3]}`
}

export interface SubscriptionContext {
  /** v2 school id; `undefined` = set but not loaded. */
  schoolId: string | null | undefined
  schoolType: string | null
  /** `school_packages.code` -> id of the reference rows. */
  packageIds: ReadonlyMap<string, string>
  /** The run date (`YYYY-MM-DD`): a subscription that ended before it is `expired`. */
  asOf: string
}

export function transformSubscription(row: Staged, ctx: SubscriptionContext): Outcome<SubscriptionValues> {
  if (!ctx.schoolId) return reject('ORPHAN_PARENT', 'school_id')
  const tierKey = enumKey(row.package)
  const tier = tierKey === null ? undefined : SUBSCRIPTION_TIER_MAP[tierKey]
  if (tier === undefined) {
    return reject('UNKNOWN_ENUM', 'package', { enumValue: row.package ?? '', allowedCodes: SUBSCRIPTION_TIER_SOURCE_CODES })
  }
  const quota = integer(row.quota)
  if (quota === null || quota === 'invalid' || quota < 1) return reject('INVALID_VALUE', 'quota')
  const startsOn = dateOnly(row.starts_at)
  const endsOn = dateOnly(row.ends_at)
  if (startsOn === null) return reject('INVALID_VALUE', 'starts_at')
  if (endsOn === null || endsOn < startsOn) return reject('INVALID_VALUE', 'ends_at')
  const code = packageCodeFor(ctx.schoolType)
  const packageId = code === null ? undefined : ctx.packageIds.get(code)
  if (packageId === undefined) return reject('UNSUPPORTED', 'school_package_id')
  return ok({
    school_id: ctx.schoolId,
    school_package_id: packageId,
    package_tier: tier,
    student_quota: quota,
    status: endsOn < ctx.asOf ? 'expired' : 'active',
    starts_on: startsOn,
    ends_on: endsOn,
    ...stamps(row),
  })
}
