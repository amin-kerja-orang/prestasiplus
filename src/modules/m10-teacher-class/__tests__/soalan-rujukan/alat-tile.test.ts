// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import AlatSoalanBlock from '../../components/soalan/AlatSoalanBlock.vue'
import routes from '../../routes/soalan-rujukan'

const sessionMock = vi.hoisted((): { role: string | null } => ({ role: 'teacher' }))
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

describe('Alat Soalan tile "Soalan & Rujukan"', () => {
  it('the route fragment registers the list, the form and the edit route for teacher and admin', () => {
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
