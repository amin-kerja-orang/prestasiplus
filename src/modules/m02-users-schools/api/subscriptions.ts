/**
 * M02 school subscription endpoints (SRS v1.28 §7 #29–#37, #42; build-plan M02-T3): S12 list, S13
 * create (with the package cards, #30), S14 detail (quota, extend, upgrade, cancel, student list) and
 * S15 standalone renewal invoice. Every call needs an admin session (`AD`). UI tasks read this file and
 * do not change it (build-plan §S.3 rule 5).
 *
 * Mutations resolve to `{data, status}` (`status` = the flash text, UNVERIFIED COPY §8). `data` is the
 * full `SubscriptionDetail` (a superset of DATA-M02-07 `SchoolSubscription`), so S14 can re-render from it.
 * Dates are ISO 8601 with the +08:00 offset; the screen formats them (BR-33).
 */

import { api, type ListResult } from '@/api'

import type { SchoolSummary } from './schools'

/** BR-23. */
export type SubscriptionStatus = 'active' | 'grace' | 'expired' | 'cancelled'

/** BR-22: `basic` "Pemantauan" (free, 500 questions/month), `full` "Penuh" (unlimited, RM30 per student per year). */
export type PackageTier = 'basic' | 'full'

/** DATA-M02-06 `formLevel`; the badge shows it upper-case ("T5", "D1_D6"). */
export type SchoolFormLevel = 't4' | 't5' | 'd1_d6' | 't1_t3'

/** DATA-M02-06 (#30). */
export interface SchoolPackage {
  id: number
  code: 'T4' | 'T5' | 'D1_D6' | 'T1_T3'
  name: string
  slug: string
  educationLevel: 'spm' | 'primary' | 'lower_secondary'
  formLevel: SchoolFormLevel
  /** Decimal string, e.g. "30.00". */
  priceAnnual: string
  /** Term years = `maxRenewals + 1` (FR-M02-85). */
  maxRenewals: number
  isActive: boolean
}

/** #29 row. */
export interface SubscriptionListItem {
  id: number
  school: { id: number; name: string; code: string }
  formLevel: SchoolFormLevel
  packageTier: PackageTier
  /** BR-24: students of the school, active and inactive. */
  used: number
  studentQuota: number
  status: SubscriptionStatus
  startsAt: string
  endsAt: string
}

/** `meta.counts` of #29: over all subscriptions, not the filters; `totalQuota` = active rows only (FR-M02-82). */
export interface SubscriptionCounts extends Record<string, number> {
  active: number
  grace: number
  expired: number
  totalQuota: number
}

export interface SubscriptionListMeta {
  counts: SubscriptionCounts
}

export interface SubscriptionListQuery {
  search?: string | null
  status?: SubscriptionStatus | '' | null
  formLevel?: SchoolFormLevel | '' | null
  signal?: AbortSignal
}

/** DATA-M02-07 plus the derived `used` (BR-24). */
export interface SchoolSubscription {
  id: number
  schoolId: number
  schoolPackageId: number
  packageTier: PackageTier
  studentQuota: number
  used: number
  status: SubscriptionStatus
  startsAt: string
  endsAt: string
  /** 500 for `basic` (DV-M02-08); `null` = unlimited. */
  questionLimit: number | null
  paymentReference: string | null
  paymentNotes: string | null
  /** History text shown as "Nota:". */
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** #32 and every mutation result: the subscription with its school and package (S14). */
export interface SubscriptionDetail extends SchoolSubscription {
  formLevel: SchoolFormLevel
  /** max(0, quota − used) (BR-25). */
  remaining: number
  /** min(100, round(used × 100 / quota)) (BR-25). */
  usedPercent: number
  school: SchoolSummary
  package: SchoolPackage
}

export interface SubscriptionMutation {
  data: SubscriptionDetail
  status: string
}

/** #31 body. */
export interface CreateSubscriptionInput {
  schoolId: number | null
  packageTier: PackageTier
  schoolPackageId: number | null
  studentQuota: number
  paymentReference?: string | null
  paymentNotes?: string | null
}

/** #33 allowed page sizes (S14 "Tunjuk"); anything else answers 50 (DV-M02-11). */
export const SUBSCRIPTION_PER_PAGE_OPTIONS = [25, 50, 100, 200] as const

/** #33 row. */
export interface SubscriptionStudent {
  id: number
  name: string
  idDelima: string | null
  classLevel: string | null
}

export interface SubscriptionStudentsQuery {
  perPage?: number | null
  page?: number | null
  signal?: AbortSignal
}

/** #42 (DATA-M02-12). Money is a decimal string ("30.00", "23280.00"); the screen prefixes "RM". */
export interface RenewalInvoice {
  /** "INV-{subscription id}-{yyyymmdd of today}". */
  ref: string
  /** Today, ISO 8601. */
  date: string
  school: SchoolSummary
  packageName: string
  currentPeriod: { start: string; end: string }
  /** `endsAt` → `endsAt` + 1 year (BR-30). */
  renewalPeriod: { start: string; end: string }
  students: { no: number; name: string; idDelima: string | null; classLevel: string | null }[]
  studentCount: number
  pricePerStudent: string
  total: string
}

const base = '/api/admin/school-subscriptions'
const at = (id: number): string => `${base}/${String(id)}`

/** #29 `GET /api/admin/school-subscriptions`: all rows, newest first, not paginated. */
export function fetchSubscriptions(
  query: SubscriptionListQuery = {},
): Promise<ListResult<SubscriptionListItem, SubscriptionListMeta>> {
  return api.list<SubscriptionListItem, SubscriptionListMeta>(base, {
    query: {
      search: query.search || null,
      status: query.status || null,
      formLevel: query.formLevel || null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #30 `GET /api/admin/school-packages`: the 4 packages (S13 "Tingkatan" cards). */
export function fetchSchoolPackages(
  options: { signal?: AbortSignal } = {},
): Promise<SchoolPackage[]> {
  return api.get<SchoolPackage[]>(
    '/api/admin/school-packages',
    options.signal ? { signal: options.signal } : {},
  )
}

/** #31 `POST /api/admin/school-subscriptions` (201; 422 with `fields`). */
export function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionMutation> {
  return api.post<SubscriptionMutation>(base, { body: input, raw: true })
}

/** #32 `GET /api/admin/school-subscriptions/:id` (404). */
export function fetchSubscription(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<SubscriptionDetail> {
  return api.get<SubscriptionDetail>(at(id), options.signal ? { signal: options.signal } : {})
}

/** #33 `GET …/:id/students`: `meta.pageSize` is the page size actually used (DV-M02-11). */
export function fetchSubscriptionStudents(
  id: number,
  query: SubscriptionStudentsQuery = {},
): Promise<ListResult<SubscriptionStudent>> {
  return api.list<SubscriptionStudent>(`${at(id)}/students`, {
    query: { perPage: query.perPage ?? null, page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #34 `PUT …/:id/quota` (422 outside 1–2000). `notes` = the optional reason. */
export function updateSubscriptionQuota(
  id: number,
  input: { studentQuota: number; notes?: string | null },
): Promise<SubscriptionMutation> {
  return api.put<SubscriptionMutation>(`${at(id)}/quota`, { body: input, raw: true })
}

/** #35 `POST …/:id/extend` (422 unless `days` is 1–365). */
export function extendSubscription(
  id: number,
  input: { days: number; reason?: string | null },
): Promise<SubscriptionMutation> {
  return api.post<SubscriptionMutation>(`${at(id)}/extend`, { body: input, raw: true })
}

/** #36 `POST …/:id/upgrade` (422 unless the tier is `basic`). */
export function upgradeSubscription(
  id: number,
  input: { paymentReference?: string | null; paymentNotes?: string | null } = {},
): Promise<SubscriptionMutation> {
  return api.post<SubscriptionMutation>(`${at(id)}/upgrade`, { body: input, raw: true })
}

/** #37 `POST …/:id/cancel` (422 when already cancelled). */
export function cancelSubscription(id: number): Promise<SubscriptionMutation> {
  return api.post<SubscriptionMutation>(`${at(id)}/cancel`, { raw: true })
}

/** #42 `GET …/:id/renewal-invoice` (S15, standalone page). */
export function fetchRenewalInvoice(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<RenewalInvoice> {
  return api.get<RenewalInvoice>(
    `${at(id)}/renewal-invoice`,
    options.signal ? { signal: options.signal } : {},
  )
}
