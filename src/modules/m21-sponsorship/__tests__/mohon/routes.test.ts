/**
 * M21-T2 S6 route (SRS M21 v1.2 FR-M21-05, 07, 09; DV-M21-06): signed-in access, header and tab title.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'

import routes from '../../routes'
import mohon from '../../routes/mohon'

const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

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
