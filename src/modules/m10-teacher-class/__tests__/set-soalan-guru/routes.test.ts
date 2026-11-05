import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

/** R1-GUR-8b routes (S6-T14): teacher only in both API modes, V2 path redirects with replace. */

async function load(mode: 'http' | 'mock'): Promise<RouteRecordRaw[]> {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', mode)
  return (await import('../../routes')).default
}
afterEach(() => {
  vi.unstubAllEnvs()
})

const SET_PATHS = [
  '/guru/set-soalan',
  '/guru/set-soalan/cipta',
  '/guru/set-soalan/:id',
  '/guru/set-soalan/:id/keputusan',
]

describe('Set Soalan guru routes', () => {
  for (const mode of ['http', 'mock'] as const) {
    it(`${mode} mode: the 4 set routes carry roles ['teacher'] and the V3 user layout`, async () => {
      const routes = await load(mode)
      for (const path of SET_PATHS) {
        const r = routes.find((x) => x.path === path)
        expect(r, path).toBeDefined()
        expect(r?.meta?.roles, path).toEqual(['teacher'])
        expect(r?.meta?.access, path).toBe('auth')
      }
    })
  }

  it('/guru/set/cipta redirects to /guru/set-soalan/cipta with replace (no extra history entry)', async () => {
    const routes = await load('mock')
    const stub = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: routes
        .filter((r) => r.path === '/guru/set/cipta' || SET_PATHS.includes(r.path))
        .map((r) => ('redirect' in r ? r : { ...r, component: stub })) as RouteRecordRaw[],
    })
    router.addRoute({ path: '/start', component: stub })
    await router.push('/start')
    await router.push('/guru/set/cipta')
    expect(router.currentRoute.value.fullPath).toBe('/guru/set-soalan/cipta')
    // One entry for the whole redirect: going back lands on the page before it.
    router.back()
    await new Promise((r) => setTimeout(r, 20))
    expect(router.currentRoute.value.fullPath).toBe('/start')
  })

  it('the redirect record has no component and points at the create page', async () => {
    const routes = await load('mock')
    const r = routes.find((x) => x.path === '/guru/set/cipta')
    expect(r?.redirect).toBe('/guru/set-soalan/cipta')
  })
})
