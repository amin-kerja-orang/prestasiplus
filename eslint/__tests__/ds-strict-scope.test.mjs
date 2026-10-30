// T1 (docs/design/v2-admin-page-templates.md section 4): route walker. Every page of a Portal
// Pentadbiran route (`/admin/**`, `/guru/monitoring/**`), every UI file reachable from one, and every
// file of the shell is inside the admin lint scope (config/ds-strict.json adminScope). A new portal page
// that is not covered fails here, so it can never ship unlinted.
import { describe, expect, it } from 'vitest'

import { matcher } from '../lib/glob.mjs'
import { readAdminStrict } from '../admin-strict.mjs'
import {
  navPaths,
  portalRoutes,
  reachableUiFiles,
  routePattern,
  walk,
  isTestPath,
} from '../../scripts/lib/admin-routes.mjs'

const cfg = readAdminStrict()
const inScope = matcher(cfg.scope)
const exempt = matcher(cfg.exempt)
const covered = (f) => inScope(f) && !exempt(f)

const routes = portalRoutes()
const pages = [...new Set(routes.map((r) => r.page).filter(Boolean))].sort()

describe('T1 portal route walker', () => {
  it('finds the portal routes', () => {
    expect(routes.length).toBeGreaterThan(60)
    expect(pages.length).toBeGreaterThan(60)
  })

  it('has every portal route page inside the lint scope', () => {
    expect(pages.filter((p) => !covered(p))).toEqual([])
  })

  it('has every UI file reachable from a portal route inside the lint scope', () => {
    expect(reachableUiFiles(pages).filter((f) => !covered(f))).toEqual([])
  })

  it('covers the whole shell and m28 admin (unlinted before this scope)', () => {
    const files = walk('src/shells/pentadbiran').filter((p) => /\.(vue|ts)$/.test(p) && !isTestPath(p))
    expect(files.length).toBeGreaterThan(3)
    expect(files.filter((f) => !covered(f))).toEqual([])
    const m28 = walk('src/modules/m28-bijak-spm/admin').filter((p) => /\.(vue|ts)$/.test(p) && !isTestPath(p))
    expect(m28.length).toBeGreaterThan(10)
    expect(m28.filter((f) => !covered(f))).toEqual([])
  })

  it('resolves every built menu / nav path to a covered page (paths without a route record are skipped)', () => {
    const literal = routes.filter((r) => r.page && r.path.startsWith('/'))
    const checked = []
    for (const file of ['src/shells/pentadbiran/menu.ts', 'src/shells/nav/admin-nav.ts']) {
      for (const path of navPaths(file)) {
        const hit = literal.find((r) => routePattern(r.path).test(path.split('?')[0].split('#')[0]))
        if (hit) checked.push({ path, page: hit.page })
      }
    }
    expect(checked.length).toBeGreaterThan(20)
    expect(checked.filter((c) => !covered(c.page))).toEqual([])
  })

  it('matches routes with params', () => {
    expect(routePattern('/admin/users/:id/edit').test('/admin/users/12/edit')).toBe(true)
    expect(routePattern('/admin/users/:id/edit').test('/admin/users/edit')).toBe(false)
  })
})

describe('glob matcher', () => {
  it('handles **, *, braces', () => {
    const m = matcher(['a/{b,c}/**', 'x/*Page.vue', 'q/**/z.ts'])
    expect(m('a/b/d/e.vue')).toBe(true)
    expect(m('a/d/e.vue')).toBe(false)
    expect(m('x/FooPage.vue')).toBe(true)
    expect(m('x/y/FooPage.vue')).toBe(false)
    expect(m('q/z.ts')).toBe(true)
    expect(m('q/r/s/z.ts')).toBe(true)
  })
})
