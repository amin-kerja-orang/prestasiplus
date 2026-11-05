import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { decideAccess, type GuardSession } from '@/app/router/guards'
import { useSessionStore } from '@/stores/session'
import type { Role } from '@/stores/session-types'

import analitik from '../../routes/analitik'
import classRoutes from '../../routes/class'
import prestasi from '../../routes/prestasi'

/** SW4-04 / DV-M08-46: the Prestasi routes declare their roles, as `class.ts` and `analisa-item.ts` do. */
const router = createRouter({
  history: createMemoryHistory(),
  routes: [...prestasi, ...analitik, ...classRoutes],
})

const ALL_ROLES: readonly Role[] = [
  'student',
  'teacher',
  'parent',
  'sponsor',
  'school_admin',
  'ppd_officer',
  'jpn_officer',
  'admin',
]
const SCHOOL_VIEW_ROLES: readonly Role[] = ['admin', 'teacher', 'school_admin', 'parent']
const CLASS_VIEW_ROLES: readonly Role[] = ['admin', 'teacher', 'school_admin']

const session = (role: Role | null): GuardSession => ({
  isLoggedIn: role !== null,
  role,
  landingPath: '/dashboard',
})

const decide = (path: string, role: Role | null) =>
  decideAccess(router.resolve(path) as unknown as RouteLocationNormalized, session(role))

describe('M08 prestasi route roles (SW4-04)', () => {
  it.each([
    ['/prestasi/sekolah', 'm08.prestasi.sekolah'],
    ['/prestasi/tingkatan', 'm08.prestasi.tingkatan'],
    ['/prestasi/tingkatan/t4', 'm08.prestasi.tingkatan.detail'],
  ])(
    'S1-S3 %s admits admin, teacher, school_admin, parent and answers 403 to the rest, the pupil included (FR-MUR-4-2)',
    (path, name) => {
      const resolved = router.resolve(path)
      expect(resolved.name).toBe(name)
      expect(resolved.meta.roles).toEqual(SCHOOL_VIEW_ROLES)
      expect(resolved.meta.onForbidden).toBe('403')
      for (const role of ALL_ROLES) {
        expect(decide(path, role)).toEqual(
          SCHOOL_VIEW_ROLES.includes(role) ? { kind: 'allow' } : { kind: 'in-place', status: 403 },
        )
      }
    },
  )

  it('S4 /prestasi/kelas is for admin, teacher and school_admin; a pupil, parent or PPD officer gets the 403 page (AC-MUR-4-3)', () => {
    const meta = router.resolve('/prestasi/kelas').meta
    expect(meta.roles).toEqual(CLASS_VIEW_ROLES)
    expect(meta.onForbidden).toBe('403')
    for (const role of CLASS_VIEW_ROLES) {
      expect(decide('/prestasi/kelas', role)).toEqual({ kind: 'allow' })
    }
    for (const role of ['student', 'parent', 'ppd_officer', 'jpn_officer', 'sponsor'] as const) {
      expect(decide('/prestasi/kelas', role)).toEqual({ kind: 'in-place', status: 403 })
    }
  })

  it('a pupil gets 403 on every school-wide Prestasi route', () => {
    for (const path of ['/prestasi/sekolah', '/prestasi/tingkatan', '/prestasi/tingkatan/t4', '/prestasi/kelas']) {
      expect(decide(path, 'student')).toEqual({ kind: 'in-place', status: 403 })
    }
  })

  it('/prestasi is a component route "Prestasi Saya" (no redirect, no ownsH1), open to every signed-in role', () => {
    const resolved = router.resolve('/prestasi')
    expect(resolved.name).toBe('m08.prestasi.own')
    const record = resolved.matched[0]
    expect(record?.redirect).toBeUndefined()
    expect(record?.components?.default).toBeTypeOf('function')
    expect(resolved.meta.title).toBe('Prestasi Saya')
    expect(resolved.meta.header).toEqual({
      title: 'Prestasi Saya',
      subtitle: 'Analisis pencapaian latihan anda',
    })
    expect(resolved.meta.ownsH1).toBeUndefined()
    expect(resolved.meta.roles).toBeUndefined()
    expect(decide('/prestasi', 'student')).toEqual({ kind: 'allow' })
    expect(decide('/prestasi', null)).toEqual({ kind: 'redirect', to: '/login' })
  })

  it.each(['admin', 'teacher', 'school_admin'] as const)(
    '/prestasi beforeEnter sends %s to /prestasi/sekolah and keeps the pupil on /prestasi (FR-MUR-4-13)',
    (role) => {
      setActivePinia(createPinia())
      const guard = router.resolve('/prestasi').matched[0]?.beforeEnter as () => unknown
      const sessionStore = useSessionStore()
      sessionStore.setSession({
        token: 't',
        remember: false,
        expiresAt: '2099-01-01T00:00:00+08:00',
        user: { id: 2, role, landingPath: '/dashboard' } as never,
      })
      expect(guard()).toBe('/prestasi/sekolah')
      sessionStore.setSession({
        token: 't',
        remember: false,
        expiresAt: '2099-01-01T00:00:00+08:00',
        user: { id: 3, role: 'student', landingPath: '/dashboard' } as never,
      })
      expect(guard()).toBe(true)
    },
  )

  it('a guest still goes to /login', () => {
    expect(decide('/prestasi/kelas', null)).toEqual({ kind: 'redirect', to: '/login' })
    expect(decide('/prestasi/sekolah', null)).toEqual({ kind: 'redirect', to: '/login' })
  })

  it('S4 is never narrower than the class dashboard it leads to (S5)', () => {
    const s4 = router.resolve('/prestasi/kelas').meta.roles ?? []
    const s5 = router.resolve('/prestasi/kelas/228').meta.roles ?? []
    for (const role of s5) expect(s4).toContain(role)
  })
})
