import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { decideAccess } from '@/app/router'

import routes from '../../routes/soalan'

const landing = '/dashboard'
const session = (role: 'student' | 'teacher' | 'admin' | null) => ({
  isLoggedIn: role !== null,
  role,
  landingPath: role === null ? null : landing,
})

describe('S6-T17 structured routes (R1-GUR-44b)', () => {
  const structured = routes.filter((r) => r.path.startsWith('/guru/soalan-berstruktur'))

  it('mounts the list and the numeric detail for the teacher shell with portal guru', () => {
    expect(structured.map((r) => r.path)).toEqual([
      '/guru/soalan-berstruktur',
      '/guru/soalan-berstruktur/:id([0-9]+)',
    ])
    expect(structured.map((r) => r.name)).toEqual([
      'm10.soalan.berstruktur',
      'm10.soalan.berstruktur.detail',
    ])
    expect(structured[0]?.props).toEqual({ portal: 'guru' })
    const detailProps = structured[1]?.props as (r: unknown) => unknown
    expect(detailProps({ params: { id: '4454' } })).toEqual({ id: 4454, portal: 'guru' })
    for (const r of structured) {
      expect(r.meta?.layout).toBe('user')
      expect(r.meta?.roles).toEqual(['teacher', 'admin'])
      expect(typeof r.component).toBe('function')
    }
  })

  it('lazy-loads the two M04 pages', async () => {
    const [list, detail] = await Promise.all(
      structured.map((r) => (r.component as () => Promise<{ default: unknown }>)()),
    )
    expect(list?.default).toBeTruthy()
    expect(detail?.default).toBeTruthy()
  })
})

describe('S21-S24 route access (decideAccess)', () => {
  it('declares the four routes for teacher and admin only on the user shell', () => {
    expect(
      routes.filter((r) => !r.path.startsWith('/guru/soalan-berstruktur')).map((r) => r.path),
    ).toEqual([
      '/guru/soalan',
      '/guru/soalan/cipta',
      '/guru/soalan/:id([0-9]+)',
      '/guru/soalan/:id([0-9]+)/edit',
    ])
    for (const r of routes) {
      expect(r.meta?.layout).toBe('user')
      expect(r.meta?.roles).toEqual(['teacher', 'admin'])
    }
  })

  for (const r of routes) {
    const to = { path: r.path, meta: r.meta ?? {} } as unknown as RouteLocationNormalized
    it(`${r.path}: guest to /login, student to the 403 page, teacher and admin allowed`, () => {
      expect(decideAccess(to, session(null))).toEqual({ kind: 'redirect', to: '/login' })
      expect(decideAccess(to, session('student'))).toEqual({ kind: 'in-place', status: 403 })
      expect(decideAccess(to, session('teacher'))).toEqual({ kind: 'allow' })
      expect(decideAccess(to, session('admin'))).toEqual({ kind: 'allow' })
    })
  }
})
