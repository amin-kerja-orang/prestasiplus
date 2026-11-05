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
import { statusTone } from '../admin/server-status'
import { setUnauthorizedRedirect, type UserMe } from '@/stores'

// These specs cover the legacy shell component itself (still the frame of parent, sponsor and PPD).
// The real layouts.ts frames the student / teacher / admin fixtures in the v2 layouts, so force the
// legacy choice here.
vi.mock('@/app/router/layouts', async (importOriginal) =>
  (await import('@/app/__tests__/legacy-shells')).legacyLayoutsModule(importOriginal),
)

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

const BOTH = ['admin', 'teacher'] as const

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-admin-shell-test',
    routes: [
      { path: '/admin', component: page('home'), meta: { layout: 'admin', roles: ['admin'] } },
      {
        path: '/admin/questions/import',
        component: page('import'),
        meta: {
          layout: 'admin',
          roles: ['admin'],
          header: { title: 'Import Soalan', subtitle: 'Muat naik CSV' },
        },
      },
      {
        path: '/admin/users',
        component: page('users'),
        meta: { layout: 'admin', roles: ['admin'], header: { title: 'Pengguna' } },
      },
      {
        path: '/admin/laporan',
        component: page('laporan'),
        meta: { layout: 'admin', roles: ['admin'] },
      },
      {
        path: '/admin/no-header',
        component: page('no-header'),
        meta: { layout: 'admin', roles: ['admin'] },
      },
      {
        path: '/admin/dynamic',
        component: page('dynamic', () =>
          usePageMeta().setHeader({ title: 'Tajuk Dinamik', subtitle: 'Sub dinamik' }),
        ),
        meta: { layout: 'admin', roles: ['admin'], header: { title: 'Statik' } },
      },
      {
        path: '/guru/monitoring',
        component: page('monitoring'),
        meta: { layout: 'admin', roles: BOTH, header: { title: 'Monitoring Penglibatan' } },
      },
      {
        path: '/guru/kirkpatrick',
        component: page('kirkpatrick'),
        meta: { layout: 'admin', roles: BOTH, header: { title: 'Kirkpatrick' } },
      },
      {
        path: '/guru/kirkpatrick/pelajar/:id',
        component: page('kirk-pupil'),
        meta: { layout: 'admin', roles: BOTH, header: { title: 'Pelajar' } },
      },
      {
        path: '/guru/laporan',
        component: page('guru-laporan'),
        meta: { layout: 'user', roles: ['teacher'] },
      },
      { path: '/tetapan', component: page('tetapan'), meta: { layout: 'role' } },
      { path: '/dashboard', component: page('dashboard'), meta: { layout: 'user' } },
    ],
  },
]

// The router loads the admin shell lazily (layouts.ts); preload it so mounting resolves at once.
beforeAll(async () => {
  await import('../admin/AdminShell.vue')
})

const STATUS = {
  cpuPct: 6,
  ramPct: 52,
  diskPct: 50,
  uptime: '204d 2h',
  load: 0.15,
  cores: 8,
  ramUsedGb: 16.2,
  ramTotalGb: 31.1,
  diskUsedGb: 199.3,
  diskTotalGb: 398.7,
}

let pinia: Pinia
let router: Router
let wrapper: VueWrapper | null = null
let transport: ReturnType<typeof fakeTransport>
let status: Record<string, unknown> | null = STATUS

async function open(path: string, user: UserMe = ADMIN): Promise<VueWrapper> {
  logIn(user)
  router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  // `shellComponents.admin` is an async component: let its (preloaded) module resolve.
  await flushPromises()
  return wrapper
}

const sidebar = (w: VueWrapper) => w.get('[data-testid="shell-admin-sidebar"]')
const bottom = (w: VueWrapper) => w.get('[data-testid="shell-admin-bottom-nav"]')
const lagi = (w: VueWrapper) => w.get('[data-testid="shell-admin-lagi"]')
const visible = (el: ReturnType<VueWrapper['get']>): boolean =>
  (el.element as HTMLElement).style.display !== 'none'
const isOpen = (w: VueWrapper) => visible(lagi(w))
const labelsOf = (el: ReturnType<VueWrapper['get']>) =>
  el.findAll('a[data-nav-id]').map((a) => a.text().replace(/\s+/g, ' ').trim())
const activeIds = (el: ReturnType<VueWrapper['get']>) =>
  el.findAll('a.active[data-nav-id]').map((a) => a.attributes('data-nav-id'))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date', 'setInterval', 'clearInterval'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  status = STATUS
  transport = fakeTransport((req) => {
    if (req.url === '/api/admin/server-status') {
      return status ? { body: { data: status } } : { status: 500, body: null }
    }
    return {}
  })
  installTransport(transport)
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

describe('AdminShell: structure and breakpoints (< lg / ≥ lg)', () => {
  it('renders in the admin layout with sidebar ≥ lg only, bottom nav and footer < lg only', async () => {
    const w = await open('/admin')
    expect(w.find('[data-layout="admin"]').exists()).toBe(true)
    // Tailwind `hidden lg:block`: not rendered below 1024.
    expect(sidebar(w).classes()).toEqual(expect.arrayContaining(['hidden', 'lg:block', 'w-64']))
    expect(bottom(w).classes()).toContain('lg:hidden')
    expect(w.get('[data-testid="shell-admin-footer"]').classes()).toContain('lg:hidden')
    expect(w.get('[data-testid="shell-admin-footer"]').text()).toContain(
      '© 2026 PRESTASIPLUS. Hakcipta Terpelihara.',
    )
    expect(w.get('[data-testid="shell-admin-footer"]').text()).toContain(
      'Didikan penuh ❤️ dari Malaysia 🇲🇾',
    )
    // Below lg the header carries the logo only: avatar, pill and logout are ≥ lg.
    expect(w.get('[data-testid="shell-admin-header-logo"]').classes()).toContain('lg:hidden')
    expect(
      w.get('[data-testid="shell-admin-header-avatar"]').element.parentElement?.className,
    ).toContain('hidden')
    // No search and no bell in the admin header (live omission).
    const header = w.get('[data-testid="shell-admin-header"]')
    expect(header.find('input[type="search"]').exists()).toBe(false)
    expect(header.find('[data-testid="shell-user-bell"]').exists()).toBe(false)
  })

  it('the main column is offset by the sidebar (lg:ml-64) and clears the bottom nav', async () => {
    const w = await open('/admin')
    const column = w.get('[data-testid="shell-admin-main"]').element.parentElement!
    expect(column.className).toContain('lg:ml-64')
    expect(column.className).toContain('pb-[calc(45px+env(safe-area-inset-bottom)+16px)]')
    expect(column.className).toContain('lg:pb-0')
  })

})

describe('AdminShell: menu per role', () => {

  it('teacher on /guru/monitoring: teacher menu in the admin chrome, no admin item in the DOM', async () => {
    const w = await open('/guru/monitoring', TEACHER)
    expect(w.find('[data-layout="admin"]').exists()).toBe(true)
    expect(w.get('[data-testid="shell-admin-caption"]').text()).toBe('Portal Guru')
    expect(w.get('[data-testid="shell-admin-sidebar-logo"]').attributes('href')).toBe('/guru')
    expect(w.get('[data-testid="shell-admin-header-logo"]').attributes('href')).toBe('/guru')
    expect(w.get('[data-testid="shell-admin-user-block"]').text()).toContain('Guru')

    const html = w.html()
    for (const adminOnly of [
      'Panel Pentadbir',
      'Laporan Eksekutif',
      'Ke Dashboard',
      'Student View',
      'Aktiviti Harian',
      'data-nav-id="ke-dashboard"',
      'href="/admin/',
    ]) {
      // "Gambar Rajah" (teacher menu, open item) is the only /admin/ route of the teacher list.
      if (adminOnly === 'href="/admin/') {
        const hrefs = [...html.matchAll(/href="(\/admin\/[^"]*)"/g)].map((m) => m[1])
        expect([...new Set(hrefs)]).toEqual(['/admin/soalan-gambar'])
      } else {
        expect(html, adminOnly).not.toContain(adminOnly)
      }
    }
    // Teacher menu, its own order; the pinned card is the teacher's Command Center.
    const labels = labelsOf(sidebar(w))
    expect(labels[0]).toBe('Command CenterLIVE')
    expect(labels).toContain('Dashboard Guru')
    expect(labels).toContain('Monitoring')
    expect(sidebar(w).get('[data-nav-id="t-command-center"]').attributes('href')).toBe(
      '/guru/command-center',
    )
    // No footer links for the teacher.
    expect(w.find('[data-testid="shell-admin-footer-links"]').exists()).toBe(false)
  })

  it('teacher: no server-status pill and no request to /api/admin/server-status', async () => {
    const w = await open('/guru/monitoring', TEACHER)
    await vi.advanceTimersByTimeAsync(31_000)
    await flushPromises()
    expect(w.find('[data-testid="admin-server-status"]').exists()).toBe(false)
    expect(transport.requests.filter((r) => r.url.includes('server-status'))).toEqual([])
  })

  it('teacher: bottom nav is Guru, Kelas, Monitoring, Kirkpatrick, Lagi', async () => {
    const w = await open('/guru/monitoring', TEACHER)
    expect(
      bottom(w)
        .findAll('a, button')
        .map((c) => c.text()),
    ).toEqual(['Guru', 'Kelas', 'Monitoring', 'Kirkpatrick', 'Lagi'])
    expect(bottom(w).get('[data-nav-id="bottom-monitoring"]').classes()).toContain('active')
    expect(bottom(w).findAll('.active')).toHaveLength(1)
  })


  it('/tetapan for the admin renders the admin shell; for a student the user shell is used', async () => {
    const w = await open('/tetapan')
    expect(w.find('[data-layout="admin"]').exists()).toBe(true)
    expect(activeIds(sidebar(w))).toEqual(['tetapan-peribadi'])
  })
})

describe('AdminShell: collapsible groups', () => {
  const group = (w: VueWrapper, key: string) => sidebar(w).get(`[data-group-key="${key}"]`)
  const shown = (w: VueWrapper, key: string) => visible(group(w, key).get(':scope > div'))





  it('a pupil page of Kirkpatrick opens the group although no item is active (teacher)', async () => {
    const w = await open('/guru/kirkpatrick/pelajar/8', TEACHER)
    expect(activeIds(sidebar(w))).toEqual([])
    expect(shown(w, 'kirkpatrick')).toBe(true)
    expect(bottom(w).get('[data-nav-id="bottom-kirkpatrick"]').classes()).toContain('active')
  })
})

describe('AdminShell: "Lagi" popover', () => {
  it('is closed at first, opens from "Lagi" and closes on a second tap', async () => {
    const w = await open('/admin')
    expect(isOpen(w)).toBe(false)
    await w.get('[data-nav-id="bottom-lagi"]').trigger('click')
    expect(isOpen(w)).toBe(true)
    // The "Lagi" cell shows the active colour while the popover is open.
    expect(w.get('[data-nav-id="bottom-lagi"]').classes()).toContain('text-indigo-600')
    await w.get('[data-nav-id="bottom-lagi"]').trigger('click')
    expect(isOpen(w)).toBe(false)
  })

  it('closes by a tap outside, not by a tap inside it', async () => {
    const w = await open('/admin')
    await w.get('[data-nav-id="bottom-lagi"]').trigger('click')
    await lagi(w).get('p').trigger('click')
    expect(isOpen(w)).toBe(true)
    await w.get('[data-testid="shell-admin-main"]').trigger('click')
    expect(isOpen(w)).toBe(false)
  })

  it('closes when a link is followed (route change)', async () => {
    const w = await open('/admin')
    await w.get('[data-nav-id="bottom-lagi"]').trigger('click')
    expect(isOpen(w)).toBe(true)
    await router.push('/admin/users')
    await flushPromises()
    expect(isOpen(w)).toBe(false)
  })


  it('every row is at least 44px high (DV-SH-11) and the list scrolls inside the panel', async () => {
    const w = await open('/admin')
    for (const row of lagi(w).findAll('a')) {
      expect(row.classes(), row.text()).toEqual(expect.arrayContaining(['min-h-11', 'py-3']))
    }
    expect(lagi(w).classes()).toEqual(
      expect.arrayContaining([
        'fixed',
        'right-4',
        'w-56',
        'max-h-[70vh]',
        'overflow-y-auto',
        'overscroll-contain',
        'rounded-2xl',
        'shadow-xl',
        'lg:hidden',
      ]),
    )
    expect(lagi(w).classes()).toContain('bottom-[calc(45px+env(safe-area-inset-bottom)+8px)]')
  })


  it('teacher: the teacher list without Command Center or bottom-nav entries, ends "Log Keluar"', async () => {
    const w = await open('/guru/monitoring', TEACHER)
    const rows = lagi(w)
      .findAll('a')
      .map((a) => a.text())
    expect(rows).not.toContain('Command Center')
    expect(rows).not.toContain('Dashboard Guru')
    expect(rows).not.toContain('Kelas Saya')
    expect(rows).not.toContain('Monitoring')
    expect(rows).not.toContain('Student View')
    expect(rows).toContain('Headcount')
    expect(rows.at(-1)).toBe('Log Keluar')
    expect(lagi(w).find('a[href="/logout"]').exists()).toBe(true)
  })
})

describe('AdminShell: header', () => {
  const title = (w: VueWrapper) => w.get('[data-testid="shell-admin-title"]').text()
  const subtitle = (w: VueWrapper) => w.find('[data-testid="shell-admin-subtitle"]')

  it('takes the title and subtitle from the route meta (DV-SH-03)', async () => {
    const w = await open('/admin/questions/import')
    expect(title(w)).toBe('Import Soalan')
    expect(subtitle(w).text()).toBe('Muat naik CSV')
  })

  it('renders the title only when the screen has no subtitle', async () => {
    const w = await open('/admin/users')
    expect(title(w)).toBe('Pengguna')
    expect(subtitle(w).exists()).toBe(false)
  })

  it('prefers the page header set with usePageMeta', async () => {
    const w = await open('/admin/dynamic')
    expect(title(w)).toBe('Tajuk Dinamik')
    expect(subtitle(w).text()).toBe('Sub dinamik')
  })

  it('falls back to the live default "Dashboard" / "Selamat datang, Admin"', async () => {
    const w = await open('/admin/no-header')
    expect(title(w)).toBe('Dashboard')
    expect(subtitle(w).text()).toBe('Selamat datang, Admin')
  })

  it('the title is a single truncating line', async () => {
    const w = await open('/admin/users')
    expect(w.get('[data-testid="shell-admin-title"]').classes()).toContain('truncate')
    expect(w.get('h1').element.parentElement?.className).toContain('min-w-0')
  })

  it('the logout icon is a plain link to /logout with title "Log Keluar"', async () => {
    const w = await open('/admin')
    const link = w.get('[data-testid="shell-admin-header-logout"]')
    expect(link.attributes('href')).toBe('/logout')
    expect(link.attributes('title')).toBe('Log Keluar')
  })
})

describe('server-status thresholds (design-system §5)', () => {
  it('CPU 50/80, RAM 60/85, Disk 75/90, strictly greater than', () => {
    expect(['cpu', 'ram', 'disk'].map((m) => statusTone(m as 'cpu', 0))).toEqual(['ok', 'ok', 'ok'])
    expect([50, 51, 80, 81].map((v) => statusTone('cpu', v))).toEqual(['ok', 'warn', 'warn', 'bad'])
    expect([60, 61, 85, 86].map((v) => statusTone('ram', v))).toEqual(['ok', 'warn', 'warn', 'bad'])
    expect([75, 76, 90, 91].map((v) => statusTone('disk', v))).toEqual([
      'ok',
      'warn',
      'warn',
      'bad',
    ])
  })
})
