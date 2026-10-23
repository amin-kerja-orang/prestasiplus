import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { decideAccess, type GuardSession } from '@/app/router/guards'
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
const SCHOOL_VIEW_ROLES: readonly Role[] = ['admin', 'teacher', 'school_admin', 'student', 'parent']

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
    'S1-S3 %s admits admin, teacher, school_admin, student, parent and answers 403 to the rest',
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

  it('S4 /prestasi/kelas is for admin, teacher and school_admin; a parent or PPD officer gets the 403 page', () => {
    const meta = router.resolve('/prestasi/kelas').meta
    expect(meta.roles).toEqual(['admin', 'teacher', 'school_admin'])
    expect(meta.onForbidden).toBe('403')
    for (const role of ['admin', 'teacher', 'school_admin'] as const) {
      expect(decide('/prestasi/kelas', role)).toEqual({ kind: 'allow' })
    }
    for (const role of ['parent', 'ppd_officer', 'jpn_officer', 'sponsor', 'student'] as const) {
      expect(decide('/prestasi/kelas', role)).toEqual({ kind: 'in-place', status: 403 })
    }
  })

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
