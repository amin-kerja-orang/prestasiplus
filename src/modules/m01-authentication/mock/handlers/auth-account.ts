/**
 * M01 SRS v1.12 §7 #8–#12 (M01-T1): the signed-in user's own profile, picture, password and
 * settings. Every route needs a session (`requireAuth`, 401 → `/login`). `GET /api/me` (#7) is the
 * mock core's route.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 8 | `PUT /api/me` | BR-13 e-mail never changes; BR-14 rules; `{data: UserMe, status}` |
 * | 9 | `POST /api/me/picture` | BR-15: jpeg/png/webp, ≤ 2 MB, stored as a data URL |
 * | 10 | `PUT /api/me/password` | BR-16: current password must match, the session is kept |
 * | 11 | `GET /api/me/settings` | BR-17 defaults |
 * | 12 | `PUT /api/me/settings` | BR-17: writes every field |
 *
 * Success texts are placeholders (SRS §8 "UNVERIFIED COPY").
 */

import { API_ERROR_CODES } from '@/api/errors'
import { toUserMe } from '@/mock/core-data/me'
import {
  confirmed,
  exists,
  fail,
  max,
  min,
  ok,
  oneOf,
  required,
  requireAuth,
  route,
  rule,
  validate,
  validationError,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import type { Faith, UserSettings } from '../../api/types'
import { isSessionUser } from '../datasets/users-types'
import { usersRepo as users } from '../repository/users'
import { schoolExists } from './auth-deps'
import { bodyOf, intOrNull, isBlank, textOrNull, toBool } from './auth-input'
import { DEFAULT_SETTINGS, userSettingsRepo } from './auth-state'

export const MSG_PROFILE_SAVED = 'Profil berjaya dikemaskini.'
export const MSG_PICTURE_SAVED = 'Gambar profil berjaya dikemaskini.'
export const MSG_PASSWORD_CHANGED = 'Kata laluan berjaya dikemaskini.'
export const MSG_SETTINGS_SAVED = 'Tetapan berjaya disimpan.'

/** BR-15. */
export const PICTURE_TYPES: Readonly<Record<string, true>> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
}
/** BR-15: 2 MB, as kilobytes for the `max` rule. */
export const PICTURE_MAX_KB = 2048

const FAITHS: readonly Faith[] = ['muslim', 'hindu', 'buddhist', 'christian', 'none']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function userId(req: MockRequest): number {
  if (!req.session) throw new Error('requireAuth() must run first')
  return req.session.userId
}

function currentUser(req: MockRequest) {
  const user = users.get(userId(req))
  return user && isSessionUser(user) ? user : undefined
}

/** Roles whose `schoolId` is an admin-assigned scope, not a self-service choice. */
const STAFF_ROLES: ReadonlySet<string> = new Set([
  'school_admin',
  'ppd_officer',
  'jpn_officer',
  'admin',
])

const unauthorized = () => fail(401, API_ERROR_CODES.UNAUTHORIZED, 'Unauthenticated.')

// --- #8 ---------------------------------------------------------------------------------------

const optionalGrade = rule('grade', (value) => {
  const grade = intOrNull(value)
  return grade !== null && grade >= 1 && grade <= 11 ? null : 'The selected :attribute is invalid.'
})

const optionalSchool = exists((value) => {
  const id = intOrNull(value)
  return id !== null && schoolExists(id)
})

function updateProfile(req: MockRequest, ctx: MockContext): MockResponse {
  const user = currentUser(req)
  if (!user) return unauthorized()
  const body = bodyOf(req)
  const invalid = validate(body, {
    name: [required(), max(255)],
    phone: [max(14)],
    bio: [max(500)],
    grade: [optionalGrade],
    schoolId: [optionalSchool],
  })
  if (invalid) return invalid

  // BR-13: `email` in the body is ignored. A field that is absent keeps its value; `null` clears it.
  const patch: Parameters<typeof users.update>[1] = { name: String(body.name) }
  if ('phone' in body) patch.phone = textOrNull(body.phone)
  if ('bio' in body) patch.bio = textOrNull(body.bio)
  if ('grade' in body) patch.grade = intOrNull(body.grade)
  // Security: a staff account's school is its tenant scope (M27 `schoolOf`); only a student or
  // teacher may pick a school here, so a staff `schoolId` in the body is ignored (kept as stored).
  if ('schoolId' in body && !STAFF_ROLES.has(user.role)) patch.schoolId = intOrNull(body.schoolId)
  const saved = users.update(user.id, patch, ctx.clock.now())
  if (!isSessionUser(saved)) return unauthorized()
  return ok(toUserMe(saved), { status: MSG_PROFILE_SAVED })
}

// --- #9 ---------------------------------------------------------------------------------------

const pictureType = rule('mimes', (value) =>
  typeof Blob !== 'undefined' && value instanceof Blob && PICTURE_TYPES[value.type] === true
    ? null
    : 'The :attribute field must be a file of type: jpeg, png, webp.',
)

/** Base64 data URL of `file` (prototype storage of the avatar, DATA-M01-01 `avatarUrl`). */
async function toDataUrl(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${file.type};base64,${btoa(binary)}`
}

async function uploadPicture(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const user = currentUser(req)
  if (!user) return unauthorized()
  const body = req.body as Record<string, unknown> | undefined
  const invalid = validate(
    body ?? {},
    { profilePicture: [required(), pictureType, max(PICTURE_MAX_KB)] },
    { attributes: { profilePicture: 'profile picture' } },
  )
  if (invalid) return invalid
  const dataUrl = await toDataUrl((body as { profilePicture: Blob }).profilePicture)
  return ctx.transaction(() => {
    users.update(user.id, { avatarUrl: dataUrl }, ctx.clock.now())
    return ok({ avatarUrl: dataUrl }, { status: MSG_PICTURE_SAVED })
  })
}

// --- #10 --------------------------------------------------------------------------------------

function changePassword(req: MockRequest): MockResponse {
  const user = currentUser(req)
  if (!user) return unauthorized()
  const body = bodyOf(req)
  const invalid = validate(body, {
    currentPassword: [required()],
    password: [required(), min(6), confirmed()],
  })
  if (invalid) return invalid
  if (!users.verifyPassword(user.id, String(body.currentPassword))) {
    return validationError({ currentPassword: 'The password is incorrect.' })
  }
  users.setPassword(user.id, String(body.password))
  return ok({ status: MSG_PASSWORD_CHANGED })
}

// --- #11, #12 ---------------------------------------------------------------------------------

const timeRule = rule('date_format', (value) =>
  typeof value === 'string' && TIME_RE.test(value)
    ? null
    : 'The :attribute field must match the format H:i.',
)

function getSettings(req: MockRequest): MockResponse {
  return ok(userSettingsRepo.get(userId(req)))
}

function saveSettings(req: MockRequest): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(body, {
    subuhPushTime: [timeRule],
    sahurPushTime: [timeRule],
    faith: [oneOf(FAITHS)],
  })
  if (invalid) return invalid
  const settings: UserSettings = {
    // An unticked checkbox is `false`; a missing key counts as unticked (BR-17).
    spiritualMode: toBool(body.spiritualMode),
    showBismillahSplash: toBool(body.showBismillahSplash),
    subuhPushEnabled: toBool(body.subuhPushEnabled),
    subuhPushTime: isBlank(body.subuhPushTime)
      ? DEFAULT_SETTINGS.subuhPushTime
      : String(body.subuhPushTime),
    ramadanModeEnabled: toBool(body.ramadanModeEnabled),
    sahurPushTime: isBlank(body.sahurPushTime)
      ? DEFAULT_SETTINGS.sahurPushTime
      : String(body.sahurPushTime),
    faith: isBlank(body.faith) ? null : (String(body.faith) as Faith),
  }
  return ok(userSettingsRepo.save(userId(req), settings), { status: MSG_SETTINGS_SAVED })
}

export const accountRoutes: RouteDef[] = [
  route('PUT', '/api/me', [requireAuth()], updateProfile),
  route('POST', '/api/me/picture', [requireAuth()], uploadPicture),
  route('PUT', '/api/me/password', [requireAuth()], changePassword),
  route('GET', '/api/me/settings', [requireAuth()], getSettings),
  route('PUT', '/api/me/settings', [requireAuth()], saveSettings),
]
