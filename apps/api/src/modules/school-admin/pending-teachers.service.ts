import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  SCHOOL_ADMIN_PENDING_TEACHER_FLASH,
  SCHOOL_ADMIN_TEACHER_VERIFIED_NOTICE,
  type SchoolAdminPendingTeacherListResponse,
  type SchoolAdminVerifyTeacherResult,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { toMytTimestamp } from '../../common/time/myt'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock } from '../../db/clock'
import { isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import { NotificationsService } from '../notifications'
import { UsersRepository } from '../users'
import { SCHOOL_ADMIN_AUDIT, WRITE_TX } from './school-admin.constants'

/** The signed-in school admin and the request facts the audit row needs. `schoolId` comes from the session, never the request. */
export interface SchoolAdminActor {
  userId: string
  role: string
  schoolId: string
  sessionRowId: string
  scopeLevel: string
  isTest: boolean
  requestId: string | null
  ip: string | null
}

/** First letters of the first two words. */
const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?'

/** Pending teachers of the own school and the verify action (BE-21 AC 13). */
@Injectable()
export class PendingTeachersService {
  private readonly logger = new Logger(PendingTeachersService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** The teachers who asked for the actor's school. Another school's pending teachers are never in the answer. */
  async list(actor: SchoolAdminActor): Promise<SchoolAdminPendingTeacherListResponse> {
    const rows = await this.guard(() => this.users.pendingTeachersOfSchool(actor.schoolId))
    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      initials: initialsOf(r.name),
      email: r.email,
      phone: r.phone,
      requestedAt: toMytTimestamp(r.createdAt),
    }))
    return { data, meta: listMeta(1, Math.max(1, data.length), data.length) }
  }

  /**
   * Verifies one pending teacher. ONE transaction: the guarded update (see `UsersRepository.verifyPendingTeacher`) and the
   * audit row (ids only). Anything that is not "a teacher pending for MY school" is the same 404, an already verified one
   * included (idempotency: a repeat call never succeeds twice and never says "already done"). The inbox notice goes out AFTER
   * the commit; a failure there is logged without the teacher's data and never fails the request.
   */
  async verify(actor: SchoolAdminActor, id: string): Promise<SchoolAdminVerifyTeacherResult> {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    const now = this.clock.now()
    const teacher = await this.write(async (tx) => {
      const verified = await this.users.verifyPendingTeacher(id, actor.schoolId, now)
      if (!verified) return null
      await this.audit.record({
        tx,
        action: SCHOOL_ADMIN_AUDIT.TEACHER_VERIFIED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.sessionRowId,
        scopeLevel: actor.scopeLevel,
        schoolId: actor.schoolId,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'user',
        targetId: verified.id,
        details: { teacherId: verified.id, schoolId: actor.schoolId },
      })
      return verified
    })
    if (!teacher) throw ApiError.of('NOT_FOUND')
    try {
      await this.notifications.push(teacher.id, { ...SCHOOL_ADMIN_TEACHER_VERIFIED_NOTICE }, { push: true })
    } catch {
      this.logger.warn('The teacher-verified notice could not be delivered')
    }
    return { data: { id: teacher.id, isActive: true, schoolId: actor.schoolId }, status: SCHOOL_ADMIN_PENDING_TEACHER_FLASH.verified }
  }

  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
