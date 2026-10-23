import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { decideAccess } from '@/app/router'

import dashboard from '../routes/dashboard'
import kelas from '../routes/kelas'
import pelajar from '../routes/pelajar'

/**
 * SW5-06 / DV-M10-37: the APIs behind S1, S4, S5 and S6 (`GET /api/guru/dashboard`, `/api/guru/classes`,
 * `/api/guru/students`) are teacher-only and answer 403 to an admin, so the routes must not admit the admin.
 */
const session = (role: 'student' | 'teacher' | 'admin') => ({
  isLoggedIn: true,
  role,
  landingPath: '/dashboard',
})

const teacherOnly = [...dashboard, ...kelas, ...pelajar].filter((r) => !('redirect' in r))

describe('M10 teacher-only routes (SW5-06)', () => {
  it('covers S1, S4, S5 and S6', () => {
    expect(teacherOnly.map((r) => r.path)).toEqual([
      '/guru',
      '/guru/kelas',
      '/guru/kelas/cipta',
      '/guru/pelajar',
    ])
  })

  for (const r of teacherOnly) {
    it(`${r.path}: meta.roles is exactly ['teacher'] and an admin is redirected`, () => {
      expect(r.meta?.roles).toEqual(['teacher'])
      const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
      expect(decideAccess(to, session('teacher'))).toEqual({ kind: 'allow' })
      expect(decideAccess(to, session('admin'))).not.toEqual({ kind: 'allow' })
    })
  }
})
