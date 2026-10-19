/**
 * M02 school subscriptions, packages and the renewal invoice (SRS v1.28 §7 #29–#37, #42; BR-22…BR-31,
 * FR-M02-82…97). All admin-only (`AD`): a guest gets `401`, any other role `403` (FR-M02-99).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 29 | `GET /api/admin/school-subscriptions?search=&status=&formLevel=` | all rows, newest first (id desc), not paginated; `meta.counts` over all rows, `totalQuota` = active rows only |
 * | 30 | `GET /api/admin/school-packages` | the 4 packages |
 * | 31 | `POST /api/admin/school-subscriptions` | BR-31; 201 |
 * | 32 | `GET …/:id` | subscription + school + package; 404 |
 * | 33 | `GET …/:id/students?perPage=&page=` | 25 / 50 / 100 / 200, 50 by default (DV-M02-11); `meta.pageSize` = the size used |
 * | 34 | `PUT …/:id/quota` | BR-26 |
 * | 35 | `POST …/:id/extend` | BR-28 |
 * | 36 | `POST …/:id/upgrade` | BR-27; 422 unless `basic` |
 * | 37 | `POST …/:id/cancel` | BR-29; 422 when already cancelled |
 * | 42 | `GET …/:id/renewal-invoice` | BR-30 |
 *
 * INFERRED (SRS §5 / §8 "UNVERIFIED COPY"): the success and refusal texts, the format of the history lines
 * appended to `notes` (BR-26 / BR-28: `[Kuota 1000 → 1200 pada 25/09/2026 15:40] {reason}`, only when a
 * reason is given; one line per entry, joined with a newline; BR-27's upgrade line is observed), that
 * quota / extend / upgrade / cancel also work on `expired`, `grace` and `cancelled` subscriptions
 * (FR-M02-91: same action card), that extending never re-activates a `cancelled` subscription, that a school
 * may hold several subscriptions (live has two rows at 8277 and 8880), an unknown status / form-level
 * filter matching nothing, and an unknown `perPage` answering 50.
 */

import { formatDateCompact, formatDateTime, toIsoMyt } from '@/lib/time'
import {
  created,
  int,
  max,
  min,
  notFound,
  ok,
  oneOf,
  paginate,
  pageParams,
  queryInt,
  queryString,
  required,
  requireRole,
  route,
  rule,
  unpaged,
  validate,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import {
  SUBSCRIPTION_PER_PAGE_OPTIONS,
  type PackageTier,
  type RenewalInvoice,
  type SchoolPackage,
  type SubscriptionDetail,
  type SubscriptionListItem,
} from '../../api/subscriptions'
import type { SchoolSummary } from '../../api/schools'
import { studentsAt } from '../quota'
import { schoolsRepo } from '../repository/schools'
import {
  addMonthsMyt,
  schoolPackagesRepo,
  schoolSubscriptionsRepo,
  type SchoolSubscriptionRow,
} from '../repository/subscriptions'
import { bodyOf, intOrNull, textOrNull } from './users-input'

/** DV-M02-07 (live allowed 5000). */
export const SUBSCRIPTION_QUOTA_MIN = 1
export const SUBSCRIPTION_QUOTA_MAX = 2000
/** FR-M02-95. */
export const EXTEND_DAYS_MIN = 1
export const EXTEND_DAYS_MAX = 365
/** DV-M02-11: the page size of S14 when `per_page` is absent or unknown. */
export const SUBSCRIPTION_DEFAULT_PER_PAGE = 50

// UNVERIFIED COPY (§8): placeholders until the live copy is verified.
export const MSG_SUBSCRIPTION_CREATED = 'Langganan berjaya dicipta.'
export const MSG_QUOTA_UPDATED = 'Kuota berjaya dikemaskini.'
export const MSG_EXTENDED = 'Tempoh langganan berjaya dilanjutkan.'
export const MSG_UPGRADED = 'Langganan berjaya dinaik taraf.'
export const MSG_CANCELLED = 'Langganan berjaya dibatalkan.'
// INFERRED refusals.
export const MSG_NOT_BASIC = 'Hanya langganan Pemantauan boleh dinaik taraf.'
export const MSG_ALREADY_CANCELLED = 'Langganan ini sudah dibatalkan.'

const adminOnly = requireRole('admin')

const idOf = (req: MockRequest): number => Number(req.params.id)

const DAY_MS = 86_400_000

/** A quota typed into a form arrives as text; the rules see the number. */
const integerRule = () =>
  rule('integer', (value) =>
    typeof value === 'number' && Number.isInteger(value)
      ? null
      : 'The :attribute field must be an integer.',
  )

const quotaRules = () => [
  required(),
  integerRule(),
  min(SUBSCRIPTION_QUOTA_MIN),
  max(SUBSCRIPTION_QUOTA_MAX),
]

const optionalText = () =>
  rule('string', (value) =>
    value === null || value === undefined || typeof value === 'string'
      ? null
      : 'The :attribute field must be a string.',
  )

function pkgOf(row: SchoolSubscriptionRow): SchoolPackage {
  const pkg = schoolPackagesRepo.get(row.schoolPackageId)
  if (!pkg)
    throw new Error(
      `subscription ${String(row.id)}: package ${String(row.schoolPackageId)} is missing`,
    )
  return pkg
}

function schoolOf(schoolId: number): SchoolSummary {
  const school = schoolsRepo.summary(schoolId)
  if (!school) throw new Error(`subscription: school ${String(schoolId)} is missing`)
  return school
}

/** BR-25. */
export function usedPercent(used: number, quota: number): number {
  return quota > 0 ? Math.min(100, Math.round((used * 100) / quota)) : 0
}

/** The S14 record and every mutation result. `used` is computed from the users store (BR-24). */
export function toDetail(row: SchoolSubscriptionRow): SubscriptionDetail {
  const pkg = pkgOf(row)
  const used = studentsAt(row.schoolId)
  return {
    id: row.id,
    schoolId: row.schoolId,
    schoolPackageId: row.schoolPackageId,
    packageTier: row.packageTier,
    studentQuota: row.studentQuota,
    used,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    questionLimit: row.questionLimit,
    paymentReference: row.paymentReference,
    paymentNotes: row.paymentNotes,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    formLevel: pkg.formLevel,
    remaining: Math.max(0, row.studentQuota - used),
    usedPercent: usedPercent(used, row.studentQuota),
    school: schoolOf(row.schoolId),
    package: pkg,
  }
}

function toListItem(row: SchoolSubscriptionRow): SubscriptionListItem {
  const school = schoolOf(row.schoolId)
  return {
    id: row.id,
    school: { id: school.id, name: school.name, code: school.code },
    formLevel: pkgOf(row).formLevel,
    packageTier: row.packageTier,
    used: studentsAt(row.schoolId),
    studentQuota: row.studentQuota,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  }
}

/** Appends a history line to `notes` (one line per entry). */
function appendNote(current: string | null, line: string): string {
  return current === null || current === '' ? line : `${current}\n${line}`
}

/** The line of a quota / extend entry, only when the admin gave a reason (INFERRED format). */
function reasonLine(prefix: string, reason: string | null): string | null {
  return reason === null ? null : `[${prefix}] ${reason}`
}

// --- #29 ---------------------------------------------------------------------------------------------

function listSubscriptions(req: MockRequest): MockResponse {
  const all = schoolSubscriptionsRepo.all()
  const counts = {
    active: 0,
    grace: 0,
    expired: 0,
    totalQuota: 0,
  }
  for (const row of all) {
    if (row.status === 'active') {
      counts.active++
      counts.totalQuota += row.studentQuota
    } else if (row.status === 'grace') counts.grace++
    else if (row.status === 'expired') counts.expired++
  }

  const term = (queryString(req.query, 'search') ?? '').trim().toLowerCase()
  const status = (queryString(req.query, 'status') ?? '').trim()
  const formLevel = (queryString(req.query, 'formLevel') ?? '').trim()
  const rows = all
    .filter((row) => {
      if (status !== '' && row.status !== status) return false
      if (formLevel !== '' && pkgOf(row).formLevel !== formLevel) return false
      if (term === '') return true
      const school = schoolOf(row.schoolId)
      return school.name.toLowerCase().includes(term) || school.code.toLowerCase().includes(term)
    })
    .map(toListItem)
  return unpaged(rows, { counts })
}

// --- #30 ---------------------------------------------------------------------------------------------

function listPackages(): MockResponse {
  return ok(schoolPackagesRepo.all())
}

// --- #31 ---------------------------------------------------------------------------------------------

function createSubscription(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const input = {
    ...body,
    schoolId: intOrNull(body.schoolId) ?? body.schoolId,
    schoolPackageId: intOrNull(body.schoolPackageId) ?? body.schoolPackageId,
    studentQuota: intOrNull(body.studentQuota) ?? body.studentQuota,
  }
  const invalid = validate(input, {
    schoolId: [
      required(),
      rule('exists', (value) => {
        const school = typeof value === 'number' ? schoolsRepo.get(value) : undefined
        return school?.isActive === true ? null : 'The selected :attribute is invalid.'
      }),
    ],
    packageTier: [required(), oneOf(['basic', 'full'])],
    schoolPackageId: [
      required(),
      rule('exists', (value) =>
        typeof value === 'number' && schoolPackagesRepo.get(value) !== undefined
          ? null
          : 'The selected :attribute is invalid.',
      ),
    ],
    studentQuota: quotaRules(),
    paymentReference: [optionalText()],
    paymentNotes: [optionalText()],
  })
  if (invalid) return invalid
  const row = schoolSubscriptionsRepo.create(
    {
      schoolId: Number(input.schoolId),
      schoolPackageId: Number(input.schoolPackageId),
      packageTier: body.packageTier as PackageTier,
      studentQuota: Number(input.studentQuota),
      paymentReference: textOrNull(body.paymentReference),
      paymentNotes: textOrNull(body.paymentNotes),
    },
    ctx.clock.now(),
  )
  return created(toDetail(row), { status: MSG_SUBSCRIPTION_CREATED })
}

// --- #32 ---------------------------------------------------------------------------------------------

function getSubscription(req: MockRequest): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  return row ? ok(toDetail(row)) : notFound()
}

// --- #33 ---------------------------------------------------------------------------------------------

function subscriptionStudents(req: MockRequest): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  if (!row) return notFound()
  const asked = queryInt(req.query, 'perPage')
  const perPage = (SUBSCRIPTION_PER_PAGE_OPTIONS as readonly number[]).includes(asked ?? 0)
    ? (asked as number)
    : SUBSCRIPTION_DEFAULT_PER_PAGE
  const page = pageParams(req.query, { pageSize: perPage })
  return paginate(studentsOf(row.schoolId), page)
}

/** BR-24 / BR-30: every student of the school, active and inactive, by name. */
function studentsOf(schoolId: number) {
  return users
    .adminList({ role: 'student', schoolId, page: 1, pageSize: 100_000 })
    .rows.sort((a, b) => a.name.localeCompare(b.name, 'ms') || a.id - b.id)
    .map((u) => ({ id: u.id, name: u.name, idDelima: u.idDelima, classLevel: u.classLevel }))
}

// --- #34 ---------------------------------------------------------------------------------------------

function updateQuota(req: MockRequest, ctx: MockContext): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  if (!row) return notFound()
  const body = bodyOf(req)
  const input = { ...body, studentQuota: intOrNull(body.studentQuota) ?? body.studentQuota }
  const invalid = validate(input, { studentQuota: quotaRules(), notes: [optionalText()] })
  if (invalid) return invalid
  const now = ctx.clock.now()
  const quota = Number(input.studentQuota)
  const line = reasonLine(
    `Kuota ${String(row.studentQuota)} → ${String(quota)} pada ${formatDateTime(now)}`,
    textOrNull(body.notes),
  )
  const next = schoolSubscriptionsRepo.update(
    row.id,
    { studentQuota: quota, ...(line === null ? {} : { notes: appendNote(row.notes, line) }) },
    now,
  )
  return ok(toDetail(next), { status: MSG_QUOTA_UPDATED })
}

// --- #35 ---------------------------------------------------------------------------------------------

function extend(req: MockRequest, ctx: MockContext): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  if (!row) return notFound()
  const body = bodyOf(req)
  const input = { ...body, days: intOrNull(body.days) ?? body.days }
  const invalid = validate(input, {
    days: [required(), integerRule(), min(EXTEND_DAYS_MIN), max(EXTEND_DAYS_MAX)],
    reason: [optionalText()],
  })
  if (invalid) return invalid
  const now = ctx.clock.now()
  const days = Number(input.days)
  const endsAt = Date.parse(row.endsAt) + days * DAY_MS
  // BR-28: an expired / grace subscription whose new end lies in the future becomes active.
  const revive = (row.status === 'expired' || row.status === 'grace') && endsAt > now
  const line = reasonLine(
    `Dilanjutkan ${String(days)} hari pada ${formatDateTime(now)}`,
    textOrNull(body.reason),
  )
  const next = schoolSubscriptionsRepo.update(
    row.id,
    {
      endsAt: toIsoMyt(endsAt),
      ...(revive ? { status: 'active' as const } : {}),
      ...(line === null ? {} : { notes: appendNote(row.notes, line) }),
    },
    now,
  )
  return ok(toDetail(next), { status: MSG_EXTENDED })
}

// --- #36 ---------------------------------------------------------------------------------------------

function upgrade(req: MockRequest, ctx: MockContext): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  if (!row) return notFound()
  if (row.packageTier !== 'basic') return validationError({ packageTier: MSG_NOT_BASIC })
  const body = bodyOf(req)
  const invalid = validate(body, {
    paymentReference: [optionalText()],
    paymentNotes: [optionalText()],
  })
  if (invalid) return invalid
  const now = ctx.clock.now()
  const paymentReference = textOrNull(body.paymentReference)
  const paymentNotes = textOrNull(body.paymentNotes)
  const next = schoolSubscriptionsRepo.update(
    row.id,
    {
      packageTier: 'full',
      questionLimit: null,
      endsAt: toIsoMyt(addMonthsMyt(now, 12)),
      status: 'active',
      ...(paymentReference === null ? {} : { paymentReference }),
      ...(paymentNotes === null ? {} : { paymentNotes }),
      notes: appendNote(row.notes, `[Naik taraf Pemantauan → Penuh pada ${formatDateTime(now)}]`),
    },
    now,
  )
  return ok(toDetail(next), { status: MSG_UPGRADED })
}

// --- #37 ---------------------------------------------------------------------------------------------

function cancel(req: MockRequest, ctx: MockContext): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  if (!row) return notFound()
  if (row.status === 'cancelled') return validationError({ status: MSG_ALREADY_CANCELLED })
  const next = schoolSubscriptionsRepo.update(row.id, { status: 'cancelled' }, ctx.clock.now())
  return ok(toDetail(next), { status: MSG_CANCELLED })
}

// --- #42 ---------------------------------------------------------------------------------------------

/** Integer cents of a decimal string ("30.00" → 3000). */
function toCents(price: string): number {
  return Math.round(Number(price) * 100)
}

function fromCents(cents: number): string {
  return `${String(Math.trunc(cents / 100))}.${String(cents % 100).padStart(2, '0')}`
}

function renewalInvoice(req: MockRequest, ctx: MockContext): MockResponse {
  const row = schoolSubscriptionsRepo.get(idOf(req))
  if (!row) return notFound()
  const now = ctx.clock.now()
  const pkg = pkgOf(row)
  const list = studentsOf(row.schoolId)
  const data: RenewalInvoice = {
    ref: `INV-${String(row.id)}-${formatDateCompact(now)}`,
    date: toIsoMyt(now),
    school: schoolOf(row.schoolId),
    packageName: pkg.name,
    currentPeriod: { start: row.startsAt, end: row.endsAt },
    renewalPeriod: { start: row.endsAt, end: toIsoMyt(addMonthsMyt(Date.parse(row.endsAt), 12)) },
    students: list.map((s, i) => ({ no: i + 1, ...s })),
    studentCount: list.length,
    pricePerStudent: pkg.priceAnnual,
    // BR-30: the enrolled students, not the quota.
    total: fromCents(list.length * toCents(pkg.priceAnnual)),
  }
  return ok(data)
}

export const subscriptionRoutes: RouteDef[] = [
  route('GET', '/api/admin/school-subscriptions', [adminOnly], listSubscriptions),
  route('GET', '/api/admin/school-packages', [adminOnly], listPackages),
  route('POST', '/api/admin/school-subscriptions', [adminOnly], createSubscription),
  route('GET', '/api/admin/school-subscriptions/:id', [adminOnly], getSubscription, {
    params: { id: int() },
  }),
  route('GET', '/api/admin/school-subscriptions/:id/students', [adminOnly], subscriptionStudents, {
    params: { id: int() },
  }),
  route('PUT', '/api/admin/school-subscriptions/:id/quota', [adminOnly], updateQuota, {
    params: { id: int() },
  }),
  route('POST', '/api/admin/school-subscriptions/:id/extend', [adminOnly], extend, {
    params: { id: int() },
  }),
  route('POST', '/api/admin/school-subscriptions/:id/upgrade', [adminOnly], upgrade, {
    params: { id: int() },
  }),
  route('POST', '/api/admin/school-subscriptions/:id/cancel', [adminOnly], cancel, {
    params: { id: int() },
  }),
  route('GET', '/api/admin/school-subscriptions/:id/renewal-invoice', [adminOnly], renewalInvoice, {
    params: { id: int() },
  }),
]
