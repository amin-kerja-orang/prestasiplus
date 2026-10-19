/**
 * M02 S16 SPM package assignment (SRS v1.28 §7 #10, #11; BR-13, FR-M02-47…50). Admin only.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 10 | `GET /api/admin/users/:id/packages` | the two cards (T4, T5), what is assigned, the school and the T5 count; 404; 422 for a non-school-admin |
 * | 11 | `POST /api/admin/users/:id/packages` | upsert per (user, form level); quota 1–2000 (DV-M02-07); 404; 422 |
 *
 * INFERRED: the refusal text for a user that is not a school admin, the success text ("Pakej berjaya
 * ditetapkan.", UNVERIFIED COPY §8) and the `packageId` ↔ `formLevel` pairing (t4 → 1, t5 → 2, BR-22).
 */

import {
  int,
  min,
  max,
  notFound,
  ok,
  oneOf,
  required,
  route,
  rule,
  validate,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import type { AdminUserPackages, FormLevel } from '../../api/users'
import { schoolsRepo } from '../repository/schools'
import {
  PACKAGE_QUOTA_MAX,
  PACKAGE_QUOTA_MIN,
  SCHOOL_ADMIN_PACKAGES,
  schoolAdminPackagesRepo,
} from './school-admin-packages-store'
import { adminOnly, idOf } from './users-admin'
import { bodyOf, intOrNull } from './users-input'

/** UNVERIFIED COPY (§8). */
export const MSG_PACKAGE_ASSIGNED = 'Pakej berjaya ditetapkan.'
export const MSG_NOT_SCHOOL_ADMIN = 'Pengguna ini bukan admin sekolah.'

/** BR-22 / FR-M02-48: "RM 30/pelajar · {years} tahun". */
const priceLabel = (years: number): string => `RM 30/pelajar · ${String(years)} tahun`

function getPackages(req: MockRequest): MockResponse {
  const user = users.get(idOf(req))
  if (!user) return notFound()
  if (user.role !== 'school_admin') return validationError({ id: MSG_NOT_SCHOOL_ADMIN })
  const assigned = schoolAdminPackagesRepo.forUser(user.id)
  const data: AdminUserPackages = {
    user: { id: user.id, name: user.name },
    school: user.schoolId === null ? null : schoolsRepo.summary(user.schoolId),
    packages: SCHOOL_ADMIN_PACKAGES.map((p) => {
      const row = assigned.find((a) => a.formLevel === p.formLevel)
      return {
        formLevel: p.formLevel,
        packageId: p.packageId,
        code: p.code,
        name: p.name,
        priceLabel: priceLabel(p.years),
        years: p.years,
        assigned: row ? { studentQuota: row.studentQuota, assignedAt: row.assignedAt } : null,
      }
    }),
    // FR-M02-48: "{n} pelajar T5 sedia ada dalam sistem" = the school's students at class level T5 (grade 11).
    existingT5Count:
      user.schoolId === null
        ? 0
        : users.countWhere({ role: 'student', schoolId: user.schoolId, grade: 11 }),
  }
  return ok(data)
}

const packageOf = (level: unknown) => SCHOOL_ADMIN_PACKAGES.find((p) => p.formLevel === level)

function assignPackage(req: MockRequest, ctx: MockContext): MockResponse {
  const user = users.get(idOf(req))
  if (!user) return notFound()
  if (user.role !== 'school_admin') return validationError({ id: MSG_NOT_SCHOOL_ADMIN })
  const body = bodyOf(req)
  // A quota typed into a form arrives as text; the rules see the number.
  const input = { ...body, studentQuota: intOrNull(body.studentQuota) ?? body.studentQuota }
  const invalid = validate(input, {
    formLevel: [required(), oneOf(['t4', 't5'])],
    packageId: [
      required(),
      rule('in', (value, { input: all }) => {
        const pkg = packageOf(all.formLevel)
        return pkg !== undefined && intOrNull(value) === pkg.packageId
          ? null
          : 'The selected :attribute is invalid.'
      }),
    ],
    studentQuota: [
      required(),
      rule('integer', (value) =>
        typeof value === 'number' && Number.isInteger(value)
          ? null
          : 'The :attribute field must be an integer.',
      ),
      min(PACKAGE_QUOTA_MIN),
      max(PACKAGE_QUOTA_MAX),
    ],
  })
  if (invalid) return invalid
  const row = schoolAdminPackagesRepo.assign(
    user.id,
    {
      formLevel: body.formLevel as FormLevel,
      packageId: Number(intOrNull(body.packageId)),
      studentQuota: Number(input.studentQuota),
    },
    ctx.clock.now(),
  )
  return ok(row, { status: MSG_PACKAGE_ASSIGNED })
}

export const userPackageRoutes: RouteDef[] = [
  route('GET', '/api/admin/users/:id/packages', [adminOnly], getPackages, {
    params: { id: int() },
  }),
  route('POST', '/api/admin/users/:id/packages', [adminOnly], assignPackage, {
    params: { id: int() },
  }),
]
