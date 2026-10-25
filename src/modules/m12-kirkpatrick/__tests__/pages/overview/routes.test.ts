import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

import overview from '../../../routes/overview'

const byPath = (p: string) => overview.find((r) => r.path === p)

/** The props of a route record, resolved the way the router does for a function `props`. */
function propsOf(route: RouteRecordRaw | undefined): Record<string, unknown> {
  const props = (route as { props?: unknown } | undefined)?.props
  expect(typeof props, 'props is a function').toBe('function')
  return (props as (to: RouteLocationNormalized) => Record<string, unknown>)(
    {} as RouteLocationNormalized,
  )
}

describe('S1 route props (G4 F6, BUG-11)', () => {
  it('forces the data scope to the own school on the school-admin alias and keeps its detail links off', () => {
    expect(propsOf(byPath('/admin-sekolah/kirkpatrick'))).toEqual({
      basePath: '/admin-sekolah/kirkpatrick',
      detailLinks: false,
      scopeForced: true,
    })
  })

  it('leaves the admin and guru mounts unforced, with detail links on', () => {
    for (const prefix of ['/admin/kirkpatrick', '/guru/kirkpatrick']) {
      const props = propsOf(byPath(prefix))
      expect(props).toEqual({ basePath: prefix, detailLinks: true })
      expect(props).not.toHaveProperty('scopeForced')
    }
  })
})
