import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { decideAccess } from '@/app/router'

import routes from '../routes'

const landing = '/dashboard'
type Role = 'student' | 'teacher' | 'parent' | 'admin' | null
const session = (role: Role) => ({
  isLoggedIn: role !== null,
  role,
  landingPath: role === null ? null : landing,
})

const adminRoutes = routes.filter((r) => r.path.startsWith('/admin/'))

describe('Bijak SPM admin routes: access (AC-22.4 / R26, FB-022)', () => {
  it('declares the admin question bank, review, paper and intake routes', () => {
    expect(adminRoutes.length).toBeGreaterThanOrEqual(10)
    for (const r of adminRoutes) {
      expect(r.meta?.roles, r.path).toEqual(['admin'])
      expect(r.meta?.onForbidden, r.path).toBe('403')
    }
  })

  for (const r of adminRoutes) {
    const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
    it(`${r.path}: guest to /login, other roles get the 403, admin allowed`, () => {
      expect(decideAccess(to, session(null))).toEqual({ kind: 'redirect', to: '/login' })
      for (const role of ['student', 'teacher', 'parent'] as const)
        expect(decideAccess(to, session(role))).toEqual({ kind: 'in-place', status: 403 })
      expect(decideAccess(to, session('admin'))).toEqual({ kind: 'allow' })
    })
  }
})
