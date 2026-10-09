import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const stub = { template: '<div />' }

export interface Mounted {
  wrapper: VueWrapper
  router: Router
}

/** Mounts a teacher page with a router that knows the M13 teacher paths (as stubs). */
export async function mountAt(
  component: Component,
  url: string,
  props: Record<string, unknown> = {},
): Promise<Mounted> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cikgu', component: stub },
      { path: '/cikgu/rph', component: stub },
      { path: '/cikgu/rph/baharu', component: stub },
      { path: '/cikgu/rph/:id', component: stub },
      { path: '/cikgu/essay', component: stub },
      { path: '/cikgu/essay/baharu', component: stub },
      { path: '/cikgu/essay/:id', component: stub },
      { path: '/cikgu/pbd', component: stub },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(component, {
    attachTo: document.body,
    props,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

export function listMeta(total: number, page = 1) {
  return { page, pageSize: 20, totalItems: total, totalPages: Math.max(1, Math.ceil(total / 20)) }
}
