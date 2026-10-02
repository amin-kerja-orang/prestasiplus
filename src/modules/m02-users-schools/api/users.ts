/**
 * M02 admin user endpoints (SRS M02 v1.28 §7 #1–#11, #39) and the proposed `GET /api/admin/config/defaults`
 * (see the note on {@link fetchAdminDefaults}). Types and client functions for S1 (list), S2 (create),
 * S3 (edit) and S16 (SPM packages). UI tasks read this file and do not change it (build-plan §S.3
 * rule 5). Every `/api/admin/*` call needs an admin session (guest `401`, other roles `403`,
 * FR-M02-99); #39 needs any session.
 *
 * All ids are integers (§6). Success texts of the mutations are the UNVERIFIED COPY of SRS §8.
 */

import { api, type ListResult } from '@/api'
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
}

/** #4 `POST /api/admin/users`: only the fields of the visible section are sent (FR-M02-21). */
export interface CreateAdminUserRequest {
  role: Role
  name: string
  email: string
  phone?: string | null
  password: string
  passwordConfirmation: string
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
  newPassword?: string | null
  newPasswordConfirmation?: string | null
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
  /** 1 for `t4`, 2 for `t5`. */
  packageId: number
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

/** #3 `GET /api/admin/users/:id` (404 for an unknown id). */
export function fetchAdminUser(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<AdminUserDetail> {
  return api.get<AdminUserDetail>(
    `/api/admin/users/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** #4 `POST /api/admin/users` (201; `422 VALIDATION_ERROR` with `fields`). */
export function createAdminUser(
  request: CreateAdminUserRequest,
): Promise<UserMutation<AdminUserDetail>> {
  return api.post<UserMutation<AdminUserDetail>>('/api/admin/users', { body: request, raw: true })
}

/** #5 `PUT /api/admin/users/:id` (422 with `fields`; 404). */
export function updateAdminUser(
  id: number,
  request: UpdateAdminUserRequest,
): Promise<UserMutation<AdminUserDetail>> {
  return api.put<UserMutation<AdminUserDetail>>(`/api/admin/users/${String(id)}`, {
    body: request,
    raw: true,
  })
}

/** #6 `DELETE /api/admin/users/:id` (404; 422 for the admin's own account). */
export function deleteAdminUser(id: number): Promise<UserMutation<{ deleted: number }>> {
  return api.delete<UserMutation<{ deleted: number }>>(`/api/admin/users/${String(id)}`, {
    raw: true,
  })
}

/** #7 `POST /api/admin/users/bulk-delete` (422 for no ids or the admin's own id). */
export function bulkDeleteAdminUsers(
  ids: readonly number[],
): Promise<UserMutation<{ deleted: number }>> {
  return api.post<UserMutation<{ deleted: number }>>('/api/admin/users/bulk-delete', {
    body: { ids },
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
    body: request,
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
 */
export function fetchAdminDefaults(options: { signal?: AbortSignal } = {}): Promise<AdminDefaults> {
  return api.get<AdminDefaults>(
    '/api/admin/config/defaults',
    options.signal ? { signal: options.signal } : {},
  )
}
