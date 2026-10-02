/**
 * M02 complimentary students (SRS v1.28 §7 #16–#23; BR-18, BR-19; FR-M02-65…75). All admin-only (`AD`):
 * a guest gets `401`, any other role `403` (FR-M02-99).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 16 | `GET /api/admin/comp-students?page=` | 50 per page, newest first (INFERRED); `meta.counts {coinsOff, total}` over all 90 |
 * | 17 | `POST /api/admin/comp-students` | BR-18; 201 `ImportResult`; ids from 9,000,001 (X-9) |
 * | 18 | `GET …/:id` | profile + enrolments; 404 unless a complimentary student |
 * | 19 | `POST …/bulk-action` | `coins_off` / `coins_on` / `deactivate` / `activate` on the given ids |
 * | 20, 21 | `POST …/:id/toggle-coins`, `…/toggle-active` | 404 |
 * | 22 | `GET /api/admin/teachers` | every teacher, by name |
 * | 23 | `GET /api/admin/teachers/:id/classrooms` | the teacher's active classes (M10), `[]` for none or an unknown teacher |
 *
 * REQUIRES the M10 mock plugin (and so M03, M04) booted with M02: #16, #17, #18 and #23 read the M10
 * classes and answer a clear `500` (`MSG_NEEDS_M10`) otherwise.
 *
 * The user row belongs to M01 (the users store); the class, teacher and enrolment come from the M10
 * `classrooms` repository (never copied); `coinsEnabled`, `packageExpiresAt` and "Sekolah asal" live in
 * the M02 `complimentaryProfiles` table.
 *
 * INFERRED (SRS §5 / §8 "UNVERIFIED COPY"): the success and error texts; a line without a comma, without
 * a name or whose IC has fewer than 6 digits is `failed` (with an `errors` entry), a username that already
 * exists (or repeats in the paste) is `skipped` (BR-18); the school and grade come from the classroom;
 * names are kept as typed (trimmed); the IC is kept as digits; the list order (newest first) and "Kelas" =
 * the first active class by id; the unknown-teacher answer of #23 (`[]`, like the live query); bulk action
 * ids that are not complimentary students are ignored (`updated` counts the ones applied).
 */

import {
  created,
  serverError,
  int,
  notFound,
  ok,
  oneOf,
  paged,
  pageParams,
  required,
  requireRole,
  route,
  rule,
  validate,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type {
  CompBulkAction,
  CompStudentClass,
  CompStudentDetail,
  CompStudentListItem,
  TeacherClassroomOption,
  TeacherOption,
} from '../../api/comp-students'
import type { ImportResult } from '../../api/imports'
import { adminDefaults } from './admin-config'
import {
  COMP_PACKAGE,
  compExpiresAt,
  complimentaryRepo,
  DEFAULT_PACKAGE_EXPIRES_AT,
  isHiddenComp,
} from '../repository/complimentary'
import { schoolsRepo } from '../repository/schools'
import { bodyOf, intList, intOrNull } from './users-input'

/** FR-M02-66. */
export const COMP_PAGE_SIZE = 50
export const COMP_USERNAME_DOMAIN = '@prestasiplus.my'

// UNVERIFIED COPY (§8): placeholders until the live copy is verified.
export const compCreatedText = (n: number): string =>
  `${String(n)} pelajar komplimen berjaya didaftarkan.`
export const MSG_COMP_ACTION_DONE = 'Tindakan berjaya dilaksanakan.'
// INFERRED line errors of the S7 register.
export const MSG_COMP_BAD_LINE = 'Format baris tidak sah. Gunakan NAMA, NOKP.'
export const MSG_COMP_SHORT_IC = 'No. KP mesti sekurang-kurangnya 6 digit.'

const adminOnly = requireRole('admin')

export const MSG_NEEDS_M10 =
  'Pelajar komplimen memerlukan pemalam mock M10 (kelas), M03 dan M04 dimuatkan bersama M02.'

/** #16, #17, #18, #23 read the M10 classes: without the M10 plugin booted the answer is a clear 500. */
function withClasses(handler: (req: MockRequest, ctx: MockContext) => MockResponse) {
  return (req: MockRequest, ctx: MockContext): MockResponse =>
    ctx.db.store('m10.classrooms') !== undefined ? handler(req, ctx) : serverError(MSG_NEEDS_M10)
}

const idOf = (req: MockRequest): number => Number(req.params.id)

const BULK_ACTIONS: readonly CompBulkAction[] = ['coins_off', 'coins_on', 'deactivate', 'activate']

/** The complimentary student `id`, or `undefined` (any other user is not part of S6–S8). */
function compUser(id: number): UserRow | undefined {
  const user = users.get(id)
  return user?.role === 'student' && user.isComplimentary && !isHiddenComp(id) ? user : undefined
}

/** The classes of a student: active first-by-id gives S6 "Kelas" / "Cikgu"; every enrolment gives S8. */
function classesOf(userId: number) {
  return classrooms
    .enrolmentsOf(userId)
    .filter((e) => e.classroomKind === 'classroom')
    .sort((a, b) => a.classroomId - b.classroomId)
}

function teacherName(teacherId: number | null): string {
  return teacherId === null ? '' : (users.get(teacherId)?.name ?? '')
}

function firstClass(userId: number): { label: string; teacher: string } {
  const enrolment = classesOf(userId).find((e) => e.status === 'active')
  const cls = enrolment && classrooms.get(enrolment.classroomKind, enrolment.classroomId)
  return cls ? { label: cls.name, teacher: teacherName(cls.teacherId) } : { label: '', teacher: '' }
}

const usernameOf = (user: UserRow): string => user.email

function schoolNameOf(schoolId: number | null): string | null {
  return schoolId === null ? null : (schoolsRepo.get(schoolId)?.name ?? null)
}

function toListItem(user: UserRow): CompStudentListItem {
  const profile = complimentaryRepo.get(user.id)
  const cls = firstClass(user.id)
  return {
    id: user.id,
    name: user.name,
    username: usernameOf(user),
    icNumber: users.adminIcNumber(user.id),
    schoolName: schoolNameOf(user.schoolId),
    classLabel: cls.label,
    teacherName: cls.teacher,
    isActive: user.isActive,
    coinsEnabled: profile?.coinsEnabled ?? false,
    packageExpiresAt: profile?.packageExpiresAt ?? DEFAULT_PACKAGE_EXPIRES_AT,
  }
}

function subjectName(subjectId: number | null): string | null {
  return subjectId === null ? null : (curriculum.subject(subjectId)?.name ?? null)
}

function toDetail(user: UserRow): CompStudentDetail {
  const profile = complimentaryRepo.get(user.id)
  const cls = firstClass(user.id)
  const wallet = complimentaryRepo.wallet(user.id)
  const classes: CompStudentClass[] = classesOf(user.id).flatMap((e) => {
    const c = classrooms.get(e.classroomKind, e.classroomId)
    return c
      ? [
          {
            name: c.name,
            classCode: c.joinCode,
            subjectName: subjectName(c.subjectId),
            teacherName: teacherName(c.teacherId),
            status: e.status,
          },
        ]
      : []
  })
  return {
    userId: user.id,
    username: usernameOf(user),
    name: user.name,
    icNumber: users.adminIcNumber(user.id),
    classLevel: user.classLevel,
    isActive: user.isActive,
    coinsEnabled: profile?.coinsEnabled ?? false,
    packageExpiresAt: profile?.packageExpiresAt ?? DEFAULT_PACKAGE_EXPIRES_AT,
    originalSchoolName: profile?.originalSchoolName ?? schoolNameOf(user.schoolId),
    classLabel: cls.label,
    teacherName: cls.teacher,
    syilingBalance: wallet.syiling,
    coinBalance: wallet.coins,
    classes,
  }
}

// --- #16 ---------------------------------------------------------------------------------------------

function listCompStudents(req: MockRequest): MockResponse {
  const page = pageParams(req.query, { pageSize: COMP_PAGE_SIZE })
  // Newest first; the `comp` test override removes some baseline students from M02's view.
  const all = users
    .query('U-COMP', {
      sort: [
        { field: 'createdAt', dir: 'desc' },
        { field: 'id', dir: 'desc' },
      ],
    })
    .rows.filter((u) => !isHiddenComp(u.id))
  const rows = all.slice((page.page - 1) * page.pageSize, page.page * page.pageSize)
  // FR-M02-65: coins OFF over all complimentary students (a student without a profile is OFF).
  const coinsOff = all.filter((u) => !(complimentaryRepo.get(u.id)?.coinsEnabled ?? false)).length
  return paged({ rows: rows.map(toListItem), total: all.length }, page, {
    counts: { coinsOff, total: all.length },
  })
}

// --- #17 ---------------------------------------------------------------------------------------------

/** BR-18: the `NAMA, NOKP` lines; the IC follows the last comma. `line` is 1-based over the raw text. */
function parseLines(text: string): { line: number; name: string; ic: string; comma: boolean }[] {
  const out: { line: number; name: string; ic: string; comma: boolean }[] = []
  text.split(/\r\n|\r|\n/).forEach((raw, index) => {
    if (raw.trim() === '') return
    const cut = raw.lastIndexOf(',')
    out.push(
      cut < 0
        ? { line: index + 1, name: raw.trim(), ic: '', comma: false }
        : {
            line: index + 1,
            name: raw.slice(0, cut).trim(),
            ic: raw.slice(cut + 1).replace(/\D/g, ''),
            comma: true,
          },
    )
  })
  return out
}

const isoDate = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function registerStudents(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const input = { ...body, classroomId: intOrNull(body.classroomId) ?? body.classroomId }
  const invalid = validate(input, {
    classroomId: [
      required(),
      rule('exists', (value) => {
        const cls = typeof value === 'number' ? classrooms.get('classroom', value) : undefined
        return cls?.isActive === true ? null : 'The selected :attribute is invalid.'
      }),
    ],
    packageExpiresAt: [
      required(),
      rule('date', (value) =>
        isoDate(value) ? null : 'The :attribute field must be a valid date.',
      ),
    ],
    students: [required()],
  })
  if (invalid) return invalid

  const cls = classrooms.get('classroom', Number(input.classroomId))
  if (!cls) return notFound()
  const now = ctx.clock.now()
  const adminId = req.session?.userId ?? null
  const school = schoolNameOf(cls.schoolId)
  // SEC-M02-02: read from `ctx.config` (`mock.config()`, reset), not the module-level defaults.
  const password = adminDefaults(ctx).compStudentDefaultPassword
  const result: ImportResult = { created: 0, skipped: 0, failed: 0, errors: [] }
  const seen = new Set<string>()

  for (const entry of parseLines(String(body.students))) {
    if (!entry.comma || entry.name === '') {
      result.failed++
      result.errors.push({ line: entry.line, message: MSG_COMP_BAD_LINE })
      continue
    }
    if (entry.ic.length < 6) {
      result.failed++
      result.errors.push({ line: entry.line, message: MSG_COMP_SHORT_IC })
      continue
    }
    const username = `${entry.ic.slice(-6)}${COMP_USERNAME_DOMAIN}`
    if (seen.has(username) || users.findByEmail(username) !== undefined) {
      result.skipped++
      continue
    }
    seen.add(username)
    const user = users.create(
      {
        name: entry.name,
        email: username,
        role: 'student',
        grade: cls.levelId,
        schoolId: cls.schoolId,
        isActive: true,
        isComplimentary: true,
        createdById: adminId,
      },
      now,
    )
    users.setPassword(user.id, password)
    users.setIcNumber(user.id, entry.ic)
    // BR-18: the full package until the given date (INFERRED mapping, see COMP_PACKAGE).
    users.setSubscription(user.id, {
      package: COMP_PACKAGE,
      expiresAt: compExpiresAt(String(body.packageExpiresAt)),
    })
    complimentaryRepo.create(user.id, {
      packageExpiresAt: String(body.packageExpiresAt),
      originalSchoolName: school,
    })
    classrooms.enrol(
      { kind: 'classroom', classId: cls.classId, studentId: user.id, source: 'complimentary' },
      now,
    )
    result.created++
  }
  return created(result, { status: compCreatedText(result.created) })
}

// --- #18 ---------------------------------------------------------------------------------------------

function getCompStudent(req: MockRequest): MockResponse {
  const user = compUser(idOf(req))
  return user ? ok(toDetail(user)) : notFound()
}

// --- #19 – #21 ---------------------------------------------------------------------------------------

function bulkAction(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const ids = intList(body.ids)
  const invalid = validate(
    { ...body, ids: ids ?? body.ids },
    {
      action: [required(), oneOf(BULK_ACTIONS)],
      ids: [
        required(),
        rule('array', (value) =>
          Array.isArray(value) && value.length > 0 ? null : 'The :attribute field is required.',
        ),
      ],
    },
  )
  if (invalid) return invalid
  const now = ctx.clock.now()
  const action = body.action as CompBulkAction
  let updated = 0
  for (const id of ids ?? []) {
    const user = compUser(id)
    if (!user) continue
    if (action === 'coins_off' || action === 'coins_on') {
      complimentaryRepo.setCoins(id, action === 'coins_on')
    } else {
      users.update(id, { isActive: action === 'activate' }, now)
    }
    updated++
  }
  return ok({ updated }, { status: MSG_COMP_ACTION_DONE })
}

function toggleCoins(req: MockRequest): MockResponse {
  const user = compUser(idOf(req))
  if (!user) return notFound()
  const next = !complimentaryRepo.coinsEnabled(user.id)
  const profile = complimentaryRepo.setCoins(user.id, next)
  return ok({ coinsEnabled: profile.coinsEnabled }, { status: MSG_COMP_ACTION_DONE })
}

function toggleActive(req: MockRequest, ctx: MockContext): MockResponse {
  const user = compUser(idOf(req))
  if (!user) return notFound()
  const next = users.update(user.id, { isActive: !user.isActive }, ctx.clock.now())
  return ok({ isActive: next.isActive }, { status: MSG_COMP_ACTION_DONE })
}

// --- #22, #23 ----------------------------------------------------------------------------------------

function listTeachers(): MockResponse {
  const rows: TeacherOption[] = users
    .query('U-ROLE', { sort: 'id' }, 'teacher')
    .rows.map((u) => ({ id: u.id, name: u.name, email: u.email }))
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ms') || a.id - b.id)
  return ok(rows)
}

function teacherClassrooms(req: MockRequest): MockResponse {
  const rows: TeacherClassroomOption[] = classrooms
    .forTeacher(idOf(req))
    .filter((c) => c.kind === 'classroom' && c.isActive)
    .sort((a, b) => a.classId - b.classId)
    .map((c) => ({ id: c.classId, name: c.name, classCode: c.joinCode }))
  return ok(rows)
}

export const compStudentRoutes: RouteDef[] = [
  route('GET', '/api/admin/comp-students', [adminOnly], withClasses(listCompStudents)),
  route('POST', '/api/admin/comp-students', [adminOnly], withClasses(registerStudents)),
  route('POST', '/api/admin/comp-students/bulk-action', [adminOnly], bulkAction),
  route('GET', '/api/admin/comp-students/:id', [adminOnly], withClasses(getCompStudent), {
    params: { id: int() },
  }),
  route('POST', '/api/admin/comp-students/:id/toggle-coins', [adminOnly], toggleCoins, {
    params: { id: int() },
  }),
  route('POST', '/api/admin/comp-students/:id/toggle-active', [adminOnly], toggleActive, {
    params: { id: int() },
  }),
  route('GET', '/api/admin/teachers', [adminOnly], listTeachers),
  route('GET', '/api/admin/teachers/:id/classrooms', [adminOnly], withClasses(teacherClassrooms), {
    params: { id: int() },
  }),
]
