import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { AUTH_ERROR_MESSAGES } from '../auth/errors'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { SessionSchema } from '../session/session'
import {
  ACCOUNT_AUTH_MESSAGES,
  ACCOUNT_MESSAGES,
  ACCOUNT_RESET_IC_MAX_ATTEMPTS,
  ACCOUNT_RESET_IC_WINDOW_MINUTES,
  ACCOUNT_RESET_TOKEN_RULES,
  ACCOUNT_SECURITY_NOTIFICATIONS,
  ACCOUNT_THROTTLE,
  AccountFaithSchema,
  AccountPasswordChangeRequestSchema,
  AccountPasswordEmailRequestSchema,
  AccountPasswordResetIcRequestSchema,
  AccountPasswordResetRequestSchema,
  AccountPasswordResetResponseSchema,
  AccountPictureSchema,
  AccountPictureUploadRequestSchema,
  AccountPlatformStatsSchema,
  AccountProfileUpdateRequestSchema,
  AccountRegisterRequestSchema,
  AccountResetTokenSchema,
  AccountSchoolSummarySchema,
  AccountSelfRegisterRoleSchema,
  AccountSettingsSchema,
  AccountSettingsUpdateRequestSchema,
  AccountStatusSchema,
  AccountUserMeSchema,
  accountStatusEnvelopeOf,
} from './schema'

/** Components contributed by BE-06 (M01 account); appended to COMPONENT_SCHEMAS in openapi.ts. */
export const ACCOUNT_COMPONENT_SCHEMAS = {
  AccountSelfRegisterRole: AccountSelfRegisterRoleSchema,
  AccountSchoolSummary: AccountSchoolSummarySchema,
  AccountUserMe: AccountUserMeSchema,
  AccountStatus: AccountStatusSchema,
  AccountRegisterRequest: AccountRegisterRequestSchema,
  AccountPasswordEmailRequest: AccountPasswordEmailRequestSchema,
  AccountPasswordResetRequest: AccountPasswordResetRequestSchema,
  AccountPasswordResetIcRequest: AccountPasswordResetIcRequestSchema,
  AccountResetToken: AccountResetTokenSchema,
  AccountPasswordResetResponse: AccountPasswordResetResponseSchema,
  AccountProfileUpdateRequest: AccountProfileUpdateRequestSchema,
  AccountPasswordChangeRequest: AccountPasswordChangeRequestSchema,
  AccountPictureUploadRequest: AccountPictureUploadRequestSchema,
  AccountPicture: AccountPictureSchema,
  AccountFaith: AccountFaithSchema,
  AccountSettings: AccountSettingsSchema,
  AccountSettingsUpdateRequest: AccountSettingsUpdateRequestSchema,
  AccountPlatformStats: AccountPlatformStatsSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** D57b: responses that carry a credential or token are never cached. */
const noStoreHeaders = {
  'Cache-Control': { description: 'no-store (the body carries a credential or token).', schema: { type: 'string' as const, enum: ['no-store'] } },
}
const jsonNoStore = (schema: z.ZodType, description: string) => ({ ...json(schema, description), headers: noStoreHeaders })

/** D57a: 429 RATE_LIMITED with the `retryAfter` body field AND the `Retry-After` header (seconds). */
const rateLimited = (description: string) => ({
  ...err(`RATE_LIMITED, with retryAfter seconds in the body and the Retry-After header. ${description}`),
  headers: {
    'Retry-After': {
      description: 'Seconds until a retry is allowed (same value as error.retryAfter).',
      schema: { type: 'integer' as const, minimum: 1 },
    },
  },
})

const THROTTLE_TEXT = `the BE-03 login numbers: ${String(ACCOUNT_THROTTLE.failedAttemptsPerWindow)} failed attempts per ${String(ACCOUNT_THROTTLE.windowSeconds)} seconds, then 429 until the window ends with doubling backoff on repeat`
/** Logging rule for every route that takes an IC number, a token, an e-mail or a password. */
const REDACTION_TEXT =
  'Log redaction (BE-NFR-10, BE-NFR-11): the request body, the IC number, the reset token, the e-mail and every password are never written to application logs, audit rows or error bodies (an e-mail may appear only masked, a token only as its id).'
const WRITE_THROTTLE_TEXT = 'D57a: this write route is rate limited (RATE_LIMITED, retryAfter, Retry-After); the per-user limit is a platform setting of the implementation.'

/** Registers the 11 account routes (register, reset, own profile, settings, public stats). */
export function registerAccountPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on authenticated mutating requests.' }),
  })
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
  const unauthorized = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
  const csrfInvalid = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
  const validation = (detail: string) =>
    err(
      `VALIDATION_ERROR with fields (one message per field, the first failing rule). ${detail} Top-level message is the first field message (+ " (and N more error(s))" when several).`,
    )

  registry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['account'],
    summary: 'Self-registration (Murid, Guru, Ibu Bapa)',
    description:
      'Public. Roles are limited to student, teacher and parent (default student); any other role in the body is a 422. Creates an active account and logs it in: the response is the contract Session and the session cookie is set (not remembered). A duplicate e-mail (case-insensitive) is a 422 on `fields.email`. Rate limit (BE-06 AC6, D57a): per client IP, ' + THROTTLE_TEXT + '; only refused attempts (422) count, so legitimate registrations are not slowed. The response is Cache-Control: no-store (it sets a session). Accepted residual risk (security review, by design as the mock and the UX): the 422 emailTaken lets a client learn whether an e-mail is registered; it is bounded only by the per-IP limit above. ' + REDACTION_TEXT,
    request: { body: body(AccountRegisterRequestSchema) },
    responses: {
      201: jsonNoStore(envelopeOf(SessionSchema), 'Registered and logged in.'),
      422: validation(
        `Copy: name/email/password "The <field> field is required."; email "The email field must be a valid email address." / "${ACCOUNT_AUTH_MESSAGES.emailTaken}"; phone and ic number max 14; role "The selected role is invalid."; students: "${ACCOUNT_AUTH_MESSAGES.gradeRequired}" / "${ACCOUNT_AUTH_MESSAGES.gradeInvalid}"; school "${ACCOUNT_AUTH_MESSAGES.schoolInvalid}"; password min 6 and "The password field confirmation does not match.".`,
      ),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (card AC6; the mock has no registration throttle, so the mock tests cannot verify it).`),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/password/email',
    tags: ['account'],
    summary: 'Request a password reset link',
    description: `Public. Answers 200 "${ACCOUNT_AUTH_MESSAGES.resetSent}" for a known AND an unknown e-mail alike (existence is never disclosed; approved deviation D55b from the mock 422 "${ACCOUNT_AUTH_MESSAGES.userNotFound}", card AC3). Token rules: ${ACCOUNT_RESET_TOKEN_RULES.summary} The e-mailed link carries the token in the URL fragment (/password/reset#token=...&email=...), never in the path or query, so it is not sent to servers, logs or Referer; the reset pages send Referrer-Policy: no-referrer. The mail goes through a MailPort; the dev MailPort logs only the masked e-mail and the token id, never the link or the token. Throttle (uniform, no enumeration): one request per 60 seconds per e-mail, keyed on the hash of the normalised e-mail for EVERY request whether the e-mail exists, is inactive or not (the state of an unknown e-mail is stored too, bounded by expiry); every reset-ic attempt (match or not) starts the same 60 second throttle, so a 429 here is never a match oracle. A second request inside the interval is 429 RATE_LIMITED with retryAfter and the Retry-After header; in addition ${ACCOUNT_THROTTLE.ipCeilingPerWindow} requests per client IP per ${ACCOUNT_THROTTLE.windowSeconds} seconds across all e-mails. Do the same work for known and unknown e-mails (no timing difference). ${REDACTION_TEXT}`,
    request: { body: body(AccountPasswordEmailRequestSchema) },
    responses: {
      200: json(envelopeOf(AccountStatusSchema), `Accepted. status = "${ACCOUNT_AUTH_MESSAGES.resetSent}".`),
      422: validation('email: "The email field is required." / "The email field must be a valid email address.".'),
      429: rateLimited(`"${ACCOUNT_AUTH_MESSAGES.resetThrottled}" with fields.email.`),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/password/reset',
    tags: ['account'],
    summary: 'Set a new password with a reset token',
    description: `Public. Replaces the password, consumes the token (single use) and invalidates the user's other sessions (card AC2), then logs the user in: the response is the contract Session plus the flash text, and the cookie is set (not remembered). An unknown, used, expired or other-e-mail token, and an unknown e-mail, all answer 422 "${ACCOUNT_AUTH_MESSAGES.tokenInvalid}" on fields.email: the unknown e-mail never gets a user-not-found message (decided, D55b, no account enumeration; the mock answered "${ACCOUNT_AUTH_MESSAGES.userNotFound}"). An inactive account is refused with 403 ACCOUNT_INACTIVE and nothing changes (reachable only with a valid token, so not an oracle). Token rules: ${ACCOUNT_RESET_TOKEN_RULES.summary} Every wrong redemption counts as a failure: ${String(ACCOUNT_THROTTLE.failedAttemptsPerWindow)} failures per ${String(ACCOUNT_THROTTLE.windowSeconds)} seconds per (e-mail hash, client IP) and ${String(ACCOUNT_THROTTLE.ipCeilingPerWindow)} per client IP, then 429 RATE_LIMITED with retryAfter and the Retry-After header (BE-03 login numbers, backoff doubling). A successful reset: invalidates the user's other sessions and remember tokens, re-hashes the password with argon2id, clears must-change-password, writes an audit event (without the token) and notifies the user in-app (proposed copy "${ACCOUNT_SECURITY_NOTIFICATIONS.resetDone.title}"). The response sets the session cookie and is Cache-Control: no-store. ${REDACTION_TEXT}`,
    request: { body: body(AccountPasswordResetRequestSchema) },
    responses: {
      200: jsonNoStore(AccountPasswordResetResponseSchema, `Password reset and logged in. status = "${ACCOUNT_AUTH_MESSAGES.resetDone}".`),
      403: err(`ACCOUNT_INACTIVE "${ACCOUNT_AUTH_MESSAGES.accountInactive}".`),
      422: validation(`token/email/password required rules as register; "${ACCOUNT_AUTH_MESSAGES.tokenInvalid}" on fields.email.`),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (too many failed redemptions per (e-mail, IP) or per IP).`),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/password/reset-ic',
    tags: ['account'],
    summary: 'Reset by e-mail and IC number (returns a reset token)',
    description: `Public. The IC number is compared with its stored hash and is never returned. A match returns a reset token (data.token only, the e-mail is not echoed) bound to that e-mail: it can only be redeemed through /auth/password/reset together with the same e-mail, never for another account or any other way. Token rules: ${ACCOUNT_RESET_TOKEN_RULES.summary} The response is Cache-Control: no-store. An unknown e-mail, an inactive account, an account without a stored IC (teacher, parent) and a wrong IC number are indistinguishable in status, body and timing (equal work, dummy compare; no token is issued for an inactive account): 422 "${ACCOUNT_AUTH_MESSAGES.icMismatch}" on fields.email. A match behaves no differently from a miss for throttling: EVERY attempt, match or not, also starts the 60 second per-e-mail throttle of /auth/password/email (keyed on the e-mail hash), so a 429 there never reveals a correct guess. A match is audited (without the IC or the token) and notifies the account owner in-app (NotificationsService.push, proposed copy "${ACCOUNT_SECURITY_NOTIFICATIONS.resetIcIssued.title}"), so a takeover is visible. Open product question: whether IC-only self-service reset is acceptable for minors (PDPA) is a pending lead/user decision. ${REDACTION_TEXT} Attempt limit (D55a): at most ${String(ACCOUNT_RESET_IC_MAX_ATTEMPTS)} attempts per ${String(ACCOUNT_RESET_IC_WINDOW_MINUTES)} minutes, counted separately per account (e-mail, whether or not it exists, so the limit does not reveal existence) and per client IP; every attempt counts, successful or not, and whichever limit is reached first answers 429 RATE_LIMITED with retryAfter seconds (also the Retry-After header).`,
    request: { body: body(AccountPasswordResetIcRequestSchema) },
    responses: {
      200: jsonNoStore(envelopeOf(AccountResetTokenSchema), 'Token issued.'),
      422: validation(`email required/valid; ic number required, max 14; mismatch "${ACCOUNT_AUTH_MESSAGES.icMismatch}" on fields.email.`),
      429: rateLimited(
        `"${ACCOUNT_AUTH_MESSAGES.resetIcRateLimited}" (D55a: more than ${String(ACCOUNT_RESET_IC_MAX_ATTEMPTS)} attempts in ${String(ACCOUNT_RESET_IC_WINDOW_MINUTES)} minutes for the same account or the same IP).`,
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/me',
    tags: ['account'],
    summary: 'The signed-in user',
    description:
      'Any signed-in role. Projection still used by pages not yet on /session. id, name, e-mail, username, avatarUrl, school, roles, active role and landingPath always equal the same fields of GET /session. No password, IC number or isActive.',
    responses: { 200: json(envelopeOf(AccountUserMeSchema), 'The user.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'put',
    path: '/me',
    tags: ['account'],
    summary: 'Update own profile',
    description:
      'Any signed-in role, own record only. `email` and any other key in the body are ignored (BR-13). An absent key keeps the stored value; null or blank clears phone, bio, grade, schoolId. schoolId is ignored for school_admin, ppd_officer and admin accounts. ' + WRITE_THROTTLE_TEXT,
    request: { headers: [csrf], body: body(AccountProfileUpdateRequestSchema) },
    responses: {
      200: json(accountStatusEnvelopeOf(AccountUserMeSchema), `Saved. status = "${ACCOUNT_MESSAGES.profileSaved}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        `name required, max 255; phone max 14; bio max 500; grade "${ACCOUNT_AUTH_MESSAGES.gradeInvalid}"; school "${ACCOUNT_AUTH_MESSAGES.schoolInvalid}".`,
      ),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (D57a).`),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/me/password',
    tags: ['account'],
    summary: 'Change own password',
    description:
      `Any signed-in role. The current password is required and re-hashed with argon2id on change. The session is kept (BR-16). A wrong current password counts as a failure: ${THROTTLE_TEXT}, per user. ${WRITE_THROTTLE_TEXT} ${REDACTION_TEXT}`,
    request: { headers: [csrf], body: body(AccountPasswordChangeRequestSchema) },
    responses: {
      200: json(envelopeOf(AccountStatusSchema), `Changed. data.status = "${ACCOUNT_MESSAGES.passwordChanged}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        `current password required; password required, min 6, confirmed; a wrong current password is "${ACCOUNT_AUTH_MESSAGES.currentPasswordWrong}" on fields.currentPassword.`,
      ),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (repeated wrong current password, D57a).`),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/picture',
    tags: ['account'],
    summary: 'Upload the profile picture',
    description:
      'Any signed-in role. multipart/form-data, part `profilePicture`: image/jpeg, image/png or image/webp, at most 2048 KB. Stored through BE-04; the response carries the file URL (the mock returned a data URL). ' + WRITE_THROTTLE_TEXT,
    request: {
      headers: [csrf],
      body: { required: true, content: { 'multipart/form-data': { schema: AccountPictureUploadRequestSchema } } },
    },
    responses: {
      200: json(accountStatusEnvelopeOf(AccountPictureSchema), `Saved. status = "${ACCOUNT_MESSAGES.pictureSaved}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        'profilePicture: "The profile picture field is required." / "The profile picture field must be a file of type: jpeg, png, webp." / "The profile picture field must not be greater than 2048 kilobytes.".',
      ),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (D57a).`),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/me/settings',
    tags: ['account'],
    summary: 'Own personal settings',
    description: 'Any signed-in role. A user who never saved reads the BR-17 defaults (booleans false, subuh 05:30, sahur 04:30, faith null).',
    responses: { 200: json(envelopeOf(AccountSettingsSchema), 'The settings.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'put',
    path: '/me/settings',
    tags: ['account'],
    summary: 'Save own personal settings',
    description: 'Any signed-in role. Every save writes all seven fields (BR-17); see AccountSettingsUpdateRequest for the defaults of missing keys. ' + WRITE_THROTTLE_TEXT,
    request: { headers: [csrf], body: body(AccountSettingsUpdateRequestSchema) },
    responses: {
      200: json(accountStatusEnvelopeOf(AccountSettingsSchema), `Saved. status = "${ACCOUNT_MESSAGES.settingsSaved}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        'subuh push time / sahur push time: "The <field> field must match the format H:i."; faith: "The selected faith is invalid.".',
      ),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (D57a).`),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/public/stats',
    tags: ['account'],
    summary: 'Public platform counters (login page)',
    description:
      'Public, no session. Computed per request from the database: published and active questions, active subjects, active education levels. Nothing is stored or hard-coded (BR-21). Unauthenticated lookup, so rate limited per client IP (D57a).',
    responses: {
      200: json(envelopeOf(AccountPlatformStatsSchema), 'The counters.'),
      429: rateLimited(`"${AUTH_ERROR_MESSAGES.RATE_LIMITED}" (D57a).`),
    },
  })
}
