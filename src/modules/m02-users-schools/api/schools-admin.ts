/**
 * M02 school administration endpoints (SRS v1.28 §7 #24–#28, #43 and `GET /api/admin/schools/options`
 * of XL-13; build-plan M02-T2). Types and client functions for S9 (list), S10/S11 (create/edit) and
 * the M04 school select. Every call needs an admin session (`AD`). UI tasks read this file and do
 * not change it (build-plan §S.3 rule 5).
 *
 * Mutations resolve to `{data, status}` (`status` = the flash text, UNVERIFIED COPY §8), so the
 * screen can show the green alert.
 */

import { api, type ListResult } from '@/api'

import type { SchoolSummary } from './schools'

/** BR-21. */
export type SchoolType = 'SK' | 'SMK' | 'SJK(C)' | 'SJK(T)' | 'MRSM' | 'SBP'

/** DATA-M02-03 with the derived counts (S9 "Pelajar" / "Guru"). */
export interface AdminSchool extends SchoolSummary {
  isActive: boolean
  createdAt: string
  updatedAt: string
  /** Users with role `student` at the school (active and inactive). */
  studentCount: number
  /** Users with role `teacher` at the school. */
  teacherCount: number
}

/** `meta.counts` of #24: over all schools, not affected by the filters. */
export interface SchoolCounts extends Record<string, number> {
  total: number
  active: number
  inactive: number
}

export interface SchoolListMeta {
  counts: SchoolCounts
  /** Distinct school types present in the data (the S9 "Jenis" filter options). */
  types: string[]
}

export interface SchoolListQuery {
  search?: string | null
  state?: string | null
  type?: string | null
  page?: number
  signal?: AbortSignal
}

/** #26 / #27 body. `district` and `city` may be empty; `isActive` defaults to true on create. */
export interface SchoolInputBody {
  name: string
  code: string
  type: SchoolType
  state: string
  district?: string | null
  city?: string | null
  isActive?: boolean
}

/** A mutation result: the data plus the flash text. */
export interface SchoolMutation<T> {
  data: T
  status: string
}

/** §6.3 `SchoolOption` (#43). */
export interface SchoolOption {
  id: number
  name: string
}

/** #24 `GET /api/admin/schools`: 30 per page, name A→Z. */
export function fetchAdminSchools(
  query: SchoolListQuery = {},
): Promise<ListResult<AdminSchool, SchoolListMeta>> {
  return api.list<AdminSchool, SchoolListMeta>('/api/admin/schools', {
    query: {
      search: query.search ?? null,
      state: query.state ?? null,
      type: query.type ?? null,
      page: query.page ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #25 `GET /api/admin/schools/:id` (404 for an unknown school). */
export function fetchAdminSchool(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<AdminSchool> {
  return api.get<AdminSchool>(
    `/api/admin/schools/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** #26 `POST /api/admin/schools` (201; 422 with `fields`, e.g. a duplicate code). */
export function createSchool(input: SchoolInputBody): Promise<SchoolMutation<AdminSchool>> {
  return api.post<SchoolMutation<AdminSchool>>('/api/admin/schools', { body: input, raw: true })
}

/** #27 `PUT /api/admin/schools/:id` (404; 422). */
export function updateSchool(
  id: number,
  input: SchoolInputBody,
): Promise<SchoolMutation<AdminSchool>> {
  return api.put<SchoolMutation<AdminSchool>>(`/api/admin/schools/${String(id)}`, {
    body: input,
    raw: true,
  })
}

/** #28 `POST /api/admin/schools/:id/toggle`: flips `isActive` (404 for an unknown school). */
export function toggleSchool(id: number): Promise<SchoolMutation<{ isActive: boolean }>> {
  return api.post<SchoolMutation<{ isActive: boolean }>>(
    `/api/admin/schools/${String(id)}/toggle`,
    { raw: true },
  )
}

/**
 * #43 `GET /api/schools?all=1` (consumer M04 #31): every school of the register, active and
 * inactive, name A→Z, no paging. `GET /api/admin/schools/options` (XL-13) answers the same.
 */
export function fetchSchoolOptions(
  options: { signal?: AbortSignal } = {},
): Promise<SchoolOption[]> {
  return api.get<SchoolOption[]>('/api/schools', {
    query: { all: 1 },
    ...(options.signal ? { signal: options.signal } : {}),
  })
}
