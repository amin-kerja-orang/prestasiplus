import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { isPathInScope, scopeHomePath, shellHomePath } from '../prototype-scope'
import { decideAccess } from '../router'

/** `/admin/command-center` (the target of `/admin`): Admin Pusat only, default `onForbidden`. */
const ADMIN_HOME = {
  path: '/admin/command-center',
  fullPath: '/admin/command-center',
  name: 'admin.command-center',
  meta: { access: 'auth', roles: ['admin'] },
} as unknown as RouteLocationNormalized

/** The real API lands a school admin on `/admin` (session-view LANDING_PATHS). */
const SCHOOL_ADMIN = { isLoggedIn: true, role: 'school_admin' as const, landingPath: '/admin' }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('forbidden role in scope mode goes to the role home (demo rehearsal blocker)', () => {
  it('sends a school admin to /admin-sekolah instead of looping on the server landing /admin', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
    expect(decideAccess(ADMIN_HOME, SCHOOL_ADMIN)).toEqual({
      kind: 'redirect',
      to: '/admin-sekolah',
    })
  })

  it('keeps the server landing path when the prototype scope is off', () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect(decideAccess(ADMIN_HOME, SCHOOL_ADMIN)).toEqual({ kind: 'redirect', to: '/admin' })
  })
})

describe('student landing (GET /api/dashboard is served in both modes)', () => {
  it('lands the student on /dashboard in http mode, inside the student scope', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    expect(scopeHomePath('student')).toBe('/dashboard')
    expect(shellHomePath('student')).toBe('/dashboard')
    expect(isPathInScope('student', '/dashboard')).toBe(true)
    expect(
      decideAccess(ADMIN_HOME, { isLoggedIn: true, role: 'student', landingPath: '/dashboard' }),
    ).toEqual({ kind: 'redirect', to: '/dashboard' })
  })

  it('lands the student on /dashboard in mock mode', () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(scopeHomePath('student')).toBe('/dashboard')
    expect(shellHomePath('student')).toBe('/dashboard')
  })

  it('leaves the other roles unchanged in http mode', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    expect(scopeHomePath('teacher')).toBe('/guru')
    expect(scopeHomePath('school_admin')).toBe('/admin-sekolah')
    expect(scopeHomePath('admin')).toBe('/admin/command-center')
  })
})
