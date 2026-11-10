// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory } from 'vue-router'

import { api, installTransport } from '@/api'
import type { ModuleManifest } from '@/app/modules'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { usePageMeta } from '@/composables/usePageMeta'
import { clock } from '@/lib/time'
import { NOTIFICATION_PUSH_EVENT } from '@/shells/user/constants'
import { setUnauthorizedRedirect } from '@/stores'
import { useNotificationBadgeStore } from '@/stores/notification-badge'

const Page = defineComponent({ name: 'HeaderPage', setup: () => () => h('p', 'page') })

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-header',
    routes: [
      {
        path: '/peta-belajar',
        component: Page,
        meta: {
          layout: 'user',
          v2: true,
          header: { title: 'Tajuk Laluan', subtitle: 'Sub Laluan' },
        },
      },
    ],
  },
]

// The router loads the Pembelajaran layout lazily; preload it so mounting resolves at once.
beforeAll(async () => {
  await import('../PembelajaranLayout.vue')
})

let pinia: Pinia
let wrapper: VueWrapper | null = null

async function open(path: string): Promise<VueWrapper> {
  logIn(STUDENT)
  const router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
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

describe('PembelajaranLayout bell (C-6, FR-M01-53)', () => {
  it('refreshes the bell when a foreground notification push arrives', async () => {
    await open('/peta-belajar')
    const refresh = vi.spyOn(useNotificationBadgeStore(pinia), 'refresh').mockResolvedValue(0)
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PUSH_EVENT))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops listening once the layout is unmounted', async () => {
    await open('/peta-belajar')
    const refresh = vi.spyOn(useNotificationBadgeStore(pinia), 'refresh').mockResolvedValue(0)
    wrapper?.unmount()
    wrapper = null
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PUSH_EVENT))
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('PembelajaranLayout title and subtitle (C-7)', () => {
  it('prints the route header title and subtitle', async () => {
    const w = await open('/peta-belajar')
    expect(w.get('[data-testid="pembelajaran-header"] h1').text()).toBe('Tajuk Laluan')
    expect(w.get('[data-testid="pembelajaran-subtitle"]').text()).toBe('Sub Laluan')
  })

  it('a data-driven header (usePageMeta.setHeader) wins over the route header', async () => {
    const w = await open('/peta-belajar')
    usePageMeta().setHeader({ title: '5 MARIKH - Kimia', subtitle: 'SK Demo — Tingkatan 5' })
    await nextTick()
    expect(w.get('[data-testid="pembelajaran-header"] h1').text()).toBe('5 MARIKH - Kimia')
    expect(w.get('[data-testid="pembelajaran-subtitle"]').text()).toBe('SK Demo — Tingkatan 5')
  })

  it('shows the subtitle below md too, at 10px below sm', async () => {
    const w = await open('/peta-belajar')
    const classes = w.get('[data-testid="pembelajaran-subtitle"]').classes()
    expect(classes).not.toContain('hidden')
    expect(classes).toContain('text-[10px]')
    expect(classes).toContain('sm:text-caption')
  })
})
