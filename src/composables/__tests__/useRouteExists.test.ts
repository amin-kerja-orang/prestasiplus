// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useRouteExists } from '../useRouteExists'

function probe(catchAllName?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/known/:id', component: { template: '<div />' } },
      { path: '/:rest(.*)*', name: catchAllName, component: { template: '<div />' } },
    ],
  })
  let exists!: (p: string) => boolean
  mount(
    defineComponent({
      setup() {
        exists = useRouteExists().routeExists
        return () => null
      },
    }),
    { global: { plugins: [router] } },
  )
  return exists
}

describe('useRouteExists', () => {
  it('is true for a real route and false for the catch-all 404', () => {
    const exists = probe('core.not-found')
    expect(exists('/known/3')).toBe(true)
    expect(exists('/pricing')).toBe(false)
  })
})
