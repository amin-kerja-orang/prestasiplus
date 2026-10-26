import { Inject, Injectable } from '@nestjs/common'
import {
  ASSIGNABLE_ROLES,
  EXISTING_STUDENTS_LIMIT,
  ROLE_CODES,
  STUDENT_SEARCH_LIMIT,
  STUDENT_SEARCH_MIN_CHARS,
  USERS_PAGE_SIZE,
  USER_MESSAGES,
  usersDeletedText,
  type AdminUserDetail,
  type AdminUserListItem,
  type CreateUserRequest,
  type CreatedUser,
  type ExistingStudent,
  type RoleCode,
  type StudentSearchItem,
  type UpdatedUser,
  type UpdateUserRequest,
} from '@pp/contract'

import { AuditService } from '../../common/audit/audit.service'
import { ApiError } from '../../common/errors/api-error'
import { listMeta } from '../../common/http/respond'
import { CLOCK, type Clock } from '../../db/clock'
import type { TxClient } from '../../db/client'
import { isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { PasswordService } from '../auth/password.service'
import { isOverloadError } from '../auth/auth.errors'
import { ParentsRepository } from '../parents/parents.repository'
import { SchoolsRepository } from '../schools'
import type { Caller } from './caller'
import { classLevelOfGrade } from './class-level'
import { generatePassword, IcService } from './credentials'
import { toDetail, toListItem, toStudentItem } from './users.mapper'
import { BULK_DELETE_MAX_IDS, PAGE_NUMBER_MAX, USER_AUDIT } from './users.constants'
import { FIELD_MESSAGES, forbidden, invalid, lastAdmin, notFound } from './users.errors'
import { UsersPorts } from './users.ports'
import { UsersRepository, uniqueField, type UserRecord } from './users.repository'

type LinkChange = { added: string[]; removed: string[] }
/** Audit `details` of a link change: student ids only (no names), and no key at all when nothing changed. */
const linkDetails = (c: LinkChange | null): { linkedStudents?: LinkChange } =>
  c !== null && (c.added.length > 0 || c.removed.length > 0) ? { linkedStudents: c } : {}

const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const
const SORT_LOCALE = 'ms'
const byNameThenId = (a: { name: string; id: string }, b: { name: string; id: string }): number =>
  a.name.localeCompare(b.name, SORT_LOCALE) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1)

/** Laravel `boolean()` as the mock reads `isActive`: true, 1, "1", "true", "on", "yes" are true. */
export function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase())
  return false
}

const blankToNull = (v: string | null | undefined): string | null => (v === undefined || v === null || v.trim() === '' ? null : v.trim())

export interface UserListQueryInput {
  role?: string | undefined
  schoolId?: string | undefined
  isActive?: string | undefined
  search?: string | undefined
  page?: string | undefined
}

export interface Page<T, M> {
  data: T[]
  meta: M
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SchoolsRepository) private readonly schools: SchoolsRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(IcService) private readonly ic: IcService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ParentsRepository) private readonly parentLinks: ParentsRepository,
    @Inject(UsersPorts) private readonly ports: UsersPorts,
  ) {}

  // --- reads --------------------------------------------------------------------------------------

  async list(caller: Caller, q: UserListQueryInput) {
    const roleCounts = await this.users.roleCounts(caller)
    const page = pageOf(q.page)
    const empty = () => ({ data: [] as AdminUserListItem[], meta: { ...listMeta(page, USERS_PAGE_SIZE, 0), roleCounts: toWire(roleCounts) } })

    // Like the SQL `where` of the mock: a role outside the codes or a non-numeric school matches nothing.
    const role = q.role?.trim() ?? ''
    if (role !== '' && !(ROLE_CODES as readonly string[]).includes(role)) return empty()
    const schoolText = q.schoolId?.trim() ?? ''
    if (schoolText !== '' && !isIdString(schoolText)) return empty()
    const active = q.isActive?.trim()
    const search = q.search?.trim() ?? ''

    const { rows, total } = await this.users.list(caller, {
      ...(role === '' ? {} : { role: role as RoleCode }),
      ...(schoolText === '' ? {} : { schoolId: schoolText }),
      ...(active === '1' ? { isActive: true } : active === '0' ? { isActive: false } : {}),
      ...(search === '' ? {} : { search }),
      page,
      pageSize: USERS_PAGE_SIZE,
    })
    const names = await this.schoolNames(rows.map((r) => r.schoolId))
    return {
      data: rows.map((r) => toListItem(r, r.schoolId === null || !this.schoolShown(caller, r.schoolId) ? undefined : names.get(r.schoolId))),
      meta: { ...listMeta(page, USERS_PAGE_SIZE, total), roleCounts: toWire(roleCounts) },
    }
  }

  /** Schools with at least one visible user, by name (case-insensitive), then id. */
  async filters(caller: Caller): Promise<{ schools: { id: string; name: string }[] }> {
    // Only the schools that have a user are read (not the whole schools table).
    const schools = (await this.schools.getMany(await this.users.schoolIdsWithUsers(caller))).map((s) => ({ id: s.id, name: s.name }))
    schools.sort((a, b) => {
      const x = a.name.toLowerCase()
      const y = b.name.toLowerCase()
      return x < y ? -1 : x > y ? 1 : BigInt(a.id) < BigInt(b.id) ? -1 : 1
    })
    return { schools }
  }

  /** User detail; the read is audited (ids only). */
  async detail(caller: Caller, id: string): Promise<AdminUserDetail> {
    const user = await this.users.findVisible(caller, id)
    if (!user) throw notFound()
    await this.audit.record({ ...this.auditBase(caller, USER_AUDIT.READ, user) })
    return this.detailOf(caller, user)
  }

  async searchStudents(caller: Caller, raw: string | undefined): Promise<StudentSearchItem[]> {
    const q = raw?.trim() ?? ''
    if ([...q].length < STUDENT_SEARCH_MIN_CHARS) return []
    // A teacher sees only students of its own classes. No classes table exists before BE-17, so a
    // teacher gets none (fail closed) instead of every student of the school.
    if (caller.role === 'teacher') return []
    const rows = await this.users.searchStudentsByName(caller, q, STUDENT_SEARCH_LIMIT)
    // The school name is redundant for a school-scoped caller and is given to admin only.
    const names = caller.isAdmin ? await this.schoolNames(rows.map((r) => r.schoolId)) : null
    return rows.map((r) => toStudentItem(r, names ? (r.schoolId === null ? null : (names.get(r.schoolId) ?? null)) : undefined))
  }

  async teachers(caller: Caller): Promise<{ id: string; name: string; email: string | null }[]> {
    const rows = await this.users.teachers(caller)
    return rows.sort(byNameThenId)
  }

  /**
   * The teacher's active classes for the "Kelas guru" select, name A to Z then id. `[]` for none, for an unknown
   * teacher and (school_admin) for a teacher outside the caller's school: the contract has no 404 here, and
   * an out-of-scope teacher must look the same as an unknown one. A school_admin also sees only the classes of
   * its own school: a teacher who moved schools keeps active classes of the old school, which are not shown.
   */
  async teacherClassrooms(caller: Caller, teacherId: string): Promise<{ id: string; name: string; classCode: string }[]> {
    if (!isIdString(teacherId)) return []
    if (!caller.isAdmin) {
      const teacher = await this.users.get(teacherId)
      if (!teacher || !teacher.roles.includes('teacher') || teacher.schoolId !== caller.schoolId) return []
    }
    const rows = await this.ports.classrooms.activeOf(teacherId, caller.isAdmin ? undefined : { schoolId: caller.schoolId })
    return rows.sort(byNameThenId)
  }

  /** Existing students of a school for the import screen: at most 200, name A to Z. */
  async schoolStudents(caller: Caller, schoolId: string, search: string | undefined, classLevel: string | undefined): Promise<ExistingStudent[]> {
    // Another school is 404 for a school_admin, the same as an unknown school.
    if (!caller.isAdmin && schoolId !== caller.schoolId) throw notFound()
    if (!(await this.schools.exists(schoolId))) throw notFound()
    const rows = await this.users.studentsOfSchool(schoolId, search?.trim() ?? '', classLevel ?? '')
    return rows
      .sort(byNameThenId)
      .slice(0, EXISTING_STUDENTS_LIMIT)
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        idDelima: r.idDelima,
        classLevel: classLevelOfGrade(r.grade),
        isActive: r.isActive,
      }))
  }

  // --- create -------------------------------------------------------------------------------------

  async create(caller: Caller, body: CreateUserRequest): Promise<{ data: CreatedUser; status: string }> {
    this.assertAssignable(caller, body.roles)
    const roles = body.roles
    const isStudent = roles.includes('student')
    const email = blankToNull(body.email)
    const username = blankToNull(body.username)

    const fields: Record<string, string> = {}
    const schoolId = await this.resolveSchool(caller, blankToNull(body.schoolId), fields)
    const ppd = await this.resolveRegion(roles, blankToNull(body.ppdState), blankToNull(body.ppdDistrict), fields)
    const ic = isStudent ? this.icOf(blankToNull(body.icNumber), fields) : null
    await this.checkLinked(caller, roles, body.linkedStudentIds, fields)
    await this.checkUnique(fields, { email, username, schoolId })
    if (Object.keys(fields).length > 0) throw invalid(fields)

    const password = generatePassword()
    const passwordHash = await this.passwords.hash(password)
    const now = this.clock.now()

    const id = await this.write(async (tx) => {
      const newId = await this.users.create({
        name: body.name,
        email,
        username,
        phone: blankToNull(body.phone),
        schoolId,
        grade: isStudent ? gradeOf(body.grade) : null,
        passwordHash,
        mustChangePassword: false, // R39: an admin-created account is not forced to change its password
        icHash: ic?.hash ?? null,
        icMasked: ic?.masked ?? null,
        isActive: body.isActive === undefined ? true : toBool(body.isActive),
        createdById: caller.userId,
        now,
      })
      await this.users.setRoles(newId, roles, now)
      await this.users.setAdminScope(newId, roles.includes('admin'), now)
      if (roles.includes('ppd_officer') && ppd) await this.users.setPpdScope(newId, ppd, now)
      const linkChange =
        roles.includes('parent') && body.linkedStudentIds !== undefined ? await this.storeLinked(caller, newId, body.linkedStudentIds) : null
      await this.audit.record({
        tx,
        ...this.auditBase(caller, USER_AUDIT.CREATED, { id: newId, schoolId }),
        details: { roles, ...linkDetails(linkChange) },
      })
      return newId
    })
    const created = await this.mustGet(id)
    const detail = await this.detailOf(caller, created)
    return { data: { ...detail, mustChangePassword: false, generatedPassword: password }, status: USER_MESSAGES.created }
  }

  // --- update -------------------------------------------------------------------------------------

  async update(caller: Caller, id: string, body: UpdateUserRequest): Promise<{ data: UpdatedUser; status: string }> {
    if (!isIdString(id)) throw notFound()
    // Cheap pre-check, so an unknown or out-of-scope id (404) does not cost a hash. The locked
    // re-read inside the transaction stays the authority.
    if (body.resetPassword === true && !(await this.users.findVisible(caller, id))) throw notFound()
    // Hash first: the transaction (and the admin lock) must not wait on argon2id.
    const newPassword = body.resetPassword === true ? generatePassword() : null
    const newHash = newPassword === null ? null : await this.passwords.hash(newPassword)
    const now = this.clock.now()

    await this.write(async (tx) => {
      await this.users.lockAdminChanges()
      const target = await this.users.findVisible(caller, id)
      if (!target) throw notFound()
      // A school_admin edits the non-role fields of an in-scope parent but cannot change its roles
      // (contract PUT /admin/users/{id}); every other target needs an assignable role set.
      const parentTarget = !caller.isAdmin && target.roles.includes('parent')
      if (parentTarget) {
        if (body.roles.length !== target.roles.length || body.roles.some((r) => !target.roles.includes(r))) throw forbidden()
      } else {
        this.assertAssignable(caller, body.roles)
      }
      const roles = body.roles
      const isStudent = roles.includes('student')
      const fields: Record<string, string> = {}

      // school: absent keeps the stored value, null clears it.
      let schoolId: string | null = target.schoolId
      // A school_admin never changes the school of a parent target: body.schoolId is ignored (no
      // comparison, no error), so the school a parent carries cannot be guessed (AC 7).
      if (body.schoolId !== undefined && !parentTarget) {
        const sent = blankToNull(body.schoolId)
        if (caller.isAdmin) {
          if (sent !== null && !(await this.schools.exists(sent))) fields.schoolId = FIELD_MESSAGES.schoolInvalid
          else schoolId = sent
        } else if (sent !== caller.schoolId) {
          // A school_admin cannot move a user to another school or out of its own.
          fields.schoolId = FIELD_MESSAGES.schoolInvalid
        }
      }
      if (roles.includes('school_admin') && schoolId === null && fields.schoolId === undefined) fields.schoolId = FIELD_MESSAGES.schoolRequired

      // grade (R73): required only when the request makes the user a student that would have none (the
      // student role is being added and no grade is stored or sent) or when a `grade` key is sent (null
      // is refused, an out-of-range value is refused). An update of an existing student that does not
      // touch the grade (password reset, name or e-mail edit) never fails on a stored null grade: a
      // migrated pupil with no class label must stay resettable.
      let grade: number | null | undefined
      if (isStudent) {
        if (body.grade !== undefined) {
          const g = body.grade === null ? null : gradeOf(body.grade)
          if (g === null) fields.grade = FIELD_MESSAGES.gradeRequired
          else grade = g
        } else if (target.grade === null && !target.roles.includes('student')) {
          fields.grade = FIELD_MESSAGES.gradeRequired
        }
      }

      const email = body.email === undefined ? target.email : blankToNull(body.email)
      const username = body.username === undefined ? target.username : blankToNull(body.username)
      if (email === null && username === null) fields.email = FIELD_MESSAGES.emailRequired

      // PPD scope: validated when sent, required when the account becomes a ppd_officer.
      const sentState = blankToNull(body.ppdState)
      const sentDistrict = blankToNull(body.ppdDistrict)
      let ppd: { state: string; district: string } | null | undefined
      if (roles.includes('ppd_officer')) {
        if (sentState !== null || sentDistrict !== null || target.ppd === null) {
          const state = sentState ?? target.ppd?.state ?? null
          const district = sentDistrict ?? target.ppd?.district ?? null
          if (state === null) fields.ppdState = FIELD_MESSAGES.ppdStateRequired
          if (district === null) fields.ppdDistrict = FIELD_MESSAGES.ppdDistrictRequired
          if (state !== null && district !== null) {
            ppd = await this.resolveRegion(roles, state, district, fields)
          }
        }
      } else if (roles.includes('school_admin') && sentState !== null) {
        await this.resolveRegion(roles, sentState, sentDistrict, fields)
      }

      const ic = isStudent && body.icNumber !== undefined ? this.icOf(blankToNull(body.icNumber), fields) : undefined
      await this.checkLinked(caller, roles, body.linkedStudentIds, fields)
      await this.checkUnique(fields, {
        email: body.email === undefined ? null : email,
        username: body.username === undefined && schoolId === target.schoolId ? null : username,
        schoolId,
        exceptId: id,
      })
      if (Object.keys(fields).length > 0) throw invalid(fields)

      // Last-admin and self-demotion guards (D58).
      const wasAdmin = target.roles.includes('admin')
      const nextActive = body.isActive === undefined ? target.isActive : toBool(body.isActive)
      if (wasAdmin) {
        const demote = !roles.includes('admin')
        const deactivate = target.isActive && !nextActive
        if (demote && target.id === caller.userId) throw lastAdmin()
        if ((demote || deactivate) && target.isActive && (await this.users.countActiveAdmins([target.id])) === 0) throw lastAdmin()
      }

      await this.users.update(
        id,
        {
        name: body.name,
        ...(body.email !== undefined ? { email } : {}),
        ...(body.username !== undefined ? { username } : {}),
        ...(body.phone !== undefined ? { phone: blankToNull(body.phone) } : {}),
        ...(schoolId !== target.schoolId ? { schoolId } : {}),
        ...(grade !== undefined ? { grade } : {}),
        ...(ic !== undefined ? { icHash: ic?.hash ?? null, icMasked: ic?.masked ?? null } : {}),
        ...(body.isActive !== undefined ? { isActive: nextActive } : {}),
        // R39: an admin password write clears the flag, so a migrated account that kept it is not locked out.
        ...(newHash !== null ? { passwordHash: newHash, mustChangePassword: false } : {}),
        now,
        },
        caller,
      )
      const rolesChanged = roles.length !== target.roles.length || roles.some((r) => !target.roles.includes(r))
      if (rolesChanged) {
        await this.users.setRoles(id, roles, now)
        await this.users.setAdminScope(id, roles.includes('admin'), now)
        if (!roles.includes('ppd_officer')) await this.users.setPpdScope(id, null, now)
      }
      if (roles.includes('ppd_officer') && ppd) await this.users.setPpdScope(id, ppd, now)
      // BR-10 / BR-11: the set is replaced only for a parent that sent it (absent keeps the stored links).
      const linkChange =
        roles.includes('parent') && body.linkedStudentIds !== undefined ? await this.storeLinked(caller, id, body.linkedStudentIds) : null

      // A role, status, school or password change ends the sessions of the target (BE-NFR-39).
      const deactivated = target.isActive && !nextActive
      if (rolesChanged || deactivated || newHash !== null || schoolId !== target.schoolId) {
        await this.users.revokeSessions([id])
      }
      await this.audit.record({
        tx,
        ...this.auditBase(caller, USER_AUDIT.UPDATED, { id, schoolId }),
        details: {
          changed: changedFields(body),
          ...linkDetails(linkChange),
          ...(rolesChanged ? { roles } : {}),
          ...(newHash !== null ? { credentialReset: true } : {}),
        },
      })
    })

    const saved = await this.mustGet(id)
    const detail = await this.detailOf(caller, saved)
    return { data: { ...detail, ...(newPassword !== null ? { generatedPassword: newPassword } : {}) }, status: USER_MESSAGES.updated }
  }

  // --- toggle, delete -----------------------------------------------------------------------------

  async toggleActive(caller: Caller, id: string): Promise<{ data: { isActive: boolean }; status: string }> {
    if (!isIdString(id)) throw notFound()
    const now = this.clock.now()
    const isActive = await this.write(async (tx) => {
      await this.users.lockAdminChanges()
      const target = await this.users.findVisible(caller, id)
      if (!target) throw notFound()
      const next = !target.isActive
      if (!next && target.roles.includes('admin') && (await this.users.countActiveAdmins([target.id])) === 0) throw lastAdmin()
      await this.users.update(id, { isActive: next, now }, caller)
      if (!next) await this.users.revokeSessions([id])
      await this.audit.record({
        tx,
        ...this.auditBase(caller, USER_AUDIT.TOGGLED, target),
        details: { isActive: next },
      })
      return next
    })
    return { data: { isActive }, status: USER_MESSAGES.toggled }
  }

  /**
   * Delete rule (card AC 7, mock BR-06): CASCADE. The user, its roles and scopes, its sessions and
   * the links the mock lists go in one transaction; audit rows keep a null actor and
   * `created_by_id` of other users becomes null. A table of another card that references the user
   * with a RESTRICT foreign key BLOCKS the delete: the transaction rolls back and the answer is
   * 409 CONFLICT, so nothing is half deleted.
   */
  async remove(caller: Caller, id: string): Promise<{ data: { deleted: number }; status: string }> {
    if (!isIdString(id)) throw notFound()
    await this.write(async (tx) => {
      await this.users.lockAdminChanges()
      const target = await this.users.findVisible(caller, id)
      if (!target) throw notFound()
      if (target.id === caller.userId) throw invalid({ id: USER_MESSAGES.ownDelete })
      if (target.roles.includes('admin') && target.isActive && (await this.users.countActiveAdmins([target.id])) === 0) throw lastAdmin()
      await this.audit.record({ tx, ...this.auditBase(caller, USER_AUDIT.DELETED, target), details: { roles: target.roles } })
      if ((await this.users.remove([id], caller)) !== 1) throw notFound()
    })
    return { data: { deleted: 1 }, status: USER_MESSAGES.deleted }
  }

  async bulkRemove(caller: Caller, rawIds: readonly string[]): Promise<{ data: { deleted: number }; status: string }> {
    if (!rawIds.every(isIdString)) throw invalid({ ids: FIELD_MESSAGES.idsInteger })
    const ids = [...new Set(rawIds)]
    if (ids.length > BULK_DELETE_MAX_IDS) throw invalid({ ids: FIELD_MESSAGES.idsTooMany(BULK_DELETE_MAX_IDS) })
    if (ids.includes(caller.userId)) throw invalid({ ids: USER_MESSAGES.ownDelete })

    const deleted = await this.write(async (tx) => {
      await this.users.lockAdminChanges()
      // Unknown, malformed and out-of-scope ids are skipped as stale selections.
      const targets = await this.users.findVisibleMany(caller, ids)
      if (targets.length === 0) return 0
      const removedAdmins = targets.filter((t) => t.roles.includes('admin') && t.isActive).map((t) => t.id)
      if (removedAdmins.length > 0 && (await this.users.countActiveAdmins(removedAdmins)) === 0) throw lastAdmin()
      const targetIds = targets.map((t) => t.id)
      const count = await this.users.remove(targetIds, caller)
      await this.audit.record({
        tx,
        action: USER_AUDIT.BULK_DELETED,
        actorUserId: caller.userId,
        actorRole: caller.role,
        sessionRowId: caller.auth.sessionRowId,
        targetType: 'user',
        scopeLevel: caller.auth.active.scope.level,
        schoolId: caller.schoolId,
        requestId: caller.requestId,
        ip: caller.ip,
        details: { requested: ids.length, deleted: count, ids: targetIds },
      })
      return count
    })
    return { data: { deleted }, status: usersDeletedText(deleted) }
  }

  // --- helpers ------------------------------------------------------------------------------------

  /** Runs a write in one transaction with its audit row; a unique-index race becomes a field error. */
  private async write<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    try {
      // The admin lock queues writers inside the transaction, so it gets more room than Prisma's 5 s default.
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      // An overloaded database is retryable: 429 with Retry-After, never a 500.
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      const field = uniqueField(err)
      if (field === 'email') throw invalid({ email: FIELD_MESSAGES.emailTaken })
      if (field === 'username') throw invalid({ username: FIELD_MESSAGES.usernameTaken })
      if (isForeignKeyBlock(err)) throw ApiError.of('CONFLICT')
      throw err
    }
  }

  private assertAssignable(caller: Caller, roles: readonly RoleCode[]): void {
    const allowed = (caller.isAdmin ? ASSIGNABLE_ROLES.admin : ASSIGNABLE_ROLES.school_admin) as readonly RoleCode[]
    if (roles.some((r) => !allowed.includes(r))) throw forbidden()
  }

  /** The school of a new user: a school_admin always gets its own, and may not name another. */
  private async resolveSchool(caller: Caller, sent: string | null, fields: Record<string, string>): Promise<string | null> {
    if (!caller.isAdmin) {
      if (sent !== null && sent !== caller.schoolId) fields.schoolId = FIELD_MESSAGES.schoolInvalid
      return caller.schoolId
    }
    if (sent === null) return null
    if (!(await this.schools.exists(sent))) {
      fields.schoolId = FIELD_MESSAGES.schoolInvalid
      return null
    }
    return sent
  }

  /**
   * JPN name and PPD code checks (mock BR-08). Required for a ppd_officer (the schema enforces it);
   * checked for a school_admin only when sent. Returns the pair a ppd_officer is stored with.
   */
  private async resolveRegion(
    roles: readonly RoleCode[],
    state: string | null,
    district: string | null,
    fields: Record<string, string>,
  ): Promise<{ state: string; district: string } | null> {
    const isPpd = roles.includes('ppd_officer')
    if (!isPpd && !roles.includes('school_admin')) return null
    if (state === null) return null
    const jpn = (await this.schools.jpnList()).find((j) => j.name === state)
    if (!jpn) {
      fields.ppdState = FIELD_MESSAGES.ppdStateInvalid
      if (isPpd && district !== null) fields.ppdDistrict = FIELD_MESSAGES.ppdDistrictInvalid
      return null
    }
    if (!isPpd) return null
    if (district === null) return null
    const ppds = (await this.schools.ppdList(jpn.id)) ?? []
    if (!ppds.some((p) => p.code === district)) {
      fields.ppdDistrict = FIELD_MESSAGES.ppdDistrictInvalid
      return null
    }
    return { state: jpn.name, district }
  }

  /** A MyKad number as typed, to hash and mask; a value that is not one is a field error (never echoed). */
  private icOf(raw: string | null, fields: Record<string, string>) {
    if (raw === null) return null
    const parts = this.ic.parts(raw)
    if (parts === null) fields.icNumber = FIELD_MESSAGES.icFormat
    return parts
  }

  /** Every linked id must be a student (a school_admin: of its own school; a student elsewhere reads as unknown). */
  private async checkLinked(
    caller: Caller,
    roles: readonly RoleCode[],
    ids: readonly string[] | undefined,
    fields: Record<string, string>,
  ): Promise<void> {
    if (!roles.includes('parent') || ids === undefined) return
    if (!(await this.users.allStudents(ids, caller))) fields.linkedStudentIds = FIELD_MESSAGES.linkedInvalid
  }

  /**
   * Stores the checked links of a parent in the user write's transaction: the set is replaced by `ids`
   * (AC-M02-15.4). A school_admin only replaces the links of its own school's children, the ones it can see.
   */
  private async storeLinked(caller: Caller, parentId: string, ids: readonly string[]): Promise<LinkChange> {
    // Re-check in the write transaction (after the admin lock on update): a student deleted or de-roled
    // since the pre-check is a 422, not a 500 or a link to a non-student.
    const gone = () => invalid({ linkedStudentIds: FIELD_MESSAGES.linkedInvalid })
    if (!(await this.users.allStudents(ids, caller))) throw gone()
    try {
      return await this.parentLinks.replaceLinksOfParent(parentId, ids, caller.isAdmin ? null : caller.schoolId)
    } catch (err) {
      if (isForeignKeyBlock(err)) throw gone() // the student vanished between the re-check and the insert
      throw err
    }
  }

  /**
   * E-mail and username uniqueness. The answer is the same for every caller and says nothing about
   * the school or role of the existing account (the check is global and the message is fixed).
   */
  private async checkUnique(
    fields: Record<string, string>,
    v: { email: string | null; username: string | null; schoolId: string | null; exceptId?: string },
  ): Promise<void> {
    if (v.email !== null && (await this.users.emailTaken(v.email, v.exceptId))) fields.email = FIELD_MESSAGES.emailTaken
    if (v.username !== null && v.schoolId !== null && (await this.users.usernameTaken(v.schoolId, v.username, v.exceptId))) {
      fields.username = FIELD_MESSAGES.usernameTaken
    }
  }

  private async schoolNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((i): i is string => i !== null))]
    const rows = await this.schools.getMany(wanted)
    return new Map(rows.map((s) => [s.id, s.name]))
  }

  /**
   * A school_admin sees a school only when it is its own: a visible parent may carry any school (its
   * visibility comes from its children), and that school is not the caller's to learn (AC 7).
   */
  private schoolShown(caller: Caller, schoolId: string | null): boolean {
    return caller.isAdmin || (schoolId !== null && schoolId === caller.schoolId)
  }

  private async detailOf(caller: Caller, user: UserRecord): Promise<AdminUserDetail> {
    const shown = this.schoolShown(caller, user.schoolId)
    const visibleUser = shown ? user : { ...user, schoolId: null }
    const school = !shown || user.schoolId === null ? null : await this.schools.get(user.schoolId)
    // Children of a parent only; a school_admin gets those of its own school (contract AdminUserDetail).
    let linkedStudents: StudentSearchItem[] = []
    if (user.roles.includes('parent')) {
      const rows = (await this.users.linkedStudents(caller, user.id)).sort(byNameThenId)
      const names = caller.isAdmin ? await this.schoolNames(rows.map((r) => r.schoolId)) : null
      linkedStudents = rows.map((r) => toStudentItem(r, names ? (r.schoolId === null ? null : (names.get(r.schoolId) ?? null)) : undefined))
    }
    return toDetail({ user: visibleUser, school, linkedStudents })
  }

  private async mustGet(id: string): Promise<UserRecord> {
    const user = await this.users.get(id)
    if (!user) throw ApiError.of('SERVER_ERROR')
    return user
  }

  private auditBase(caller: Caller, action: string, target: { id: string; schoolId: string | null }) {
    return {
      action,
      actorUserId: caller.userId,
      actorRole: caller.role,
      sessionRowId: caller.auth.sessionRowId,
      targetType: 'user',
      targetId: target.id,
      schoolId: target.schoolId,
      scopeLevel: caller.auth.active.scope.level,
      requestId: caller.requestId,
      ip: caller.ip,
    }
  }
}

/** Page number of the list: a missing, non-numeric or < 1 value is page 1 (not an error). */
function pageOf(raw: string | undefined): number {
  const t = raw?.trim() ?? ''
  if (!/^\d+$/.test(t)) return 1
  const n = Number(t)
  return n >= 1 ? Math.min(n, PAGE_NUMBER_MAX) : 1
}

/** The wire keys of `RoleCounts` are camel case. */
function toWire(c: Record<RoleCode, number>) {
  return {
    student: c.student,
    teacher: c.teacher,
    parent: c.parent,
    sponsor: c.sponsor,
    schoolAdmin: c.school_admin,
    ppdOfficer: c.ppd_officer,
    admin: c.admin,
  }
}

function gradeOf(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

/** Names of the keys the request carried (never their values). */
function changedFields(body: UpdateUserRequest): string[] {
  return Object.keys(body).filter((k) => (body as Record<string, unknown>)[k] !== undefined)
}

/** A RESTRICT foreign key of another table blocks the delete (Prisma P2003 / driver 23503). */
function isForeignKeyBlock(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; message?: unknown; meta?: unknown }
  if (e.code === 'P2003') return true
  let text = typeof e.message === 'string' ? e.message : ''
  try {
    text += JSON.stringify(e.meta ?? {})
  } catch {
    // no extra information
  }
  return /23503|foreign key/i.test(text)
}
