import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'

import { bijakRoutes } from '@/modules/m28-bijak-spm'

import m04Routes from '../../routes'

/**
 * S2-T03 route table (PRD30 3.2 and 3.3, PRD47 M-01, M-04, R-04): the real route records of both modules, with the page
 * components stubbed. A `pending` row belongs to the named owner, runs as `it.fails` and must lose the flag in that owner's PR.
 */
interface Alias {
  from: string
  to: string
  owner: string
  pending?: boolean
}

const ALIASES: Alias[] = [
  { from: '/admin/studio/imports', to: '/admin/spm/soalan/ekstrak', owner: 'S2-T03' },
  { from: '/admin/spm/semakan', to: '/admin/studio?status=review', owner: 'S2-T03' },
  { from: '/admin/spm/semakan?subject=MAT', to: '/admin/studio?status=review', owner: 'S2-T03' },
  { from: '/admin/studio/questions/42/preview', to: '/admin/studio/questions/42/sunting?pratonton=1', owner: 'S2-T03' },
  // Waits for the KPI strip in the Studio list header (S2-T01); a later part of S2-T03 removes the flag.
  { from: '/admin/spm/soalan', to: '/admin/spm/databank', owner: 'S2-T03 after S2-T01', pending: true },
  { from: '/admin/spm/soalan?status=approved', to: '/admin/spm/databank', owner: 'S2-T03 after S2-T01', pending: true },
  { from: '/admin/spm/kertas', to: '/admin/studio/sets', owner: 'S3-T02', pending: true },
  { from: '/admin/spm/kertas/baharu', to: '/admin/studio/sets', owner: 'S3-T02', pending: true },
  { from: '/admin/spm/kertas-subjektif', to: '/admin/kertas-subjektif', owner: 'S3-T06', pending: true },
]

/** Same prefix as a redirected list, so each must keep its own screen. */
const PROTECTED = [
  '/admin/spm/soalan/ekstrak',
  '/admin/spm/soalan/ekstrak/7',
  '/admin/spm/soalan/muat-naik',
  '/admin/spm/soalan/manual',
  '/admin/spm/soalan/7/sunting',
  '/admin/spm/semakan/7',
]

const stub = { template: '<div />' }
const withStubs = (records: RouteRecordRaw[]): RouteRecordRaw[] =>
  records.map((r) => ('component' in r ? { ...r, component: stub } : r) as RouteRecordRaw)

const makeRouter = (): Router =>
  createRouter({ history: createMemoryHistory(), routes: withStubs([...m04Routes, ...bijakRoutes]) })

async function expectLands(alias: Alias): Promise<void> {
  const router = makeRouter()
  await router.push(alias.from)
  const now = router.currentRoute.value
  expect(now.fullPath).toBe(alias.to)
  expect(now.matched.length).toBeGreaterThan(0)
  // The target is a screen, not a further redirect, so a chain or a loop cannot form.
  expect(now.matched.at(-1)?.redirect).toBeUndefined()
}

describe('S2-T03 alias table', () => {
  for (const alias of ALIASES) {
    const title = `${alias.from} -> ${alias.to} (${alias.owner})`
    if (alias.pending) it.fails(title, () => expectLands(alias))
    else it(title, () => expectLands(alias))
  }

  it.each(PROTECTED)('%s keeps its own screen', (path) => {
    const matched = makeRouter().resolve(path).matched
    expect(matched.length).toBeGreaterThan(0)
    expect(matched.at(-1)?.redirect).toBeUndefined()
  })

  it('keeps the route names that pages link by', async () => {
    const router = makeRouter()
    await router.push({ name: 'm28.admin.review' })
    expect(router.currentRoute.value.fullPath).toBe('/admin/studio?status=review')
  })

  it('/admin/soalan-gambar opens the Audit Rajah screen (AC-QA-15, route part)', () => {
    const matched = makeRouter().resolve('/admin/soalan-gambar').matched
    expect(matched.length).toBeGreaterThan(0)
    expect(matched.at(-1)?.redirect).toBeUndefined()
  })

  it('does not match a non-numeric preview id', () => {
    expect(makeRouter().resolve('/admin/studio/questions/abc/preview').matched).toHaveLength(0)
  })
})
