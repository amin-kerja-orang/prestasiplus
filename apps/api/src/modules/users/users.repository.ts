import { Inject, Injectable } from '@nestjs/common'
import { ROLE_CODES, type RoleCode } from '@pp/contract'

import { ScopeFilter } from '../../common/scope/scope-filter'
import type { Prisma } from '../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { ROLE_PRIORITY } from '../auth/auth.constants'
import { SessionStore } from '../auth'
import type { Caller } from './caller'
import { gradeOfClassLevel } from './class-level'
import { SCHOOL_ADMIN_VISIBLE_ROLES } from './users.constants'

/** A user as the rest of the API sees it: decimal-string ids, no password, IC hash or `legacy_*`. */
export interface UserRecord {
  id: string
  name: string
  email: string | null
  username: string | null
  phone: string | null
  schoolId: string | null
  grade: number | null
  bio: string | null
  idDelima: string | null
  icMasked: string | null
  isActive: boolean
  isSuspended: boolean
  mustChangePassword: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
  /** In `ROLE_PRIORITY` order. */
  roles: RoleCode[]
  /** JPN name and PPD code of a ppd_officer (from its district scope row). */
  ppd: { state: string; district: string } | null
}

export interface UserListFilter {
  role?: RoleCode
  schoolId?: string
  isActive?: boolean
  search?: string
  page: number
  pageSize: number
}

export interface UserSearchInput {
  /** Substring of name or e-mail, case-insensitive. */
  q: string
  role?: RoleCode
  schoolId?: string
  limit: number
}

export interface NewUserRow {
  name: string
  email: string | null
  username: string | null
  phone: string | null
  schoolId: string | null
  grade: number | null
  passwordHash: string
  mustChangePassword: boolean
  icHash: string | null
  icMasked: string | null
  isActive: boolean
  createdById: string
  now: Date
}

export interface UserPatchRow {
  name?: string
  email?: string | null
  username?: string | null
  phone?: string | null
  schoolId?: string | null
  grade?: number | null
  icHash?: string | null
  icMasked?: string | null
  isActive?: boolean
  passwordHash?: string
  mustChangePassword?: boolean
  now: Date
}

export type RoleCounts = Record<RoleCode, number>

export interface TeacherRow {
  id: string
  name: string
  email: string | null
}

export interface StudentRow {
  id: string
  name: string
  email: string | null
  idDelima: string | null
  grade: number | null
  schoolId: string | null
  isActive: boolean
}

const INCLUDE = { roles: true, scopes: true } satisfies Prisma.UserInclude
type UserDb = Prisma.UserGetPayload<{ include: typeof INCLUDE }>

const STUDENT_SELECT = { id: true, name: true, email: true, idDelima: true, grade: true, schoolId: true, isActive: true } as const

const roleRank = (r: string): number => {
  const i = (ROLE_PRIORITY as readonly string[]).indexOf(r)
  return i < 0 ? ROLE_PRIORITY.length : i
}

function toRecord(u: UserDb): UserRecord {
  const ppdScope = u.scopes.find((s) => s.role === 'ppd_officer' && s.level === 'district')
  return {
    id: idToString(u.id),
    name: u.name,
    email: u.email,
    username: u.username,
    phone: u.phone,
    schoolId: u.schoolId === null ? null : idToString(u.schoolId),
    grade: u.grade,
    bio: u.bio,
    idDelima: u.idDelima,
    icMasked: u.icMasked,
    isActive: u.isActive,
    isSuspended: u.isSuspended,
    mustChangePassword: u.mustResetPassword,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
    roles: u.roles
      .map((r) => r.role)
      .filter((r): r is RoleCode => (ROLE_CODES as readonly string[]).includes(r))
      .sort((a, b) => roleRank(a) - roleRank(b)),
    ppd: ppdScope?.districtCode && ppdScope.stateCode ? { state: ppdScope.stateCode, district: ppdScope.districtCode } : null,
  }
}

type StudentDb = Prisma.UserGetPayload<{ select: typeof STUDENT_SELECT }>
function toStudent(r: StudentDb): StudentRow {
  return { ...r, id: idToString(r.id), schoolId: r.schoolId === null ? null : idToString(r.schoolId) }
}

/** Newest first: the list order (mock BR-02). */
const NEWEST_FIRST: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }]

/**
 * Prisma `contains` does not escape LIKE wildcards, so `%` and `_` in a search term would match
 * anything. Escape them (Postgres' default LIKE escape is the backslash) so they match literally.
 */
export const likeEscape = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

const textSearch = (term: string): Prisma.UserWhereInput => ({
  OR: [{ name: { contains: likeEscape(term), mode: 'insensitive' } }, { email: { contains: likeEscape(term), mode: 'insensitive' } }],
})

/** Maps a unique-index violation (a race past the pre-check) to the field it belongs to. */
export function uniqueField(err: unknown): 'email' | 'username' | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { code?: unknown; message?: unknown; meta?: unknown }
  if (e.code !== 'P2002') return null
  let text = typeof e.message === 'string' ? e.message : ''
  try {
    text += JSON.stringify(e.meta ?? {})
  } catch {
    // an unserialisable meta carries no extra information
  }
  if (text.includes('uq_users_school_username')) return 'username'
  if (text.includes('uq_users_email')) return 'email'
  return null
}

/**
 * The only doorway to `users`, `user_roles` and `user_scopes` for the other modules (ADR-0014):
 * `get`, `findByEmail` and `search`. The admin methods below take the `Caller` and apply the scope
 * of its active role (`ScopeFilter`), so an out-of-scope user is simply "not found".
 *
 * Methods use `prisma.client`, so they join the caller's transaction when there is one.
 */
@Injectable()
export class UsersRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionStore) private readonly sessions: SessionStore,
  ) {}

  // --- doorway for other cards ------------------------------------------------------------------

  /** One user (any state) or null; a malformed id is "not found", never an error. */
  async get(id: string): Promise<UserRecord | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.user.findUnique({ where: { id: idFromString(id) }, include: INCLUDE })
    return row ? toRecord(row) : null
  }

  /** The user with this e-mail (case-insensitive) or null. */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM users WHERE lower(email) = lower(${email}) LIMIT 1`
    const first = rows[0]
    return first ? this.get(idToString(first.id)) : null
  }

  /** Users whose name or e-mail contains `q`, name A to Z. */
  async search(input: UserSearchInput): Promise<UserRecord[]> {
    const and: Prisma.UserWhereInput[] = [textSearch(input.q)]
    if (input.role) and.push({ roles: { some: { role: input.role } } })
    if (input.schoolId !== undefined) {
      if (!isIdString(input.schoolId)) return []
      and.push({ schoolId: idFromString(input.schoolId) })
    }
    const rows = await this.prisma.client.user.findMany({
      where: { AND: and },
      include: INCLUDE,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: input.limit,
    })
    return rows.map(toRecord)
  }

  // --- scope ------------------------------------------------------------------------------------

  private scopeWhere(caller: Caller): Prisma.UserWhereInput {
    return new ScopeFilter(caller.auth).where({ schoolColumn: 'schoolId' }) as Prisma.UserWhereInput
  }

  /**
   * Users the caller may see and change. Admin: everyone. school_admin: users of its own school
   * whose roles are all in `SCHOOL_ADMIN_VISIBLE_ROLES` (and at least one is); any other target
   * is "not found" (never 403).
   */
  visibleWhere(caller: Caller): Prisma.UserWhereInput {
    const scope = this.scopeWhere(caller)
    if (caller.isAdmin) return scope
    const visible = [...SCHOOL_ADMIN_VISIBLE_ROLES]
    return {
      AND: [scope, { roles: { some: { role: { in: visible } } } }, { roles: { none: { role: { notIn: visible } } } }],
    }
  }

  async findVisible(caller: Caller, id: string): Promise<UserRecord | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.user.findFirst({
      where: { AND: [{ id: idFromString(id) }, this.visibleWhere(caller)] },
      include: INCLUDE,
    })
    return row ? toRecord(row) : null
  }

  /** The visible users among `ids` (unknown, malformed and out-of-scope ids are skipped). */
  async findVisibleMany(caller: Caller, ids: readonly string[]): Promise<UserRecord[]> {
    const valid = [...new Set(ids.filter(isIdString))].map(idFromString)
    if (valid.length === 0) return []
    const rows = await this.prisma.client.user.findMany({
      where: { AND: [{ id: { in: valid } }, this.visibleWhere(caller)] },
      include: INCLUDE,
    })
    return rows.map(toRecord)
  }

  // --- admin list -------------------------------------------------------------------------------

  async list(caller: Caller, filter: UserListFilter): Promise<{ rows: UserRecord[]; total: number }> {
    const and: Prisma.UserWhereInput[] = [this.visibleWhere(caller)]
    if (filter.role) and.push({ roles: { some: { role: filter.role } } })
    if (filter.schoolId !== undefined) and.push({ schoolId: idFromString(filter.schoolId) })
    if (filter.isActive !== undefined) and.push({ isActive: filter.isActive })
    if (filter.search) and.push(textSearch(filter.search))
    const where: Prisma.UserWhereInput = { AND: and }
    const [rows, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        include: INCLUDE,
        orderBy: NEWEST_FIRST,
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.client.user.count({ where }),
    ])
    return { rows: rows.map(toRecord), total }
  }

  /** Users per role over everything the caller can see, ignoring the list filters (the 7 stat cards). */
  async roleCounts(caller: Caller): Promise<RoleCounts> {
    const groups = await this.prisma.client.userRole.groupBy({
      by: ['role'],
      where: { user: this.visibleWhere(caller) },
      _count: { _all: true },
    })
    const out = Object.fromEntries(ROLE_CODES.map((r) => [r, 0])) as RoleCounts
    for (const g of groups) if (g.role in out) out[g.role as RoleCode] = g._count._all
    return out
  }

  /** Distinct schools of the users the caller can see (filter options). */
  async schoolIdsWithUsers(caller: Caller): Promise<string[]> {
    const groups = await this.prisma.client.user.groupBy({
      by: ['schoolId'],
      where: { AND: [this.visibleWhere(caller), { schoolId: { not: null } }] },
    })
    return groups.flatMap((g) => (g.schoolId === null ? [] : [idToString(g.schoolId)]))
  }

  // --- lookups ----------------------------------------------------------------------------------

  /** Every teacher the caller can see: `{id, name, email}`. The caller sorts them. */
  async teachers(caller: Caller): Promise<TeacherRow[]> {
    const rows = await this.prisma.client.user.findMany({
      where: { AND: [this.scopeWhere(caller), { roles: { some: { role: 'teacher' } } }] },
      select: { id: true, name: true, email: true },
    })
    return rows.map((r) => ({ id: idToString(r.id), name: r.name, email: r.email }))
  }

  /** Students of one school matching the filters; the caller sorts and cuts them. */
  async studentsOfSchool(schoolId: string, search: string, classLevel: string): Promise<StudentRow[]> {
    const and: Prisma.UserWhereInput[] = [{ schoolId: idFromString(schoolId) }, { roles: { some: { role: 'student' } } }]
    if (classLevel !== '') {
      const grade = gradeOfClassLevel(classLevel)
      if (grade === null) return []
      and.push({ grade })
    }
    if (search !== '') {
      and.push({
        OR: [
          { name: { contains: likeEscape(search), mode: 'insensitive' } },
          { email: { contains: likeEscape(search), mode: 'insensitive' } },
          { idDelima: { contains: likeEscape(search), mode: 'insensitive' } },
        ],
      })
    }
    const rows = await this.prisma.client.user.findMany({ where: { AND: and }, select: STUDENT_SELECT })
    return rows.map(toStudent)
  }

  /** Students whose NAME contains `q`, name A to Z (the student picker). */
  async searchStudentsByName(caller: Caller, q: string, limit: number): Promise<StudentRow[]> {
    const rows = await this.prisma.client.user.findMany({
      where: {
        AND: [this.scopeWhere(caller), { roles: { some: { role: 'student' } } }, { name: { contains: likeEscape(q), mode: 'insensitive' } }],
      },
      select: STUDENT_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit,
    })
    return rows.map(toStudent)
  }

  // --- uniqueness and references ----------------------------------------------------------------

  async emailTaken(email: string, exceptId?: string): Promise<boolean> {
    const except = exceptId !== undefined && isIdString(exceptId) ? idFromString(exceptId) : null
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM users WHERE lower(email) = lower(${email})
         AND (${except}::bigint IS NULL OR id <> ${except}::bigint) LIMIT 1`
    return rows.length > 0
  }

  /** Usernames are unique per school (case-insensitive); a user without a school has no constraint. */
  async usernameTaken(schoolId: string, username: string, exceptId?: string): Promise<boolean> {
    if (!isIdString(schoolId)) return false
    const except = exceptId !== undefined && isIdString(exceptId) ? idFromString(exceptId) : null
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM users WHERE school_id = ${idFromString(schoolId)} AND lower(username) = lower(${username})
         AND (${except}::bigint IS NULL OR id <> ${except}::bigint) LIMIT 1`
    return rows.length > 0
  }

  /** Lower-case e-mails among `emails` that already exist (one query for a whole import). */
  async existingEmails(emails: readonly string[]): Promise<Set<string>> {
    const lower = [...new Set(emails.map((e) => e.toLowerCase()))]
    if (lower.length === 0) return new Set()
    const rows = await this.prisma.client.$queryRaw<{ e: string }[]>`
      SELECT lower(email) AS e FROM users WHERE lower(email) = ANY(${lower}::text[])`
    return new Set(rows.map((r) => r.e))
  }

  /** True when every id is a user with the student role. */
  async allStudents(ids: readonly string[]): Promise<boolean> {
    if (!ids.every(isIdString)) return false
    const unique = [...new Set(ids)].map(idFromString)
    if (unique.length === 0) return true
    const n = await this.prisma.client.user.count({ where: { id: { in: unique }, roles: { some: { role: 'student' } } } })
    return n === unique.length
  }

  // --- writes (call inside a transaction) -------------------------------------------------------

  /** Serialises the changes that can remove an admin, so two requests cannot both pass the last-admin check. */
  async lockAdminChanges(): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('users.admin-changes'))`
  }

  /** Active, unsuspended admins (a suspended admin cannot log in) other than `exceptIds` (the last-admin guard). */
  async countActiveAdmins(exceptIds: readonly string[] = []): Promise<number> {
    const except = exceptIds.filter(isIdString).map(idFromString)
    return this.prisma.client.user.count({
      where: { isActive: true, isSuspended: false, roles: { some: { role: 'admin' } }, ...(except.length > 0 ? { id: { notIn: except } } : {}) },
    })
  }

  async create(input: NewUserRow): Promise<string> {
    const row = await this.prisma.client.user.create({ data: toCreateData(input), select: { id: true } })
    return idToString(row.id)
  }

  async update(id: string, patch: UserPatchRow): Promise<void> {
    const { now, schoolId, ...rest } = patch
    await this.prisma.client.user.update({
      where: { id: idFromString(id) },
      data: {
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.email !== undefined ? { email: rest.email } : {}),
        ...(rest.username !== undefined ? { username: rest.username } : {}),
        ...(rest.phone !== undefined ? { phone: rest.phone } : {}),
        ...(rest.grade !== undefined ? { grade: rest.grade } : {}),
        ...(rest.icHash !== undefined ? { icHash: rest.icHash } : {}),
        ...(rest.icMasked !== undefined ? { icMasked: rest.icMasked } : {}),
        ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        ...(rest.passwordHash !== undefined ? { passwordHash: rest.passwordHash } : {}),
        ...(rest.mustChangePassword !== undefined ? { mustResetPassword: rest.mustChangePassword } : {}),
        ...(schoolId !== undefined ? { schoolId: schoolId === null ? null : idFromString(schoolId) } : {}),
        updatedAt: now,
      },
    })
  }

  /** Makes the role list of a user exactly `roles` (adds the missing, removes the others). */
  async setRoles(id: string, roles: readonly RoleCode[], now: Date): Promise<void> {
    const userId = idFromString(id)
    await this.prisma.client.userRole.deleteMany({ where: { userId, role: { notIn: [...roles] } } })
    await this.prisma.client.userRole.createMany({
      data: roles.map((role) => ({ userId, role, createdAt: now })),
      skipDuplicates: true,
    })
  }

  /** Creates many users with one role each; returns their ids in input order. */
  async createManyWithRole(rows: readonly NewUserRow[], role: RoleCode): Promise<string[]> {
    if (rows.length === 0) return []
    const created = await this.prisma.client.user.createManyAndReturn({
      data: rows.map(toCreateData),
      select: { id: true, email: true },
    })
    const byEmail = new Map(created.map((c) => [c.email?.toLowerCase(), c.id]))
    const ids = rows.map((r) => byEmail.get(r.email?.toLowerCase()))
    const now = rows[0]?.now ?? new Date()
    await this.prisma.client.userRole.createMany({
      data: ids.flatMap((userId) => (userId === undefined ? [] : [{ userId, role, createdAt: now }])),
    })
    return ids.flatMap((i) => (i === undefined ? [] : [idToString(i)]))
  }

  /** Stores (or clears, with null) the district scope of a ppd_officer. */
  async setPpdScope(id: string, ppd: { state: string; district: string } | null, now: Date): Promise<void> {
    const userId = idFromString(id)
    if (ppd === null) {
      await this.prisma.client.userScope.deleteMany({ where: { userId, role: 'ppd_officer' } })
      return
    }
    await this.prisma.client.userScope.upsert({
      where: { userId_role: { userId, role: 'ppd_officer' } },
      create: { userId, role: 'ppd_officer', level: 'district', stateCode: ppd.state, districtCode: ppd.district, createdAt: now, updatedAt: now },
      update: { level: 'district', stateCode: ppd.state, districtCode: ppd.district, schoolId: null, updatedAt: now },
    })
  }

  /** The national scope row of an admin (the seed writes the same row). */
  async setAdminScope(id: string, isAdmin: boolean, now: Date): Promise<void> {
    const userId = idFromString(id)
    if (!isAdmin) {
      await this.prisma.client.userScope.deleteMany({ where: { userId, role: 'admin' } })
      return
    }
    await this.prisma.client.userScope.upsert({
      where: { userId_role: { userId, role: 'admin' } },
      create: { userId, role: 'admin', level: 'national', createdAt: now, updatedAt: now },
      update: { level: 'national', stateCode: null, districtCode: null, schoolId: null, updatedAt: now },
    })
  }

  /** Ends every live session of the users, in the current transaction (SessionStore.revokeAllFor; PrismaService.client is the active transaction). */
  async revokeSessions(ids: readonly string[]): Promise<void> {
    for (const id of ids.filter(isIdString)) await this.sessions.revokeAllFor(idFromString(id))
  }

  /** Hard delete; roles, scopes and sessions go with the user (FK cascade), audit actors become null. */
  async remove(ids: readonly string[]): Promise<number> {
    const userIds = ids.filter(isIdString).map(idFromString)
    if (userIds.length === 0) return 0
    const res = await this.prisma.client.user.deleteMany({ where: { id: { in: userIds } } })
    return res.count
  }
}

function toCreateData(input: NewUserRow): Prisma.UserUncheckedCreateInput {
  return {
    name: input.name,
    email: input.email,
    username: input.username,
    phone: input.phone,
    schoolId: input.schoolId === null ? null : idFromString(input.schoolId),
    grade: input.grade,
    passwordHash: input.passwordHash,
    mustResetPassword: input.mustChangePassword,
    icHash: input.icHash,
    icMasked: input.icMasked,
    isActive: input.isActive,
    createdById: idFromString(input.createdById),
    createdAt: input.now,
    updatedAt: input.now,
  }
}
