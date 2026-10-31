/**
 * M21-T2 S6 route (SRS M21 v1.2 FR-M21-05, 07, 09; DV-M21-06): signed-in access, header and tab title.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

// The S6 route is hidden unless VITE_KELUARGA_ANGKAT=on (D74): this file covers the "on" state;
// `src/app/__tests__/features.test.ts` covers the "off" state.
type RoutesMod = typeof import('../../routes')
let routes: RoutesMod['default']
let mohon: (typeof import('../../routes/mohon'))['default']
let router: Router

beforeAll(async () => {
  vi.stubEnv('VITE_KELUARGA_ANGKAT', 'on')
  vi.resetModules()
  const { buildRoutes } = await import('@/app/router')
  routes = (await import('../../routes')).default
  mohon = (await import('../../routes/mohon')).default
  router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })
}, 120_000) // a fresh import of the whole router is slow under parallel load

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('M21 S6 route', () => {
  it('is spread into the module routes', () => {
    expect(routes.map((r) => r.path)).toContain('/mohon-keluarga-angkat')
    expect(mohon).toHaveLength(1)
  })

  it('is a signed-in user-shell route open to every role, with the DV-M21-06 header', () => {
    const r = router.getRoutes().find((x) => x.path === '/mohon-keluarga-angkat')
    expect(r?.meta.layout).toBe('user')
    expect(r?.meta.access).toBe('auth')
    expect(r?.meta.roles).toBeUndefined()
    expect(r?.meta.title).toBe('Mohon Keluarga Angkat')
    expect(r?.meta.header).toEqual({
      title: 'Mohon Keluarga Angkat',
      subtitle: 'Selamat datang kembali',
    })
    expect(router.resolve('/mohon-keluarga-angkat').matched.length).toBeGreaterThan(0)
  })
})
