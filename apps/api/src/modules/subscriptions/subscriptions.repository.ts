import { Inject, Injectable } from '@nestjs/common'
import type { SUBSCRIPTION_STATUSES, SUBSCRIPTION_TIERS } from '@pp/contract'

import { ScopeFilter } from '../../common/scope/scope-filter'
import type { Prisma } from '../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { Caller } from '../users/caller'
import { likeEscape } from '../users/users.repository'
import { dateToDay, dayToDate } from './dates'

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number]

export interface PackageRow {
  id: string
  code: string
  name: string
  slug: string
  educationLevel: string
  formLevel: string
  /** Decimal string with two places ("30.00"); money is never a float. */
  priceAnnual: string
  maxRenewals: number
  isActive: boolean
}

export interface SubscriptionRecord {
  id: string
  schoolId: string
  schoolPackageId: string
  packageTier: SubscriptionTier
  studentQuota: number
  status: SubscriptionStatus
  /** `YYYY-MM-DD`, Malaysia time. */
  startsOn: string
  endsOn: string
  questionLimit: number | null
  paymentReference: string | null
  paymentNotes: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface NewSubscription {
  schoolId: string
  schoolPackageId: string
  packageTier: SubscriptionTier
  studentQuota: number
  startsOn: string
  endsOn: string
  questionLimit: number | null
  paymentReference: string | null
  paymentNotes: string | null
  now: Date
}

export interface SubscriptionPatch {
  studentQuota?: number
  status?: SubscriptionStatus
  packageTier?: SubscriptionTier
  endsOn?: string
  questionLimit?: number | null
  paymentReference?: string
  paymentNotes?: string
  notes?: string
  now: Date
}

export interface SubscriptionFilter {
  search?: string
  status?: string
  formLevel?: string
}

export interface SubscriptionCounts {
  active: number
  grace: number
  expired: number
  totalQuota: number
}

export interface UserPackageRow {
  id: string
  userId: string
  formLevel: 't4' | 't5'
  schoolPackageId: string
  studentQuota: number
  assignedAt: Date
}

type SubDb = Prisma.SchoolSubscriptionGetPayload<object>
type PkgDb = Prisma.SchoolPackageGetPayload<object>

function toRecord(r: SubDb): SubscriptionRecord {
  return {
    id: idToString(r.id),
    schoolId: idToString(r.schoolId),
    schoolPackageId: idToString(r.schoolPackageId),
    packageTier: r.packageTier as SubscriptionTier,
    studentQuota: r.studentQuota,
    status: r.status as SubscriptionStatus,
    startsOn: dateToDay(r.startsOn),
    endsOn: dateToDay(r.endsOn),
    questionLimit: r.questionLimit,
    paymentReference: r.paymentReference,
    paymentNotes: r.paymentNotes,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toPackage(p: PkgDb): PackageRow {
  return {
    id: idToString(p.id),
    code: p.code,
    name: p.name,
    slug: p.slug,
    educationLevel: p.educationLevel,
    formLevel: p.formLevel,
    priceAnnual: p.priceAnnual.toFixed(2),
    maxRenewals: p.maxRenewals,
    isActive: p.isActive,
  }
}

function toUserPackage(r: Prisma.UserPackageGetPayload<object>): UserPackageRow {
  return {
    id: idToString(r.id),
    userId: idToString(r.userId),
    formLevel: r.formLevel as 't4' | 't5',
    schoolPackageId: idToString(r.schoolPackageId),
    studentQuota: r.studentQuota,
    assignedAt: r.assignedAt,
  }
}

/** Newest first: the list order (mock FR-M02-83). */
const NEWEST_FIRST: Prisma.SchoolSubscriptionOrderByWithRelationInput[] = [{ id: 'desc' }]

/** The only doorway to `school_packages`, `school_subscriptions` and `user_packages` (ADR-0014). */
@Injectable()
export class SubscriptionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- packages -----------------------------------------------------------------------------------

  async packages(): Promise<PackageRow[]> {
    const rows = await this.prisma.client.schoolPackage.findMany({ orderBy: { id: 'asc' } })
    return rows.map(toPackage)
  }

  async packageById(id: string): Promise<PackageRow | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.schoolPackage.findUnique({ where: { id: idFromString(id) } })
    return row ? toPackage(row) : null
  }

  /** The catalogue row of a form level (`t4`, `t5`, ...): the first by id. */
  async packageByFormLevel(formLevel: string): Promise<PackageRow | null> {
    const row = await this.prisma.client.schoolPackage.findFirst({ where: { formLevel }, orderBy: { id: 'asc' } })
    return row ? toPackage(row) : null
  }

  // --- scope --------------------------------------------------------------------------------------

  /** Admin: everything. A school-scoped caller: its own school only (defence in depth; the routes are admin only). */
  private scopeWhere(caller: Caller): Prisma.SchoolSubscriptionWhereInput {
    return new ScopeFilter(caller.auth).where({ schoolColumn: 'schoolId', schoolRelation: 'school' }) as Prisma.SchoolSubscriptionWhereInput
  }

  // --- subscriptions: reads -------------------------------------------------------------------------

  /** One subscription inside the caller's scope, or null (unknown, malformed and out-of-scope alike). */
  async find(caller: Caller, id: string): Promise<SubscriptionRecord | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.schoolSubscription.findFirst({
      where: { AND: [{ id: idFromString(id) }, this.scopeWhere(caller)] },
    })
    return row ? toRecord(row) : null
  }

  /** The same, locked for the rest of the transaction (call inside `prisma.transaction`). */
  async findForUpdate(caller: Caller, id: string): Promise<SubscriptionRecord | null> {
    if (!isIdString(id)) return null
    await this.prisma.client.$queryRaw`SELECT id FROM school_subscriptions WHERE id = ${idFromString(id)} FOR UPDATE`
    return this.find(caller, id)
  }

  async list(caller: Caller, filter: SubscriptionFilter): Promise<{ rows: SubscriptionRecord[]; packages: Map<string, PackageRow> }> {
    const and: Prisma.SchoolSubscriptionWhereInput[] = [this.scopeWhere(caller)]
    if (filter.status) and.push({ status: filter.status })
    if (filter.formLevel) and.push({ schoolPackage: { is: { formLevel: filter.formLevel } } })
    if (filter.search) {
      const term = likeEscape(filter.search)
      and.push({
        school: { is: { OR: [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }] } },
      })
    }
    const rows = await this.prisma.client.schoolSubscription.findMany({ where: { AND: and }, orderBy: NEWEST_FIRST, include: { schoolPackage: true } })
    return {
      rows: rows.map(toRecord),
      packages: new Map(rows.map((r) => [idToString(r.schoolPackageId), toPackage(r.schoolPackage)])),
    }
  }

  /** Stat cards over every visible row, ignoring the list filters; `totalQuota` sums ACTIVE rows only. */
  async counts(caller: Caller): Promise<SubscriptionCounts> {
    const groups = await this.prisma.client.schoolSubscription.groupBy({
      by: ['status'],
      where: this.scopeWhere(caller),
      _count: { _all: true },
      _sum: { studentQuota: true },
    })
    const out: SubscriptionCounts = { active: 0, grace: 0, expired: 0, totalQuota: 0 }
    for (const g of groups) {
      if (g.status === 'active') {
        out.active = g._count._all
        out.totalQuota = g._sum.studentQuota ?? 0
      } else if (g.status === 'grace') out.grace = g._count._all
      else if (g.status === 'expired') out.expired = g._count._all
    }
    return out
  }

  /**
   * The subscription that grants the school's quota: the latest-starting `active` or `grace` row
   * (ties by id).
   */
  async quotaSource(schoolId: string): Promise<SubscriptionRecord | null> {
    if (!isIdString(schoolId)) return null
    const row = await this.prisma.client.schoolSubscription.findFirst({
      where: { schoolId: idFromString(schoolId), status: { in: ['active', 'grace'] } },
      orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
    })
    return row ? toRecord(row) : null
  }

  /** True when the school has an `active` subscription covering `day` (start and end days included). */
  async hasLiveSubscription(schoolId: string, day: string): Promise<boolean> {
    if (!isIdString(schoolId)) return false
    const n = await this.prisma.client.schoolSubscription.count({
      where: { schoolId: idFromString(schoolId), status: 'active', startsOn: { lte: dayToDate(day) }, endsOn: { gte: dayToDate(day) } },
    })
    return n > 0
  }

  // --- subscriptions: writes (call inside a transaction) ------------------------------------------

  async create(input: NewSubscription): Promise<SubscriptionRecord> {
    const row = await this.prisma.client.schoolSubscription.create({
      data: {
        schoolId: idFromString(input.schoolId),
        schoolPackageId: idFromString(input.schoolPackageId),
        packageTier: input.packageTier,
        studentQuota: input.studentQuota,
        status: 'active',
        startsOn: dayToDate(input.startsOn),
        endsOn: dayToDate(input.endsOn),
        questionLimit: input.questionLimit,
        paymentReference: input.paymentReference,
        paymentNotes: input.paymentNotes,
        notes: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
    })
    return toRecord(row)
  }

  async update(id: string, patch: SubscriptionPatch): Promise<SubscriptionRecord> {
    const row = await this.prisma.client.schoolSubscription.update({
      where: { id: idFromString(id) },
      data: {
        ...(patch.studentQuota !== undefined ? { studentQuota: patch.studentQuota } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.packageTier !== undefined ? { packageTier: patch.packageTier } : {}),
        ...(patch.endsOn !== undefined ? { endsOn: dayToDate(patch.endsOn) } : {}),
        ...(patch.questionLimit !== undefined ? { questionLimit: patch.questionLimit } : {}),
        ...(patch.paymentReference !== undefined ? { paymentReference: patch.paymentReference } : {}),
        ...(patch.paymentNotes !== undefined ? { paymentNotes: patch.paymentNotes } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        updatedAt: patch.now,
      },
    })
    return toRecord(row)
  }

  /** Serialises the student imports of one school, so two imports cannot both pass the quota check. Transaction scoped. */
  async lockSchoolImports(schoolId: string): Promise<void> {
    const key = `students.import:${schoolId}`
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
  }

  // --- user packages ---------------------------------------------------------------------------------

  async userPackages(userId: string): Promise<UserPackageRow[]> {
    if (!isIdString(userId)) return []
    const rows = await this.prisma.client.userPackage.findMany({ where: { userId: idFromString(userId) }, orderBy: { id: 'asc' } })
    return rows.map(toUserPackage)
  }

  /** Mock BR-13: creates the row of (user, form level) or replaces its package and quota; `assignedAt` = now. */
  async assignUserPackage(input: {
    userId: string
    formLevel: 't4' | 't5'
    schoolPackageId: string
    studentQuota: number
    now: Date
  }): Promise<UserPackageRow> {
    // One native statement on the unique key (uq_user_packages_user_form_level): parallel calls leave one row, never a 500.
    const rows = await this.prisma.client.$queryRaw<Prisma.UserPackageGetPayload<object>[]>`
      INSERT INTO user_packages (user_id, form_level, school_package_id, student_quota, assigned_at, created_at, updated_at)
      VALUES (${idFromString(input.userId)}, ${input.formLevel}, ${idFromString(input.schoolPackageId)}, ${input.studentQuota}, ${input.now}, ${input.now}, ${input.now})
      ON CONFLICT (user_id, form_level) DO UPDATE
        SET school_package_id = EXCLUDED.school_package_id, student_quota = EXCLUDED.student_quota,
            assigned_at = EXCLUDED.assigned_at, updated_at = EXCLUDED.updated_at
      RETURNING id, user_id AS "userId", form_level AS "formLevel", school_package_id AS "schoolPackageId",
                student_quota AS "studentQuota", assigned_at AS "assignedAt", created_at AS "createdAt", updated_at AS "updatedAt"`
    return toUserPackage(rows[0] as Prisma.UserPackageGetPayload<object>)
  }
}
