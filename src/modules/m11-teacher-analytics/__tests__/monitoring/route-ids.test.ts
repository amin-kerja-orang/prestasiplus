/**
 * M11 monitoring route props (SWZ S11-5): in http mode the API ids are strings (contract `IdSchema =
 * z.string()`, never parsed) and reach the page props as-is; mock mode keeps numbers.
 */
import { describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ http: false }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

import { createPinia, setActivePinia } from 'pinia'

import { useSessionStore } from '@/stores'

import { monitoringRoutes } from '../../routes/monitoring'

type PropsFn = (route: unknown) => Record<string, unknown>

const routes = monitoringRoutes({
  name: 'x-monitoring',
  prefix: '/guru/monitoring',
  layout: 'admin',
  roles: ['teacher'],
})
const propsOf = (name: string, params: Record<string, string>) => {
  const route = routes.find((r) => r.name === name)
  return (route?.props as PropsFn)({ params })
}
const params = { schoolId: '1042', userId: '77' }

describe('monitoring route ids', () => {
  it('keeps numbers in mock mode (school, student and teacher routes)', () => {
    mode.http = false
    expect(propsOf('x-monitoring-sekolah', params)).toMatchObject({ schoolId: 1042 })
    expect(propsOf('x-monitoring-pelajar', params)).toMatchObject({ schoolId: 1042, userId: 77 })
    expect(propsOf('x-monitoring-guru', params)).toMatchObject({ schoolId: 1042, userId: 77 })
  })

  it('passes string ids through in http mode (school, student and teacher routes)', () => {
    mode.http = true
    expect(propsOf('x-monitoring-sekolah', params)).toMatchObject({ schoolId: '1042' })
    expect(propsOf('x-monitoring-pelajar', params)).toMatchObject({
      schoolId: '1042',
      userId: '77',
    })
    expect(propsOf('x-monitoring-guru', params)).toMatchObject({ schoolId: '1042', userId: '77' })
  })

  it('does not strip a leading zero from a string id in http mode', () => {
    mode.http = true
    expect(propsOf('x-monitoring-sekolah', { schoolId: '0042' })).toMatchObject({
      schoolId: '0042',
    })
  })
})

describe('FR-GUR-10-1 Guru index route', () => {
  const guru = monitoringRoutes({
    name: 'g',
    prefix: '/guru/monitoring',
    layout: 'admin',
    roles: ['teacher', 'admin'],
    ownSchool: true,
  })
  const index = guru.find((r) => r.name === 'g')
  const login = (role: 'teacher' | 'admin') => {
    setActivePinia(createPinia())
    useSessionStore().setSession({
      token: 't',
      remember: false,
      expiresAt: '2099-01-01T00:00:00+08:00',
      user: { id: 2, role, schoolId: 5, landingPath: '/' } as never,
    })
  }
  type Guard = () => unknown

  it('mounts the school detail page with only the base path (no school id prop)', () => {
    const p = (index?.props as PropsFn)({ params: {} })
    expect(p).toEqual({ basePath: '/guru/monitoring' })
    expect(index?.meta?.header).toEqual({ title: 'Detail Sekolah' })
  })

  it('an admin is redirected to /admin/monitoring; a teacher stays', () => {
    login('admin')
    expect((index?.beforeEnter as Guard)()).toBe('/admin/monitoring')
    login('teacher')
    expect((index?.beforeEnter as Guard)()).toBe(true)
  })

  it('the default mount (overview) has no guard and the no-"T4/T5" subtitle', () => {
    const overview = routes.find((r) => r.name === 'x-monitoring')
    expect(overview?.beforeEnter).toBeUndefined()
    expect(JSON.stringify(overview?.meta)).not.toContain('T4/T5')
  })
})
