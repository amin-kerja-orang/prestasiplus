/**
 * M02 admin user endpoints (SRS M02 v1.28 §7 #1–#11, #39) and the proposed `GET /api/admin/config/defaults`
 * (see the note on {@link fetchAdminDefaults}). Types and client functions for S1 (list), S2 (create),
 * S3 (edit) and S16 (SPM packages). UI tasks read this file and do not change it (build-plan §S.3
 * rule 5). Every `/api/admin/*` call needs an admin session (guest `401`, other roles `403`,
 * FR-M02-99); #39 needs any session.
 *
 * All ids are integers (§6). Success texts of the mutations are the UNVERIFIED COPY of SRS §8.
 */

import { api, wireId, type EntityId, type ListResult } from '@/api'
import { isHttpMode } from '@/api/mode'
import type { Role, UserMe } from '@/modules/m01-authentication'

import type { SchoolSummary } from './schools'

/** The 8 live role codes (BR-01) plus `unmapped` for the 6 users whose live role is outside them (§6.15 B, D9). */
export type AdminUserRole = Role | 'unmapped'

/** DATA-M02-01 `subscriptionPackage`. */
export type SubscriptionPackage = 'none' | 'regular_monthly' | 'personal'

/** `AdminUserListItem` (§6.1). `school` is `{id, name}`; `avatarUrl` is null unless a picture was uploaded. */
export interface AdminUserListItem {
  id: number
  name: string
  email: string
  phone: string | null
  role: AdminUserRole
  school: { id: number; name: string } | null
  isActive: boolean
  /** ISO 8601 (+08:00). */
  createdAt: string
  avatarUrl: string | null
}

/** The 7 stat cards of S1 (`meta.roleCounts`): all users per role, ignoring the filters (BR-02). */
export interface RoleCounts {
  student: number
  teacher: number
  parent: number
  sponsor: number
  schoolAdmin: number
  ppdOfficer: number
  admin: number
}

export interface AdminUserListMeta {
  roleCounts: RoleCounts
}

export interface AdminUserListQuery {
  role?: AdminUserRole | '' | null
  schoolId?: number | null
  isActive?: boolean | null
  /** Name or e-mail substring. */
  search?: string | null
  page?: number | null
  signal?: AbortSignal
}

/** `{data, status}`: the body of a mutation (`raw` response, the flash text is in `status`). */
export interface UserMutation<T> {
  data: T
  status: string
}

/** A linked child (`StudentSearchItem`, §6.1): also the row of #39. */
export interface StudentSearchItem {
  id: number
  name: string
  /** `D1…D6` / `T1…T5`, or null. */
  classLevel: string | null
  schoolName: string | null
}

/**
 * `AdminUserDetail` (§6.1) = `UserMe` + the admin fields. It differs from `UserMe` only where a user can
 * have no session: `role` may be `unmapped` (D9) and `landingPath` is then null.
 */
export interface AdminUserDetail extends Omit<UserMe, 'role' | 'landingPath'> {
  role: AdminUserRole
  landingPath: string | null
  /**
   * The full IC for a seeded fixture, else the mask `xxxxxx-xx-xx` + the last 2 digits (DV-M02-16); null
   * without an IC. Only the admin endpoints return it.
   */
  icNumber: string | null
  isActive: boolean
  subscriptionPackage: SubscriptionPackage
  hasPkskSubscription: boolean
  ppdState: string | null
  ppdDistrict: string | null
  /** The linked children of a `parent`; `[]` for every other role. */
  linkedStudents: StudentSearchItem[]
  /** http mode only: the whole role list of the account (`role` is the first of it). */
  roles?: Role[]
}

/**
 * http mode only (D59b): the create / update response also carries the server-generated password, shown once.
 * `generatedPassword` is absent on an update without `resetPassword`.
 */
export interface AdminUserDetailWithPassword extends AdminUserDetail {
  generatedPassword?: string
}

/** #4 `POST /api/admin/users`: only the fields of the visible section are sent (FR-M02-21). */
export interface CreateAdminUserRequest {
  role: Role
  name: string
  email: string
  phone?: string | null
  /** Mock mode only: in http mode the server generates the password (D59b) and the pair is not sent. */
  password?: string
  passwordConfirmation?: string
  /** Default true. */
  isActive?: boolean
  /** 1–11, required for `student`. */
  grade?: number | null
  icNumber?: string | null
  /** Optional for `student` / `teacher`, required for `school_admin`. */
  schoolId?: number | null
  linkedStudentIds?: number[]
  /** A JPN name (required for `ppd_officer` / `jpn_officer`; defaults to the school's state for a school admin). */
  ppdState?: string | null
  /** A PPD code (required for `ppd_officer`; defaults to the school's district for a school admin). */
  ppdDistrict?: string | null
}

/**
 * #5 `PUT /api/admin/users/:id`. A key that is absent leaves the stored value unchanged (BR-11: the
 * fields of hidden sections are not sent); `null` clears an optional value (`phone`, `schoolId`,
 * `icNumber`).
 */
export interface UpdateAdminUserRequest {
  name: string
  email: string
  phone?: string | null
  role: Role
  isActive: boolean
  grade?: number | null
  icNumber?: string | null
  subscriptionPackage?: SubscriptionPackage
  hasPkskSubscription?: boolean
  schoolId?: number | null
  /** Replaces the whole set; applied only when `role` is `parent`. */
  linkedStudentIds?: number[]
  /** Mock mode only: in http mode there is no admin-chosen password (D59b), see `resetPassword`. */
  newPassword?: string | null
  newPasswordConfirmation?: string | null
  /** http mode only: the whole role list to store (`role` is only the mock's single role). */
  roles?: Role[]
  /** http mode only (D59b): ask the server for a new random password, returned once. */
  resetPassword?: boolean
}

/** #9: the session of the target user (M01 `SessionPayload`); the client replaces `pp.auth` with it. */
export interface ImpersonationSession {
  token: string
  expiresAt: string
  user: UserMe
}

export type FormLevel = 't4' | 't5'

/** DATA-M02-08 `SchoolAdminPackage`. */
export interface SchoolAdminPackage {
  id: number
  userId: number
  formLevel: FormLevel
  packageId: number
  studentQuota: number
  /** ISO 8601 (+08:00). */
  assignedAt: string
}

/** One card of S16 (#10). `priceLabel` = "RM 30/pelajar · {years} tahun". */
export interface AdminPackageCard {
  formLevel: FormLevel
  packageId: number
  /** "T4" / "T5". */
  code: string
  /** "Pakej SPM Tingkatan 4" / "Pakej SPM Tingkatan 5". */
  name: string
  priceLabel: string
  years: number
  assigned: { studentQuota: number; assignedAt: string } | null
}

/** #10. `school` is null only for a school admin without a school (never in the seeds). */
export interface AdminUserPackages {
  user: { id: number; name: string }
  school: SchoolSummary | null
  packages: AdminPackageCard[]
  /** Students of the school with class level T5 (FR-M02-48). */
  existingT5Count: number
}

export interface AssignPackageRequest {
  formLevel: FormLevel
  /** 1 for `t4`, 2 for `t5` (a string id in http mode). */
  packageId: EntityId
  /** 1–2000. */
  studentQuota: number
}

/** The fixture default passwords the screens show (SEC-M02-01…03; dummy values in the prototype). */
export interface AdminDefaults {
  /** S2 generator (FR-M02-30). */
  schoolAdminDefaultPassword: string
  /** S4 "Kata Laluan Default" (FR-M02-53). */
  bulkImportDefaultPassword: string
  /** S7 info alert (FR-M02-70). */
  compStudentDefaultPassword: string
}

/** #1 `GET /api/admin/users`: 25 per page, newest first; `meta.roleCounts` = the S1 stat cards. */
export function fetchAdminUsers(
  query: AdminUserListQuery = {},
): Promise<ListResult<AdminUserListItem, AdminUserListMeta>> {
  return api.list<AdminUserListItem, AdminUserListMeta>('/api/admin/users', {
    query: {
      role: query.role || null,
      schoolId: query.schoolId ?? null,
      isActive:
        query.isActive === undefined || query.isActive === null ? null : query.isActive ? 1 : 0,
      search: query.search || null,
      page: query.page ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #2 `GET /api/admin/users/filters`: the schools with at least one user, by name (FR-M02-04). */
export async function fetchUserFilters(
  options: { signal?: AbortSignal } = {},
): Promise<{ id: number; name: string }[]> {
  const data = await api.get<{ schools: { id: number; name: string }[] }>(
    '/api/admin/users/filters',
    options.signal ? { signal: options.signal } : {},
  )
  return data.schools
}

/**
 * http mode: the wire detail has `roles[]`, a nullable e-mail and `icMasked` (BE-05); the screens use the single
 * `role` (the first role), a string e-mail and `icNumber`. The ids stay the wire strings.
 */
function fromWireDetail<T extends AdminUserDetail>(wire: T): T {
  const w = wire as T & { icMasked?: string | null; email: string | null }
  const roles = w.roles ?? []
  return {
    ...w,
    roles,
    role: roles[0] ?? 'unmapped',
    email: w.email ?? '',
    icNumber: w.icMasked ?? w.icNumber ?? null,
  }
}

/**
 * http mode: the role list to PUT after the form shows `role`. `roles` replaces the whole list server-side, so a
 * multi-role user keeps every role: an unchanged select sends the loaded list, a changed one swaps only the role
 * the select shows (the first) for the new one.
 */
export function rolesAfterEdit(original: readonly Role[], role: Role): Role[] {
  // `student` never combines with another role and `admin` is single-role (contract `UserRolesSchema`).
  if (original.length === 0 || role === 'student' || role === 'admin') return [role]
  return [...new Set(original.map((r, i) => (i === 0 ? role : r)))].filter(
    (r) => r !== 'student' && r !== 'admin',
  )
}

/** #3 `GET /api/admin/users/:id` (404 for an unknown id). */
export async function fetchAdminUser(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<AdminUserDetail> {
  const detail = await api.get<AdminUserDetail>(
    `/api/admin/users/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
  return isHttpMode() ? fromWireDetail(detail) : detail
}

/** #4 `POST /api/admin/users` (201; `422 VALIDATION_ERROR` with `fields`). */
export async function createAdminUser(
  request: CreateAdminUserRequest,
): Promise<UserMutation<AdminUserDetailWithPassword>> {
  if (!isHttpMode()) {
    return api.post<UserMutation<AdminUserDetail>>('/api/admin/users', { body: request, raw: true })
  }
  // D59b: `roles[]`, string ids and no password pair; the server answers with `generatedPassword`.
  const body: Record<string, unknown> = { ...request, roles: [request.role] }
  delete body.role
  delete body.password
  delete body.passwordConfirmation
  if (request.schoolId != null) body.schoolId = wireId(request.schoolId)
  if (request.linkedStudentIds) body.linkedStudentIds = request.linkedStudentIds.map(wireId)
  const result = await api.post<UserMutation<AdminUserDetailWithPassword>>('/api/admin/users', {
    body,
    raw: true,
  })
  return { ...result, data: fromWireDetail(result.data) }
}

/** #5 `PUT /api/admin/users/:id` (422 with `fields`; 404). */
export async function updateAdminUser(
  id: number,
  request: UpdateAdminUserRequest,
): Promise<UserMutation<AdminUserDetailWithPassword>> {
  const url = `/api/admin/users/${String(id)}`
  if (!isHttpMode()) {
    return api.put<UserMutation<AdminUserDetail>>(url, { body: request, raw: true })
  }
  // D59b: `roles[]` (whole list), string ids, no password pair, no subscription fields (derived read-only).
  const body: Record<string, unknown> = { ...request, roles: request.roles ?? [request.role] }
  for (const key of [
    'role',
    'newPassword',
    'newPasswordConfirmation',
    'subscriptionPackage',
    'hasPkskSubscription',
  ])
    delete body[key]
  // A username-only account has no e-mail (`null` on the wire, '' in the form): an empty value is not sent,
  // so the stored value is kept instead of failing the contract's e-mail format.
  if (body.email === '') delete body.email
  if (request.schoolId != null) body.schoolId = wireId(request.schoolId)
  if (request.linkedStudentIds) body.linkedStudentIds = request.linkedStudentIds.map(wireId)
  const result = await api.put<UserMutation<AdminUserDetailWithPassword>>(url, {
    body,
    raw: true,
  })
  return { ...result, data: fromWireDetail(result.data) }
}

/** #6 `DELETE /api/admin/users/:id` (404; 422 for the admin's own account). */
export function deleteAdminUser(id: number): Promise<UserMutation<{ deleted: number }>> {
  return api.delete<UserMutation<{ deleted: number }>>(`/api/admin/users/${String(id)}`, {
    raw: true,
  })
}

/** #7 `POST /api/admin/users/bulk-delete` (422 for no ids or the admin's own id). */
export function bulkDeleteAdminUsers(
  ids: readonly EntityId[],
): Promise<UserMutation<{ deleted: number }>> {
  // Contract `BulkDeleteRequestSchema`: `ids` are strings (SWX-2): never leave a number in the body in http mode.
  return api.post<UserMutation<{ deleted: number }>>('/api/admin/users/bulk-delete', {
    body: { ids: ids.map(wireId) },
    raw: true,
  })
}

/** #8 `POST /api/admin/users/:id/toggle-active`. */
export function toggleUserActive(id: number): Promise<UserMutation<{ isActive: boolean }>> {
  return api.post<UserMutation<{ isActive: boolean }>>(
    `/api/admin/users/${String(id)}/toggle-active`,
    { raw: true },
  )
}

/**
 * #9 `POST /api/admin/users/:id/impersonate` ("Login As"): the caller replaces the client session with the
 * returned one and navigates to `user.landingPath`, with no message and no return control (FR-M02-12).
 */
export function impersonateUser(id: number): Promise<ImpersonationSession> {
  return api.post<ImpersonationSession>(`/api/admin/users/${String(id)}/impersonate`)
}

/** #10 `GET /api/admin/users/:id/packages` (404; 422 when the user is not a school admin). */
export function fetchUserPackages(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<AdminUserPackages> {
  return api.get<AdminUserPackages>(
    `/api/admin/users/${String(id)}/packages`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** #11 `POST /api/admin/users/:id/packages`: assigning again replaces the quota (BR-13). */
export function assignUserPackage(
  id: number,
  request: AssignPackageRequest,
): Promise<UserMutation<SchoolAdminPackage>> {
  return api.post<UserMutation<SchoolAdminPackage>>(`/api/admin/users/${String(id)}/packages`, {
    // Contract `SchoolPackageAssignRequestSchema`: `packageId` is a string (SWX-2).
    body: { ...request, packageId: wireId(request.packageId) },
    raw: true,
  })
}

/** #39 `GET /api/students/search?q=`: up to 15 students (any session); `[]` for a query under 2 characters. */
export function searchStudents(
  q: string,
  options: { signal?: AbortSignal } = {},
): Promise<StudentSearchItem[]> {
  return api.get<StudentSearchItem[]>('/api/students/search', {
    query: { q },
    ...(options.signal ? { signal: options.signal } : {}),
  })
}

/**
 * PROPOSED (not in SRS §7; INFERRED) `GET /api/admin/config/defaults`: the three fixture default passwords
 * that live renders into S2 / S4 / S7. Admin only. The contract lists no endpoint for them although the
 * screens show them (§6.12), so the mock adds this one; it goes into §7 when M02 is next revised.
 * MOCK MODE ONLY: the real API removed the route on purpose (D59b, no shared default password: it is 404), so
 * no http-mode code path may call this.
 */
export function fetchAdminDefaults(options: { signal?: AbortSignal } = {}): Promise<AdminDefaults> {
  // SWEEP-23OCT A5: the real API has no such route (and must not hand out default passwords), so http mode
  // never fires the request; callers already treat a failure as "no defaults" (empty value / placeholder).
  if (isHttpMode())
    return Promise.reject(new Error('Tiada kata laluan lalai dalam mod API sebenar.'))
  return api.get<AdminDefaults>(
    '/api/admin/config/defaults',
    options.signal ? { signal: options.signal } : {},
  )
}
