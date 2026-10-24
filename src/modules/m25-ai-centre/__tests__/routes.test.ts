/**
 * M25-T2 S1 route (SRS M25 v1.2 FR-M25-02, 03, 05, 07, 08; XR-M25-06; DV-M25-01, DV-M25-09).
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'

import routes from '../routes'
import heatmap from '../routes/heatmap'

const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

describe('M25 S1 route', () => {
  it('is spread into the module routes', () => {
    expect(routes.map((r) => r.path)).toEqual(['/buku-nota/heatmap'])
    expect(heatmap).toHaveLength(1)
  })

  it('is a user-shell route for student and admin only, other roles go to their landing page', () => {
    const r = router.getRoutes().find((x) => x.path === '/buku-nota/heatmap')
    expect(r?.meta.layout).toBe('user')
    expect(r?.meta.access).toBe('auth')
    expect(r?.meta.roles).toEqual(['student', 'admin'])
    expect(r?.meta.onForbidden).toBe('landing')
  })

  it('sets the DV-M25-01 header and the exact tab title', () => {
    const r = router.getRoutes().find((x) => x.path === '/buku-nota/heatmap')
    expect(r?.meta.title).toBe('Peta Haba Topik Lemah')
    expect(r?.meta.header).toEqual({
      title: 'Peta Haba Topik Lemah',
      subtitle: 'Selamat datang kembali',
    })
  })

  it('does not register /heatmap-topik-lemah (the global 404 handles it, DV-M25-09)', () => {
    expect(router.getRoutes().some((x) => x.path === '/heatmap-topik-lemah')).toBe(false)
    const hit = router.resolve('/heatmap-topik-lemah')
    expect(hit.matched.every((m) => m.path !== '/buku-nota/heatmap')).toBe(true)
  })
})
