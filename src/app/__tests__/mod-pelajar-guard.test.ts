// @vitest-environment jsdom
// C-52 Q1: a plain Admin Pusat opening a student-only route (`modPelajarForAdmin`) is switched into
// Mod Pelajar by the router guard, then lands on the requested route (guards step 2c).
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { clock } from '@/lib/time'
import { enterModPelajar } from '@/shells/shared/mod-pelajar'
import { useFlashStore, useSessionStore } from '@/stores'

import type { ModuleManifest } from '../modules'
import { createAppRouter, resolvePostLoginTarget, setRouteOutcome, useRouteOutcome } from '../router'
import { ADMIN, logIn, NOW, STUDENT } from './router-fixtures'

vi.mock('@/shells/shared/mod-pelajar', () => ({ enterModPelajar: vi.fn() }))
// The student prototype scope does not list /kertas-subjektif (scope forced on for that role and path).
vi.mock('../prototype-scope', async (importOriginal) => {
  const real = await importOriginal<typeof import('../prototype-scope')>()
  return {
    ...real,
    isPrototypeScopeOn: () => true,
    isPathAllowed: (role: Parameters<typeof real.isPathAllowed>[0], path: string) =>
      role === 'student' && path.startsWith('/kertas-subjektif') ? false : real.isPathInScope(role, path),
  }
})

const page = { template: '<i/>' }
const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-test',
    routes: [
      { path: '/login', component: page, meta: { layout: 'bare', access: 'public' } },
      {
        path: '/spm/bijak/kertas/:paperId',
        component: page,
        meta: { layout: 'user', access: 'auth', roles: ['student'], modPelajarForAdmin: true, onForbidden: '403' },
      },
      {
        path: '/kertas-subjektif/:id',
        component: page,
        meta: { layout: 'user', access: 'auth', roles: ['student'], modPelajarForAdmin: true, onForbidden: '403' },
      },
      { path: '/admin', component: page, meta: { layout: 'admin', access: 'auth', roles: ['admin'] } },
    ],
  },
]
const DEEP = '/spm/bijak/kertas/p1?tab=2'
const router = () => createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })

/** Mock-mode behaviour of the real call: the student session replaces the admin's (parked in `mode`). */
function switchToStudent(): Promise<string> {
  const ok = useSessionStore().enterModPelajar(
    { token: 'tok_student', expiresAt: '2026-09-25T17:40:00+08:00', user: STUDENT },
    '/admin/command-center',
  )
  return ok ? Promise.resolve('/dashboard') : Promise.reject(new Error('on'))
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  setActivePinia(createPinia())
  setRouteOutcome(null)
  vi.mocked(enterModPelajar).mockReset()
})

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
})

describe('Mod Pelajar for the admin (route guard)', () => {
  it('admin on a deep link: enters Mod Pelajar once, then lands on that exact route', async () => {
    vi.mocked(enterModPelajar).mockImplementation(switchToStudent)
    logIn(ADMIN)
    const r = router()
    await r.push(DEEP)
    expect(enterModPelajar).toHaveBeenCalledTimes(1)
    expect(r.currentRoute.value.fullPath).toBe(DEEP)
    expect(useSessionStore().role).toBe('student')
    expect(useRouteOutcome().value).toBeNull()
    await r.push('/spm/bijak/kertas/p2')
    expect(enterModPelajar).toHaveBeenCalledTimes(1)
  })

  it('student: unchanged, no switch', async () => {
    logIn(STUDENT)
    const r = router()
    await r.push(DEEP)
    expect(enterModPelajar).not.toHaveBeenCalled()
    expect(r.currentRoute.value.fullPath).toBe(DEEP)
    expect(useRouteOutcome().value).toBeNull()
  })

  it('school_admin: in-place 403, no switch', async () => {
    logIn({ ...ADMIN, role: 'school_admin', landingPath: '/admin-sekolah' })
    const r = router()
    await r.push(DEEP)
    expect(enterModPelajar).not.toHaveBeenCalled()
    expect(useRouteOutcome().value).toBe(403)
    expect(r.currentRoute.value.fullPath).toBe(DEEP)
  })

  it('failed switch: error flash, in-place 403, one attempt (no loop)', async () => {
    vi.mocked(enterModPelajar).mockRejectedValue(new Error('refused'))
    logIn(ADMIN)
    const r = router()
    await r.push(DEEP)
    expect(enterModPelajar).toHaveBeenCalledTimes(1)
    expect(useRouteOutcome().value).toBe(403)
    expect(useSessionStore().role).toBe('admin')
    expect(useFlashStore().current).toEqual({ type: 'error', message: 'Mod Pelajar tidak dapat dibuka. Sila cuba lagi.' })
  })

  it('a post-login return keeps the deep link for a plain admin (the guard switches on arrival)', () => {
    const r = router()
    const admin = { isLoggedIn: true, role: 'admin', landingPath: '/admin' } as const
    expect(resolvePostLoginTarget(r, DEEP, admin)).toBe(DEEP)
    expect(resolvePostLoginTarget(r, DEEP, { ...admin, role: 'school_admin' })).toBe('/admin')
    expect(resolvePostLoginTarget(r, DEEP, { ...admin, mustChangePassword: true })).toBe('/admin')
    expect(resolvePostLoginTarget(r, DEEP, { ...admin, role: 'student' })).toBe(DEEP)
  })

  it('a password-flagged admin goes to /password/change and is not switched', async () => {
    logIn(ADMIN, { mustChangePassword: true })
    const r = router()
    await r.push(DEEP)
    expect(r.currentRoute.value.path).toBe('/password/change')
    expect(enterModPelajar).not.toHaveBeenCalled()
  })

  it('a flagged page the student cannot open (outside the student scope): no switch, the admin gets the in-place 403', async () => {
    logIn(ADMIN)
    const r = router()
    await r.push('/kertas-subjektif/x1')
    expect(enterModPelajar).not.toHaveBeenCalled()
    expect(useSessionStore().role).toBe('admin')
    expect(r.currentRoute.value.path).toBe('/kertas-subjektif/x1')
    expect(useRouteOutcome().value).toBe(403)
  })

  it('two concurrent navigations switch once and show no error flash', async () => {
    let release: () => void = () => {}
    vi.mocked(enterModPelajar).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release = () => {
            void switchToStudent()
            resolve('/dashboard')
          }
        }),
    )
    logIn(ADMIN)
    const r = router()
    const a = r.push(DEEP)
    const b = r.push('/spm/bijak/kertas/p2')
    await vi.waitFor(() => expect(enterModPelajar).toHaveBeenCalled())
    release()
    await Promise.allSettled([a, b])
    expect(enterModPelajar).toHaveBeenCalledTimes(1)
    expect(useSessionStore().role).toBe('student')
    expect(useFlashStore().current).toBeNull()
  })

  it('a route without the flag does not switch the admin', async () => {
    logIn(ADMIN)
    const r = router()
    await r.push('/admin')
    expect(enterModPelajar).not.toHaveBeenCalled()
  })
})
