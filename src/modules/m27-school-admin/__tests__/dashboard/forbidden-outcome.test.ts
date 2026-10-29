import type { RouteLocationNormalized } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { decideAccess, type GuardSession } from '@/app/router/guards'

import dashboard from '../../routes/dashboard'

/**
 * Pins the documented role-mismatch outcome of `/admin-sekolah` (M27 SRS section 9, FR-M27-08/10,
 * DV-M27-01): every role but `school_admin` sees "Akses Ditolak" in place. Routes without
 * `onForbidden` (the router default) redirect the wrong role to its landing path (M01 BR-07);
 * the difference between the two is per-route and intentional.
 */
const asRoute = (meta: Record<string, unknown>, path: string) =>
  ({ path, meta }) as unknown as RouteLocationNormalized

const session = (role: GuardSession['role']): GuardSession => ({
  isLoggedIn: true,
  role,
  landingPath: '/dashboard',
})

describe('/admin-sekolah wrong role (M27 section 9)', () => {
  const route = dashboard[0]!
  const to = asRoute(route.meta as Record<string, unknown>, route.path)

  it.each(['teacher', 'student', 'parent', 'admin'] as const)('%s sees 403 in place', (role) => {
    expect(decideAccess(to, session(role))).toEqual({ kind: 'in-place', status: 403 })
  })

  it('school_admin is allowed', () => {
    expect(decideAccess(to, session('school_admin'))).toEqual({ kind: 'allow' })
  })

  it('a route with the default onForbidden redirects the same role to its landing path', () => {
    const other = asRoute({ access: 'auth', roles: ['admin'] }, '/admin')
    expect(decideAccess(other, session('teacher'))).toEqual({ kind: 'redirect', to: '/dashboard' })
  })
})
