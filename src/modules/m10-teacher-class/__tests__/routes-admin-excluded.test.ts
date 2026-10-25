import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { decideAccess } from '@/app/router'

import kelas from '../routes/kelas'
import pelajar from '../routes/pelajar'

/** DV-M10-48 (G5-M10 B1): S4, S5 and S6 sit on teacher-only APIs, so the admin is not admitted. */
const landing = '/dashboard'
const session = (role: 'student' | 'teacher' | 'admin' | null) => ({
  isLoggedIn: role !== null,
  role,
  landingPath: role === null ? null : landing,
})
const routes = [...kelas, ...pelajar].filter((r) => !('redirect' in r))

describe('S4, S5, S6 route access (DV-M10-48)', () => {
  it('covers /guru/kelas, /guru/kelas/cipta and /guru/pelajar with roles [teacher]', () => {
    expect(routes.map((r) => r.path)).toEqual(['/guru/kelas', '/guru/kelas/cipta', '/guru/pelajar'])
    for (const r of routes) expect(r.meta?.roles, r.path).toEqual(['teacher'])
  })

  for (const r of routes) {
    const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
    it(`${r.path}: teacher allowed, admin and student redirected`, () => {
      expect(decideAccess(to, session('teacher'))).toEqual({ kind: 'allow' })
      expect(decideAccess(to, session('admin'))).toEqual({ kind: 'redirect', to: landing })
      expect(decideAccess(to, session('student'))).toEqual({ kind: 'redirect', to: landing })
    })
  }
})
