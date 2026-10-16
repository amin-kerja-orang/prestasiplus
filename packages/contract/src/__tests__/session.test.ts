import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_STATUS,
  EnterModeRequestSchema,
  LoginRequestSchema,
  ScopeSchema,
  SessionSchema,
  SwitchRoleRequestSchema,
  canEnterModPelajar,
  type Session,
} from '../index'
import { buildOpenApiDocument } from '../openapi'

const user = { id: '7', name: 'Pengguna Ujian', email: 'a@x.test', username: null, avatarUrl: null, schoolId: '3' }
const schoolScope = { level: 'school', schoolId: '3', label: 'SK Contoh' }
const classScope = { level: 'class', schoolId: '3', label: 'Kelas 5A' }
const selfScope = { level: 'self', label: 'Diri sendiri' }
const base = {
  user,
  capabilities: ['PM-01'],
  landingPath: '/admin',
  expiresAt: '2026-10-16T17:30:00+08:00',
  csrf: 'tok',
}
const adminSession = (): Session =>
  ({
    ...base,
    roles: [{ role: 'school_admin', portal: 'pentadbiran', scope: schoolScope }],
    active: { role: 'school_admin', portal: 'pentadbiran', scope: schoolScope, via: 'direct' },
    mode: null,
  }) as Session
const modeSession = () => ({
  ...adminSession(),
  landingPath: '/dashboard',
  active: { role: 'student', portal: 'pembelajaran', scope: selfScope, via: 'mod_pelajar' },
  mode: { kind: 'mod_pelajar', returnRole: 'school_admin', since: '2026-10-16T09:00:00+08:00', isTest: true },
})

describe('LoginRequest', () => {
  it('accepts e-mail and username logins and defaults remember', () => {
    expect(LoginRequestSchema.parse({ identifier: ' a@x.test ', password: 'pw' })).toEqual({
      identifier: 'a@x.test',
      password: 'pw',
      remember: false,
    })
    expect(
      LoginRequestSchema.safeParse({ identifier: 'ali', password: 'pw', schoolId: '3', remember: true }).success,
    ).toBe(true)
  })
  it('rejects empty fields, numeric school ids and any extra key (role, scope)', () => {
    expect(LoginRequestSchema.safeParse({ identifier: '', password: 'pw' }).success).toBe(false)
    expect(LoginRequestSchema.safeParse({ identifier: 'a', password: '' }).success).toBe(false)
    expect(LoginRequestSchema.safeParse({ identifier: 'a', password: 'p', schoolId: 3 }).success).toBe(false)
    expect(LoginRequestSchema.safeParse({ identifier: 'a', password: 'p', role: 'admin' }).success).toBe(false)
    expect(LoginRequestSchema.safeParse({ identifier: 'a', password: 'p', scope: schoolScope }).success).toBe(false)
  })
})

describe('Scope', () => {
  it('requires the codes its level needs', () => {
    expect(ScopeSchema.safeParse({ level: 'national', label: 'Kebangsaan' }).success).toBe(true)
    expect(ScopeSchema.safeParse({ level: 'district', districtCode: 'D1', label: 'PPD X' }).success).toBe(true)
    expect(ScopeSchema.safeParse({ level: 'district', label: 'PPD X' }).success).toBe(false)
    expect(ScopeSchema.safeParse({ level: 'state', label: 'Negeri' }).success).toBe(false)
    expect(ScopeSchema.safeParse({ level: 'school', label: 'x' }).success).toBe(false)
    expect(ScopeSchema.safeParse({ level: 'planet', label: 'x' }).success).toBe(false)
  })
})

describe('Session', () => {
  it('accepts a single-role admin session and a dual-role teacher + school_admin session', () => {
    expect(SessionSchema.safeParse(adminSession()).success).toBe(true)
    const dual = {
      ...base,
      roles: [
        { role: 'teacher', portal: 'pembelajaran', scope: classScope },
        { role: 'school_admin', portal: 'pentadbiran', scope: schoolScope },
      ],
      active: { role: 'teacher', portal: 'pembelajaran', scope: classScope, via: 'direct' },
      mode: null,
    }
    expect(SessionSchema.safeParse(dual).success).toBe(true)
  })
  it('requires +08:00 expiry and a leading slash on the landing path', () => {
    expect(SessionSchema.safeParse({ ...adminSession(), expiresAt: '2026-10-16T09:30:00Z' }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...adminSession(), landingPath: 'admin' }).success).toBe(false)
  })
  it('rejects an active role outside the list, a wrong portal and a scope that differs from the grant', () => {
    const s = adminSession()
    expect(SessionSchema.safeParse({ ...s, active: { ...s.active, role: 'teacher', portal: 'pembelajaran' } }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...s, active: { ...s.active, portal: 'pembelajaran' } }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...s, active: { ...s.active, scope: { level: 'national', label: 'x' } } }).success).toBe(false)
  })
  it('rejects forbidden role combinations and duplicates', () => {
    const grant = (role: string, portal: string, scope: unknown) => ({ role, portal, scope })
    const withRoles = (roles: unknown[]) => ({ ...adminSession(), roles })
    expect(
      SessionSchema.safeParse(
        withRoles([grant('student', 'pembelajaran', selfScope), grant('teacher', 'pembelajaran', classScope)]),
      ).success,
    ).toBe(false)
    expect(
      SessionSchema.safeParse(
        withRoles([grant('school_admin', 'pentadbiran', schoolScope), grant('school_admin', 'pentadbiran', schoolScope)]),
      ).success,
    ).toBe(false)
    expect(SessionSchema.safeParse(withRoles([])).success).toBe(false)
  })
})

describe('Mod Pelajar mode', () => {
  it('accepts the student-as-self session with an admin return role', () => {
    expect(SessionSchema.safeParse(modeSession()).success).toBe(true)
  })
  it('is available to admin and school_admin only', () => {
    expect(canEnterModPelajar('admin')).toBe(true)
    expect(canEnterModPelajar('school_admin')).toBe(true)
    for (const r of ['teacher', 'ppd_officer', 'student', 'parent', 'sponsor'] as const)
      expect(canEnterModPelajar(r)).toBe(false)
    const m = modeSession()
    const teacherReturn = {
      ...m,
      roles: [{ role: 'teacher', portal: 'pembelajaran', scope: classScope }],
      mode: { ...m.mode, returnRole: 'teacher' },
    }
    expect(SessionSchema.safeParse(teacherReturn).success).toBe(false)
  })
  it('must act as student with self scope, and mode and via must agree', () => {
    const m = modeSession()
    expect(SessionSchema.safeParse({ ...m, active: { ...m.active, scope: schoolScope } }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...m, active: { ...m.active, role: 'teacher' } }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...m, active: { ...m.active, via: 'direct' } }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...adminSession(), active: { ...adminSession().active, via: 'mod_pelajar' } }).success).toBe(false)
  })
  it('flags the data as test data and needs a return role in the list', () => {
    const m = modeSession()
    expect(SessionSchema.safeParse({ ...m, mode: { ...m.mode, isTest: false } }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...m, mode: { ...m.mode, returnRole: 'admin' } }).success).toBe(false)
  })
})

describe('role and mode requests', () => {
  it('accepts a role code and rejects unknown roles', () => {
    expect(SwitchRoleRequestSchema.safeParse({ role: 'teacher' }).success).toBe(true)
    expect(SwitchRoleRequestSchema.safeParse({ role: 'jpn_officer' }).success).toBe(false)
    expect(SwitchRoleRequestSchema.safeParse({}).success).toBe(false)
  })
  it('never accepts a scope from the client', () => {
    expect(SwitchRoleRequestSchema.safeParse({ role: 'teacher', scope: classScope }).success).toBe(false)
    expect(EnterModeRequestSchema.safeParse({ mode: 'mod_pelajar', scope: selfScope }).success).toBe(false)
  })
  it('accepts only the known mode', () => {
    expect(EnterModeRequestSchema.safeParse({ mode: 'mod_pelajar' }).success).toBe(true)
    expect(EnterModeRequestSchema.safeParse({ mode: 'student_preview' }).success).toBe(false)
  })
})

describe('auth errors', () => {
  it('has a status and a BM message for every code, with the live copy for the first three', () => {
    for (const c of AUTH_ERROR_CODES) {
      expect(AUTH_ERROR_STATUS[c]).toBeGreaterThanOrEqual(400)
      expect(AUTH_ERROR_MESSAGES[c].length).toBeGreaterThan(0)
    }
    expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).toBe('E-mel/Nama pengguna atau kata laluan tidak sah.')
    expect(AUTH_ERROR_MESSAGES.RATE_LIMITED).toMatch(/percubaan/)
  })
})

describe('OpenAPI session paths', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }
  it('documents the six endpoints', () => {
    expect(Object.keys(doc.paths['/auth/login'] ?? {})).toEqual(['post'])
    expect(Object.keys(doc.paths['/auth/logout'] ?? {})).toEqual(['post'])
    expect(Object.keys(doc.paths['/session'] ?? {})).toEqual(['get'])
    expect(Object.keys(doc.paths['/session/role'] ?? {})).toEqual(['post'])
    expect(Object.keys(doc.paths['/session/mode'] ?? {}).sort()).toEqual(['delete', 'post'])
  })
  it('documents error responses and registers the session components', () => {
    expect(doc.paths['/auth/login']!.post!.responses).toHaveProperty('401')
    expect(doc.paths['/session/role']!.post!.responses).toHaveProperty('409')
    for (const n of ['Session', 'Scope', 'ActiveRole', 'Mode', 'LoginRequest', 'SwitchRoleRequest', 'EnterModeRequest'])
      expect(doc.components.schemas).toHaveProperty(n)
  })
})
