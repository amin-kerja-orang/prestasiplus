// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { createAppRouter } from '@/app/router'

import { FULL_ITEMS, PENTADBIRAN_FULL_MENU, PENTADBIRAN_MENU, type PentadbiranGroup } from '../menu'
import { S0_ROWS } from '../menu/fragments/s0'
import { S2_ROWS } from '../menu/fragments/s2'
import { S3_ROWS } from '../menu/fragments/s3'
import { S4_ROWS } from '../menu/fragments/s4'
import { S5_ROWS } from '../menu/fragments/s5'
import { S6_ROWS } from '../menu/fragments/s6'
import { S7_ROWS } from '../menu/fragments/s7'
import { normalisePath, redirectsFrom, renderMenu, resolveRoute } from '../menu/render'
import snapshot from './fixtures/menu-snapshot.json'

const item = (id: string, to: string, built = true) => ({ id, label: id, to, built })
const group = (key: string, items: ReturnType<typeof item>[]): PentadbiranGroup => ({ key, icon: 'gear', items })
const ids = (menu: readonly PentadbiranGroup[]): string[] => menu.flatMap((g) => g.items.map((i) => i.id))

describe('renderMenu (dedup)', () => {
  it('skips an entry whose route equals an earlier rendered entry (first wins)', () => {
    const out = renderMenu([
      group('a', [item('A1', '/admin/x'), item('A2', '/admin/y')]),
      group('b', [item('B1', '/admin/x/'), item('B2', '/admin/x?tab=1'), item('B3', '/admin/z')]),
    ])
    expect(ids(out)).toEqual(['A1', 'A2', 'B3'])
  })

  it('skips an entry that redirects to a page another rendered entry already shows', () => {
    const redirects = { '/admin/studio/imports': '/admin/spm/soalan/ekstrak' }
    const out = renderMenu(
      [
        group('soalan', [
          item('BS-02', '/admin/spm/soalan/ekstrak'),
          item('KS-14', '/admin/studio/imports'),
          item('KS-17', '/admin/studio/sets'),
        ]),
      ],
      redirects,
    )
    expect(ids(out)).toEqual(['BS-02', 'KS-17'])
  })

  it('first entry wins also when the redirect entry comes first', () => {
    const redirects = { '/old': '/new' }
    expect(ids(renderMenu([group('a', [item('R', '/old'), item('N', '/new')])], redirects))).toEqual(['R'])
  })

  it('follows a redirect chain and survives a cycle', () => {
    expect(resolveRoute('/a', { '/a': '/b', '/b': '/c?x=1' })).toBe('/c')
    expect(['/a', '/b']).toContain(resolveRoute('/a', { '/a': '/b', '/b': '/a' }))
    expect(normalisePath('/admin/q/?s=1#h')).toBe('/admin/q')
  })

  it('never renders unbuilt entries and drops groups left empty', () => {
    const out = renderMenu([group('a', [item('A1', '/p', false)]), group('b', [item('B1', '/p'), item('B2', '/p')])])
    expect(out.map((g) => g.key)).toEqual(['b'])
    expect(ids(out)).toEqual(['B1'])
  })
})

describe('redirectsFrom + renderMenu with real router records', () => {
  const small = (): Router =>
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/studio', name: 'studio', component: { render: () => null } },
        { path: '/old', redirect: '/admin/studio' },
        { path: '/old-obj', redirect: { path: '/admin/studio', query: { a: '1' } } },
        { path: '/old-name', redirect: { name: 'studio' } },
        { path: '/old-fn', redirect: () => '/admin/studio' },
        { path: '/old/:id', redirect: '/admin/studio' },
      ],
    })

  it('reads string, object-path and object-name redirects; skips function and param redirects', () => {
    expect(redirectsFrom(small().getRoutes())).toEqual({
      '/old': '/admin/studio',
      '/old-obj': '/admin/studio',
      '/old-name': '/admin/studio',
    })
  })

  it('skips an entry whose route is a router redirect to an already-shown page; the shown one stays', () => {
    const redirects = redirectsFrom(small().getRoutes())
    const out = renderMenu(
      [group('a', [item('S', '/admin/studio'), item('O', '/old'), item('N', '/old-name'), item('F', '/old-fn')])],
      redirects,
    )
    // /old-fn is a function redirect: not resolved statically, so it is kept
    expect(ids(out)).toEqual(['S', 'F'])
  })

  it('the real app router drops nothing from today\'s menu (and no two entries show one page)', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    const redirects = redirectsFrom(router.getRoutes())
    const out = renderMenu(PENTADBIRAN_FULL_MENU, redirects)
    expect(ids(out)).toEqual(ids(PENTADBIRAN_MENU))
    const pages = out.flatMap((g) => g.items.map((i) => resolveRoute(i.to, redirects)))
    expect(new Set(pages).size).toBe(pages.length)
  })
})

describe('menu fragments', () => {
  it('output is identical to the pre-split menu (snapshot of HEAD before the split)', () => {
    expect(JSON.stringify(PENTADBIRAN_FULL_MENU)).toBe(JSON.stringify(snapshot.full))
    expect(JSON.stringify(PENTADBIRAN_MENU)).toBe(JSON.stringify(snapshot.rendered))
  })

  it('every fragment row is used by the composer, once', () => {
    const rows = [S0_ROWS, S2_ROWS, S3_ROWS, S4_ROWS, S5_ROWS, S6_ROWS, S7_ROWS].flatMap((list) => list.map((r) => r[0]))
    expect(new Set(rows).size).toBe(rows.length)
    expect([...rows].sort()).toEqual(FULL_ITEMS.map((i) => i.id).sort())
  })
})
