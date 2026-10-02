/**
 * M02 imports, quota and existing-students lookup (SRS v1.28 §7 #12–#15). Admin-only (`AD`).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 12 | `POST /api/admin/users/bulk-import` | S4; BR-14; 200 `{data: ImportResult, status}`; 422 |
 * | 13 | `POST /api/admin/students/import` | S5; BR-15; 200; 422 (no subscription, quota) |
 * | 14 | `GET /api/admin/schools/:id/quota` | BR-16; 404 |
 * | 15 | `GET /api/admin/schools/:id/students?search=&classLevel=` | BR-17; ≤ 200, name A→Z (INFERRED order) |
 *
 * The import handlers are `async` (they read an uploaded file) and write inside `ctx.transaction`,
 * so a failure rolls the whole import back. The body is JSON or multipart; in multipart every value
 * arrives as text, so ids are read as integers from either form.
 *
 * INFERRED (URS OQ-2, unobserved): the flash texts (§8 placeholders), the messages of failed lines
 * (`import/records.ts`), that the S5 class level is not checked against the school type (the
 * screen only offers the matching groups, FR-M02-61), that an import whose new records exceed the
 * remaining quota is refused as a whole with "Kuota tidak mencukupi." (BR-15), and that a
 * `grace` subscription grants the quota like an `active` one (BR-16).
 */

import { users } from '@/modules/m01-authentication/mock'
import {
  int,
  notFound,
  ok,
  queryString,
  requireRole,
  route,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { ExistingStudent, ImportMode, ImportResult } from '../../api/imports'
import { adminDefaults } from './admin-config'
import {
  countStudentRecords,
  countUserRecords,
  gradeOfClassLevel,
  planStudentImport,
  planUserImport,
} from '../import/records'
import { readImportFile } from '../import/text'
import { schoolQuota } from '../quota'
import { schoolsRepo } from '../repository/schools'

const adminOnly = requireRole('admin')

/** The roles S4 can create (BR-14, BR-01 short labels Guru / Ibu Bapa / Admin / PPD). */
export const BULK_IMPORT_ROLES = ['teacher', 'parent', 'school_admin', 'ppd_officer'] as const
type BulkRole = (typeof BULK_IMPORT_ROLES)[number]
/** Roles that must name a school (BR-14). */
const SCHOOL_REQUIRED_ROLES: readonly string[] = ['teacher', 'school_admin']

export const IMPORT_NO_DATA = 'Tiada data untuk diimport.'
export const IMPORT_NO_SUBSCRIPTION =
  'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.'
export const IMPORT_QUOTA_SHORT = 'Kuota tidak mencukupi.'

/** UNVERIFIED COPY (§8). */
export function usersImportedText(r: Pick<ImportResult, 'created' | 'skipped' | 'failed'>): string {
  return `Import selesai: ${String(r.created)} pengguna didaftarkan, ${String(r.skipped)} dilangkau, ${String(r.failed)} gagal.`
}
export function studentsImportedText(r: Pick<ImportResult, 'created' | 'skipped'>): string {
  return `Import selesai: ${String(r.created)} pelajar didaftarkan, ${String(r.skipped)} dilangkau.`
}

/** The most students a lookup returns (BR-17, OBSERVED). */
export const EXISTING_STUDENTS_LIMIT = 200

type Body = Record<string, unknown>

function bodyOf(req: MockRequest): Body {
  const b = req.body
  return typeof b === 'object' && b !== null && !Array.isArray(b) && !(b instanceof Blob)
    ? (b as Body)
    : {}
}

/** A text field, trimmed; `''` when absent or not text. */
function text(b: Body, key: string): string {
  const v = b[key]
  return typeof v === 'string' ? v.trim() : ''
}

/** An id in JSON (number) or multipart (digits); `undefined` when absent or malformed. */
function idField(b: Body, key: string): number | undefined {
  const v = b[key]
  if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return v
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : undefined
  }
  return undefined
}

/** `importMode` and the text to import; a 422 response when the mode or the data is missing. */
async function importText(
  b: Body,
  fields: Record<string, string>,
): Promise<{ mode: ImportMode; text: string } | null> {
  const mode = text(b, 'importMode')
  if (mode === '') {
    fields.importMode = 'The import mode field is required.'
    return null
  }
  if (mode !== 'csv' && mode !== 'paste') {
    fields.importMode = 'The selected import mode is invalid.'
    return null
  }
  const content =
    mode === 'csv'
      ? await readImportFile(b.csvFile)
      : typeof b.pasteContent === 'string'
        ? b.pasteContent
        : undefined
  return { mode, text: content ?? '' }
}

function dataField(mode: ImportMode): string {
  return mode === 'csv' ? 'csvFile' : 'pasteContent'
}

function result(planned: number, skipped: number, failed: number, errors: ImportResult['errors']) {
  return { created: planned, skipped, failed, errors } satisfies ImportResult
}

/** #12 S4. */
async function bulkImport(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const b = bodyOf(req)
  const fields: Record<string, string> = {}

  const role = text(b, 'role')
  if (role === '') fields.role = 'The role field is required.'
  else if (!(BULK_IMPORT_ROLES as readonly string[]).includes(role)) {
    fields.role = 'The selected role is invalid.'
  }

  const schoolId = idField(b, 'schoolId')
  const schoolGiven = b.schoolId !== undefined && b.schoolId !== null && b.schoolId !== ''
  if (schoolGiven && (schoolId === undefined || !schoolsRepo.get(schoolId))) {
    fields.schoolId = 'The selected school id is invalid.'
  } else if (!schoolGiven && SCHOOL_REQUIRED_ROLES.includes(role)) {
    fields.schoolId = 'The school id field is required.'
  }

  // SEC-M02-03: an empty field falls back to the configured bulk default.
  const typed = text(b, 'defaultPassword')
  if (typed !== '' && [...typed].length < 6) {
    fields.defaultPassword = 'The default password field must be at least 6 characters.'
  }
  const defaultPassword = typed === '' ? adminDefaults(ctx).bulkImportDefaultPassword : typed

  const source = await importText(b, fields)
  if (source && countUserRecords(source.text) === 0) fields[dataField(source.mode)] = IMPORT_NO_DATA

  if (Object.keys(fields).length > 0) return validationError(fields)

  const school = schoolId === undefined ? undefined : schoolsRepo.get(schoolId)
  const { planned, skipped, failed, errors } = planUserImport(
    (source as { text: string }).text,
    (email) => users.findByEmail(email) !== undefined,
  )
  const now = ctx.clock.now()
  const adminId = req.session?.userId ?? null

  ctx.transaction(() => {
    for (const p of planned) {
      const user = users.create(
        {
          name: p.name,
          email: p.email,
          phone: p.phone,
          role: role as BulkRole,
          schoolId: schoolId ?? null,
          isActive: true,
          createdById: adminId,
          // INFERRED (BR-09): a school admin carries the JPN and PPD of its school.
          ...(role === 'school_admin' && school
            ? { ppdState: school.state, ppdDistrict: school.district }
            : {}),
        },
        now,
      )
      users.setPassword(user.id, p.password === '' ? defaultPassword : p.password)
    }
  })

  const data = result(planned.length, skipped, failed, errors)
  return ok(data, { status: usersImportedText(data) })
}

/** #13 S5. */
async function studentImport(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const b = bodyOf(req)
  const fields: Record<string, string> = {}

  const schoolId = idField(b, 'schoolId')
  const schoolGiven = b.schoolId !== undefined && b.schoolId !== null && b.schoolId !== ''
  if (!schoolGiven) fields.schoolId = 'The school id field is required.'
  else if (schoolId === undefined || !schoolsRepo.get(schoolId)) {
    fields.schoolId = 'The selected school id is invalid.'
  }

  const classLevel = text(b, 'classLevel')
  const grade = gradeOfClassLevel(classLevel)
  if (classLevel === '') fields.classLevel = 'The class level field is required.'
  else if (grade === undefined) fields.classLevel = 'The selected class level is invalid.'

  const source = await importText(b, fields)
  if (source && countStudentRecords(source.text, source.mode) === 0) {
    fields[dataField(source.mode)] = IMPORT_NO_DATA
  }
  if (Object.keys(fields).length > 0) return validationError(fields)

  // BR-15: the school must have an active subscription.
  const quota = schoolQuota(schoolId as number)
  if (!quota.hasSubscription) return validationError({ schoolId: IMPORT_NO_SUBSCRIPTION })

  const { planned, skipped, failed, errors } = planStudentImport(
    (source as { text: string }).text,
    (source as { mode: ImportMode }).mode,
    (email) => users.findByEmail(email) !== undefined,
  )
  // BR-15 (INFERRED): more new records than the remaining quota refuses the whole import.
  if (planned.length > (quota.remaining ?? 0)) {
    return validationError({ schoolId: IMPORT_QUOTA_SHORT })
  }

  const now = ctx.clock.now()
  const adminId = req.session?.userId ?? null
  ctx.transaction(() => {
    for (const p of planned) {
      const user = users.create(
        {
          name: p.name,
          email: p.email,
          role: 'student',
          grade,
          schoolId,
          idDelima: p.email,
          isActive: true,
          createdById: adminId,
        },
        now,
      )
      users.setPassword(user.id, p.password)
      if (p.icNumber !== null) users.setIcNumber(user.id, p.icNumber)
    }
  })

  const data = result(planned.length, skipped, failed, errors)
  return ok(data, { status: studentsImportedText(data) })
}

/** #15: the students of a school, filtered by name / e-mail / DELIMa ID text and class level. */
function existingStudents(schoolId: number, search: string, classLevel: string): ExistingStudent[] {
  const term = search.trim().toLowerCase()
  const rows = users.adminList({ role: 'student', schoolId, page: 1, pageSize: 100_000 }).rows
  return rows
    .filter(
      (u) =>
        (classLevel === '' || u.classLevel === classLevel) &&
        (term === '' ||
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.idDelima ?? '').toLowerCase().includes(term)),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .slice(0, EXISTING_STUDENTS_LIMIT)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      idDelima: u.idDelima,
      classLevel: u.classLevel,
      isActive: u.isActive,
    }))
}

export const importRoutes: RouteDef[] = [
  route('POST', '/api/admin/users/bulk-import', [adminOnly], bulkImport),
  route('POST', '/api/admin/students/import', [adminOnly], studentImport),
  route(
    'GET',
    '/api/admin/schools/:id/quota',
    [adminOnly],
    (req) => {
      const id = req.params.id as number
      return schoolsRepo.get(id) ? ok(schoolQuota(id)) : notFound()
    },
    { params: { id: int() } },
  ),
  route(
    'GET',
    '/api/admin/schools/:id/students',
    [adminOnly],
    (req) => {
      const id = req.params.id as number
      if (!schoolsRepo.get(id)) return notFound()
      return ok(
        existingStudents(
          id,
          queryString(req.query, 'search') ?? '',
          queryString(req.query, 'classLevel') ?? '',
        ),
      )
    },
    { params: { id: int() } },
  ),
]
