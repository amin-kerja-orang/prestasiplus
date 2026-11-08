// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { decideAccess } from '@/app/router'

import AlatSoalanBlock from '../../components/soalan/AlatSoalanBlock.vue'
import routes from '../../routes/soalan-rujukan'

const sessionMock = vi.hoisted((): { role: string | null; features: Record<string, boolean> } => ({ role: 'teacher', features: {} }))
vi.mock('@/stores/session', () => ({ useSessionStore: () => sessionMock }))

beforeEach(() => {
  setActivePinia(createPinia())
  sessionMock.role = 'teacher'
})

/** The real route fragment of S6-T16 with stub pages. */
function routerWith(fragment = routes) {
  const stub = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      ...fragment.map((r) => ({ ...r, component: stub }) as RouteRecordRaw),
    ],
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Alat Soalan tile "Soalan & Rujukan"', () => {
  it('the route fragment registers the list, the form and the edit route for teacher and admin (mock mode)', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '/guru/soalan-guru',
      '/guru/soalan-guru/cipta',
      '/guru/soalan-guru/:id(\\d+)/sunting',
    ])
    for (const r of routes) expect(r.meta?.roles, r.path).toEqual(['teacher', 'admin'])
    expect(routes[1]!.meta?.title).toBe('Cipta Soalan & Rujukan — PRESTASIPLUS')
  })

  it('renders now that the route exists, linking to /guru/soalan-guru', async () => {
    const router = routerWith()
    await router.push('/')
    const w = mount(AlatSoalanBlock, { global: { plugins: [router] } })
    await flushPromises()
    const tile = w
      .findAll('[data-testid="alat-tile"]')
      .find((x) => x.text().includes('Soalan & Rujukan'))
    expect(tile).toBeDefined()
    expect(tile!.text()).toContain('Soalan peribadi + rujukan')
    expect(tile!.find('a').attributes('href')).toBe('/guru/soalan-guru')
    expect(router.resolve('/guru/soalan-guru/12/sunting').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/guru/soalan-guru/abc/sunting').matched.length).toBe(0)
  })

  it('does not render without the route (no dead link)', async () => {
    const router = routerWith([])
    await router.push('/')
    const w = mount(AlatSoalanBlock, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.text()).not.toContain('Soalan & Rujukan')
  })
})

/** The route fragment as built under the given API mode (the mode is read at module load; DV-M10-37). */
async function loadFragment(mode: 'http' | 'mock'): Promise<RouteRecordRaw[]> {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', mode)
  return (await import('../../routes/soalan-rujukan')).default
}

describe('Soalan & Rujukan roles follow GURU_API_ROLES (the API is teacher-only)', () => {
  const session = (role: 'teacher' | 'admin') => ({ isLoggedIn: true, role, landingPath: '/dashboard' })

  it('http mode: meta.roles is [teacher]; the teacher gets every route, an admin none', async () => {
    const fragment = await loadFragment('http')
    for (const r of fragment) {
      expect(r.meta?.roles, r.path).toEqual(['teacher'])
      const to = { path: r.path, meta: r.meta ?? {} } as unknown as Parameters<typeof decideAccess>[0]
      expect(decideAccess(to, session('teacher')), r.path).toEqual({ kind: 'allow' })
      expect(decideAccess(to, session('admin')), r.path).not.toEqual({ kind: 'allow' })
    }
  })

  it('http mode: the tile shows for a teacher and not for an admin', async () => {
    const fragment = await loadFragment('http')
    const { default: Block } = await import('../../components/soalan/AlatSoalanBlock.vue')
    const tileFor = async (role: string) => {
      sessionMock.role = role
      const router = routerWith(fragment)
      await router.push('/')
      const w = mount(Block, { global: { plugins: [router] } })
      await flushPromises()
      return w.text().includes('Soalan & Rujukan')
    }
    expect(await tileFor('teacher')).toBe(true)
    expect(await tileFor('admin')).toBe(false)
  })
})
