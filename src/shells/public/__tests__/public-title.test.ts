// @vitest-environment jsdom
/**
 * Guest tab title on the first load, WITHOUT preloading the lazy public layout chunk: the router
 * sets `meta.guestTitle` synchronously in afterEach, so there is no flicker of the logged-in
 * title while `PublicLayout.vue` is still loading.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { api, installTransport } from '@/api'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect } from '@/stores'

import { DETAIL_TITLE, PUBLIC_REGISTRY, USER_TITLE } from './public-fixtures'

let pinia: Pinia
let wrapper: VueWrapper | null = null

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  installTransport(fakeTransport())
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  document.title = ''
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  vi.restoreAllMocks()
})

const newRouter = () =>
  createAppRouter({ history: createMemoryHistory(), registry: PUBLIC_REGISTRY })

describe('guest title on the first load (no layout preload)', () => {
  it('is the guest title as soon as the navigation ends, before any render', async () => {
    const router = newRouter()
    await router.push('/artikel')
    expect(document.title).toBe('Artikel — PRESTASIPLUS')
    await router.push('/video')
    expect(document.title).toBe('Video Pembelajaran — PRESTASIPLUS')
  })

  it('a logged-in user keeps the route title', async () => {
    logIn(STUDENT)
    const router = newRouter()
    await router.push('/artikel')
    expect(document.title).toBe(USER_TITLE)
  })

  it('the page setTitle still wins once the lazy layout has rendered it', async () => {
    const router = newRouter()
    await router.push('/artikel/x')
    expect(document.title).toBe('Artikel — PRESTASIPLUS')
    wrapper = mount(LayoutHost, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    })
    await vi.waitFor(
      async () => {
        await flushPromises()
        expect(wrapper?.find('[data-testid="artikel-detail"]').exists()).toBe(true)
        // The first mount transforms and loads the lazy layout chunk, which can take over 1 s under
        // a parallel full run.
      },
      { timeout: 10_000 },
    )
    expect(wrapper.find('[data-layout="public"]').exists()).toBe(true)
    expect(document.title).toBe(DETAIL_TITLE)
  })
})
