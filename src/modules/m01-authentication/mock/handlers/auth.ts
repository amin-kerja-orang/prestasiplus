/**
 * M01 SRS v1.12 §7 #1–#6: login, register, forgot password, token reset, IC reset, logout
 * (M01-T1). Public (G) except that logout ignores a dead session.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 1 | `POST /api/auth/login` | BR-01 single credentials message, BR-02 throttle, BR-23 inactive, BR-25 `lastLoginAt`, FR-69 M14 hook |
 * | 2 | `POST /api/auth/register` | BR-04/05, 201 + session, FR-69/70 hooks |
 * | 3 | `POST /api/auth/password/email` | BR-10: token to the dev outbox, 60 s throttle |
 * | 4 | `POST /api/auth/password/reset` | BR-11: token + e-mail, auto-login |
 * | 5 | `POST /api/auth/password/reset-ic` | BR-12: IC hash match, issues a broker token |
 * | 6 | `POST /api/auth/logout` | 204 whatever the session state |
 *
 * Error copy is the Laravel 11 English default (UNVERIFIED COPY, SRS §5/§8) except the observed
 * "Emel atau kata laluan tidak sah." and the M01/M02 placeholders. Credentials and IC mismatches
 * answer `422 VALIDATION_ERROR` with the message under `fields.email`, like Laravel.
 */

import { API_ERROR_CODES } from '@/api/errors'
import { sessions } from '@/mock/auth/sessions'
import { issueSession } from '@/mock/core-data/client-session'
import {
  confirmed,
  created,
  email,
  exists,
  fail,
  forbidden,
  max,
  min,
  noContent,
  ok,
  oneOf,
  required,
  route,
  rule,
  unique,
  validate,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import {
  isPrototypeRole,
  isPrototypeScopeOn,
  MSG_ROLE_OUT_OF_SCOPE,
  ROLE_OUT_OF_SCOPE_CODE,
} from '@/app/prototype-scope'

import type { SessionPayload } from '../../api/types'
import { isSessionUser, type SessionUserRow, type UserRow } from '../datasets/users-types'
import { emailKey, usersRepo as users } from '../repository/users'
import { loginThrottleRepo, passwordResetsRepo } from './auth-state'
import { notifyLogin, notifyRegistered, schoolExists } from './auth-deps'
import { bodyOf, intOrNull, textOrNull } from './auth-input'

/** BR-01 (OBSERVED). */
export const MSG_BAD_CREDENTIALS = 'Emel atau kata laluan tidak sah.'
/** BR-23 (placeholder shared with M02 §8). */
export const MSG_ACCOUNT_INACTIVE = 'Akaun anda tidak aktif. Sila hubungi pentadbir.'
/** SRS §8 (Laravel `passwords.*`, `auth.throttle`). */
export const MSG_RESET_SENT = 'Kami telah menghantar pautan set semula kata laluan ke emel anda.'
export const MSG_RESET_DONE = 'Kata laluan anda telah ditetapkan semula.'
export const MSG_USER_NOT_FOUND = "Kami tidak menemui pengguna dengan alamat emel itu."
export const MSG_RESET_THROTTLED = 'Sila tunggu sebelum mencuba semula.'
export const MSG_TOKEN_INVALID = 'Token set semula kata laluan ini tidak sah.'
/** SRS §5 (placeholder: Laravel has no default for an IC reset). */
export const MSG_IC_MISMATCH = 'Emel atau No Kad Pengenalan tidak sepadan.'

export const ACCOUNT_INACTIVE_CODE = 'ACCOUNT_INACTIVE'

/**
 * Outbox message type of reset mails (`window.__mock.outbox.lastResetFor`). Declared here, not
 * imported from `@/mock/testing/hooks`: that module is dev/e2e-only and private to the mock core
 * (eslint boundary; the demo build must not contain it). A test asserts both values are equal.
 */
export const PASSWORD_RESET_OUTBOX_TYPE = 'password-reset'

const SELF_REGISTER_ROLES = ['student', 'teacher', 'parent'] as const

const throttleMessage = (seconds: number) =>
  `Too many login attempts. Please try again in ${String(seconds)} seconds.`

function sessionUser(user: UserRow | undefined): SessionUserRow | undefined {
  return user && isSessionUser(user) ? user : undefined
}

/**
 * A successful password login (login, register, reset auto-login): sets `lastLoginAt` (BR-25),
 * opens the session, then hands over to M14 (FR-M01-69). The user in the payload is the row after
 * `recordLogin`, so `lastLoginAt` is already the new value.
 */
export function startSession(
  user: SessionUserRow,
  remember: boolean,
  ctx: MockContext,
): SessionPayload {
  const now = ctx.clock.now()
  const row = sessionUser(users.recordLogin(user.id, now)) ?? user
  const session = issueSession(row, remember, now)
  notifyLogin(user.id, now)
  return { token: session.token, expiresAt: session.expiresAt, user: session.user }
}

const inactive = () => forbidden(MSG_ACCOUNT_INACTIVE, ACCOUNT_INACTIVE_CODE)

function login(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(body, { email: [required()], password: [required()] })
  if (invalid) return invalid
  const address = String(body.email)
  const password = String(body.password)
  const now = ctx.clock.now()

  const wait = loginThrottleRepo.retryAfter(address, now)
  if (wait > 0) {
    const message = throttleMessage(wait)
    return fail(
      429,
      API_ERROR_CODES.RATE_LIMITED,
      message,
      { email: message },
      { retryAfter: wait },
    )
  }

  const user = sessionUser(users.findByEmail(address))
  if (!user || !users.verifyPassword(user.id, password)) {
    loginThrottleRepo.hit(address, now)
    return fail(422, API_ERROR_CODES.VALIDATION_ERROR, MSG_BAD_CREDENTIALS, {
      email: MSG_BAD_CREDENTIALS,
    })
  }
  // BR-23: checked after the credentials match; the refused attempt does not count.
  if (!user.isActive) return inactive()
  // Prototype scope (D43): Admin Pusat, PPD/JPN, Ibu Bapa and Penaja are not part of the prototype.
  if (isPrototypeScopeOn() && !isPrototypeRole(user.role)) {
    return forbidden(MSG_ROLE_OUT_OF_SCOPE, ROLE_OUT_OF_SCOPE_CODE)
  }

  loginThrottleRepo.clear(address)
  return ok(startSession(user, body.remember === true || body.remember === 'true', ctx))
}

/** The value is 1–11 when the role is `student`; other roles ignore `grade` (BR-04). */
const gradeRule = rule(
  'grade',
  (value, { input }) => {
    const role = input.role ?? 'student'
    if (role !== 'student') return null
    if (value === undefined || value === null || value === '') {
      return 'The :attribute field is required.'
    }
    const grade = intOrNull(value)
    return grade !== null && grade >= 1 && grade <= 11
      ? null
      : 'The selected :attribute is invalid.'
  },
  { implicit: true },
)

const schoolRule = exists((value) => {
  const id = intOrNull(value)
  return id !== null && schoolExists(id)
})

function register(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(
    body,
    {
      name: [required(), max(255)],
      email: [
        required(),
        email(),
        max(255),
        unique((value) => users.findByEmail(String(value)) !== undefined),
      ],
      phone: [max(14)],
      role: [oneOf(SELF_REGISTER_ROLES)],
      grade: [gradeRule],
      icNumber: [max(14)],
      schoolId: [schoolRule],
      password: [required(), min(6), confirmed()],
    },
    { attributes: { icNumber: 'ic number' } },
  )
  if (invalid) return invalid

  const role = (body.role ?? 'student') as (typeof SELF_REGISTER_ROLES)[number]
  const isStudent = role === 'student'
  const now = ctx.clock.now()
  const created_ = users.create(
    {
      name: String(body.name),
      email: String(body.email),
      role,
      phone: textOrNull(body.phone),
      grade: isStudent ? intOrNull(body.grade) : null,
      schoolId: intOrNull(body.schoolId),
    },
    now,
  )
  users.setPassword(created_.id, String(body.password))
  const ic = textOrNull(body.icNumber)
  if (isStudent && ic !== null) users.setIcNumber(created_.id, ic)

  notifyRegistered(created_.id, textOrNull(body.referralCode))
  const user = sessionUser(users.get(created_.id))
  if (!user) throw new Error('register: the created user has no session role')
  return created(startSession(user, false, ctx))
}

function forgotPassword(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(body, { email: [required(), email()] })
  if (invalid) return invalid
  const user = users.findByEmail(String(body.email))
  if (!user) {
    return fail(422, API_ERROR_CODES.VALIDATION_ERROR, MSG_USER_NOT_FOUND, {
      email: MSG_USER_NOT_FOUND,
    })
  }
  const now = ctx.clock.now()
  const wait = passwordResetsRepo.retryAfter(user.email, now)
  if (wait > 0) {
    return fail(
      429,
      API_ERROR_CODES.RATE_LIMITED,
      MSG_RESET_THROTTLED,
      { email: MSG_RESET_THROTTLED },
      { retryAfter: wait },
    )
  }
  const reset = passwordResetsRepo.issue(user.email, now)
  ctx.outbox.send({
    type: PASSWORD_RESET_OUTBOX_TYPE,
    to: user.email,
    subject: 'Set Semula Kata Laluan',
    data: {
      token: reset.id,
      email: user.email,
      link: `/password/reset/${reset.id}?email=${encodeURIComponent(user.email)}`,
    },
  })
  return ok({ status: MSG_RESET_SENT })
}

function resetPassword(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(body, {
    token: [required()],
    email: [required(), email()],
    password: [required(), min(6), confirmed()],
  })
  if (invalid) return invalid
  const found = users.findByEmail(String(body.email))
  const user = sessionUser(found)
  if (!found) {
    return fail(422, API_ERROR_CODES.VALIDATION_ERROR, MSG_USER_NOT_FOUND, {
      email: MSG_USER_NOT_FOUND,
    })
  }
  const row = passwordResetsRepo.find(String(body.token))
  if (!user || !row || row.email !== emailKey(found.email) || row.expiresAt <= ctx.clock.now()) {
    return fail(422, API_ERROR_CODES.VALIDATION_ERROR, MSG_TOKEN_INVALID, {
      email: MSG_TOKEN_INVALID,
    })
  }
  // BR-23 (INFERRED extension): the reset logs the user in, so an inactive account is refused and
  // nothing changes.
  if (!user.isActive) return inactive()

  users.setPassword(user.id, String(body.password))
  passwordResetsRepo.consume(row.id)
  return ok({ ...startSession(user, false, ctx), status: MSG_RESET_DONE })
}

function resetByIc(req: MockRequest, ctx: MockContext): MockResponse {
  const body = bodyOf(req)
  const invalid = validate(
    body,
    {
      email: [required(), email()],
      icNumber: [required(), max(14)],
    },
    { attributes: { icNumber: 'ic number' } },
  )
  if (invalid) return invalid
  const user = users.findByEmail(String(body.email))
  if (!user || !users.verifyIc(user.id, String(body.icNumber))) {
    return fail(422, API_ERROR_CODES.VALIDATION_ERROR, MSG_IC_MISMATCH, { email: MSG_IC_MISMATCH })
  }
  const reset = passwordResetsRepo.issue(user.email, ctx.clock.now())
  return ok({ token: reset.id, email: user.email })
}

function logout(req: MockRequest): MockResponse {
  // A 401 is ignored (SRS #6): the response is 204 for any token, live or dead.
  if (req.token) {
    // Impersonation children die with the actor session (they would otherwise outlive the logout).
    sessions.revokeChildrenOf(req.token)
    sessions.revoke(req.token)
  }
  return noContent()
}

export const authRoutes: RouteDef[] = [
  route('POST', '/api/auth/login', login),
  route('POST', '/api/auth/register', register),
  route('POST', '/api/auth/password/email', forgotPassword),
  route('POST', '/api/auth/password/reset', resetPassword),
  route('POST', '/api/auth/password/reset-ic', resetByIc),
  route('POST', '/api/auth/logout', logout),
]
