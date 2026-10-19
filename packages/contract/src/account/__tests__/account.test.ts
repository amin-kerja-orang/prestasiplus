import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { SessionSchema, type Session } from '../../session/session'
import { ACCOUNT_COMPONENT_SCHEMAS } from '../paths'
import {
  ACCOUNT_AUTH_MESSAGES,
  ACCOUNT_MESSAGES,
  ACCOUNT_PICTURE_MAX_KB,
  ACCOUNT_PICTURE_MESSAGES,
  ACCOUNT_RESET_IC_MAX_ATTEMPTS,
  ACCOUNT_RESET_IC_WINDOW_MINUTES,
  ACCOUNT_SETTINGS_DEFAULTS,
  AccountPasswordChangeRequestSchema,
  AccountPasswordEmailRequestSchema,
  AccountPasswordResetIcRequestSchema,
  AccountPasswordResetRequestSchema,
  AccountPasswordResetResponseSchema,
  AccountPictureFileSchema,
  AccountPictureSchema,
  AccountPlatformStatsSchema,
  AccountProfileUpdateRequestSchema,
  AccountRegisterRequestSchema,
  AccountResetTokenSchema,
  AccountSettingsSchema,
  AccountSettingsUpdateRequestSchema,
  AccountStatusSchema,
  AccountUserMeSchema,
  accountUserMeMismatches,
  type AccountUserMe,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'

/** First message per top-level field of a failed parse (the mock reports one message per field). */
function fields(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) {
  const r = schema.safeParse(value)
  if (r.success || !r.error) return {} as Record<string, string>
  const out: Record<string, string> = {}
  for (const i of r.error.issues) {
    const key = String(i.path[0])
    if (!(key in out)) out[key] = i.message
  }
  return out
}

const school = { id: '3', name: 'SK Contoh', code: 'ABC1234', type: 'SK', state: 'Selangor', district: 'Petaling', city: null }
const me: AccountUserMe = {
  id: '7',
  name: 'Murid Contoh',
  email: 'murid@contoh.test',
  username: null,
  phone: null,
  bio: null,
  avatarUrl: null,
  grade: 5,
  schoolId: '3',
  school,
  role: 'student',
  roles: ['student'],
  landingPath: '/dashboard',
  createdAt: AT,
  updatedAt: AT,
  lastLoginAt: null,
}
const selfScope = { level: 'self', label: 'Diri sendiri' }
const session = (): Session =>
  SessionSchema.parse({
    user: { id: '7', name: 'Murid Contoh', email: 'murid@contoh.test', username: null, avatarUrl: null, schoolId: '3' },
    roles: [{ role: 'student', portal: 'pembelajaran', scope: selfScope }],
    active: { role: 'student', portal: 'pembelajaran', scope: selfScope, via: 'direct' },
    mode: null,
    capabilities: [],
    landingPath: '/dashboard',
    expiresAt: '2026-10-16T17:30:00+08:00',
    csrf: 'tok',
  })

const register = {
  name: 'Murid Contoh',
  email: 'murid@contoh.test',
  role: 'student',
  grade: 5,
  schoolId: '3',
  password: 'rahsia1',
  passwordConfirmation: 'rahsia1',
}

describe('AccountUserMe', () => {
  it('parses a user and never carries secrets or isActive', () => {
    expect(AccountUserMeSchema.safeParse(me).success).toBe(true)
    expect(AccountUserMeSchema.safeParse({ ...me, school: null, schoolId: null, grade: null, lastLoginAt: AT }).success).toBe(true)
    for (const leak of ['password', 'icNumber', 'rememberToken', 'isActive', 'passwordHash']) {
      expect(AccountUserMeSchema.safeParse({ ...me, [leak]: 'x' }).success).toBe(false)
    }
  })

  it('rejects numeric ids, a UTC timestamp, a bad grade, an unknown role and inconsistent role/school', () => {
    expect(AccountUserMeSchema.safeParse({ ...me, id: 7 }).success).toBe(false)
    expect(AccountUserMeSchema.safeParse({ ...me, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(AccountUserMeSchema.safeParse({ ...me, grade: 12 }).success).toBe(false)
    expect(AccountUserMeSchema.safeParse({ ...me, role: 'jpn_officer' }).success).toBe(false)
    expect(AccountUserMeSchema.safeParse({ ...me, role: 'teacher' }).success).toBe(false)
    expect(AccountUserMeSchema.safeParse({ ...me, school: null }).success).toBe(false)
    expect(AccountUserMeSchema.safeParse({ ...me, school: { ...school, id: '9' } }).success).toBe(false)
  })

  it('agrees with GET /session on the shared fields (AC8)', () => {
    expect(accountUserMeMismatches(me, session())).toEqual([])
    expect(accountUserMeMismatches({ ...me, name: 'Lain', landingPath: '/admin', schoolId: null }, session())).toEqual([
      'name',
      'schoolId',
      'landingPath',
    ])
  })
})

describe('register', () => {
  it('accepts a student, defaults the role and strips unknown keys (role escalation, isActive)', () => {
    expect(AccountRegisterRequestSchema.safeParse(register).success).toBe(true)
    const noRole = { ...register, role: undefined }
    expect(AccountRegisterRequestSchema.safeParse(noRole).success).toBe(true)
    const parsed = AccountRegisterRequestSchema.parse({ ...register, isActive: false, schoolRole: 'admin', name: '  Murid Contoh ' })
    expect(parsed).not.toHaveProperty('isActive')
    expect(parsed).not.toHaveProperty('schoolRole')
    expect(parsed.name).toBe('Murid Contoh')
  })

  it('accepts a teacher and a parent without grade (grade ignored for them)', () => {
    for (const role of ['teacher', 'parent']) {
      expect(AccountRegisterRequestSchema.safeParse({ ...register, role, grade: undefined }).success).toBe(true)
      expect(AccountRegisterRequestSchema.safeParse({ ...register, role, grade: 99 }).success).toBe(true)
    }
  })

  it('limits the roles to student, teacher and parent', () => {
    for (const role of ['admin', 'school_admin', 'ppd_officer', 'sponsor', 'jpn_officer', '']) {
      expect(fields(AccountRegisterRequestSchema, { ...register, role })).toEqual({ role: 'The selected role is invalid.' })
    }
  })

  it('gives the mock copy per field', () => {
    expect(fields(AccountRegisterRequestSchema, {})).toEqual({
      name: 'The name field is required.',
      email: 'The email field is required.',
      password: 'The password field is required.',
      grade: ACCOUNT_AUTH_MESSAGES.gradeRequired,
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, name: 'a'.repeat(256) })).toEqual({
      name: 'The name field must not be greater than 255 characters.',
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, email: 'bukan-emel' })).toEqual({
      email: 'The email field must be a valid email address.',
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, phone: '1'.repeat(15) })).toEqual({
      phone: 'The phone field must not be greater than 14 characters.',
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, icNumber: '1'.repeat(15) })).toEqual({
      icNumber: 'The ic number field must not be greater than 14 characters.',
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, grade: 0 })).toEqual({ grade: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
    expect(fields(AccountRegisterRequestSchema, { ...register, grade: 12 })).toEqual({ grade: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
  })

  it('password: min 6 first, then confirmation; passwords are not trimmed', () => {
    expect(fields(AccountRegisterRequestSchema, { ...register, password: 'abc', passwordConfirmation: 'abd' })).toEqual({
      password: 'The password field must be at least 6 characters.',
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, passwordConfirmation: 'rahsia2' })).toEqual({
      password: 'The password field confirmation does not match.',
    })
    expect(fields(AccountRegisterRequestSchema, { ...register, passwordConfirmation: undefined })).toEqual({
      password: 'The password field confirmation does not match.',
    })
    const spaced = AccountRegisterRequestSchema.parse({ ...register, password: ' rahsia1 ', passwordConfirmation: ' rahsia1 ' })
    expect(spaced.password).toBe(' rahsia1 ')
  })

  it('school id is an Id string; the optional text fields take null or blank', () => {
    expect(AccountRegisterRequestSchema.safeParse({ ...register, schoolId: 3 }).success).toBe(false)
    expect(AccountRegisterRequestSchema.safeParse({ ...register, schoolId: null, phone: null, icNumber: '', referralCode: null }).success).toBe(true)
  })
})

describe('password reset', () => {
  it('email request', () => {
    expect(AccountPasswordEmailRequestSchema.safeParse({ email: ' a@b.test ' }).success).toBe(true)
    expect(fields(AccountPasswordEmailRequestSchema, {})).toEqual({ email: 'The email field is required.' })
    expect(fields(AccountPasswordEmailRequestSchema, { email: 'x' })).toEqual({ email: 'The email field must be a valid email address.' })
  })

  it('reset request needs token, e-mail and a confirmed password', () => {
    const ok = { token: 'rt_abc', email: 'a@b.test', password: 'rahsia1', passwordConfirmation: 'rahsia1' }
    expect(AccountPasswordResetRequestSchema.safeParse(ok).success).toBe(true)
    expect(fields(AccountPasswordResetRequestSchema, {})).toEqual({
      token: 'The token field is required.',
      email: 'The email field is required.',
      password: 'The password field is required.',
    })
    expect(fields(AccountPasswordResetRequestSchema, { ...ok, passwordConfirmation: 'x' })).toEqual({
      password: 'The password field confirmation does not match.',
    })
  })

  it('reset-ic request: the IC number is required, max 14 and never in a response', () => {
    expect(AccountPasswordResetIcRequestSchema.safeParse({ email: 'a@b.test', icNumber: '010101-01-0101' }).success).toBe(true)
    expect(fields(AccountPasswordResetIcRequestSchema, { email: 'a@b.test' })).toEqual({ icNumber: 'The ic number field is required.' })
    expect(fields(AccountPasswordResetIcRequestSchema, { email: 'a@b.test', icNumber: '1'.repeat(15) })).toEqual({
      icNumber: 'The ic number field must not be greater than 14 characters.',
    })
    expect(AccountResetTokenSchema.safeParse({ token: 'rt_abc', email: 'a@b.test' }).success).toBe(true)
    expect(AccountResetTokenSchema.safeParse({ token: 'rt_abc', email: 'a@b.test', icNumber: '1' }).success).toBe(false)
  })

  it('reset response is the Session plus a sibling status', () => {
    expect(AccountPasswordResetResponseSchema.safeParse({ data: session(), status: ACCOUNT_AUTH_MESSAGES.resetDone }).success).toBe(true)
    expect(AccountPasswordResetResponseSchema.safeParse({ data: session() }).success).toBe(false)
    expect(AccountPasswordResetResponseSchema.safeParse({ data: { token: 'x', expiresAt: AT, user: me }, status: 's' }).success).toBe(false)
    expect(AccountStatusSchema.safeParse({ status: ACCOUNT_AUTH_MESSAGES.resetSent }).success).toBe(true)
  })

  it('keeps the mock error copy and the rate limit shape', () => {
    expect(ACCOUNT_AUTH_MESSAGES.icMismatch).toBe('Email atau No Kad Pengenalan tidak sepadan.')
    expect(ACCOUNT_AUTH_MESSAGES.tokenInvalid).toBe('This password reset token is invalid.')
    expect(ACCOUNT_AUTH_MESSAGES.resetSent).toBe('We have emailed your password reset link.')
    const throttled = { error: { code: 'RATE_LIMITED', message: 'Please wait before retrying.', fields: { email: 'Please wait before retrying.' }, retryAfter: 42 } }
    expect(ErrorBodySchema.safeParse(throttled).success).toBe(true)
  })
})

describe('D55 decisions', () => {
  it('exports the reset-ic attempt limit as 5 per 15 minutes', () => {
    expect(ACCOUNT_RESET_IC_MAX_ATTEMPTS).toBe(5)
    expect(ACCOUNT_RESET_IC_WINDOW_MINUTES).toBe(15)
  })

  it('reset-ic documents 429 RATE_LIMITED with the BM message and the per-account + per-IP rule', () => {
    const doc = buildOpenApiDocument() as {
      paths: Record<string, Record<string, { description?: string; responses: Record<string, { description?: string; content?: Record<string, { schema: unknown }> }> }>>
    }
    const op = doc.paths['/auth/password/reset-ic']?.post
    const res = op?.responses['429']
    expect(res?.description).toContain('RATE_LIMITED')
    expect(res?.description).toContain(ACCOUNT_AUTH_MESSAGES.resetIcRateLimited)
    expect(res?.content?.['application/json']).toBeDefined()
    expect(ACCOUNT_AUTH_MESSAGES.resetIcRateLimited).toBe('Terlalu banyak percubaan. Sila cuba lagi dalam 15 minit.')
    expect(op?.description).toContain('per account')
    expect(op?.description).toContain('per client IP')
    const limited = { error: { code: 'RATE_LIMITED', message: ACCOUNT_AUTH_MESSAGES.resetIcRateLimited, retryAfter: 900 } }
    expect(ErrorBodySchema.safeParse(limited).success).toBe(true)
  })

  it('states no-enumeration as decided (D55b), not pending', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { description?: string }>> }
    expect(doc.paths['/auth/password/email']?.post?.description).toContain('D55b')
    expect(doc.paths['/auth/password/reset']?.post?.description).toContain('D55b')
  })
})

describe('profile', () => {
  it('requires name, ignores email and any other key', () => {
    expect(fields(AccountProfileUpdateRequestSchema, {})).toEqual({ name: 'The name field is required.' })
    const parsed = AccountProfileUpdateRequestSchema.parse({ name: ' Murid Baharu ', email: 'lain@contoh.test', role: 'admin', isActive: false })
    expect(parsed).toEqual({ name: 'Murid Baharu' })
  })

  it('absent keeps, null or blank clears', () => {
    const absent = AccountProfileUpdateRequestSchema.parse({ name: 'A' })
    expect('phone' in absent).toBe(false)
    expect(AccountProfileUpdateRequestSchema.parse({ name: 'A', phone: null, bio: null, grade: null, schoolId: null })).toEqual({
      name: 'A',
      phone: null,
      bio: null,
      grade: null,
      schoolId: null,
    })
    expect(AccountProfileUpdateRequestSchema.parse({ name: 'A', phone: '   ' }).phone).toBe('')
  })

  it('limits and copy', () => {
    expect(fields(AccountProfileUpdateRequestSchema, { name: 'A', bio: 'b'.repeat(501) })).toEqual({
      bio: 'The bio field must not be greater than 500 characters.',
    })
    expect(fields(AccountProfileUpdateRequestSchema, { name: 'A', phone: '1'.repeat(15) })).toEqual({
      phone: 'The phone field must not be greater than 14 characters.',
    })
    for (const grade of [0, 12, 1.5, '5']) {
      expect(fields(AccountProfileUpdateRequestSchema, { name: 'A', grade })).toEqual({ grade: ACCOUNT_AUTH_MESSAGES.gradeInvalid })
    }
    expect(AccountProfileUpdateRequestSchema.safeParse({ name: 'A', grade: 11, schoolId: '3' }).success).toBe(true)
    expect(AccountProfileUpdateRequestSchema.safeParse({ name: 'A', schoolId: 3 }).success).toBe(false)
  })

  it('exact success copy', () => {
    expect(ACCOUNT_MESSAGES).toEqual({
      profileSaved: 'Profil berjaya dikemaskini.',
      pictureSaved: 'Gambar profil berjaya dikemaskini.',
      passwordChanged: 'Kata laluan berjaya dikemaskini.',
      settingsSaved: 'Tetapan berjaya disimpan.',
    })
  })
})

describe('change password', () => {
  const ok = { currentPassword: 'lama123', password: 'baharu1', passwordConfirmation: 'baharu1' }
  it('needs the current password and a confirmed new one', () => {
    expect(AccountPasswordChangeRequestSchema.safeParse(ok).success).toBe(true)
    expect(fields(AccountPasswordChangeRequestSchema, {})).toEqual({
      currentPassword: 'The current password field is required.',
      password: 'The password field is required.',
    })
    expect(fields(AccountPasswordChangeRequestSchema, { ...ok, password: 'abc', passwordConfirmation: 'abc' })).toEqual({
      password: 'The password field must be at least 6 characters.',
    })
    expect(fields(AccountPasswordChangeRequestSchema, { ...ok, passwordConfirmation: 'lain123' })).toEqual({
      password: 'The password field confirmation does not match.',
    })
  })

  it('a wrong current password is a server 422 on fields.currentPassword', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: ACCOUNT_AUTH_MESSAGES.currentPasswordWrong, fields: { currentPassword: ACCOUNT_AUTH_MESSAGES.currentPasswordWrong } } }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
  })
})

describe('picture', () => {
  const file = (type: string, bytes: number) => new Blob([new Uint8Array(bytes)], { type })
  const messages = (v: unknown) => {
    const r = AccountPictureFileSchema.safeParse(v)
    return r.success ? [] : r.error.issues.map((i) => i.message)
  }
  it('accepts jpeg, png and webp up to 2048 KB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(messages(file(type, 1024))).toEqual([])
    expect(messages(file('image/png', ACCOUNT_PICTURE_MAX_KB * 1024))).toEqual([])
  })
  it('refuses other types, big files and non-files with the mock copy', () => {
    expect(messages(file('image/gif', 10))).toEqual([ACCOUNT_PICTURE_MESSAGES.type])
    expect(messages(file('application/pdf', 10))).toEqual([ACCOUNT_PICTURE_MESSAGES.type])
    expect(messages(file('image/png', ACCOUNT_PICTURE_MAX_KB * 1024 + 1))).toEqual([ACCOUNT_PICTURE_MESSAGES.size])
    expect(messages(undefined)).toEqual(['The profile picture field is required.'])
    expect(messages('data:image/png;base64,AAA')).toEqual(['The profile picture field is required.'])
    expect(ACCOUNT_PICTURE_MESSAGES.type).toBe('The profile picture field must be a file of type: jpeg, png, webp.')
    expect(ACCOUNT_PICTURE_MESSAGES.size).toBe('The profile picture field must not be greater than 2048 kilobytes.')
  })
  it('response carries only the avatar URL', () => {
    expect(AccountPictureSchema.safeParse({ avatarUrl: '/files/avatars/7.png' }).success).toBe(true)
    expect(AccountPictureSchema.safeParse({ avatarUrl: '' }).success).toBe(false)
  })
})

describe('settings', () => {
  const saved = { ...ACCOUNT_SETTINGS_DEFAULTS }
  it('defaults match BR-17 and parse as a response', () => {
    expect(AccountSettingsSchema.safeParse(saved).success).toBe(true)
    expect(saved).toEqual({
      spiritualMode: false,
      showBismillahSplash: false,
      subuhPushEnabled: false,
      subuhPushTime: '05:30',
      ramadanModeEnabled: false,
      sahurPushTime: '04:30',
      faith: null,
    })
    expect(AccountSettingsSchema.safeParse({ ...saved, faith: 'muslim', subuhPushTime: '24:00' }).success).toBe(false)
    expect(AccountSettingsSchema.safeParse({ ...saved, faith: 'atheist' }).success).toBe(false)
    expect(AccountSettingsSchema.safeParse({ ...saved, extra: 1 }).success).toBe(false)
  })

  it('a missing boolean is false; blank times and faith are accepted (server applies defaults)', () => {
    const parsed = AccountSettingsUpdateRequestSchema.parse({})
    expect(parsed.spiritualMode).toBe(false)
    expect(parsed.ramadanModeEnabled).toBe(false)
    expect(AccountSettingsUpdateRequestSchema.safeParse({ subuhPushTime: '', sahurPushTime: null, faith: '' }).success).toBe(true)
    expect(AccountSettingsUpdateRequestSchema.safeParse({ ...saved, faith: 'hindu', subuhPushTime: '23:59', sahurPushTime: '00:00' }).success).toBe(true)
  })

  it('time and faith copy', () => {
    for (const t of ['5:30', '24:00', '12:60', '0530', 'aa:bb']) {
      expect(fields(AccountSettingsUpdateRequestSchema, { subuhPushTime: t, sahurPushTime: t })).toEqual({
        subuhPushTime: 'The subuh push time field must match the format H:i.',
        sahurPushTime: 'The sahur push time field must match the format H:i.',
      })
    }
    expect(fields(AccountSettingsUpdateRequestSchema, { faith: 'atheist' })).toEqual({ faith: 'The selected faith is invalid.' })
  })
})

describe('public stats', () => {
  it('has three non-negative counts and nothing else', () => {
    expect(AccountPlatformStatsSchema.safeParse({ questionCount: 128989, subjectCount: 31, levelCount: 11 }).success).toBe(true)
    expect(AccountPlatformStatsSchema.safeParse({ questionCount: -1, subjectCount: 0, levelCount: 0 }).success).toBe(false)
    expect(AccountPlatformStatsSchema.safeParse({ questionCount: 1, subjectCount: 1, levelCount: 1, userCount: 5 }).success).toBe(false)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { tags?: string[]; requestBody?: { content: Record<string, unknown> }; responses: Record<string, unknown>; parameters?: { name: string }[] }>>
    components: { schemas: Record<string, unknown> }
  }
  const routes: [string, string][] = [
    ['post', '/auth/register'],
    ['post', '/auth/password/email'],
    ['post', '/auth/password/reset'],
    ['post', '/auth/password/reset-ic'],
    ['get', '/me'],
    ['put', '/me'],
    ['put', '/me/password'],
    ['post', '/me/picture'],
    ['get', '/me/settings'],
    ['put', '/me/settings'],
    ['get', '/public/stats'],
  ]

  it('contains the 11 account routes and counts them by its own tag', () => {
    for (const [method, path] of routes) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    const tagged = Object.values(doc.paths).flatMap((p) => Object.values(p)).filter((o) => o.tags?.includes('account'))
    expect(tagged).toHaveLength(11)
  })

  it('contains every component, with the Account prefix', () => {
    const ids = Object.keys(ACCOUNT_COMPONENT_SCHEMAS)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(id.startsWith('Account'), id).toBe(true)
      expect(doc.components.schemas[id], id).toBeDefined()
    }
  })

  it('picture is multipart; the other bodies are JSON', () => {
    expect(Object.keys(doc.paths['/me/picture']?.post?.requestBody?.content ?? {})).toEqual(['multipart/form-data'])
    expect(Object.keys(doc.paths['/me']?.put?.requestBody?.content ?? {})).toEqual(['application/json'])
  })

  it('declares the error responses and CSRF on authenticated mutations only', () => {
    for (const [method, path] of routes) {
      const op = doc.paths[path]?.[method]
      const authed = path.startsWith('/me')
      const csrf = op?.parameters?.some((p) => p.name === 'X-CSRF-Token') ?? false
      const mutating = method !== 'get'
      expect(csrf, `${method} ${path} csrf`).toBe(authed && mutating)
      if (authed) expect(op?.responses['401'], `${method} ${path} 401`).toBeDefined()
      if (authed && mutating) expect(op?.responses['403'], `${method} ${path} 403`).toBeDefined()
    }
    expect(doc.paths['/auth/password/email']?.post?.responses['429']).toBeDefined()
    expect(doc.paths['/auth/register']?.post?.responses['429']).toBeDefined()
    expect(doc.paths['/auth/password/reset-ic']?.post?.responses['429']).toBeDefined()
    expect(doc.paths['/auth/password/reset']?.post?.responses['403']).toBeDefined()
  })

  it('exposes no password or IC number in any response component', () => {
    const responseIds = ['AccountUserMe', 'AccountStatus', 'AccountResetToken', 'AccountPicture', 'AccountSettings', 'AccountPlatformStats', 'AccountSchoolSummary']
    for (const id of responseIds) {
      const text = JSON.stringify(doc.components.schemas[id])
      expect(text, id).not.toMatch(/icNumber|passwordHash|"password"/)
    }
  })
})
