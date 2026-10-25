// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, useRoute, type Router } from 'vue-router'

import { api, installTransport } from '@/api'
import type { ModuleManifest } from '@/app/modules'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { usePageMeta } from '@/composables/usePageMeta'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect } from '@/stores'

/**
 * One page component for every route. Like M08 `HeadcountTablePage`, it sets its header from loaded
 * data, except on `/peta-belajar`, which stands for a page with no data-driven header.
 */
const Page = defineComponent({
  name: 'TitlePage',
  setup() {
    const route = useRoute()
    if (route.path !== '/peta-belajar') {
      usePageMeta().setHeader({ title: 'Headcount Sejarah', subtitle: 'Selamat datang kembali' })
    }
    return () => h('p', 'page')
  },
})

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-page-title',
    routes: [
      {
        path: '/headcount/7',
        component: Page,
        meta: { layout: 'user', v2: true, header: { title: 'Headcount' } },
      },
      {
        path: '/headcount/8',
        component: Page,
        meta: { layout: 'user', v2: true, ownsH1: true, header: { title: 'Headcount Tetap' } },
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
let router: Router

async function open(path: string): Promise<VueWrapper> {
  logIn(STUDENT)
  router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
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
  // jsdom has no Element.scrollTo; the shell scrolls its panel to the top on every navigation.
  Element.prototype.scrollTo = () => undefined
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

describe('PembelajaranLayout: topbar title', () => {
  it('prints the page-provided header over the static route header', async () => {
    const w = await open('/headcount/7')
    const h1s = w.findAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0]?.text()).toBe('Headcount Sejarah')
  })

  it('keeps the static route header for a page that sets none', async () => {
    const w = await open('/peta-belajar')
    expect(w.get('h1').text()).toBe('Tajuk Shell')
  })

  it('keeps the static route header when the page owns its h1', async () => {
    const w = await open('/headcount/8')
    expect(w.get('p[data-testid="shell-title"]').text()).toBe('Headcount Tetap')
  })

  it('does not carry the dynamic title over to the next page', async () => {
    const w = await open('/headcount/7')
    expect(w.get('h1').text()).toBe('Headcount Sejarah')
    await router.push('/peta-belajar')
    await vi.waitFor(() => expect(w.get('h1').text()).toBe('Tajuk Shell'))
  })
})
