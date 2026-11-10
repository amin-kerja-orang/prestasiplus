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
import { useNotificationBadgeStore } from '@/stores/notification-badge'

const TEACHER = { ...STUDENT, id: 3, role: 'teacher' as const, grade: null, landingPath: '/guru' }

const Page = defineComponent({ name: 'PillPage', setup: () => () => h('p', 'page') })

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-pills',
    routes: [
      { path: '/dashboard', component: Page, meta: { layout: 'user', v2: true } },
      { path: '/guru', component: Page, meta: { layout: 'user', v2: true } },
    ],
  },
]

beforeAll(async () => {
  await import('../pembelajaran/PembelajaranLayout.vue')
})

let pinia: Pinia
let wrapper: VueWrapper | null = null

async function open(user: typeof STUDENT, path: string): Promise<VueWrapper> {
  logIn(user)
  const router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await vi.waitFor(() =>
    expect(wrapper?.find('[data-testid="pembelajaran-bottom-nav"]').exists()).toBe(true),
  )
  return wrapper
}

beforeEach(() => {
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

describe('PembelajaranLayout: reward pills (FR-MUR-SH-11)', () => {
  it('gives a student two 44px links: coin to /gamification, streak to /profile', async () => {
    const w = await open(STUDENT, '/dashboard')
    const coin = w.get('[data-testid="pembelajaran-chip-coin"]')
    const streak = w.get('[data-testid="pembelajaran-chip-streak"]')
    expect(coin.element.tagName).toBe('A')
    expect(coin.attributes('href')).toBe('/gamification')
    expect(coin.classes()).toContain('min-h-11')
    expect(coin.text()).toContain('koin')
    expect(streak.element.tagName).toBe('A')
    expect(streak.attributes('href')).toBe('/profile')
    expect(streak.classes()).toContain('min-h-11')
    expect(streak.text()).toContain('hari 🔥')
  })

  it('gives a teacher no pill links', async () => {
    const w = await open(TEACHER, '/guru')
    expect(w.find('[data-testid="pembelajaran-chip-coin"]').exists()).toBe(false)
    expect(w.find('[data-testid="pembelajaran-chip-streak"]').exists()).toBe(false)
    expect(w.find('[data-ds="reward-chip"]').exists()).toBe(false)
  })
})

describe('PembelajaranLayout: notification bell (BUG-I1, v2-shells 5.1)', () => {
  it('links to /notifikasi with a 44px target and a count badge that caps at 99+', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    const w = await open(STUDENT, '/dashboard')
    const bell = w.get('[data-testid="shell-user-bell"]')
    expect(bell.element.tagName).toBe('A')
    expect(bell.attributes('href')).toBe('/notifikasi')
    expect(bell.classes()).toContain('size-11')
    await useNotificationBadgeStore().refresh() // settle the router's own refresh first
    useNotificationBadgeStore().set(12)
    await vi.waitFor(() =>
      expect(w.get('[data-testid="shell-user-bell-badge"]').text()).toBe('12'),
    )
    expect(bell.attributes('aria-label')).toBe('Notifikasi, 12 belum dibaca')
    useNotificationBadgeStore().set(150)
    await vi.waitFor(() =>
      expect(w.get('[data-testid="shell-user-bell-badge"]').text()).toBe('99+'),
    )
  })

  it('is absent while the prototype scope hides /notifikasi', async () => {
    const w = await open(STUDENT, '/dashboard')
    expect(w.find('[data-testid="shell-user-bell"]').exists()).toBe(false)
  })
})
