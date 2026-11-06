import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { decideAccess, type GuardSession } from '@/app/router/guards'
import type { Role } from '@/stores/session-types'

const store = vi.hoisted(() => ({ role: null as string | null }))
vi.mock('@/stores/session', () => ({ useSessionStore: () => store }))

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

describe('M08 analisa-item route roles (SW5-15, S10-T03)', () => {
  it('the id-less S9 answers the in-place 403 page to the admin, who has no school', () => {
    expect(router.resolve('/analisa-item/sekolah').name).toBe('m08.analisa-item.sekolah')
    expect(decide('/analisa-item/sekolah', 'admin')).toEqual({ kind: 'in-place', status: 403 })
  })

  it('the id-less S9 stays open to teacher, school admin and the other roles, but not to the pupil', () => {
    for (const role of ALL_ROLES.filter((r) => r !== 'admin' && r !== 'student')) {
      expect(decide('/analisa-item/sekolah', role)).toEqual({ kind: 'allow' })
    }
  })

  it('the pupil gets the in-place 403 page on the id-less S9 (FR-MUR-6-2, AC-MUR-6-5)', () => {
    expect(decide('/analisa-item/sekolah', 'student')).toEqual({ kind: 'in-place', status: 403 })
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

  it('/analisa-item is the pupil page, a component route and no longer a redirect record', () => {
    const rec = analisaItem.find((r) => r.path === '/analisa-item')
    expect(rec?.redirect).toBeUndefined()
    expect(rec?.component).toBeTypeOf('function')
    expect(router.resolve('/analisa-item').name).toBe('m08.analisa-item.murid')
    expect(decide('/analisa-item', 'student')).toEqual({ kind: 'allow' })
  })

  it('beforeEnter keeps the pupil and sends every other role through analisaItemTarget', () => {
    const rec = analisaItem.find((r) => r.path === '/analisa-item')
    const guard = rec?.beforeEnter as () => unknown
    const expected: [string | null, string | true][] = [
      ['student', true],
      ['teacher', '/analisa-item/kelas'],
      ['admin', '/analisa-item/kelas'],
      ['school_admin', '/analisa-item/sekolah'],
      ['parent', '/dashboard'],
      [null, '/login'],
    ]
    for (const [role, target] of expected) {
      store.role = role
      expect(guard(), String(role)).toBe(target)
    }
  })

  it('analisaItemTarget: guest → /login, pupil → own page', () => {
    expect(analisaItemTarget(null)).toBe('/login')
    expect(analisaItemTarget('student')).toBe('/analisa-item')
    expect(analisaItemTarget('teacher')).toBe('/analisa-item/kelas')
    expect(analisaItemTarget('admin')).toBe('/analisa-item/kelas')
    expect(analisaItemTarget('school_admin')).toBe('/analisa-item/sekolah')
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
