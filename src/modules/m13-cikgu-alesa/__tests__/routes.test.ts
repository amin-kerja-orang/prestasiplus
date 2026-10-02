/**
 * S7 / S8 (SRS M13 v1.1 §2, FR-M13-08, FR-M13-09, FR-M13-11; DV-M13-10): paths with no M13 page
 * resolve to the core catch-all 404, never to a 405 page. M13 registers no route for them.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'

import routes from '../routes'

const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

describe('M13 404 outcomes (S7, S8)', () => {
  const dead = [
    '/cikgu/send',
    '/cikgu/pbd/rollup',
    '/cikgu/pbd/bulk-approve',
    '/cikgu-alesa',
    '/cikgu/unknown',
    '/cikgu/rph/1/edit',
  ]

  it.each(dead)('%s is the catch-all 404', (path) => {
    expect(router.resolve(path).name).toBe('core.not-found')
  })

  it('declares no M13 route that could shadow them', () => {
    const paths = routes.map((r) => r.path)
    for (const p of dead) expect(paths).not.toContain(p)
    for (const r of routes) expect(r.path).not.toMatch(/:pathMatch|\*/)
  })
})
