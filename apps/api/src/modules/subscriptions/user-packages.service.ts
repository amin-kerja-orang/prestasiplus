import { Inject, Injectable } from '@nestjs/common'
import type { SchoolPackageAssignment, SchoolPackageCard, SchoolPackageUserView } from './subscriptions.types'
import {
  SCHOOL_ADMIN_FORM_LEVELS,
  SCHOOL_PACKAGE_MESSAGES,
  SchoolPackageAssignRequestSchema,
  V,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { toMytTimestamp } from '../../common/time/myt'
import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import type { TxClient } from '../../db/client'
import { isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { SchoolsRepository } from '../schools'
import type { Caller } from '../users/caller'
import { UsersRepository, type UserRecord } from '../users/users.repository'
import { parseStrict } from './strict-body'
import { SUBSCRIPTION_AUDIT, WRITE_TX } from './subscriptions.constants'
import { invalid, notFound } from './subscriptions.errors'
import { toSchool } from './subscriptions.mapper'
import { SubscriptionsRepository, type PackageRow, type UserPackageRow } from './subscriptions.repository'

/** `RM 30` for 30.00, `RM 30.50` for 30.50. */
const priceText = (price: string): string => (price.endsWith('.00') ? price.slice(0, -3) : price)

/** Mock BR-22 / FR-M02-48: "RM 30/pelajar · {years} tahun". */
export const priceLabel = (pkg: PackageRow): string => `RM ${priceText(pkg.priceAnnual)}/pelajar · ${String(pkg.maxRenewals + 1)} tahun`

/** Grade 11 is class level T5 (mock FR-M02-48 "{n} pelajar T5 sedia ada"). */
const T5_GRADE = 11

/**
 * School-admin package assignment (mock S16, BR-13): two cards (T4, T5) per school admin, an upsert
 * per (user, form level), independent of the school subscriptions (URS OQ-8). Admin only.
 */
@Injectable()
export class UserPackagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SubscriptionsRepository) private readonly repo: SubscriptionsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async view(userId: string): Promise<SchoolPackageUserView> {
    const user = await this.schoolAdmin(userId)
    const assigned = await this.repo.userPackages(user.id)
    const packages: SchoolPackageCard[] = []
    for (const formLevel of SCHOOL_ADMIN_FORM_LEVELS) {
      const pkg = await this.repo.packageByFormLevel(formLevel)
      if (!pkg) continue
      // The latest assignment of a form level wins (the table has no unique index; the writer upserts).
      const row = [...assigned].reverse().find((a) => a.formLevel === formLevel)
      packages.push({
        formLevel,
        packageId: pkg.id,
        code: pkg.code as 'T4' | 'T5',
        name: pkg.name,
        priceLabel: priceLabel(pkg),
        years: pkg.maxRenewals + 1,
        assigned: row ? { studentQuota: row.studentQuota, assignedAt: toMytTimestamp(row.assignedAt) } : null,
      })
    }
    const school = user.schoolId === null ? null : await this.schools.get(user.schoolId)
    const students = user.schoolId === null ? [] : await this.users.studentsOfSchool(user.schoolId, '', '')
    return {
      user: { id: user.id, name: user.name },
      school: school ? toSchool(school) : null,
      packages,
      existingT5Count: students.filter((s) => s.grade === T5_GRADE).length,
    }
  }

  async assign(caller: Caller, userId: string, raw: unknown): Promise<{ data: SchoolPackageAssignment; status: string }> {
    const user = await this.schoolAdmin(userId)
    const body = parseStrict(SchoolPackageAssignRequestSchema, raw)
    // `packageId` must pair with the form level: the catalogue row of t4 or t5 (mock BR-22).
    const pkg = await this.repo.packageByFormLevel(body.formLevel)
    if (!pkg || pkg.id !== body.packageId) throw invalid({ packageId: V.invalid('package id') })
    const now = this.clock.now()
    const row = await this.write(async (tx) => {
      const saved = await this.repo.assignUserPackage({
        userId: user.id,
        formLevel: body.formLevel,
        schoolPackageId: pkg.id,
        studentQuota: Number(body.studentQuota),
        now,
      })
      await this.audit.record({
        tx,
        action: SUBSCRIPTION_AUDIT.PACKAGE_ASSIGNED,
        actorUserId: caller.userId,
        actorRole: caller.role,
        sessionRowId: caller.auth.sessionRowId,
        targetType: 'user',
        targetId: user.id,
        schoolId: user.schoolId,
        scopeLevel: caller.auth.active.scope.level,
        requestId: caller.requestId,
        ip: caller.ip,
        details: { formLevel: body.formLevel, packageId: pkg.id, studentQuota: saved.studentQuota },
      })
      return saved
    })
    return { data: toAssignment(row), status: SCHOOL_PACKAGE_MESSAGES.assigned }
  }

  /** 404 for an unknown user, 422 `fields.id` for a user that is not a school admin. */
  private async schoolAdmin(userId: string): Promise<UserRecord> {
    if (!isIdString(userId)) throw notFound()
    const user = await this.users.get(userId)
    if (!user) throw notFound()
    if (!user.roles.includes('school_admin')) throw invalid({ id: SCHOOL_PACKAGE_MESSAGES.notSchoolAdmin })
    return user
  }

  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}

function toAssignment(r: UserPackageRow): SchoolPackageAssignment {
  return { id: r.id, userId: r.userId, formLevel: r.formLevel, packageId: r.schoolPackageId, studentQuota: r.studentQuota, assignedAt: toMytTimestamp(r.assignedAt) }
}
