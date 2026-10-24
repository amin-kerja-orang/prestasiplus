import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { decideAccess, type GuardSession } from '@/app/router/guards'
import type { Role } from '@/stores/session-types'

import analisaItem from '../../routes/analisa-item'
import analitik from '../../routes/analitik'
import prestasi, { prestasiTarget } from '../../routes/prestasi'

/**
 * UAT M-09: `/prestasi` sends a pelajar to the own Prestasi 360; the school-level screens (S1–S3, S9) are
 * the 403 page for a pelajar and open for every other role.
 */
const router = createRouter({
  history: createMemoryHistory(),
  routes: [...prestasi, ...analitik, ...analisaItem],
})

const toOf = (path: string): RouteLocationNormalized => {
  const r = router.resolve(path)
  return { path: r.path, meta: r.meta } as unknown as RouteLocationNormalized
}

const session = (role: Role | null): GuardSession => ({
  isLoggedIn: role !== null,
  role,
  landingPath: '/dashboard',
})

describe('/prestasi redirect (UAT M-09)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sends a pelajar to the own S6 and every other role to S1', () => {
    expect(prestasiTarget('student', 2)).toBe('/prestasi/2')
    expect(prestasiTarget('student', null)).toBe('/prestasi/sekolah')
    for (const role of ['admin', 'teacher', 'school_admin', 'parent', null]) {
      expect(prestasiTarget(role, 2)).toBe('/prestasi/sekolah')
    }
  })

  it('the /prestasi route redirects through the session store', async () => {
    await router.push('/prestasi')
    // No session in the test pinia: the guest target.
    expect(router.currentRoute.value.path).toBe('/prestasi/sekolah')
  })
})

describe('school-level screens are not for the pelajar', () => {
  const schoolLevel = [
    '/prestasi/sekolah',
    '/prestasi/tingkatan',
    '/prestasi/tingkatan/t4',
    '/analisa-item/sekolah',
    '/analisa-item/sekolah/8880',
  ]

  for (const path of schoolLevel) {
    it(`${path}: pelajar 403 in place; other roles allowed; guest to login`, () => {
      const to = toOf(path)
      expect(decideAccess(to, session('student'))).toEqual({ kind: 'in-place', status: 403 })
      for (const role of [
        'admin',
        'teacher',
        'school_admin',
        'ppd_officer',
        'jpn_officer',
      ] as const) {
        expect(decideAccess(to, session(role)).kind, `${path} ${role}`).toBe('allow')
      }
      expect(decideAccess(to, session(null)).kind).toBe('redirect')
    })
  }

  it('the own S6 stays open to a pelajar (the API refuses another pupil)', () => {
    expect(decideAccess(toOf('/prestasi/2'), session('student')).kind).toBe('allow')
  })
})
