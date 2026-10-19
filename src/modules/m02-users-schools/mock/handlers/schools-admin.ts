/**
 * M02 school administration (SRS v1.28 §7 #24–#28, #43; XL-13). All admin-only (`AD`): a guest gets
 * `401`, any other role `403` (FR-M02-99).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 24 | `GET /api/admin/schools?search=&state=&type=&page=` | 30 per page, name A→Z; `meta.counts {total, active, inactive}` over all schools, `meta.types` |
 * | 25 | `GET /api/admin/schools/:id` | 404 |
 * | 26 | `POST /api/admin/schools` | 201 `{data, status}`; 422 with `fields` |
 * | 27 | `PUT /api/admin/schools/:id` | 200; 404; 422 |
 * | 28 | `POST /api/admin/schools/:id/toggle` | `{data: {isActive}, status}`; 404 |
 * | 43 | `GET /api/schools?all=1` and `GET /api/admin/schools/options` | every school (active and inactive), name A→Z |
 *
 * The handlers only shape requests and responses; the rules live in the repository (school store)
 * and the validation table below. Unobserved rules are INFERRED (BR-20): a school code is unique
 * (case-insensitive), a school is never deleted.
 */

import { users } from '@/modules/m01-authentication/mock'
import {
  created,
  int,
  notFound,
  ok,
  oneOf,
  pageParams,
  paged,
  queryString,
  requireRole,
  required,
  route,
  rule,
  max,
  unique,
  validationErrors,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { AdminSchool } from '../../api/schools-admin'
import { STATE_NAMES } from '../data/geo'
import { schoolsRepo, type SchoolInput } from '../repository/schools'
import type { School, SchoolType } from '../repository/types'

export const SCHOOLS_PAGE_SIZE = 30

/** BR-21. */
export const SCHOOL_TYPES: readonly SchoolType[] = ['SK', 'SMK', 'SJK(C)', 'SJK(T)', 'MRSM', 'SBP']

/** UNVERIFIED COPY (§8): placeholders until the live copy is observed. */
export const SCHOOL_SAVED = 'Sekolah berjaya disimpan.'
export const SCHOOL_TOGGLED = 'Status sekolah berjaya dikemaskini.'

const adminOnly = requireRole('admin')

/** The S9 row / S11 record: the school plus its derived counts (DATA-M02-03). */
export function toAdminSchool(s: School): AdminSchool {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type,
    state: s.state,
    district: s.district,
    city: s.city,
    isActive: s.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    studentCount: users.countWhere({ role: 'student', schoolId: s.id }),
    teacherCount: users.countWhere({ role: 'teacher', schoolId: s.id }),
  }
}

/** Laravel trims every string input before validation. */
function trimmed(body: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return out
  for (const [key, value] of Object.entries(body)) {
    out[key] = typeof value === 'string' ? value.trim() : value
  }
  return out
}

const isString = () =>
  rule('string', (value) =>
    typeof value === 'string' ? null : 'The :attribute field must be a string.',
  )

/** Laravel `boolean`: true, false, 1, 0, "1", "0". */
function asBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  return undefined
}

const isBoolean = () =>
  rule('boolean', (value) =>
    asBoolean(value) === undefined ? 'The :attribute field must be true or false.' : null,
  )

/** S10/S11 rules (§5): `ignoreId` = the school being edited (its own code is not a duplicate). */
function schoolRules(ignoreId: number | null) {
  return {
    name: [required(), isString(), max(255)],
    code: [
      required(),
      isString(),
      max(20),
      unique((value) => {
        const hit = schoolsRepo.findByCode(String(value))
        return hit !== undefined && hit.id !== ignoreId
      }),
    ],
    type: [required(), oneOf(SCHOOL_TYPES)],
    state: [required(), oneOf(STATE_NAMES)],
    district: [isString(), max(255)],
    city: [isString(), max(255)],
    isActive: [isBoolean()],
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** A validated body as repository input; `isActive` falls back to `fallback` when absent. */
function toInput(body: Record<string, unknown>, fallback: boolean): SchoolInput {
  return {
    name: body.name as string,
    code: body.code as string,
    type: body.type as SchoolType,
    state: body.state as string,
    district: textOrNull(body.district),
    city: textOrNull(body.city),
    isActive: asBoolean(body.isActive) ?? fallback,
  }
}

function idOf(req: MockRequest): number {
  return req.params.id as number
}

function options(): MockResponse {
  return ok(schoolsRepo.options())
}

export const schoolAdminRoutes: RouteDef[] = [
  route('GET', '/api/admin/schools', [adminOnly], (req) => {
    const pageReq = pageParams(req.query, { pageSize: SCHOOLS_PAGE_SIZE })
    const search = queryString(req.query, 'search')
    const state = queryString(req.query, 'state')
    const type = queryString(req.query, 'type')
    const result = schoolsRepo.list({
      ...(search === undefined ? {} : { search }),
      ...(state === undefined ? {} : { state }),
      ...(type === undefined ? {} : { type }),
      page: pageReq.page,
      pageSize: pageReq.pageSize,
    })
    return paged({ rows: result.rows.map(toAdminSchool), total: result.total }, pageReq, {
      counts: schoolsRepo.counts(),
      types: schoolsRepo.types(),
    })
  }),

  // XL-13 alias: registered before `:id` (a static segment wins over a parameter anyway).
  route('GET', '/api/admin/schools/options', [adminOnly], () => options()),

  route(
    'GET',
    '/api/admin/schools/:id',
    [adminOnly],
    (req) => {
      const school = schoolsRepo.get(idOf(req))
      return school ? ok(toAdminSchool(school)) : notFound()
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/schools', [adminOnly], (req, ctx) => {
    const body = trimmed(req.body)
    const fields = validationErrors(body, schoolRules(null))
    if (fields) return validationError(fields)
    const school = schoolsRepo.create(toInput(body, true), ctx.clock.now())
    return created(toAdminSchool(school), { status: SCHOOL_SAVED })
  }),

  route(
    'PUT',
    '/api/admin/schools/:id',
    [adminOnly],
    (req, ctx) => {
      const id = idOf(req)
      const current = schoolsRepo.get(id)
      if (!current) return notFound()
      const body = trimmed(req.body)
      const fields = validationErrors(body, schoolRules(id))
      if (fields) return validationError(fields)
      const school = schoolsRepo.update(id, toInput(body, current.isActive), ctx.clock.now())
      return ok(toAdminSchool(school), { status: SCHOOL_SAVED })
    },
    { params: { id: int() } },
  ),

  route(
    'POST',
    '/api/admin/schools/:id/toggle',
    [adminOnly],
    (req, ctx) => {
      const id = idOf(req)
      if (!schoolsRepo.get(id)) return notFound()
      const school = schoolsRepo.toggleActive(id, ctx.clock.now())
      return ok({ isActive: school.isActive }, { status: SCHOOL_TOGGLED })
    },
    { params: { id: int() } },
  ),

  // #43 (M04 #31): `all=1` is required; there is no paging or search.
  route('GET', '/api/schools', [adminOnly], (req) => {
    if (queryString(req.query, 'all') !== '1') {
      return validationError({ all: 'The all field is required.' })
    }
    return options()
  }),
]
