/**
 * SRS M27 Part B §19 write endpoints of S9 to S12 (M27-T1b): #8 `PUT /pelajar/:id`, #9 `POST
 * /pelajar/:id/reset-password`, #12 `POST /guru`, #13 `PUT /guru/:id`, #14 `POST /guru/:id/toggle-active`,
 * #15 `POST /guru/:id/reset-password`, #19 `POST /pelajar`. Guard SA on all.
 *
 * Every change goes through the M02 contract `schoolAdminUsers` (XR-M27-17) inside `ctx.transaction`, so a
 * refusal leaves nothing behind. Only the keys the contract names are read from the body: `role`, `schoolId`,
 * `isActive`, `grade` and `icNumber` are ignored (FR-M27-42, 118). Check order for an object write: role
 * guard, then 404 (not of the school, not of the page's role, unknown), then 403 for an inactive in-school
 * account (not for #14), then 422. `:id` is parsed here so the guard answers 401/403 before a malformed id
 * answers 404. #19 is the only response that carries a password, in `credential` (BR-M27-41).
 */

import {
  created,
  forbidden,
  notFound,
  ok,
  route,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import {
  MSG_USER_CREATED,
  MSG_USER_UPDATED,
  m02Config,
  schoolAdminUsers,
  SchoolAdminWriteError,
} from '@/modules/m02-users-schools/mock'

import { schoolInfoOf } from '../read-models/school-info'
import type { SchoolRole } from '../read-models/school-people'
import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'
import { detailOf, lookupSchoolUser } from '../read-models/users-list'

const BASE = '/api/admin-sekolah'
const guard = [requireSchoolAdminWithSchool]

/** M02's own flash of the status toggle (`handlers/users-admin.ts`, not exported by M02). */
export const MSG_STATUS_TOGGLED = 'Status pengguna berjaya dikemaskini.'
/** `Pelajar "{name}" berjaya dicipta.` (FR-M27-118). */
export const pupilCreatedText = (name: string): string => `Pelajar "${name}" berjaya dicipta.`

type Body = Record<string, unknown>

function bodyOf(req: MockRequest): Body {
  const raw = req.body
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  if (typeof Blob !== 'undefined' && raw instanceof Blob) return {}
  return raw as Body
}

/** A string value as sent, anything else is absent (the contract then reports it as missing / invalid). */
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/** An integer sent as a number or a digit string; `null` for anything else. */
function intOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

/** A nullable optional text: absent stays absent, `null` clears. */
const phoneOf = (body: Body): { phone?: string | null } => {
  if (!('phone' in body)) return {}
  return { phone: typeof body.phone === 'string' ? body.phone : null }
}

/** The optional password pair of #8 / #13: absent stays absent, so a plain profile edit keeps the hash. */
const passwordPairOf = (
  body: Body,
): { newPassword?: string; newPasswordConfirmation?: string } => ({
  ...(typeof body.newPassword === 'string' ? { newPassword: body.newPassword } : {}),
  ...(typeof body.newPasswordConfirmation === 'string'
    ? { newPasswordConfirmation: body.newPasswordConfirmation }
    : {}),
})

/** Maps the owner's refusal onto the stable error envelope; anything else is a real bug and propagates. */
function refusal(error: unknown): MockResponse {
  if (!(error instanceof SchoolAdminWriteError)) throw error
  if (error.status === 422) return validationError(error.fields ?? {}, error.message)
  if (error.status === 404) return notFound(error.message)
  return forbidden(error.message)
}

function attempt(run: () => MockResponse): MockResponse {
  try {
    return run()
  } catch (error) {
    return refusal(error)
  }
}

const updateRoute = (path: string, role: SchoolRole): RouteDef =>
  route('PUT', path, guard, (req, ctx) => {
    const viewer = schoolOf(req)
    const found = lookupSchoolUser(viewer, role, String(req.params.id))
    if (found.kind === 'not_found') return notFound()
    if (found.kind === 'inactive') return forbidden()
    const body = bodyOf(req)
    return attempt(() =>
      ctx.transaction(() => {
        const saved = schoolAdminUsers.updateUser(
          viewer.schoolId,
          role,
          found.user.id,
          {
            name: str(body.name) ?? '',
            email: str(body.email) ?? '',
            ...phoneOf(body),
            ...passwordPairOf(body),
          },
          ctx.clock.now(),
        )
        return ok(detailOf(saved, viewer), { status: MSG_USER_UPDATED })
      }),
    )
  })

const resetRoute = (path: string, role: SchoolRole): RouteDef =>
  route('POST', path, guard, (req, ctx) => {
    const viewer = schoolOf(req)
    const found = lookupSchoolUser(viewer, role, String(req.params.id))
    if (found.kind === 'not_found') return notFound()
    if (found.kind === 'inactive') return forbidden()
    const body = bodyOf(req)
    return attempt(() =>
      ctx.transaction(() => {
        schoolAdminUsers.resetPassword(
          viewer.schoolId,
          role,
          found.user.id,
          {
            newPassword: str(body.newPassword) ?? '',
            newPasswordConfirmation: str(body.newPasswordConfirmation) ?? '',
          },
          ctx.clock.now(),
        )
        return ok({ reset: true }, { status: MSG_USER_UPDATED })
      }),
    )
  })

/** #12 (S11): a teacher of the school, created active. */
const createTeacherRoute = route('POST', `${BASE}/guru`, guard, (req, ctx) => {
  const viewer = schoolOf(req)
  const body = bodyOf(req)
  return attempt(() =>
    ctx.transaction(() => {
      const saved = schoolAdminUsers.createTeacher(
        viewer.schoolId,
        {
          name: str(body.name) ?? '',
          email: str(body.email) ?? '',
          ...phoneOf(body),
          password: str(body.password) ?? '',
          passwordConfirmation: str(body.passwordConfirmation) ?? '',
        },
        viewer.userId,
        ctx.clock.now(),
      )
      return created(detailOf(saved, viewer), { status: MSG_USER_CREATED })
    }),
  )
})

/** #14 (G1-1): teachers only, either direction, an inactive teacher included. A pupil id is a 404 here. */
const toggleRoute = route('POST', `${BASE}/guru/:id/toggle-active`, guard, (req, ctx) => {
  const viewer = schoolOf(req)
  const found = lookupSchoolUser(viewer, 'teacher', String(req.params.id), false)
  if (found.kind !== 'found') return notFound()
  return attempt(() =>
    ctx.transaction(() => {
      const saved = schoolAdminUsers.setTeacherActive(
        viewer.schoolId,
        found.user.id,
        !found.user.isActive,
        ctx.clock.now(),
      )
      return ok({ isActive: saved.isActive }, { status: MSG_STATUS_TOGGLED })
    }),
  )
})

/** #19 (S12): a pupil of the school, created active; the plaintext password is returned here and nowhere else. */
const createPupilRoute = route('POST', `${BASE}/pelajar`, guard, (req, ctx) => {
  const viewer = schoolOf(req)
  const body = bodyOf(req)
  const defaultPassword = ctx.config.get(
    'bulkImportDefaultPassword',
    m02Config().bulkImportDefaultPassword,
  )
  // A blank or absent class is no class; anything else goes to M02, which validates it (422 when it is not a class of the school).
  const classId =
    body.classId === undefined || body.classId === null || body.classId === ''
      ? undefined
      : (intOrNull(body.classId) ?? Number.NaN)
  return attempt(() =>
    ctx.transaction(() => {
      const out = schoolAdminUsers.createPupil(
        viewer.schoolId,
        {
          name: str(body.name) ?? '',
          email: str(body.email) ?? '',
          ...(typeof body.password === 'string' ? { password: body.password } : {}),
          ...(classId === undefined ? {} : { classId }),
        },
        viewer.userId,
        ctx.clock.now(),
        { defaultPassword },
      )
      return created(detailOf(out.user, viewer), {
        credential: {
          name: out.user.name,
          school: schoolInfoOf(viewer).name,
          email: out.user.email,
          password: out.password,
        },
        status: pupilCreatedText(out.user.name),
      })
    }),
  )
})

export const userWriteRoutes: RouteDef[] = [
  createPupilRoute,
  createTeacherRoute,
  updateRoute(`${BASE}/pelajar/:id`, 'student'),
  updateRoute(`${BASE}/guru/:id`, 'teacher'),
  resetRoute(`${BASE}/pelajar/:id/reset-password`, 'student'),
  resetRoute(`${BASE}/guru/:id/reset-password`, 'teacher'),
  toggleRoute,
]
