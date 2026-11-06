// S3-T06 admin UI: route records, the V2 alias and the name reserved for the Kandungan hub (PRD30 Q-18, 3.2).
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { KANDUNGAN_ROUTES } from '../admin/kandungan/api'
import routes from '../routes/admin-kertas-subjektif'
import bijakRoutes from '../routes'

const stub = { template: '<div />' }
const withStubs = (records: RouteRecordRaw[]): RouteRecordRaw[] =>
  records.map((r) => ('component' in r ? { ...r, component: stub } : r) as RouteRecordRaw)

describe('Kertas Subjektif admin routes', () => {
  it('the list carries the name reserved in KANDUNGAN_ROUTES, the title and admin-only meta', () => {
    const list = routes.find((r) => r.path === '/admin/kertas-subjektif')!
    expect(list.name).toBe(KANDUNGAN_ROUTES.kertasSubjektif)
    expect(list.name).toBe('m28.admin.kandungan.kertas-subjektif')
    expect(list.meta).toMatchObject({ layout: 'admin', access: 'auth', roles: ['admin'], title: 'Kertas Subjektif - Admin Panel',
      header: { title: 'Kertas Subjektif', subtitle: 'Kertas 2/3/4 percubaan negeri — pratonton & terbitan' } })
  })

  it('has one detail record with :id and no duplicate path or name in the module', () => {
    expect(routes.some((r) => r.path === '/admin/kertas-subjektif/:id')).toBe(true)
    const all = bijakRoutes
    const paths = all.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
    const names = all.map((r) => r.name).filter(Boolean)
    expect(new Set(names).size).toBe(names.length)
  })

  it('the V2 path /admin/spm/kertas-subjektif redirects to the list (a screen, not a chain)', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: withStubs(bijakRoutes) })
    await router.push('/admin/spm/kertas-subjektif')
    expect(router.currentRoute.value.fullPath).toBe('/admin/kertas-subjektif')
    expect(router.currentRoute.value.matched.at(-1)?.redirect).toBeUndefined()
    await router.push('/admin/kertas-subjektif/sj-1')
    expect(router.currentRoute.value.params.id).toBe('sj-1')
  })
})
