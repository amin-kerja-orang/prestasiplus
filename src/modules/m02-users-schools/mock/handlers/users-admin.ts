/**
 * M02 admin users (SRS v1.28 §7 #1–#9, #39; BR-01…BR-12, FR-M02-99). Every `/api/admin/*` route is `AD`:
 * a guest gets `401`, any other role `403` (`requireRole('admin')`); #39 needs any session.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 1 | `GET /api/admin/users` | BR-02: 25/page, newest first, AND filters, `meta.roleCounts` ignore them |
 * | 2 | `GET /api/admin/users/filters` | BR-03: the schools with ≥ 1 user, by name (61 = 57 + 4 fixtures, DV-M02-13) |
 * | 3 | `GET /api/admin/users/:id` | `AdminUserDetail`; the IC per DV-M02-16 |
 * | 4 | `POST /api/admin/users` | BR-08, BR-09 (defaults), BR-10; ids from 9,000,001 (X-9) |
 * | 5 | `PUT /api/admin/users/:id` | BR-08, BR-10…BR-12 (hidden sections keep their values) |
 * | 6, 7 | `DELETE /api/admin/users/:id`, `POST …/bulk-delete` | BR-06 (links, packages, sessions go with the user) |
 * | 8 | `POST /api/admin/users/:id/toggle-active` | BR-05 |
 * | 9 | `POST /api/admin/users/:id/impersonate` | BR-07: a fresh session of the target (M01 `SessionPayload`) |
 * | 39 | `GET /api/students/search?q=` | FR-M02-103: ≤ 15 students, any session |
 *
 * INFERRED (not observed on live, SRS §5 / §8 "UNVERIFIED COPY"): the success and refusal texts, the
 * Laravel-default validation copy, the refusal of a delete / bulk delete / "Login As" that names the
 * admin's own account (the UI offers no such control, BR-04), an unknown or invalid filter value
 * (`role`, `schoolId`) matching no user like the SQL it stands for, `isActive` / `hasPkskSubscription` /
 * `subscriptionPackage` / `grade` / `schoolId` / `icNumber` being left unchanged when their key is absent
 * (BR-11), and a "Login As" session that is not a password login (no `lastLoginAt`, no M14 hand-off; the
 * admin's own session stays valid until the client drops it).
 */

import { API_ERROR_CODES } from '@/api/errors'
import { issueSession } from '@/mock/core-data/client-session'
import { sessions } from '@/mock/auth/sessions'
import {
  confirmed,
  email,
  fail,
  int,
  max,
  min,
  notFound,
  ok,
  oneOf,
  created,
  paged,
  pageParams,
  queryInt,
  queryString,
  required,
  requireAuth,
  requireRole,
  route,
  rule,
  unique,
  validate,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import {
  isSessionUser,
  users,
  type UserPatch,
  type UserRole,
  type UserRow,
} from '@/modules/m01-authentication/mock'

import { computeExpiry } from '../repository/billing'
import { complimentaryRepo } from '../repository/complimentary'
import { schoolsRepo } from '../repository/schools'
import { parentInvitesRepo } from './parent-invites-store'
import { parentLinksRepo } from './parent-links-store'
import { schoolAdminPackagesRepo } from './school-admin-packages-store'
import { bodyOf, intList, intOrNull, textOrNull, toBool, type Body } from './users-input'
import { toDetail, toListItem, toStudentItem } from './users-shape'

/** The 8 live role codes (BR-01). `unmapped` is not one of them (§6.15 B, D9). */
export const USER_ROLES = [
  'student',
  'teacher',
  'parent',
  'sponsor',
  'school_admin',
  'ppd_officer',
  'jpn_officer',
  'admin',
] as const
type LiveRole = (typeof USER_ROLES)[number]

const PACKAGES = ['none', 'regular_monthly', 'personal'] as const

/** BR-02. */
export const USERS_PAGE_SIZE = 25
/** FR-M02-103. */
export const STUDENT_SEARCH_LIMIT = 15
/** The student search answers `[]` below this many characters (the UI never sends fewer, FR-M02-25/26). */
export const STUDENT_SEARCH_MIN_CHARS = 2

// UNVERIFIED COPY (§8): placeholders until the live copy is verified.
export const MSG_USER_CREATED = 'Pengguna berjaya didaftarkan.'
export const MSG_USER_UPDATED = 'Pengguna berjaya dikemaskini.'
export const MSG_USER_DELETED = 'Pengguna berjaya dipadam.'
export const MSG_STATUS_TOGGLED = 'Status pengguna berjaya dikemaskini.'
export const usersDeletedText = (n: number): string => `${String(n)} pengguna berjaya dipadam.`
// INFERRED refusals (BR-04: the UI has no such control on the own row).
export const MSG_OWN_DELETE = 'Anda tidak boleh memadam akaun sendiri.'
export const MSG_OWN_IMPERSONATE = 'Anda tidak boleh Login As akaun sendiri.'
export const MSG_NO_SESSION_ROLE = 'Pengguna ini tiada peranan yang sah untuk log masuk.'

const adminOnly = requireRole('admin')

const unauthorized = () => fail(401, API_ERROR_CODES.UNAUTHORIZED, 'Unauthenticated.')

function adminId(req: MockRequest): number {
  if (!req.session) throw new Error('requireRole() must run first')
  return req.session.userId
}

function idOf(req: MockRequest): number {
  return Number(req.params.id)
}

function isLiveRole(value: unknown): value is LiveRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

// --- #1 --------------------------------------------------------------------------------------------

function listUsers(req: MockRequest): MockResponse {
  const page = pageParams(req.query, { pageSize: USERS_PAGE_SIZE })
  const roleCounts = users.roleCounts()
  const empty = () => paged({ rows: [], total: 0 }, page, { roleCounts })

  const role = queryString(req.query, 'role')?.trim() ?? ''
  const schoolText = queryString(req.query, 'schoolId')?.trim() ?? ''
  const schoolId = queryInt(req.query, 'schoolId')
  const active = queryString(req.query, 'isActive')?.trim()
  // BR-02 / INFERRED: like the SQL `where`, a role outside the 8 codes or a non-numeric school matches nothing.
  if (role !== '' && !isLiveRole(role)) return empty()
  if (schoolText !== '' && schoolId === undefined) return empty()

  const result = users.adminList({
    ...(role === '' ? {} : { role: role as UserRole }),
    ...(schoolId === undefined ? {} : { schoolId }),
    ...(active === '1' ? { isActive: true } : active === '0' ? { isActive: false } : {}),
    search: queryString(req.query, 'search') ?? '',
    page: page.page,
    pageSize: page.pageSize,
  })
  return paged({ rows: result.rows.map(toListItem), total: result.total }, page, { roleCounts })
}

// --- #2 --------------------------------------------------------------------------------------------

function userFilters(): MockResponse {
  const found = users.schoolsWithUsers().flatMap((id) => {
    const s = schoolsRepo.get(id)
    return s ? [{ id: s.id, name: s.name }] : []
  })
  // BR-03 "sorted by name (A→Z, as stored)": a case-insensitive collation, then the id.
  found.sort((a, b) => {
    const x = a.name.toLowerCase()
    const y = b.name.toLowerCase()
    return x < y ? -1 : x > y ? 1 : a.id - b.id
  })
  return ok({ schools: found })
}

// --- #3 --------------------------------------------------------------------------------------------

function getUser(req: MockRequest): MockResponse {
  const row = users.get(idOf(req))
  return row ? ok(toDetail(row)) : notFound()
}

// --- shared validation (#4, #5) ----------------------------------------------------------------------

const schoolIdOk = (value: unknown): boolean => {
  const id = intOrNull(value)
  return id !== null && schoolsRepo.get(id) !== undefined
}

/** `role` of the input: a live code, else `''` (its own rule reports it). */
function roleOf(input: Readonly<Record<string, unknown>>): LiveRole | '' {
  return isLiveRole(input.role) ? input.role : ''
}

const roleRule = [required(), oneOf(USER_ROLES)]

/** `linkedStudentIds` (parents only): an array of ids, each a `student` (BR-08). */
const linkedStudentsRule = rule('linked', (value, { input }) => {
  if (roleOf(input) !== 'parent') return null
  const ids = intList(value)
  return ids !== null && ids.every((id) => users.get(id)?.role === 'student')
    ? null
    : 'The selected :attribute is invalid.'
})

const jpnNames = (): string[] => schoolsRepo.jpnList().map((j) => j.name)

/** A JPN name: required for the officers, checked for the school admin's (BR-08). */
const ppdStateRule = rule(
  'ppd_state',
  (value, { input }) => {
    const role = roleOf(input)
    const empty = value === undefined || value === null || value === ''
    if (role === 'ppd_officer' || role === 'jpn_officer') {
      if (empty) return 'The :attribute field is required.'
    } else if (role !== 'school_admin') {
      return null
    }
    return empty || (typeof value === 'string' && jpnNames().includes(value))
      ? null
      : 'The selected :attribute is invalid.'
  },
  { implicit: true },
)

/** A PPD code of the chosen JPN: required for a PPD officer (BR-08). */
const ppdDistrictRule = rule(
  'ppd_district',
  (value, { input }) => {
    if (roleOf(input) !== 'ppd_officer') return null
    if (value === undefined || value === null || value === '') {
      return 'The :attribute field is required when role is ppd_officer.'
    }
    const jpn = schoolsRepo.jpnList().find((j) => j.name === input.ppdState)
    const codes = jpn ? (schoolsRepo.ppdList(jpn.id) ?? []).map((p) => p.code) : []
    return typeof value === 'string' && codes.includes(value)
      ? null
      : 'The selected :attribute is invalid.'
  },
  { implicit: true },
)

const GRADE_INVALID = 'The selected :attribute is invalid.'

function gradeInRange(value: unknown): boolean {
  const grade = intOrNull(value)
  return grade !== null && grade >= 1 && grade <= 11
}

// --- #4 --------------------------------------------------------------------------------------------

/** BR-09 defaults: a school admin's JPN / PPD come from the school when the form did not send them. */
function officerFields(
  role: LiveRole,
  body: Body,
  schoolId: number | null,
): { ppdState: string | null; ppdDistrict: string | null } {
  const state = textOrNull(body.ppdState)
  const district = textOrNull(body.ppdDistrict)
  if (role === 'ppd_officer') return { ppdState: state, ppdDistrict: district }
  if (role === 'jpn_officer') return { ppdState: state, ppdDistrict: null }
  if (role === 'school_admin') {
    const school = schoolId === null ? undefined : schoolsRepo.get(schoolId)
    return {
      ppdState: state ?? school?.state ?? null,
      ppdDistrict: district ?? school?.district ?? null,
    }
  }
  return { ppdState: null, ppdDistrict: null }
}

function createUser(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(
    body,
    {
      role: roleRule,
      name: [required(), max(255)],
      email: [
        required(),
        email(),
        max(255),
        unique((value) => users.findByEmail(String(value)) !== undefined),
      ],
      phone: [max(14)],
      password: [required(), min(6), confirmed()],
      grade: [
        rule(
          'grade',
          (value, { input }) => {
            if (roleOf(input) !== 'student') return null
            if (value === undefined || value === null || value === '') {
              return 'The :attribute field is required when role is student.'
            }
            return gradeInRange(value) ? null : GRADE_INVALID
          },
          { implicit: true },
        ),
      ],
      icNumber: [max(14)],
      schoolId: [
        rule(
          'school_id',
          (value, { input }) => {
            const empty = value === undefined || value === null || value === ''
            if (empty) {
              return roleOf(input) === 'school_admin'
                ? 'The :attribute field is required when role is school_admin.'
                : null
            }
            return schoolIdOk(value) ? null : 'The selected :attribute is invalid.'
          },
          { implicit: true },
        ),
      ],
      linkedStudentIds: [linkedStudentsRule],
      ppdState: [ppdStateRule],
      ppdDistrict: [ppdDistrictRule],
    },
    { attributes: { icNumber: 'ic number' } },
  )
  if (invalid) return invalid

  const role = body.role as LiveRole
  const isStudent = role === 'student'
  const schoolId = intOrNull(body.schoolId)
  const now = ctx.clock.now()
  return ctx.transaction(() => {
    const row = users.create(
      {
        name: String(body.name),
        email: String(body.email),
        role,
        phone: textOrNull(body.phone),
        grade: isStudent ? intOrNull(body.grade) : null,
        // BR-08: the school is optional for student / teacher, required for school_admin; other roles keep it too
        // (the S2 form only sends it for those roles, FR-M02-21).
        schoolId,
        isActive: 'isActive' in body ? toBool(body.isActive) : true,
        createdById: adminId(req),
        ...officerFields(role, body, schoolId),
      },
      now,
    )
    users.setPassword(row.id, String(body.password))
    const ic = textOrNull(body.icNumber)
    if (isStudent && ic !== null) users.setIcNumber(row.id, ic)
    if (role === 'parent') {
      parentLinksRepo.replaceFor(row.id, intList(body.linkedStudentIds) ?? [], now)
    }
    const saved = users.get(row.id)
    if (!saved) throw new Error('createUser: the created user is missing')
    return created(toDetail(saved), { status: MSG_USER_CREATED })
  })
}

// --- #5 --------------------------------------------------------------------------------------------

function updateUser(req: MockRequest, ctx: MockContext): MockResponse {
  const id = idOf(req)
  const before = users.get(id)
  if (!before) return notFound()
  const body = bodyOf(req)
  const invalid = validate(
    body,
    {
      name: [required(), max(255)],
      email: [
        required(),
        email(),
        max(255),
        unique((value) => {
          const other = users.findByEmail(String(value))
          return other !== undefined && other.id !== id
        }),
      ],
      phone: [max(14)],
      role: roleRule,
      // BR-08 / BR-11: `grade` and `schoolId` are required only when the record would end up without one.
      grade: [
        rule(
          'grade',
          (value, { input }) => {
            if (roleOf(input) !== 'student') return null
            const sent = 'grade' in input
            if (sent ? value === null || value === undefined : before.grade === null) {
              return 'The :attribute field is required when role is student.'
            }
            return !sent || gradeInRange(value) ? null : GRADE_INVALID
          },
          { implicit: true },
        ),
      ],
      icNumber: [max(14)],
      subscriptionPackage: [oneOf(PACKAGES)],
      schoolId: [
        rule(
          'school_id',
          (value, { input }) => {
            const sent = 'schoolId' in input
            const empty = value === undefined || value === null || value === ''
            if (sent && !empty) {
              return schoolIdOk(value) ? null : 'The selected :attribute is invalid.'
            }
            const remaining = sent ? null : before.schoolId
            return roleOf(input) === 'school_admin' && remaining === null
              ? 'The :attribute field is required when role is school_admin.'
              : null
          },
          { implicit: true },
        ),
      ],
      linkedStudentIds: [linkedStudentsRule],
      newPassword: [min(6), confirmed()],
    },
    { attributes: { icNumber: 'ic number' } },
  )
  if (invalid) return invalid

  const role = body.role as LiveRole
  const isStudent = role === 'student'
  const now = ctx.clock.now()
  return ctx.transaction(() => {
    const patch: UserPatch = { name: String(body.name), email: String(body.email), role }
    if ('phone' in body) patch.phone = textOrNull(body.phone)
    if ('isActive' in body) patch.isActive = toBool(body.isActive)
    if ('schoolId' in body) patch.schoolId = intOrNull(body.schoolId)
    // BR-11: the student section is only sent for a student; `grade` stays as stored otherwise.
    if (isStudent && 'grade' in body) patch.grade = intOrNull(body.grade)
    if (isStudent && 'hasPkskSubscription' in body) {
      patch.hasPkskSubscription = toBool(body.hasPkskSubscription)
    }
    users.update(id, patch, now)

    if (isStudent && 'icNumber' in body) users.setIcNumber(id, textOrNull(body.icNumber))
    // BR-12: the expiry is computed only when the package changes (`personal` is the one-time 10 Jan plan).
    const pkg = body.subscriptionPackage
    if (isStudent && typeof pkg === 'string' && pkg !== before.subscriptionPackage) {
      const next = pkg as (typeof PACKAGES)[number]
      users.setSubscription(id, {
        package: next,
        expiresAt: computeExpiry(next, next === 'personal' ? 'onetime' : 'monthly', now),
      })
    }
    // BR-08: a filled new password replaces the old one (min 6, confirmed).
    if (typeof body.newPassword === 'string' && body.newPassword !== '') {
      users.setPassword(id, body.newPassword)
    }
    // BR-10 / BR-11: the set is replaced only for a parent that sent it.
    if (role === 'parent' && 'linkedStudentIds' in body) {
      parentLinksRepo.replaceFor(id, intList(body.linkedStudentIds) ?? [], now)
    }
    const saved = users.get(id)
    if (!saved) throw new Error('updateUser: the user is missing')
    return ok(toDetail(saved), { status: MSG_USER_UPDATED })
  })
}

// --- #6, #7 ----------------------------------------------------------------------------------------

/** BR-06: the user, its links (as parent or student), its S16 packages and its sessions. */
function removeUser(id: number): void {
  parentLinksRepo.removeForUser(id)
  parentInvitesRepo.removeForUser(id)
  schoolAdminPackagesRepo.removeForUser(id)
  complimentaryRepo.remove(id)
  sessions.revokeAllFor(id)
  users.remove(id)
}

function deleteUser(req: MockRequest, ctx: MockContext): MockResponse {
  const id = idOf(req)
  if (!users.get(id)) return notFound()
  if (id === adminId(req)) return validationError({ id: MSG_OWN_DELETE })
  return ctx.transaction(() => {
    removeUser(id)
    return ok({ deleted: 1 }, { status: MSG_USER_DELETED })
  })
}

function bulkDeleteUsers(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(body, {
    ids: [
      required(),
      rule('array', (value) =>
        intList(value) === null ? 'The :attribute field must be an array of integers.' : null,
      ),
    ],
  })
  if (invalid) return invalid
  const ids = intList(body.ids) ?? []
  if (ids.includes(adminId(req))) return validationError({ ids: MSG_OWN_DELETE })
  return ctx.transaction(() => {
    let deleted = 0
    for (const id of ids) {
      // An id that no longer exists is skipped (a stale selection), like a scoped `whereIn`.
      if (!users.get(id)) continue
      removeUser(id)
      deleted++
    }
    return ok({ deleted }, { status: usersDeletedText(deleted) })
  })
}

// --- #8 --------------------------------------------------------------------------------------------

function toggleActive(req: MockRequest, ctx: MockContext): MockResponse {
  const row = users.get(idOf(req))
  if (!row) return notFound()
  // BR-04: the own row keeps its toggle, so self-deactivation is possible (result INFERRED).
  const saved = users.update(row.id, { isActive: !row.isActive }, ctx.clock.now())
  return ok({ isActive: saved.isActive }, { status: MSG_STATUS_TOGGLED })
}

// --- #9 --------------------------------------------------------------------------------------------

function impersonate(req: MockRequest, ctx: MockContext): MockResponse {
  const target = users.get(idOf(req))
  if (!target) return notFound()
  if (target.id === adminId(req)) return validationError({ id: MSG_OWN_IMPERSONATE })
  if (!isSessionUser(target)) return validationError({ id: MSG_NO_SESSION_ROLE })
  const session = issueSession(target, false, ctx.clock.now())
  return ok({ token: session.token, expiresAt: session.expiresAt, user: session.user })
}

// --- #39 -------------------------------------------------------------------------------------------

function searchStudents(req: MockRequest): MockResponse {
  if (!req.session) return unauthorized()
  const q = queryString(req.query, 'q')?.trim() ?? ''
  if ([...q].length < STUDENT_SEARCH_MIN_CHARS) return ok([])
  const rows: UserRow[] = users.search(q, { role: 'student', limit: STUDENT_SEARCH_LIMIT })
  return ok(rows.map(toStudentItem))
}

export const userAdminRoutes: RouteDef[] = [
  route('GET', '/api/admin/users', [adminOnly], listUsers),
  route('GET', '/api/admin/users/filters', [adminOnly], userFilters),
  route('POST', '/api/admin/users', [adminOnly], createUser),
  route('POST', '/api/admin/users/bulk-delete', [adminOnly], bulkDeleteUsers),
  route('GET', '/api/admin/users/:id', [adminOnly], getUser, { params: { id: int() } }),
  route('PUT', '/api/admin/users/:id', [adminOnly], updateUser, { params: { id: int() } }),
  route('DELETE', '/api/admin/users/:id', [adminOnly], deleteUser, { params: { id: int() } }),
  route('POST', '/api/admin/users/:id/toggle-active', [adminOnly], toggleActive, {
    params: { id: int() },
  }),
  route('POST', '/api/admin/users/:id/impersonate', [adminOnly], impersonate, {
    params: { id: int() },
  }),
  route('GET', '/api/students/search', [requireAuth()], searchStudents),
]

// Referenced by the S16 handlers (same admin guard and id parsing).
export { adminOnly, idOf }
