import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

import { decideAccess } from '@/app/router'

const session = (role: 'student' | 'teacher' | 'admin' | null) => ({
  isLoggedIn: role !== null,
  role,
  landingPath: role === null ? null : '/dashboard',
})

/** The databank route as built under the given API mode (the mode is read at module load). */
async function load(mode: 'http' | 'mock'): Promise<RouteRecordRaw> {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', mode)
  const { default: routes } = await import('../../routes/soalan')
  const route = routes.find((r) => r.path === '/guru/databank')
  if (!route) throw new Error('the /guru/databank route is missing')
  return route
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('S6-T19 route /guru/databank', () => {
  it('is named, on the user shell, for logged-in users, with the PRD title', async () => {
    const r = await load('http')
    expect(r.name).toBe('m10.databank')
    expect(r.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      module: 'M10',
      title: 'Databank Soalan — PRESTASIPLUS',
    })
  })

  it('http mode: teacher only (the API answers 403 to an admin)', async () => {
    const r = await load('http')
    expect(r.meta?.roles).toEqual(['teacher'])
    const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
    expect(decideAccess(to, session(null))).toEqual({ kind: 'redirect', to: '/login' })
    expect(decideAccess(to, session('student'))).toEqual({ kind: 'in-place', status: 403 })
    expect(decideAccess(to, session('teacher'))).toEqual({ kind: 'allow' })
    expect(decideAccess(to, session('admin'))).not.toEqual({ kind: 'allow' })
  })

  it('mock mode: the roles are those of the other teacher routes', async () => {
    const r = await load('mock')
    expect(r.meta?.roles).toEqual(['teacher', 'admin'])
  })
})
