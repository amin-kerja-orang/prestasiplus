// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { createAppRouter } from '@/app/router'

import App from '../App.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App (root = LayoutHost, F-13)', () => {
  it('renders the routed page through LayoutHost', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const pinia = createPinia()
    const router = createAppRouter({ history: createMemoryHistory(), registry: [] })
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })
    await router.push('/tiada-halaman')
    await flushPromises()
    expect(wrapper.find('[data-page="not-found"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
