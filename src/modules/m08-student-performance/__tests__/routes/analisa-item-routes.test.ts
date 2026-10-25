import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { decideAccess, type GuardSession } from '@/app/router/guards'
import type { Role } from '@/stores/session-types'

import analisaItem, { analisaItemTarget } from '../../routes/analisa-item'

/** SW5-15 / DV-M08-50: the id-less S9 is the viewer's own school; Admin Pusat has none (API 404). */
const router = createRouter({ history: createMemoryHistory(), routes: analisaItem })

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

const session = (role: Role | null): GuardSession => ({
  isLoggedIn: role !== null,
  role,
  landingPath: '/dashboard',
})

const decide = (path: string, role: Role | null) =>
  decideAccess(router.resolve(path) as unknown as RouteLocationNormalized, session(role))

describe('M08 analisa-item route roles (SW5-15)', () => {
  it('the id-less S9 answers the in-place 403 page to the admin, who has no school', () => {
    expect(router.resolve('/analisa-item/sekolah').name).toBe('m08.analisa-item.sekolah')
    expect(decide('/analisa-item/sekolah', 'admin')).toEqual({ kind: 'in-place', status: 403 })
  })

  it('the id-less S9 stays open to teacher, student and school admin and the other roles', () => {
    for (const role of ALL_ROLES.filter((r) => r !== 'admin')) {
      expect(decide('/analisa-item/sekolah', role)).toEqual({ kind: 'allow' })
    }
  })

  it('S9 /{id} stays open to the admin (any school) and to every other role', () => {
    expect(router.resolve('/analisa-item/sekolah/8880').name).toBe('m08.analisa-item.sekolah.id')
    for (const role of ALL_ROLES) {
      expect(decide('/analisa-item/sekolah/8880', role)).toEqual({ kind: 'allow' })
    }
  })

  it('S10 / S11 stay admin and teacher only', () => {
    for (const path of ['/analisa-item/kelas', '/analisa-item/kelas/228']) {
      for (const role of ALL_ROLES) {
        expect(decide(path, role)).toEqual(
          role === 'admin' || role === 'teacher'
            ? { kind: 'allow' }
            : { kind: 'in-place', status: 403 },
        )
      }
    }
  })

  it('a guest still goes to /login', () => {
    expect(decide('/analisa-item/sekolah', null)).toEqual({ kind: 'redirect', to: '/login' })
  })

  it('the /analisa-item redirect sends the admin to S10, which the admin may open, never to the refused route', () => {
    const target = analisaItemTarget('admin')
    expect(target).toBe('/analisa-item/kelas')
    expect(decide(target, 'admin')).toEqual({ kind: 'allow' })
  })
})
