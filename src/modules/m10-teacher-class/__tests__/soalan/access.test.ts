import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { decideAccess } from '@/app/router'

import routes from '../../routes/soalan'

const landing = '/dashboard'
const session = (role: 'student' | 'teacher' | 'admin' | null) => ({
  isLoggedIn: role !== null,
  role,
  landingPath: role === null ? null : landing,
})

describe('S21-S24 route access (decideAccess)', () => {
  it('declares the four routes for teacher and admin only on the user shell', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '/guru/soalan',
      '/guru/soalan/cipta',
      '/guru/soalan/:id([0-9]+)',
      '/guru/soalan/:id([0-9]+)/edit',
    ])
    for (const r of routes) {
      expect(r.meta?.layout).toBe('user')
      expect(r.meta?.roles).toEqual(['teacher', 'admin'])
    }
  })

  for (const r of routes) {
    const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
    it(`${r.path}: guest to /login, student to the landing page, teacher and admin allowed`, () => {
      expect(decideAccess(to, session(null))).toEqual({ kind: 'redirect', to: '/login' })
      expect(decideAccess(to, session('student'))).toEqual({ kind: 'redirect', to: landing })
      expect(decideAccess(to, session('teacher'))).toEqual({ kind: 'allow' })
      expect(decideAccess(to, session('admin'))).toEqual({ kind: 'allow' })
    })
  }
})
