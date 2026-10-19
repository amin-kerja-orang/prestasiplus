// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory } from 'vue-router'

import { api, installTransport } from '@/api'
import type { ModuleManifest } from '@/app/modules'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect } from '@/stores'

const Page = defineComponent({ name: 'OwnsH1Page', setup: () => () => h('p', 'page') })

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-owns-h1',
    routes: [
      {
        path: '/dashboard',
        component: Page,
        meta: {
          layout: 'user',
          v2: true,
          ownsH1: true,
          header: { title: 'Halaman Sendiri' },
        },
      },
      {
        path: '/peta-belajar',
        component: Page,
        meta: { layout: 'user', v2: true, header: { title: 'Tajuk Shell' } },
      },
    ],
  },
]

// The router loads the Pembelajaran layout lazily; preload it so mounting resolves at once.
beforeAll(async () => {
  await import('../pembelajaran/PembelajaranLayout.vue')
})

let pinia: Pinia
let wrapper: VueWrapper | null = null

async function open(path: string): Promise<VueWrapper> {
  logIn(STUDENT)
  const router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  // `shellComponents.pembelajaran` is an async component: wait until the shell header is drawn.
  await vi.waitFor(() =>
    expect(wrapper?.find('[data-testid="pembelajaran-bottom-nav"]').exists()).toBe(true),
  )
  return wrapper
}

beforeEach(() => {
  // vitest.config.ts turns the prototype scope off; the Pembelajaran shell is only used with it on.
  vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date', 'setInterval', 'clearInterval'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  installTransport(fakeTransport(() => ({})))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('PembelajaranLayout: meta.ownsH1', () => {
  it('prints the shell title as a paragraph, not an h1, when the page owns its h1', async () => {
    const w = await open('/dashboard')
    const title = w.get('p[data-testid="shell-title"]')
    expect(title.text()).toBe('Halaman Sendiri')
    expect(w.find('h1').exists()).toBe(false)
  })

  it('prints the shell title as the page h1 when the route does not set ownsH1', async () => {
    const w = await open('/peta-belajar')
    const h1s = w.findAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0]?.text()).toBe('Tajuk Shell')
    expect(w.find('[data-testid="shell-title"]').exists()).toBe(false)
  })
})
