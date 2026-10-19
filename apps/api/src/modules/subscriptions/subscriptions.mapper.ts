

import type { SchoolPackage, SubscriptionDetail, SubscriptionListItem, SubscriptionSchool } from './subscriptions.types'
import { toMytTimestamp } from '../../common/time/myt'
import type { SchoolRow } from '../schools'
import { dayTimestamp } from './dates'
import type { PackageRow, SubscriptionRecord } from './subscriptions.repository'

/** BR-25: the share of the quota used, whole percent, at most 100. */
export function usedPercent(used: number, quota: number): number {
  return quota > 0 ? Math.min(100, Math.round((used * 100) / quota)) : 0
}

/** The wire schema wants a non-empty type and state; an unknown one (migrated school) is shown as "-". */
const orDash = (v: string | null): string => (v === null || v === '' ? '-' : v)

export function toSchool(s: SchoolRow): SubscriptionSchool {
  return {
    id: s.id,
    name: s.name,
    code: s.code ?? '',
    type: orDash(s.type),
    state: orDash(s.state),
    district: s.district,
    city: s.city,
  }
}

export function toPackageWire(p: PackageRow): SchoolPackage {
  return {
    id: p.id,
    code: p.code as SchoolPackage['code'],
    name: p.name,
    slug: p.slug,
    educationLevel: p.educationLevel as SchoolPackage['educationLevel'],
    formLevel: p.formLevel as SchoolPackage['formLevel'],
    priceAnnual: p.priceAnnual,
    maxRenewals: p.maxRenewals,
    isActive: p.isActive,
  }
}

export function toDetail(row: SubscriptionRecord, school: SchoolRow, pkg: PackageRow, used: number): SubscriptionDetail {
  const quota = row.studentQuota
  return {
    id: row.id,
    schoolId: row.schoolId,
    schoolPackageId: row.schoolPackageId,
    packageTier: row.packageTier,
    studentQuota: quota,
    used,
    status: row.status,
    startsAt: dayTimestamp(row.startsOn),
    endsAt: dayTimestamp(row.endsOn),
    questionLimit: row.questionLimit,
    paymentReference: row.paymentReference,
    paymentNotes: row.paymentNotes,
    notes: row.notes,
    createdAt: toMytTimestamp(row.createdAt),
    updatedAt: toMytTimestamp(row.updatedAt),
    formLevel: pkg.formLevel as SubscriptionDetail['formLevel'],
    remaining: Math.max(0, quota - used),
    usedPercent: usedPercent(used, quota),
    school: toSchool(school),
    package: toPackageWire(pkg),
  }
}

export function toListItem(row: SubscriptionRecord, school: SchoolRow, pkg: PackageRow, used: number): SubscriptionListItem {
  return {
    id: row.id,
    school: { id: school.id, name: school.name, code: school.code ?? '' },
    formLevel: pkg.formLevel as SubscriptionListItem['formLevel'],
    packageTier: row.packageTier,
    used,
    studentQuota: row.studentQuota,
    status: row.status,
    startsAt: dayTimestamp(row.startsOn),
    endsAt: dayTimestamp(row.endsOn),
  }
}
