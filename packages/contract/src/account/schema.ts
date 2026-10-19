import { z } from '../zod'
import { RoleCodeSchema } from '../common/enums'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { SessionSchema, type Session } from '../session/session'

/**
 * M01 account wire contract (BE-06, contract-only): self-registration, password reset, own profile,
 * password change, picture, personal settings and the public platform counters.
 *
 * Mock (the behavioural spec): `src/modules/m01-authentication/mock/handlers/{auth,auth-account,
 * auth-stats}.ts`, wire types `api/types.ts`, `GET /api/me` in `src/mock/core-data/{routes,me}.ts`.
 *
 * Differences from the mock, all listed once here:
 * - UD-1: ids are opaque `Id` strings (`schoolId`, `AccountUserMe.id`), not integers.
 * - UD-1: the session is the HTTP-only cookie plus `X-CSRF-Token`. Register and password reset answer
 *   with the contract `Session` (`{ data: Session }`), not the mock `{ token, expiresAt, user }`.
 * - The user projection is `AccountUserMe`: the mock single `role` is the ACTIVE role and `roles`
 *   (all roles of the account) is added so it agrees with `GET /session`; `username` is added
 *   (session users may have no e-mail); `isActive`, password, IC number and remember token never appear.
 * - Booleans of the settings body are JSON booleans (the mock also coerced "on", "1", ...).
 * - Numeric `grade` is a JSON integer (the mock also accepted digit strings from multipart forms).
 * - Unknown e-mail on `password/email` is answered like a known one (BE-06 card AC3, security), and
 *   an unknown e-mail on `password/reset` gets the token-invalid message instead of the mock
 *   "We can't find a user with that email address.". Both are APPROVED (user decision D55b, 2026-10-19):
 *   no account enumeration.
 * - D55a: `password/reset-ic` is attempt limited (5 per 15 minutes, per account and per IP), answered
 *   with 429 RATE_LIMITED; the mock has no such limit.
 * - D57a: every write route and the public lookup (`/public/stats`) documents 429 RATE_LIMITED with
 *   `retryAfter` and the `Retry-After` header; `password/reset` and `password/reset-ic` carry the
 *   limits of `ACCOUNT_THROTTLE` (the mock has none).
 * - D57b: the responses that carry a credential or token (register, reset, reset-ic) send
 *   `Cache-Control: no-store`.
 * - Security review 2026-10-19: `AccountResetToken` no longer echoes the e-mail (the client already
 *   holds it); the reset token is specified (>= 128-bit random, hash only, single use, one active
 *   token per user) in `ACCOUNT_RESET_TOKEN_RULES`; the per-e-mail throttle is uniform (keyed on the
 *   hash of the normalised e-mail for every request, known or not).
 *
 * Validation copy is the mock copy: Laravel 11 English defaults (SRS M01 section 5, unverified
 * copy) except the observed BM texts. Text fields are trimmed and a blank text counts as absent
 * (`ConvertEmptyStringsToNull`); passwords are never trimmed. Unknown body keys are ignored, never
 * stored (so a `role`, `email` on the profile, or `isActive` from the client has no effect).
 */

// --- Copy -------------------------------------------------------------------------------------

/** BM success texts (mock `MSG_*`), sent as the `status` of the response. */
export const ACCOUNT_MESSAGES = {
  profileSaved: 'Profil berjaya dikemaskini.',
  pictureSaved: 'Gambar profil berjaya dikemaskini.',
  passwordChanged: 'Kata laluan berjaya dikemaskini.',
  settingsSaved: 'Tetapan berjaya disimpan.',
} as const

/** Auth copy of the mock (`auth.ts`): Laravel `passwords.*` English texts and one BM placeholder. */
export const ACCOUNT_AUTH_MESSAGES = {
  resetSent: 'We have emailed your password reset link.',
  resetDone: 'Your password has been reset.',
  /** Mock-only: the API never discloses that an e-mail is unknown (see the header comment). */
  userNotFound: "We can't find a user with that email address.",
  resetThrottled: 'Please wait before retrying.',
  tokenInvalid: 'This password reset token is invalid.',
  icMismatch: 'Email atau No Kad Pengenalan tidak sepadan.',
  /** D55a: BM message of the reset-ic attempt limit; copy approved by D58c (2026-10-19). */
  resetIcRateLimited: 'Terlalu banyak percubaan. Sila cuba lagi dalam 15 minit.',
  accountInactive: 'Akaun anda tidak aktif. Sila hubungi pentadbir.',
  currentPasswordWrong: 'The password is incorrect.',
  emailTaken: 'The email has already been taken.',
  schoolInvalid: 'The selected school id is invalid.',
  gradeRequired: 'The grade field is required.',
  gradeInvalid: 'The selected grade is invalid.',
} as const

/** D55a: `POST /auth/password/reset-ic` allows 5 attempts per 15 minutes, counted per account (e-mail) and per IP. */
export const ACCOUNT_RESET_IC_MAX_ATTEMPTS = 5
export const ACCOUNT_RESET_IC_WINDOW_MINUTES = 15

/**
 * D57 / security review: throttle numbers of the public reset flow. The failed-attempt budget is the
 * BE-03 login throttle (5 failures per 60 seconds, then 429 until the window ends, backoff doubling
 * on repeat). `ipCeilingPerWindow` (20) is PROPOSED: a per-IP ceiling over all e-mails so a single
 * client cannot scan many accounts; the lead confirms the number. Keys: `emailIp` = hash of the
 * normalised e-mail + client IP (so an attacker cannot lock a victim out from another IP), `ip` = the
 * client IP alone.
 */
export const ACCOUNT_THROTTLE = {
  failedAttemptsPerWindow: 5,
  windowSeconds: 60,
  ipCeilingPerWindow: 20,
} as const

/**
 * Reset token rules (security review, D57). Repeated in the operation descriptions so BE-31 can
 * test them. Issued by `password/email` (mailed link) and by `password/reset-ic` (response body).
 */
export const ACCOUNT_RESET_TOKEN_RULES = {
  minEntropyBits: 128,
  summary:
    'The token is at least 128 bits from a CSPRNG; only its hash is stored; it is valid 60 minutes and single use; issuing a new token revokes every earlier unused token of that user (one active token); a successful reset consumes every outstanding token of the user; the stored hash is compared in constant time; an inactive account is never issued a token; the token is bound to the e-mail it was issued for and is redeemable only with that same e-mail.',
} as const

/**
 * Proposed BM copy of the in-app security notices (NotificationsService.push, type is a free code)
 * sent to the account owner when a reset token is issued by IC and when a password is reset, so a
 * takeover is visible. No existing frontend string; the lead confirms.
 */
export const ACCOUNT_SECURITY_NOTIFICATIONS = {
  resetIcIssued: {
    type: 'password_reset_ic',
    title: 'Permintaan tetap semula kata laluan',
    body: 'Kata laluan akaun anda diminta ditetapkan semula menggunakan No Kad Pengenalan. Jika bukan anda, sila hubungi pentadbir.',
  },
  resetDone: {
    type: 'password_reset',
    title: 'Kata laluan telah ditetapkan semula',
    body: 'Kata laluan akaun anda telah ditetapkan semula. Jika bukan anda, sila hubungi pentadbir.',
  },
} as const

/** Laravel validation templates with the attribute words filled in (mock `validate.ts`). */
const msg = {
  required: (attr: string) => `The ${attr} field is required.`,
  email: (attr: string) => `The ${attr} field must be a valid email address.`,
  maxChars: (attr: string, n: number) => `The ${attr} field must not be greater than ${String(n)} characters.`,
  minChars: (attr: string, n: number) => `The ${attr} field must be at least ${String(n)} characters.`,
  invalid: (attr: string) => `The selected ${attr} is invalid.`,
  confirmed: (attr: string) => `The ${attr} field confirmation does not match.`,
}

export const ACCOUNT_PASSWORD_MIN = 6
export const ACCOUNT_NAME_MAX = 255
export const ACCOUNT_EMAIL_MAX = 255
export const ACCOUNT_PHONE_MAX = 14
export const ACCOUNT_IC_MAX = 14
export const ACCOUNT_BIO_MAX = 500
export const ACCOUNT_GRADE_MIN = 1
export const ACCOUNT_GRADE_MAX = 11
/** A reset token is valid 60 minutes, single use (BR-10, BR-11); a new request per e-mail needs 60 s between. */
export const ACCOUNT_RESET_TOKEN_TTL_MINUTES = 60
export const ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS = 60

/** Roles a person may pick when registering (`SELF_REGISTER_ROLES`). */
export const ACCOUNT_SELF_REGISTER_ROLES = ['student', 'teacher', 'parent'] as const
export const AccountSelfRegisterRoleSchema = z
  .enum(ACCOUNT_SELF_REGISTER_ROLES, { error: msg.invalid('role') })
  .meta({ id: 'AccountSelfRegisterRole' })
export type AccountSelfRegisterRole = z.infer<typeof AccountSelfRegisterRoleSchema>

// --- Field builders ---------------------------------------------------------------------------

/** Required text, trimmed. A missing, non-text or blank value gives the "required" message. */
const requiredText = (attr: string, max: number) =>
  z
    .string({ error: msg.required(attr) })
    .trim()
    .min(1, { error: msg.required(attr) })
    .max(max, { error: msg.maxChars(attr, max) })

/** Optional text, trimmed. Absent keeps the stored value; `null` or blank clears it. */
const optionalText = (attr: string, max: number) =>
  z.string().trim().max(max, { error: msg.maxChars(attr, max) }).nullish()

const emailField = z
  .string({ error: msg.required('email') })
  .trim()
  .min(1, { error: msg.required('email') })
  .check(z.email({ error: msg.email('email') }))
  .max(ACCOUNT_EMAIL_MAX, { error: msg.maxChars('email', ACCOUNT_EMAIL_MAX) })

/** Password: never trimmed, minimum 6 characters (mock `min(6)`). */
const passwordField = (attr: string) =>
  z
    .string({ error: msg.required(attr) })
    .min(1, { error: msg.required(attr) })
    .min(ACCOUNT_PASSWORD_MIN, { error: msg.minChars(attr, ACCOUNT_PASSWORD_MIN) })

const confirmationField = z.string().optional()

/**
 * Laravel `confirmed`: `passwordConfirmation` must equal `password` (skipped when `password` is
 * empty, like every non-required rule); the message sits on `password`. `when` makes the check run
 * even when other fields failed or are missing, so one response lists every field error.
 */
const confirmedCheck = {
  when: () => true,
  path: ['password'],
  error: msg.confirmed('password'),
}
/** `when: () => true` also feeds non-objects (the OpenAPI generator probes with null), so guard. */
type Loose = Record<string, unknown>
const rec = (v: unknown): Loose => (typeof v === 'object' && v !== null ? (v as Loose) : {})
const isConfirmed = (value: unknown) => {
  const v = rec(value)
  return typeof v.password !== 'string' || v.password === '' || v.passwordConfirmation === v.password
}
/** Student grade (role defaults to student): the rule only applies to students. */
const studentGrade = (value: unknown): { student: boolean; grade: unknown } => {
  const v = rec(value)
  return { student: (v.role ?? 'student') === 'student', grade: v.grade }
}

const schoolIdField = IdSchema.nullish().meta({
  description: 'School id. Must exist (422 "The selected school id is invalid."). `null` or absent means no school.',
})

// --- Users ------------------------------------------------------------------------------------

/** School projection inside the user (M02 `SchoolSummary`, DATA-M01-06); local copy, M02 owns the school. */
export const AccountSchoolSummarySchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1),
    code: z.string().meta({ description: 'Empty string when the school has no code.' }),
    type: z.string(),
    state: z.string(),
    district: z.string().nullable(),
    city: z.string().nullable(),
  })
  .meta({ id: 'AccountSchoolSummary' })
export type AccountSchoolSummary = z.infer<typeof AccountSchoolSummarySchema>

/**
 * `GET /me` and the `data` of `PUT /me`: the signed-in user (mock `UserMe`). The shared fields
 * (`id`, `name`, `email`, `username`, `avatarUrl`, `schoolId`, and `roles` / `role` / `landingPath`
 * against `Session.roles`, `Session.active.role`, `Session.landingPath`) always agree with
 * `GET /session` (BE-06 AC8). Password, IC number, remember token and `isActive` never appear.
 */
export const AccountUserMeSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1),
    email: z.string().nullable(),
    username: z.string().nullable(),
    phone: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    grade: z.number().int().min(ACCOUNT_GRADE_MIN).max(ACCOUNT_GRADE_MAX).nullable().meta({ description: 'Students only.' }),
    schoolId: IdSchema.nullable(),
    school: AccountSchoolSummarySchema.nullable(),
    role: RoleCodeSchema.meta({ description: 'The ACTIVE role (equals Session.active.role).' }),
    roles: z.array(RoleCodeSchema).min(1).meta({ description: 'Every role of the account (equals the codes in Session.roles).' }),
    landingPath: z.string().startsWith('/').meta({ description: 'Server-computed, equals Session.landingPath (BR-07).' }),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    lastLoginAt: TimestampSchema.nullable(),
  })
  .superRefine((u, ctx) => {
    if (!u.roles.includes(u.role)) ctx.addIssue({ code: 'custom', path: ['role'], message: 'role must be one of roles' })
    if ((u.schoolId === null) !== (u.school === null)) {
      ctx.addIssue({ code: 'custom', path: ['school'], message: 'school and schoolId must agree' })
    } else if (u.school && u.school.id !== u.schoolId) {
      ctx.addIssue({ code: 'custom', path: ['school', 'id'], message: 'school.id must equal schoolId' })
    }
  })
  .meta({ id: 'AccountUserMe' })
export type AccountUserMe = z.infer<typeof AccountUserMeSchema>

/**
 * BE-06 AC8: the fields `GET /me` shares with `GET /session`. Returns the names of the fields that
 * disagree (empty = consistent). `me.role` is compared with `session.active.role`, `me.roles` with
 * the role codes of `session.roles` (same order not required).
 */
export function accountUserMeMismatches(me: AccountUserMe, session: Session): string[] {
  const out: string[] = []
  const u = session.user
  if (me.id !== u.id) out.push('id')
  if (me.name !== u.name) out.push('name')
  if (me.email !== u.email) out.push('email')
  if (me.username !== u.username) out.push('username')
  if (me.avatarUrl !== u.avatarUrl) out.push('avatarUrl')
  if (me.schoolId !== u.schoolId) out.push('schoolId')
  if (me.role !== session.active.role) out.push('role')
  const a = [...me.roles].sort().join(',')
  const b = session.roles.map((g) => g.role).sort().join(',')
  if (a !== b) out.push('roles')
  if (me.landingPath !== session.landingPath) out.push('landingPath')
  return out
}

/** Envelope with the flash text: `status` is a SIBLING of `data` (mock `Env-DS`). */
export function accountStatusEnvelopeOf<T extends z.ZodType>(data: T) {
  return z.object({ data, status: z.string().min(1) })
}

/** `data` of the routes that answer only a flash text (`password/email`, `PUT /me/password`). */
export const AccountStatusSchema = z
  .strictObject({ status: z.string().min(1) })
  .meta({ id: 'AccountStatus' })
export type AccountStatus = z.infer<typeof AccountStatusSchema>

// --- Register ---------------------------------------------------------------------------------

/**
 * Body of `POST /auth/register` (mock `register()`). `role` defaults to `student`; `grade` is
 * required (1 to 11) for students and ignored for other roles; `icNumber` is stored for students
 * only. The e-mail must be unique case-insensitively (422 `fields.email` "The email has already
 * been taken.", checked by the server). `referralCode` is the provisional M14 hook (FR-M01-70); an
 * unknown code is ignored.
 */
export const AccountRegisterRequestSchema = z
  .object({
    name: requiredText('name', ACCOUNT_NAME_MAX),
    email: emailField,
    phone: optionalText('phone', ACCOUNT_PHONE_MAX),
    role: AccountSelfRegisterRoleSchema.nullish(),
    grade: z.number().int().nullish().meta({ description: 'Student only, 1 to 11.' }),
    icNumber: optionalText('ic number', ACCOUNT_IC_MAX).meta({ description: 'Student only. Write-only: never returned.' }),
    schoolId: schoolIdField,
    password: passwordField('password'),
    passwordConfirmation: confirmationField,
    referralCode: z.string().trim().nullish(),
  })
  .refine(isConfirmed, confirmedCheck)
  .refine(
    (v) => {
      const { student, grade } = studentGrade(v)
      return !student || (grade !== undefined && grade !== null)
    },
    { when: () => true, path: ['grade'], error: ACCOUNT_AUTH_MESSAGES.gradeRequired },
  )
  .refine(
    (v) => {
      const { student, grade } = studentGrade(v)
      return (
        !student ||
        typeof grade !== 'number' ||
        (grade >= ACCOUNT_GRADE_MIN && grade <= ACCOUNT_GRADE_MAX)
      )
    },
    { when: () => true, path: ['grade'], error: ACCOUNT_AUTH_MESSAGES.gradeInvalid },
  )
  .meta({ id: 'AccountRegisterRequest' })
export type AccountRegisterRequest = z.infer<typeof AccountRegisterRequestSchema>

// --- Password reset ---------------------------------------------------------------------------

/** Body of `POST /auth/password/email`. */
export const AccountPasswordEmailRequestSchema = z
  .object({ email: emailField })
  .meta({ id: 'AccountPasswordEmailRequest' })
export type AccountPasswordEmailRequest = z.infer<typeof AccountPasswordEmailRequestSchema>

/** Body of `POST /auth/password/reset`: the token from the e-mailed link (or from reset-ic). */
export const AccountPasswordResetRequestSchema = z
  .object({
    token: z.string({ error: msg.required('token') }).trim().min(1, { error: msg.required('token') }),
    email: emailField,
    password: passwordField('password'),
    passwordConfirmation: confirmationField,
  })
  .refine(isConfirmed, confirmedCheck)
  .meta({ id: 'AccountPasswordResetRequest' })
export type AccountPasswordResetRequest = z.infer<typeof AccountPasswordResetRequestSchema>

/**
 * Body of `POST /auth/password/reset-ic`. The IC number is write-only and compared to the stored
 * hash; it is never returned.
 */
export const AccountPasswordResetIcRequestSchema = z
  .object({
    email: emailField,
    icNumber: requiredText('ic number', ACCOUNT_IC_MAX),
  })
  .meta({ id: 'AccountPasswordResetIcRequest' })
export type AccountPasswordResetIcRequest = z.infer<typeof AccountPasswordResetIcRequestSchema>

/**
 * `data` of `POST /auth/password/reset-ic`: the reset token to use with `password/reset`. The
 * e-mail is NOT echoed (the client already holds it; data minimisation, BE-NFR-11). The token is
 * bound to that e-mail and can only be redeemed through `password/reset` with it; see
 * `ACCOUNT_RESET_TOKEN_RULES`. The response is `Cache-Control: no-store`.
 */
export const AccountResetTokenSchema = z
  .strictObject({
    token: z.string().min(1).meta({
      description:
        'Opaque reset token, at least 128 bits of randomness; only its hash is stored. Never logged, never cached.',
    }),
  })
  .meta({ id: 'AccountResetToken' })
export type AccountResetToken = z.infer<typeof AccountResetTokenSchema>

/** `POST /auth/password/reset` 200: the new session (cookie also set) plus the flash text. */
export const AccountPasswordResetResponseSchema = accountStatusEnvelopeOf(SessionSchema).meta({
  id: 'AccountPasswordResetResponse',
})
export type AccountPasswordResetResponse = z.infer<typeof AccountPasswordResetResponseSchema>

// --- Profile ----------------------------------------------------------------------------------

/**
 * Body of `PUT /me`. `email` (and any other key) in the body is ignored (BR-13). An ABSENT key keeps
 * the stored value; `null` or a blank text clears `phone`, `bio`, `grade`, `schoolId`. For school
 * admin, PPD/JPN officer and admin accounts `schoolId` is ignored (a staff school is an
 * admin-assigned scope).
 */
export const AccountProfileUpdateRequestSchema = z
  .object({
    name: requiredText('name', ACCOUNT_NAME_MAX),
    phone: optionalText('phone', ACCOUNT_PHONE_MAX),
    bio: optionalText('bio', ACCOUNT_BIO_MAX),
    grade: z
      .number({ error: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
      .int({ error: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
      .min(ACCOUNT_GRADE_MIN, { error: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
      .max(ACCOUNT_GRADE_MAX, { error: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
      .nullish(),
    schoolId: schoolIdField,
  })
  .meta({ id: 'AccountProfileUpdateRequest' })
export type AccountProfileUpdateRequest = z.infer<typeof AccountProfileUpdateRequestSchema>

/** Body of `PUT /me/password`. The session is kept (BR-16). */
export const AccountPasswordChangeRequestSchema = z
  .object({
    currentPassword: z.string({ error: msg.required('current password') }).min(1, { error: msg.required('current password') }),
    password: passwordField('password'),
    passwordConfirmation: confirmationField,
  })
  .refine(isConfirmed, confirmedCheck)
  .meta({ id: 'AccountPasswordChangeRequest' })
export type AccountPasswordChangeRequest = z.infer<typeof AccountPasswordChangeRequestSchema>

// --- Picture ----------------------------------------------------------------------------------

/** BR-15: image/jpeg, image/png or image/webp, at most 2048 KB. */
export const ACCOUNT_PICTURE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCOUNT_PICTURE_MAX_KB = 2048
export const ACCOUNT_PICTURE_MESSAGES = {
  required: msg.required('profile picture'),
  type: 'The profile picture field must be a file of type: jpeg, png, webp.',
  size: `The profile picture field must not be greater than ${String(ACCOUNT_PICTURE_MAX_KB)} kilobytes.`,
} as const

/** The `profilePicture` file part (multipart): validates a `Blob` by declared type and size. */
export const AccountPictureFileSchema = z
  .custom<Blob>((value) => value instanceof Blob, { error: ACCOUNT_PICTURE_MESSAGES.required })
  .superRefine((file, ctx) => {
    if (!(ACCOUNT_PICTURE_MIME_TYPES as readonly string[]).includes(file.type)) {
      ctx.addIssue({ code: 'custom', message: ACCOUNT_PICTURE_MESSAGES.type })
    } else if (file.size > ACCOUNT_PICTURE_MAX_KB * 1024) {
      ctx.addIssue({ code: 'custom', message: ACCOUNT_PICTURE_MESSAGES.size })
    }
  })
  .meta({
    type: 'string',
    format: 'binary',
    description: 'Image file, image/jpeg, image/png or image/webp, at most 2048 KB. Stored through BE-04.',
  })

/** Body of `POST /me/picture`, `multipart/form-data`. */
export const AccountPictureUploadRequestSchema = z
  .object({ profilePicture: AccountPictureFileSchema })
  .meta({ id: 'AccountPictureUploadRequest' })
export type AccountPictureUploadRequest = z.infer<typeof AccountPictureUploadRequestSchema>

/** `data` of `POST /me/picture`. The mock returned a data URL; the API returns the stored file URL. */
export const AccountPictureSchema = z
  .strictObject({ avatarUrl: z.string().min(1) })
  .meta({ id: 'AccountPicture' })
export type AccountPicture = z.infer<typeof AccountPictureSchema>

// --- Settings ---------------------------------------------------------------------------------

export const ACCOUNT_FAITHS = ['muslim', 'hindu', 'buddhist', 'christian', 'none'] as const
export const AccountFaithSchema = z.enum(ACCOUNT_FAITHS, { error: msg.invalid('faith') }).meta({ id: 'AccountFaith' })
export type AccountFaith = z.infer<typeof AccountFaithSchema>

/** `HH:mm`, 24 hour. */
export const ACCOUNT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** BR-17 defaults, returned for a user who never saved. */
export const ACCOUNT_SETTINGS_DEFAULTS = {
  spiritualMode: false,
  showBismillahSplash: false,
  subuhPushEnabled: false,
  subuhPushTime: '05:30',
  ramadanModeEnabled: false,
  sahurPushTime: '04:30',
  faith: null,
} as const

const timeResponse = z.string().regex(ACCOUNT_TIME_PATTERN)

/** `data` of `GET /me/settings` and of `PUT /me/settings`. */
export const AccountSettingsSchema = z
  .strictObject({
    spiritualMode: z.boolean(),
    showBismillahSplash: z.boolean(),
    subuhPushEnabled: z.boolean(),
    subuhPushTime: timeResponse.meta({ description: 'HH:mm, default 05:30.' }),
    ramadanModeEnabled: z.boolean(),
    sahurPushTime: timeResponse.meta({ description: 'HH:mm, default 04:30.' }),
    faith: AccountFaithSchema.nullable().meta({
      description: 'Personal preference, kept although the migration drops it (card open question 3).',
    }),
  })
  .meta({ id: 'AccountSettings' })
export type AccountSettings = z.infer<typeof AccountSettingsSchema>

const timeRequest = (attr: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || ACCOUNT_TIME_PATTERN.test(v), { error: `The ${attr} field must match the format H:i.` })
    .nullish()
    .meta({ description: 'HH:mm (24 hour). Blank or null gives the default time.', example: '05:30' })

/**
 * Body of `PUT /me/settings`: every save writes all fields. A missing boolean counts as false (an
 * unticked checkbox, BR-17); a blank or missing time gives the default; a blank `faith` gives null.
 */
export const AccountSettingsUpdateRequestSchema = z
  .object({
    spiritualMode: z.boolean().default(false),
    showBismillahSplash: z.boolean().default(false),
    subuhPushEnabled: z.boolean().default(false),
    subuhPushTime: timeRequest('subuh push time'),
    ramadanModeEnabled: z.boolean().default(false),
    sahurPushTime: timeRequest('sahur push time'),
    faith: z.union([AccountFaithSchema, z.literal('')], { error: msg.invalid('faith') }).nullish(),
  })
  .meta({ id: 'AccountSettingsUpdateRequest' })
export type AccountSettingsUpdateRequest = z.infer<typeof AccountSettingsUpdateRequestSchema>

// --- Public stats -----------------------------------------------------------------------------

/**
 * `data` of `GET /public/stats` (public, BR-21): computed per request from the question bank
 * (published and active questions, D54a) and the active subjects and education levels; nothing is
 * stored or hard-coded.
 */
export const AccountPlatformStatsSchema = z
  .strictObject({
    questionCount: z.number().int().min(0),
    subjectCount: z.number().int().min(0),
    levelCount: z.number().int().min(0),
  })
  .meta({ id: 'AccountPlatformStats' })
export type AccountPlatformStats = z.infer<typeof AccountPlatformStatsSchema>
