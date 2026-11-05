import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { decideAccess } from '@/app/router'

import m10Routes from '../../routes'
import routes from '../../routes/teacher-profile'

/** S5-T05 part C: the two teacher profile routes and their registration in the m10 registry. */
const session = (role: 'student' | 'teacher' | 'admin' | 'school_admin') => ({ isLoggedIn: true, role, landingPath: '/dashboard' })
const allowed = (path: string, role: Parameters<typeof session>[0]) => {
  const route = routes.find((r) => r.path === path)
  const to = { path, meta: route?.meta ?? {} } as unknown as RouteLocationNormalized
  return decideAccess(to, session(role)).kind === 'allow'
}

describe('teacher profile routes', () => {
  it('lists /guru/profil/edit before /guru/profil/:id and the registry spreads them', () => {
    expect(routes.map((r) => r.path)).toEqual(['/guru/profil/edit', '/guru/profil/:id'])
    for (const path of ['/guru/profil/edit', '/guru/profil/:id']) expect(m10Routes.some((r) => r.path === path)).toBe(true)
  })

  it('the edit page is for the teacher only', () => {
    expect(allowed('/guru/profil/edit', 'teacher')).toBe(true)
    for (const role of ['student', 'admin', 'school_admin'] as const) expect(allowed('/guru/profil/edit', role)).toBe(false)
  })

  it('the teacher card is for a teacher, an admin and a school admin, not a pupil', () => {
    for (const role of ['teacher', 'admin', 'school_admin'] as const) expect(allowed('/guru/profil/:id', role)).toBe(true)
    expect(allowed('/guru/profil/:id', 'student')).toBe(false)
  })

  it('the tab titles are the PRD ones', () => {
    expect(routes[0]?.meta?.title).toBe('Edit Profil Guru — PRESTASIPLUS')
    expect(routes[1]?.meta?.title).toBe('Profil Guru — PRESTASIPLUS')
  })
})
