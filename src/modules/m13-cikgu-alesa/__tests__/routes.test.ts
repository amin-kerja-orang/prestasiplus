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

describe('M13 view routes (V1, V2): opaque ids (string from the API, digits from the mock)', () => {
  it.each(['/cikgu/rph/13101/print', '/cikgu/essay/1/edit'])(
    '%s is the catch-all 404',
    (path) => {
      expect(router.resolve(path).name).toBe('core.not-found')
    },
  )

  it.each([
    ['/cikgu/rph/13101', 'cikgu-rph-view', '13101'],
    ['/cikgu/rph/clx9abc123', 'cikgu-rph-view', 'clx9abc123'],
    ['/cikgu/essay/13201', 'cikgu-essay-view', '13201'],
    ['/cikgu/essay/clx9abc123', 'cikgu-essay-view', 'clx9abc123'],
  ])('%s resolves to the view and passes the id as a string prop', (path, name, id) => {
    const r = router.resolve(path)
    expect(r.name).toBe(name)
    expect(r.params.id).toBe(id)
    const props = r.matched[r.matched.length - 1]?.props.default
    expect(typeof props === 'function' ? props(r) : props).toEqual({ id })
  })

  it('keeps /baharu on the form', () => {
    expect(router.resolve('/cikgu/rph/baharu').name).toBe('cikgu-rph-baharu')
    expect(router.resolve('/cikgu/essay/baharu').name).toBe('cikgu-essay-baharu')
  })
})

describe('M13 registered routes (S1 to S6)', () => {
  const byName = (name: string) => router.getRoutes().find((r) => r.name === name)

  it('S1 /cikgu is open to every logged-in role and `/cikgu/` resolves to it', () => {
    const s1 = byName('cikgu')
    expect(s1?.meta.roles).toBeUndefined()
    expect(s1?.meta.access).toBe('auth')
    expect(s1?.meta.title).toBe('Cikgu Alesa')
    expect(s1?.meta.header).toEqual({ title: 'Cikgu Alesa', subtitle: 'Selamat datang kembali' })
    expect(router.resolve('/cikgu/').name).toBe('cikgu')
  })

  it.each([
    ['/cikgu/rph', 'RPH — Cikgu Alesa'],
    ['/cikgu/rph/baharu', 'Jana RPH Baharu'],
    ['/cikgu/essay', 'Marking Karangan'],
    ['/cikgu/essay/baharu', 'Mark Karangan Baharu'],
    ['/cikgu/pbd', 'PBD Auto-Tag Queue'],
    ['/cikgu/rph/13101', 'RPH — Cikgu Alesa'],
    ['/cikgu/essay/13201', 'Marking Karangan'],
  ])('%s is teacher / admin only with the live tab title', (path, title) => {
    const r = router.resolve(path)
    expect(r.name).not.toBe('core.not-found')
    expect(r.meta.roles).toEqual(['teacher', 'admin'])
    expect(r.meta.access).toBe('auth')
    expect(r.meta.title).toBe(title)
    expect(r.meta.header?.subtitle).toBe('Selamat datang kembali')
  })
})
