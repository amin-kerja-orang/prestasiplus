import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

import { decideAccess } from '@/app/router'

/**
 * SW5-06 / DV-M10-37: the real APIs behind S1, S4, S5 and S6 (`GET /api/guru/dashboard`, `/api/guru/classes`,
 * `/api/guru/students`) are teacher-only and answer 403 to an admin, so in http mode the routes admit the
 * teacher only. The mock replicates live and admits the admin.
 */
const session = (role: 'student' | 'teacher' | 'admin') => ({
  isLoggedIn: true,
  role,
  landingPath: '/dashboard',
})

/** The S1, S4, S5 and S6 routes as built under the given API mode (the mode is read at module load). */
async function load(mode: 'http' | 'mock'): Promise<RouteRecordRaw[]> {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', mode)
  const [dashboard, kelas, pelajar] = await Promise.all([
    import('../routes/dashboard'),
    import('../routes/kelas'),
    import('../routes/pelajar'),
  ])
  return [...dashboard.default, ...kelas.default, ...pelajar.default].filter(
    (r) => !('redirect' in r),
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('M10 routes with a teacher-only API (SW5-06)', () => {
  it('covers S1, S4, S5 and S6', async () => {
    expect((await load('http')).map((r) => r.path)).toEqual([
      '/guru',
      '/guru/kelas',
      '/guru/kelas/cipta',
      '/guru/pelajar',
    ])
  })

  it('http mode: meta.roles is exactly [teacher] and an admin is redirected', async () => {
    for (const r of await load('http')) {
      expect(r.meta?.roles, r.path).toEqual(['teacher'])
      const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
      expect(decideAccess(to, session('teacher')), r.path).toEqual({ kind: 'allow' })
      expect(decideAccess(to, session('admin')), r.path).not.toEqual({ kind: 'allow' })
    }
  })

  it('mock mode: S1 stays [teacher, admin] (the mock replicates live); S4, S5, S6 are teacher only (DV-M10-48)', async () => {
    for (const r of await load('mock')) {
      const s1 = r.path === '/guru'
      expect(r.meta?.roles, r.path).toEqual(s1 ? ['teacher', 'admin'] : ['teacher'])
      const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
      expect(decideAccess(to, session('admin')).kind === 'allow', r.path).toBe(s1)
      expect(decideAccess(to, session('student')), r.path).not.toEqual({ kind: 'allow' })
    }
  })
})
