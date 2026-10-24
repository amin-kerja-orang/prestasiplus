// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, type Router } from 'vue-router'

import { api, installTransport } from '@/api'
import type { ModuleManifest } from '@/app/modules'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { ADMIN, fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { usePageMeta } from '@/composables/usePageMeta'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect, SIDEBAR_OPEN_STORAGE_KEY, type UserMe } from '@/stores'

const TEACHER: UserMe = { ...STUDENT, id: 5, name: 'Guru Demo', role: 'teacher', grade: null }

function page(testId: string, onSetup?: () => void) {
  return defineComponent({
    name: `Page_${testId}`,
    setup: () => {
      onSetup?.()
      return () => h('p', { 'data-testid': testId }, testId)
    },
  })
}

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-shell-test',
    routes: [
      {
        path: '/dashboard',
        component: page('dashboard'),
        meta: {
          layout: 'user',
          header: { title: 'Dashboard', subtitle: 'Selamat datang kembali' },
        },
      },
      {
        path: '/peta-belajar',
        component: page('peta'),
        meta: { layout: 'user', header: { title: 'Peta Belajar' } },
      },
      { path: '/no-header', component: page('no-header'), meta: { layout: 'user' } },
      {
        path: '/dynamic',
        component: page('dynamic', () =>
          usePageMeta().setHeader({ title: 'Tajuk Dinamik', subtitle: 'Sub dinamik' }),
        ),
        meta: { layout: 'user', header: { title: 'Statik' } },
      },
      { path: '/spm/latih-tubi', component: page('spm'), meta: { layout: 'user' } },
    ],
  },
]

// The router loads the user shell lazily (layouts.ts); preload it so mounting resolves at once.
beforeAll(async () => {
  await import('../user/UserShell.vue')
})

let pinia: Pinia
let router: Router
let wrapper: VueWrapper | null = null
let unread = 0
let summary = { coins: 256, points: 8, streakDays: 1 }

async function open(path: string, user: UserMe = STUDENT): Promise<VueWrapper> {
  logIn(user)
  router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  // `shellComponents.user` is an async component: let its (preloaded) module resolve.
  await flushPromises()
  return wrapper
}

const sidebar = (w: VueWrapper) => w.get('[data-testid="shell-user-sidebar"]')
const drawer = (w: VueWrapper) => w.get('[data-testid="shell-user-drawer"]')
const navLabels = (el: ReturnType<VueWrapper['get']>) =>
  el.findAll('a[data-nav-id]').map((a) => a.text().replace(/\s+/g, ' ').trim())

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date', 'setInterval', 'clearInterval'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  unread = 0
  summary = { coins: 256, points: 8, streakDays: 1 }
  installTransport(
    fakeTransport((req) => {
      if (req.url === '/api/me/gamification-summary') return { body: { data: summary } }
      if (req.url === '/api/me/notifications/unread-count')
        return { body: { data: { count: unread } } }
      return {}
    }),
  )
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
})

describe('UserShell: menu per role (hidden, not disabled)', () => {
  it('student: live murid items, no admin/teacher items, account links', async () => {
    const w = await open('/dashboard')
    const labels = navLabels(sidebar(w))
    expect(labels.slice(0, 4)).toEqual(['Dashboard', 'Target SPM', 'Misi Harian', 'Remedial'])
    expect(labels).toContain('Latih Tubi')
    expect(labels).toContain('Tetapan Peribadi')
    expect(labels).toContain('Profil Saya')
    expect(labels).not.toContain('Ke Panel Admin')
    expect(labels.some((l) => l.startsWith('Command Center'))).toBe(false)
    expect(w.find('[data-nav-id="ke-admin-panel"]').exists()).toBe(false)
    // User card (FR-M01-52) and logout (FR-M01-36).
    const card = w.get('[data-testid="shell-user-sidebar-card"]')
    expect(card.text()).toContain('Pelajar Demo')
    expect(card.text()).toContain('pelajar@demo.test')
    expect(card.get('img').attributes('alt')).toBe('Avatar')
    expect(w.get('[data-testid="shell-user-sidebar-logout"]').attributes('href')).toBe('/logout')
  })

  it('admin: admin-only entries and the static sidebar counts', async () => {
    const w = await open('/dashboard', ADMIN)
    const side = sidebar(w)
    expect(side.get('[data-nav-id="ke-admin-panel"]').attributes('href')).toBe('/admin')
    expect(side.get('[data-nav-id="gambar-rajah"]').text()).toContain('6,144')
    expect(side.get('[data-nav-id="urus-tiket"]').text()).toContain('2')
  })

  it('teacher: teacher block and Command Center card, no student menu', async () => {
    const w = await open('/dashboard', TEACHER)
    const labels = navLabels(sidebar(w))
    expect(labels).toContain('Laporan Mingguan')
    expect(labels).not.toContain('Target SPM')
    const cc = sidebar(w).get('[data-nav-id="t-command-center"]')
    expect(cc.attributes('target')).toBe('_blank')
    expect(cc.text()).toContain('LIVE')
  })

  it('drawer renders the same menu plus its account section (DV-SH-04, DV-01)', async () => {
    const w = await open('/dashboard')
    const d = drawer(w)
    const side = navLabels(sidebar(w)).filter(
      (l) => !['Profil Saya', 'Panduan', 'Target SPM', 'Misi Harian', 'Remedial'].includes(l),
    )
    const menu = navLabels(d).slice(0, side.length)
    expect(menu).toEqual(side)
    expect(d.get('[data-nav-id="drawer-tetapan"]').attributes('href')).toBe('/tetapan')
    expect(d.get('[data-testid="shell-user-drawer-logout"]').attributes('href')).toBe('/logout')
    expect(d.get('[data-testid="shell-user-drawer-card"]').text()).toContain('student')
  })

  it('marks the active item (sub-paths included) on every surface', async () => {
    const w = await open('/spm/latih-tubi')
    expect(sidebar(w).get('[data-nav-id="spm"]').classes()).toContain('active')
    expect(drawer(w).get('[data-nav-id="spm"]').classes()).toContain('active')
    expect(w.get('[data-nav-id="bottom-spm"]').classes()).toContain('active')
    expect(sidebar(w).get('[data-nav-id="dashboard"]').classes()).not.toContain('active')
  })
})

describe('UserShell: badges', () => {
  it('menu pills keep their live classes (10px sidebar, 9px drawer)', async () => {
    const w = await open('/dashboard')
    const pill = (root: ReturnType<VueWrapper['get']>) =>
      root.get('[data-nav-id="spm"]').findAll('span').at(-1)!
    expect(pill(sidebar(w)).text()).toBe('SPM')
    expect(pill(sidebar(w)).classes()).toContain('text-[10px]')
    expect(pill(drawer(w)).classes()).toContain('text-[9px]')
    expect(sidebar(w).get('[data-nav-id="pksk"]').text()).toContain('PRO')
    expect(sidebar(w).get('[data-nav-id="cikgu-alesa-chat"]').text()).toContain('AI')
    expect(sidebar(w).text()).toContain('NEW')
  })

  it('bell: hidden at 0, the count, then "99+" after the 60 s refresh', async () => {
    unread = 0
    const w = await open('/dashboard')
    const bell = w.get('[data-testid="shell-user-bell"]')
    expect(bell.attributes('href')).toBe('/notifikasi')
    expect(bell.attributes('title')).toBe('Notifikasi')
    expect(w.find('[data-testid="shell-user-bell-badge"]').exists()).toBe(false)

    unread = 7
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(w.get('[data-testid="shell-user-bell-badge"]').text()).toBe('7')

    unread = 150
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(w.get('[data-testid="shell-user-bell-badge"]').text()).toBe('99+')
  })

  it('bell: a pp:notification-push event refreshes the badge at once (FR-M01-53)', async () => {
    unread = 0
    const w = await open('/dashboard')
    expect(w.find('[data-testid="shell-user-bell-badge"]').exists()).toBe(false)
    unread = 3
    window.dispatchEvent(new CustomEvent('pp:notification-push', { detail: { userId: 2 } }))
    await flushPromises()
    expect(w.get('[data-testid="shell-user-bell-badge"]').text()).toBe('3')

    // After unmount the listener is gone: a push causes no unread-count request.
    let calls = 0
    installTransport(
      fakeTransport((req) => {
        if (req.url === '/api/me/notifications/unread-count') calls += 1
        return {}
      }),
    )
    wrapper?.unmount()
    wrapper = null
    window.dispatchEvent(new CustomEvent('pp:notification-push', { detail: { userId: 2 } }))
    await flushPromises()
    expect(calls).toBe(0)
  })
})

describe('UserShell: drawer', () => {
  it('opens from the hamburger and "Lagi"; closes by ✕, overlay, Escape and navigation', async () => {
    const w = await open('/dashboard')
    const isOpen = () => drawer(w).classes().includes('open')
    expect(isOpen()).toBe(false)

    await w.get('[data-testid="shell-user-hamburger"]').trigger('click')
    expect(isOpen()).toBe(true)
    expect(w.get('[data-testid="shell-user-drawer-overlay"]').classes()).toContain('open')
    await w.get('[data-testid="shell-user-drawer-close"]').trigger('click')
    expect(isOpen()).toBe(false)

    await w.get('[data-nav-id="bottom-lagi"]').trigger('click')
    expect(isOpen()).toBe(true)
    await w.get('[data-testid="shell-user-drawer-overlay"]').trigger('click')
    expect(isOpen()).toBe(false)

    window.dispatchEvent(new CustomEvent('toggle-drawer'))
    await flushPromises()
    expect(isOpen()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(isOpen()).toBe(false)

    await w.get('[data-testid="shell-user-hamburger"]').trigger('click')
    await router.push('/no-header')
    await flushPromises()
    expect(isOpen()).toBe(false)
  })

  it('"Chat" dispatches the live toggle-chatbot event and does not open the drawer', async () => {
    const w = await open('/dashboard')
    const listener = vi.fn()
    window.addEventListener('toggle-chatbot', listener)
    await w.get('[data-nav-id="bottom-chat"]').trigger('click')
    window.removeEventListener('toggle-chatbot', listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(drawer(w).classes()).not.toContain('open')
  })
})

describe('UserShell: header', () => {
  const title = (w: VueWrapper) => w.get('[data-testid="shell-user-title"]').text()
  const subtitle = (w: VueWrapper) => w.find('[data-testid="shell-user-subtitle"]')
  /** The chip texts (value and label spans), joined with single spaces. */
  const spans = (w: VueWrapper, testId: string) =>
    w
      .get(`[data-testid="${testId}"]`)
      .findAll('span')
      .map((s) => s.text())
      .join(' ')

  it('takes the title and subtitle from the route meta (DV-SH-03)', async () => {
    const w = await open('/peta-belajar')
    expect(title(w)).toBe('Peta Belajar')
    expect(subtitle(w).exists()).toBe(false)
  })

  it('prefers the page header set with usePageMeta', async () => {
    const w = await open('/dynamic')
    expect(title(w)).toBe('Tajuk Dinamik')
    expect(subtitle(w).text()).toBe('Sub dinamik')
  })

  it('falls back to the live default "Dashboard" / "Selamat datang kembali"', async () => {
    const w = await open('/no-header')
    expect(title(w)).toBe('Dashboard')
    expect(subtitle(w).text()).toBe('Selamat datang kembali')
  })

  it('chips show koin / mata / streak from gamification-summary (student)', async () => {
    const w = await open('/dashboard')
    expect(spans(w, 'shell-user-chips')).toBe('256 koin 8 mata 1 hari 🔥')
    expect(spans(w, 'shell-user-chips-strip')).toBe('256 koin 8 mata 1 🔥')
  })

  it('teacher gets the single "syiling" chip and no mobile strip', async () => {
    summary = { coins: 0, points: 0, streakDays: 0 }
    const w = await open('/dashboard', TEACHER)
    expect(spans(w, 'shell-user-chips')).toBe('0 syiling')
    expect(w.find('[data-testid="shell-user-chips-strip"]').exists()).toBe(false)
  })

  it('the sidebar toggle collapses the sidebar and persists sidebarOpen', async () => {
    const w = await open('/dashboard')
    expect(sidebar(w).classes()).toContain('translate-x-0')
    await w.get('[data-testid="shell-user-sidebar-toggle"]').trigger('click')
    expect(sidebar(w).classes()).toContain('-translate-x-64')
    expect(localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)).toBe('false')
  })
})
