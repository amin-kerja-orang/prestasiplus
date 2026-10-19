import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { SessionSchema } from '../session/session'
import {
  ACCOUNT_AUTH_MESSAGES,
  ACCOUNT_MESSAGES,
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
      'Public. Roles are limited to student, teacher and parent (default student); any other role in the body is a 422. Creates an active account and logs it in: the response is the contract Session and the session cookie is set (not remembered). Rate limited like login (BE-06 AC6). A duplicate e-mail (case-insensitive) is a 422 on `fields.email`.',
    request: { body: body(AccountRegisterRequestSchema) },
    responses: {
      201: json(envelopeOf(SessionSchema), 'Registered and logged in.'),
      422: validation(
        `Copy: name/email/password "The <field> field is required."; email "The email field must be a valid email address." / "${ACCOUNT_AUTH_MESSAGES.emailTaken}"; phone and ic number max 14; role "The selected role is invalid."; students: "${ACCOUNT_AUTH_MESSAGES.gradeRequired}" / "${ACCOUNT_AUTH_MESSAGES.gradeInvalid}"; school "${ACCOUNT_AUTH_MESSAGES.schoolInvalid}"; password min 6 and "The password field confirmation does not match.".`,
      ),
      429: err('RATE_LIMITED, with retryAfter (card AC6; the mock has no registration throttle).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/password/email',
    tags: ['account'],
    summary: 'Request a password reset link',
    description: `Public. Answers 200 "${ACCOUNT_AUTH_MESSAGES.resetSent}" for a known AND an unknown e-mail alike (existence is never disclosed; deviation from the mock 422 "${ACCOUNT_AUTH_MESSAGES.userNotFound}", card AC3). A token is valid 60 minutes and single use, stored hashed; the link goes through a MailPort that only logs in B1. A second request for the same e-mail within 60 seconds is 429 RATE_LIMITED with retryAfter (also the Retry-After header), whether or not the e-mail exists.`,
    request: { body: body(AccountPasswordEmailRequestSchema) },
    responses: {
      200: json(envelopeOf(AccountStatusSchema), `Accepted. status = "${ACCOUNT_AUTH_MESSAGES.resetSent}".`),
      422: validation('email: "The email field is required." / "The email field must be a valid email address.".'),
      429: err(`RATE_LIMITED "${ACCOUNT_AUTH_MESSAGES.resetThrottled}" with fields.email, retryAfter seconds.`),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/password/reset',
    tags: ['account'],
    summary: 'Set a new password with a reset token',
    description: `Public. Replaces the password, consumes the token (single use) and invalidates the user's other sessions (card AC2), then logs the user in: the response is the contract Session plus the flash text, and the cookie is set (not remembered). An unknown, used, expired or other-e-mail token, and an unknown e-mail, all answer 422 "${ACCOUNT_AUTH_MESSAGES.tokenInvalid}" on fields.email (the mock answered an unknown e-mail with "${ACCOUNT_AUTH_MESSAGES.userNotFound}"). An inactive account is refused with 403 ACCOUNT_INACTIVE and nothing changes.`,
    request: { body: body(AccountPasswordResetRequestSchema) },
    responses: {
      200: json(AccountPasswordResetResponseSchema, `Password reset and logged in. status = "${ACCOUNT_AUTH_MESSAGES.resetDone}".`),
      403: err(`ACCOUNT_INACTIVE "${ACCOUNT_AUTH_MESSAGES.accountInactive}".`),
      422: validation(`token/email/password required rules as register; "${ACCOUNT_AUTH_MESSAGES.tokenInvalid}" on fields.email.`),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/password/reset-ic',
    tags: ['account'],
    summary: 'Reset by e-mail and IC number (returns a reset token)',
    description: `Public. The IC number is compared with its stored hash and is never returned. A match returns a reset token to use with /auth/password/reset (60 minutes, single use). An unknown e-mail and a wrong IC number are indistinguishable: 422 "${ACCOUNT_AUTH_MESSAGES.icMismatch}" on fields.email. Issuing a token also starts the 60 second throttle of /auth/password/email for that e-mail.`,
    request: { body: body(AccountPasswordResetIcRequestSchema) },
    responses: {
      200: json(envelopeOf(AccountResetTokenSchema), 'Token issued.'),
      422: validation(`email required/valid; ic number required, max 14; mismatch "${ACCOUNT_AUTH_MESSAGES.icMismatch}" on fields.email.`),
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
      'Any signed-in role, own record only. `email` and any other key in the body are ignored (BR-13). An absent key keeps the stored value; null or blank clears phone, bio, grade, schoolId. schoolId is ignored for school_admin, ppd_officer and admin accounts.',
    request: { headers: [csrf], body: body(AccountProfileUpdateRequestSchema) },
    responses: {
      200: json(accountStatusEnvelopeOf(AccountUserMeSchema), `Saved. status = "${ACCOUNT_MESSAGES.profileSaved}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        `name required, max 255; phone max 14; bio max 500; grade "${ACCOUNT_AUTH_MESSAGES.gradeInvalid}"; school "${ACCOUNT_AUTH_MESSAGES.schoolInvalid}".`,
      ),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/me/password',
    tags: ['account'],
    summary: 'Change own password',
    description:
      'Any signed-in role. The current password is required and re-hashed with argon2id on change. The session is kept (BR-16).',
    request: { headers: [csrf], body: body(AccountPasswordChangeRequestSchema) },
    responses: {
      200: json(envelopeOf(AccountStatusSchema), `Changed. data.status = "${ACCOUNT_MESSAGES.passwordChanged}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        `current password required; password required, min 6, confirmed; a wrong current password is "${ACCOUNT_AUTH_MESSAGES.currentPasswordWrong}" on fields.currentPassword.`,
      ),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/me/picture',
    tags: ['account'],
    summary: 'Upload the profile picture',
    description:
      'Any signed-in role. multipart/form-data, part `profilePicture`: image/jpeg, image/png or image/webp, at most 2048 KB. Stored through BE-04; the response carries the file URL (the mock returned a data URL).',
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
    description: 'Any signed-in role. Every save writes all seven fields (BR-17); see AccountSettingsUpdateRequest for the defaults of missing keys.',
    request: { headers: [csrf], body: body(AccountSettingsUpdateRequestSchema) },
    responses: {
      200: json(accountStatusEnvelopeOf(AccountSettingsSchema), `Saved. status = "${ACCOUNT_MESSAGES.settingsSaved}".`),
      401: unauthorized,
      403: csrfInvalid,
      422: validation(
        'subuh push time / sahur push time: "The <field> field must match the format H:i."; faith: "The selected faith is invalid.".',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/public/stats',
    tags: ['account'],
    summary: 'Public platform counters (login page)',
    description:
      'Public, no session. Computed per request from the database: published and active questions, active subjects, active education levels. Nothing is stored or hard-coded (BR-21).',
    responses: { 200: json(envelopeOf(AccountPlatformStatsSchema), 'The counters.') },
  })
}
