import { Inject, Injectable } from '@nestjs/common'
import {
  SCHOOL_ADMIN_FLASH,
  SCHOOL_ADMIN_MESSAGES,
  SCHOOL_ADMIN_PAGE_SIZE,
  V,
  type SchoolAdminResetResult,
  type SchoolAdminUserDetail,
  type SchoolAdminUserRole,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import type { TxClient } from '../../../db/client'
import { CLOCK, type Clock } from '../../../db/clock'
import { isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { PasswordService } from '../../auth/password.service'
import { ClassesRepository } from '../../classes'
import { SchoolsRepository, type SchoolRow } from '../../schools'
import type { Caller } from '../../users/caller'
import { generatePassword, UsersRepository, uniqueField, type ManagedCounts, type ManagedRole, type UserRecord } from '../../users'
import type { SchoolAdminActor } from '../school-admin.actor'
import { SCHOOL_ADMIN_AUDIT, WRITE_TX } from '../school-admin.constants'
import { exportFileName, type PeopleExportQuery, type PeopleListQuery } from './people.query'
import { invalidFields, parseReset, parseUserUpdate, type Fields } from './people.input'
import { isEffectivelyActive, toSchoolInfo, toUserDetail, usersCsv } from './people.mapper'

/** What differs between the teacher and the pupil routes. */
export interface PeopleKind {
  role: ManagedRole
  detailRole: SchoolAdminUserRole
  csvRole: 'guru' | 'pelajar'
  audit: { created: string; updated: string; toggled: string; passwordReset: string; exported: string }
}

export const TEACHER_KIND: PeopleKind = {
  role: 'teacher',
  detailRole: 'teacher',
  csvRole: 'guru',
  audit: {
    created: SCHOOL_ADMIN_AUDIT.TEACHER_CREATED,
    updated: SCHOOL_ADMIN_AUDIT.TEACHER_UPDATED,
    toggled: SCHOOL_ADMIN_AUDIT.TEACHER_TOGGLED,
    passwordReset: SCHOOL_ADMIN_AUDIT.TEACHER_PASSWORD_RESET,
    exported: SCHOOL_ADMIN_AUDIT.TEACHER_EXPORTED,
  },
}

export const PUPIL_KIND: PeopleKind = {
  role: 'student',
  detailRole: 'student',
  csvRole: 'pelajar',
  audit: {
    created: SCHOOL_ADMIN_AUDIT.PUPIL_CREATED,
    updated: SCHOOL_ADMIN_AUDIT.PUPIL_UPDATED,
    toggled: SCHOOL_ADMIN_AUDIT.PUPIL_TOGGLED,
    passwordReset: SCHOOL_ADMIN_AUDIT.PUPIL_PASSWORD_RESET,
    exported: SCHOOL_ADMIN_AUDIT.PUPIL_EXPORTED,
  },
}

/** The signed-in school admin: the audit facts (`actor`, school from the session) and the scope-aware `caller`. */
export interface PeopleCtx {
  actor: SchoolAdminActor
  caller: Caller
}

export interface ListPage {
  rows: UserRecord[]
  total: number
  page: number
  counts: ManagedCounts
}

export interface CreatedAccount {
  data: SchoolAdminUserDetail
  credential: { name: string; school: string; email: string; password: string }
  mustChangePassword: true
}

export type NewAccount = { name: string; email: string; phone: string | null }

/**
 * The write and read logic shared by the teacher and pupil routes (BE-21 Part A). Security rules, in one place:
 * - the school ALWAYS comes from `ctx.actor.schoolId` (the session); no argument is fed from the request;
 * - a target is found with `UsersRepository.findVisible(caller, id)` (school scope) and then must be in the SAME school and
 *   hold the route's role: anything else (unknown, other school, other role, malformed id) is the same 404 "Not Found.";
 * - a suspended account is shown as inactive and every WRITE on it answers 404 (OQ-8);
 * - passwords are hashed BEFORE the transaction; the plaintext of a created account lives in this call stack only and is
 *   never logged, audited or stored; a new password revokes the target's sessions in the SAME transaction;
 * - every write is one transaction with its audit row (ids and flags only, never a name, e-mail, phone or password).
 */
@Injectable()
export class ManagedUsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // --- reads --------------------------------------------------------------------------------------

  async list(ctx: PeopleCtx, kind: PeopleKind, q: PeopleListQuery): Promise<ListPage> {
    const schoolId = ctx.actor.schoolId
    const [page, counts] = await this.guard(() =>
      Promise.all([
        this.users.listBySchoolRole(schoolId, kind.role, {
          ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
          ...(q.search !== undefined ? { search: q.search } : {}),
          page: q.page,
          pageSize: SCHOOL_ADMIN_PAGE_SIZE,
        }),
        this.users.countsBySchoolRole(schoolId, kind.role),
      ]),
    )
    return { ...page, counts }
  }

  listEnvelope(page: ListPage) {
    return { meta: { ...listMeta(page.page, SCHOOL_ADMIN_PAGE_SIZE, page.total), counts: page.counts } }
  }

  /** Detail: 404 first (unknown, other school, other role), then 403 for an inactive (or suspended) account. */
  async detail(ctx: PeopleCtx, kind: PeopleKind, id: string): Promise<SchoolAdminUserDetail> {
    const user = await this.guard(() => this.resolve(ctx, kind, id, false))
    if (!user) throw ApiError.of('NOT_FOUND')
    if (!isEffectivelyActive(user)) throw ApiError.of('FORBIDDEN')
    return toUserDetail(user, kind.detailRole, await this.schoolOf(ctx))
  }

  /**
   * The export: rows with the same filters as the list, then ONE audit row (file name, row count and filter flags; never the
   * content, never the search text) BEFORE the content is returned, so a failed audit gives no file.
   */
  async exportRows(ctx: PeopleCtx, kind: PeopleKind, q: PeopleExportQuery): Promise<{ users: UserRecord[]; school: SchoolRow; fileName: string }> {
    const school = await this.schoolOf(ctx)
    const users = await this.guard(() =>
      this.users.exportBySchoolRole(ctx.actor.schoolId, kind.role, {
        ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
        ...(q.search !== undefined ? { search: q.search } : {}),
      }),
    )
    const fileName = exportFileName(kind.csvRole, toMytTimestamp(this.clock.now()))
    await this.guard(() =>
      this.audit.record({
        ...this.auditBase(ctx, kind.audit.exported),
        targetType: 'school',
        targetId: ctx.actor.schoolId,
        details: { fileName, rowCount: users.length, isActiveFilter: q.isActive === undefined ? null : q.isActive ? 1 : 0, searched: q.search !== undefined },
      }),
    )
    return { users, school, fileName }
  }

  csvOf(kind: PeopleKind, users: readonly UserRecord[], schoolName: string, kelasOf: (u: UserRecord) => string): string {
    return usersCsv(users, kind.csvRole, schoolName, kelasOf)
  }

  // --- create -------------------------------------------------------------------------------------

  /**
   * Validation, uniqueness and (pupils) the class are checked first: every problem is one 422 with its field. Then the
   * initial password is generated (CSPRNG) and hashed OUTSIDE the transaction. The plaintext is returned once.
   */
  async create(ctx: PeopleCtx, kind: PeopleKind, parsed: { value: NewAccount | null; fields: Fields }, classId: string | null): Promise<CreatedAccount> {
    const fields: Fields = { ...parsed.fields }
    const school = await this.schoolOf(ctx)
    if (classId !== null && !(await this.guard(() => this.classIsValid(ctx, classId)))) fields.classId = V.invalid('class id')
    if (parsed.value && (await this.guard(() => this.users.emailTaken(parsed.value?.email ?? '')))) fields.email = V.taken('email')
    if (Object.keys(fields).length > 0 || !parsed.value) throw invalidFields(fields)
    const input = parsed.value

    const password = generatePassword()
    const passwordHash = await this.passwords.hash(password)
    const now = this.clock.now()

    const id = await this.write(async (tx) => {
      if (classId !== null && !(await this.classIsValid(ctx, classId))) throw invalidFields({ classId: V.invalid('class id') })
      const newId = await this.users.create({
        name: input.name,
        email: input.email,
        username: null,
        phone: input.phone,
        schoolId: ctx.actor.schoolId,
        grade: null,
        passwordHash,
        mustChangePassword: true,
        icHash: null,
        icMasked: null,
        isActive: true,
        createdById: ctx.actor.userId,
        now,
      })
      await this.users.setRoles(newId, [kind.role], now)
      if (classId !== null) await this.classes.enrol({ classroomId: classId, studentId: newId, source: 'school_admin', now })
      await this.audit.record({
        tx,
        ...this.auditBase(ctx, kind.audit.created),
        targetType: 'user',
        targetId: newId,
        details: { userId: newId, schoolId: ctx.actor.schoolId, ...(classId !== null ? { classId, enrolled: true } : {}) },
      })
      return newId
    })
    const created = await this.users.get(id)
    if (!created) throw ApiError.of('SERVER_ERROR')
    return {
      data: toUserDetail(created, kind.detailRole, school),
      credential: { name: created.name, school: school.name, email: created.email ?? input.email, password },
      mustChangePassword: true,
    }
  }

  // --- update, toggle, reset ----------------------------------------------------------------------

  /** Checks in order: 404, 403 (inactive), 422. A new password revokes every session of the target, in the same transaction. */
  async update(ctx: PeopleCtx, kind: PeopleKind, id: string, raw: unknown): Promise<SchoolAdminUserDetail> {
    const target = await this.writable(ctx, kind, id)
    if (!target.isActive) throw ApiError.of('FORBIDDEN')
    const parsed = parseUserUpdate(raw)
    const fields: Fields = { ...parsed.fields }
    if (parsed.value && (await this.guard(() => this.users.emailTaken(parsed.value?.email ?? '', id)))) fields.email = V.taken('email')
    if (Object.keys(fields).length > 0 || !parsed.value) throw invalidFields(fields)
    const input = parsed.value
    const newHash = input.newPassword === undefined ? null : await this.passwords.hash(input.newPassword)
    const school = await this.schoolOf(ctx)
    const now = this.clock.now()

    await this.write(async (tx) => {
      await this.recheck(ctx, kind, id)
      await this.users.update(
        id,
        {
          name: input.name,
          email: input.email,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(newHash !== null ? { passwordHash: newHash, mustChangePassword: true } : {}),
          now,
        },
        ctx.caller,
      )
      if (newHash !== null) await this.users.revokeSessions([id])
      await this.audit.record({
        tx,
        ...this.auditBase(ctx, kind.audit.updated),
        targetType: 'user',
        targetId: id,
        details: { userId: id, schoolId: ctx.actor.schoolId, changed: ['name', 'email', ...(input.phone !== undefined ? ['phone'] : [])], credentialReset: newHash !== null },
      })
    })
    const saved = await this.users.get(id)
    if (!saved) throw ApiError.of('NOT_FOUND')
    return toUserDetail(saved, kind.detailRole, school)
  }

  /** Flips active / inactive (an inactive account can be switched back on). Deactivating revokes the target's sessions. */
  async toggle(ctx: PeopleCtx, kind: PeopleKind, id: string): Promise<{ isActive: boolean }> {
    await this.writable(ctx, kind, id)
    const now = this.clock.now()
    return this.write(async (tx) => {
      const current = await this.recheck(ctx, kind, id, { allowInactive: true })
      const next = !current.isActive
      await this.users.update(id, { isActive: next, now }, ctx.caller)
      if (!next) await this.users.revokeSessions([id])
      await this.audit.record({
        tx,
        ...this.auditBase(ctx, kind.audit.toggled),
        targetType: 'user',
        targetId: id,
        details: { userId: id, schoolId: ctx.actor.schoolId, isActive: next },
      })
      return { isActive: next }
    })
  }

  /** The admin types the new password (8 to 255, confirmed). 404, 403 (inactive), 422. Sets mustChangePassword and revokes the target's sessions. */
  async resetPassword(ctx: PeopleCtx, kind: PeopleKind, id: string, raw: unknown): Promise<SchoolAdminResetResult> {
    const target = await this.writable(ctx, kind, id)
    if (!target.isActive) throw ApiError.of('FORBIDDEN')
    const parsed = parseReset(raw)
    if (Object.keys(parsed.fields).length > 0 || parsed.value === null) throw invalidFields(parsed.fields)
    const newHash = await this.passwords.hash(parsed.value)
    const now = this.clock.now()
    await this.write(async (tx) => {
      await this.recheck(ctx, kind, id)
      await this.users.update(id, { passwordHash: newHash, mustChangePassword: true, now }, ctx.caller)
      await this.users.revokeSessions([id])
      await this.audit.record({
        tx,
        ...this.auditBase(ctx, kind.audit.passwordReset),
        targetType: 'user',
        targetId: id,
        details: { userId: id, schoolId: ctx.actor.schoolId, credentialReset: true },
      })
    })
    return { data: { reset: true }, status: SCHOOL_ADMIN_FLASH.updated }
  }

  // --- helpers ------------------------------------------------------------------------------------

  /**
   * The target, or null. Out of scope, another school, another role and a malformed id are all null (the caller answers 404
   * "Not Found." and never says which). With `forWrite` a suspended account is null too (OQ-8).
   */
  private async resolve(ctx: PeopleCtx, kind: PeopleKind, id: string, forWrite: boolean): Promise<UserRecord | null> {
    if (!isIdString(id)) return null
    const user = await this.users.findVisible(ctx.caller, id)
    if (!user || user.schoolId !== ctx.actor.schoolId || !user.roles.includes(kind.role)) return null
    if (forWrite && user.isSuspended) return null
    return user
  }

  private async writable(ctx: PeopleCtx, kind: PeopleKind, id: string): Promise<UserRecord> {
    const user = await this.guard(() => this.resolve(ctx, kind, id, true))
    if (!user) throw ApiError.of('NOT_FOUND')
    return user
  }

  /** Inside the transaction: the target must still be in scope (404 if it vanished) and active ("Akaun ini tidak aktif." if it turned inactive). */
  private async recheck(ctx: PeopleCtx, kind: PeopleKind, id: string, opts: { allowInactive?: boolean } = {}): Promise<UserRecord> {
    const user = await this.resolve(ctx, kind, id, true)
    if (!user) throw ApiError.of('NOT_FOUND', { message: SCHOOL_ADMIN_MESSAGES.userNotFound })
    if (!opts.allowInactive && !user.isActive) throw ApiError.of('FORBIDDEN', { message: SCHOOL_ADMIN_MESSAGES.accountInactive })
    return user
  }

  /** An ACTIVE classroom of the actor's own school. Any other class (unknown, other school, inactive, school_class kind) is not valid. */
  private async classIsValid(ctx: PeopleCtx, classId: string): Promise<boolean> {
    const c = await this.classes.get(classId)
    return c !== null && c.kind === 'classroom' && c.isActive && c.schoolId === ctx.actor.schoolId
  }

  async schoolOf(ctx: PeopleCtx): Promise<SchoolRow> {
    const school = await this.guard(() => this.schools.get(ctx.actor.schoolId))
    if (!school) throw ApiError.of('NOT_FOUND')
    return school
  }

  schoolInfo(school: SchoolRow) {
    return toSchoolInfo(school)
  }

  private auditBase(ctx: PeopleCtx, action: string) {
    const a = ctx.actor
    return {
      action,
      actorUserId: a.userId,
      actorRole: a.role,
      sessionRowId: a.sessionRowId,
      scopeLevel: a.scopeLevel,
      schoolId: a.schoolId,
      requestId: a.requestId,
      ip: a.ip,
      isTest: a.isTest,
    }
  }

  /** One transaction; an overloaded database is 429 with Retry-After, a unique-index race on the e-mail is the 422 of the field. */
  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      if (uniqueField(err) === 'email') throw invalidFields({ email: V.taken('email') })
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
