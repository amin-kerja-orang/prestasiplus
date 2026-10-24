import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_SOURCE,
  AUTH_ERROR_STATUS,
  ROLE_PORTAL,
  ROLE_SCOPE_LEVELS,
  SessionSchema,
} from '../index'
import { buildOpenApiDocument } from '../openapi'

const user = { id: '7', name: 'Pengguna Ujian', email: 'a@x.test', username: null, avatarUrl: null, schoolId: '3' }
const schoolScope = { level: 'school', schoolId: '3', label: 'SK Contoh' }
const classScope = { level: 'class', schoolId: '3', label: 'Kelas 5A' }
const selfScope = { level: 'self', label: 'Diri sendiri' }
const base = {
  user,
  capabilities: [],
  landingPath: '/admin',
  expiresAt: '2026-10-16T17:30:00+08:00',
  csrf: 'tok',
}
const scopes: Record<string, Record<string, unknown>> = {
  national: { level: 'national', label: 'Kebangsaan' },
  state: { level: 'state', stateCode: 'S1', label: 'JPN' },
  district: { level: 'district', districtCode: 'D1', label: 'PPD' },
  school: schoolScope,
  class: classScope,
  self: selfScope,
}
type Role = keyof typeof ROLE_PORTAL
const sessionFor = (role: Role, scope: unknown) => ({
  ...base,
  roles: [{ role, portal: ROLE_PORTAL[role], scope }],
  active: { role, portal: ROLE_PORTAL[role], scope, via: 'direct' },
  mode: null,
})

describe('role scope levels (ROLE_SCOPE_LEVELS)', () => {
  it('matches the documented map', () => {
    expect(ROLE_SCOPE_LEVELS).toEqual({
      student: ['self'],
      parent: ['self'],
      sponsor: ['self'],
      teacher: ['school'],
      school_admin: ['school'],
      ppd_officer: ['district', 'state'],
      admin: ['national'],
    })
  })

  it.each(Object.entries(ROLE_SCOPE_LEVELS))('%s accepts only its levels (roles and active)', (role, ok) => {
    for (const level of Object.keys(scopes)) {
      const result = SessionSchema.safeParse(sessionFor(role as Role, scopes[level]))
      expect(result.success, `${role}/${level}`).toBe((ok as readonly string[]).includes(level))
    }
  })

  it('checks roles[] and active independently', () => {
    const s = sessionFor('teacher', schoolScope)
    const paths = (v: unknown) => SessionSchema.safeParse(v).error?.issues.map((i) => i.path.join('.')) ?? []
    expect(paths({ ...s, roles: [{ ...s.roles[0], scope: classScope }] })).toContain('roles.0.scope.level')
    expect(paths({ ...s, active: { ...s.active, scope: classScope } })).toContain('active.scope.level')
  })

  it('compares the active scope with the grant field by field', () => {
    const s = sessionFor('school_admin', schoolScope)
    const changed = { ...s, active: { ...s.active, scope: { ...schoolScope, label: 'SK Lain' } } }
    expect(SessionSchema.safeParse(changed).success).toBe(false)
    const reordered = { ...s, active: { ...s.active, scope: { label: 'SK Contoh', schoolId: '3', level: 'school' } } }
    expect(SessionSchema.safeParse(reordered).success).toBe(true)
  })
})

describe('auth error copy and OpenAPI coverage', () => {
  type Doc = {
    paths: Record<
      string,
      Record<string, { responses: Record<string, { description?: string }>; parameters?: { name: string; in: string }[] }>
    >
  }
  const doc = buildOpenApiDocument() as unknown as Doc

  it('has the three live messages verbatim and tags every message', () => {
    expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).toBe('E-mel/Nama pengguna atau kata laluan tidak sah.')
    expect(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE).toBe(
      'Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir.',
    )
    expect(AUTH_ERROR_MESSAGES.SCHOOL_INACTIVE).toBe(
      'Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah.',
    )
    expect(Object.keys(AUTH_ERROR_SOURCE).sort()).toEqual(Object.keys(AUTH_ERROR_MESSAGES).sort())
    const live = Object.entries(AUTH_ERROR_SOURCE).filter(([, v]) => v === 'live').map(([k]) => k)
    expect(live.sort()).toEqual(['ACCOUNT_INACTIVE', 'INVALID_CREDENTIALS', 'SCHOOL_INACTIVE'])
  })

  it('lists every AUTH_ERROR_STATUS code under its status in the generated paths', () => {
    const byStatus = new Map<string, string>()
    for (const methods of Object.values(doc.paths))
      for (const op of Object.values(methods))
        for (const [status, r] of Object.entries(op.responses))
          byStatus.set(status, `${byStatus.get(status) ?? ''} ${r.description ?? ''}`)
    for (const [code, status] of Object.entries(AUTH_ERROR_STATUS))
      expect(byStatus.get(String(status)) ?? '', `${code} under ${status}`).toContain(code)
  })

  it('logout is idempotent (no 401) and mutating routes take X-CSRF-Token', () => {
    const logout = doc.paths['/auth/logout']!.post!
    expect(logout.responses).not.toHaveProperty('401')
    expect(logout.responses).toHaveProperty('204')
    for (const [p, m] of [
      ['/session/role', 'post'],
      ['/session/mode', 'post'],
      ['/session/mode', 'delete'],
    ] as const) {
      const op = doc.paths[p]![m]!
      expect(op.parameters?.some((x) => x.name === 'X-CSRF-Token' && x.in === 'header'), `${m} ${p}`).toBe(true)
      expect(op.responses).toHaveProperty('403')
    }
  })
})
