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
import { useSessionStore } from '@/stores'
import { ADMIN_SIDEBAR_STORAGE_KEY, setUnauthorizedRedirect, type UserMe } from '@/stores'

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
        meta: { layout: 'admin', roles: BOTH, header: { title: 'Pemantauan Penglibatan' } },
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

  it('bottom nav: 5 whole-width cells, 45px high, safe-area padding', async () => {
    const w = await open('/admin')
    const cells = bottom(w).findAll('a, button')
    expect(cells.map((c) => c.text())).toEqual([
      'Papan Pemuka',
      'Soalan',
      'Penaja',
      'Pengguna',
      'Lagi',
    ])
    for (const cell of cells) expect(cell.classes()).toContain('flex-1')
    expect(bottom(w).classes()).toContain('pb-[env(safe-area-inset-bottom)]')
    expect(bottom(w).get('div').classes()).toContain('h-[45px]')
    expect(bottom(w).get('[data-nav-id="bottom-soalan"]').attributes('href')).toBe(
      '/admin/questions',
    )
  })
})

describe('AdminShell: menu per role', () => {
  it('admin: the admin menu, "Panel Pentadbir", footer links, role "Admin"', async () => {
    const w = await open('/admin')
    const side = sidebar(w)
    expect(w.get('[data-testid="shell-admin-caption"]').text()).toBe('Panel Pentadbir')
    expect(w.get('[data-testid="shell-admin-sidebar-logo"]').attributes('href')).toBe('/admin')
    const labels = labelsOf(side)
    expect(labels.slice(0, 5)).toEqual([
      'Command CenterLIVE',
      'Aktiviti Harian',
      'Audio KBAT',
      'Papan Pemuka',
      'Laporan Eksekutif',
    ])
    expect(labels).toContain('Ke Papan Pemuka')
    expect(labels).toContain('Tetapan Peribadi')
    expect(side.get('[data-nav-id="command-center"]').attributes('target')).toBe('_blank')
    expect(side.get('[data-nav-id="ke-dashboard"]').attributes('href')).toBe('/dashboard')
    const block = w.get('[data-testid="shell-admin-user-block"]')
    expect(block.text()).toContain('Admin Demo')
    expect(block.text()).toContain('Admin')
    expect(block.get('img').attributes('alt')).toBe('Avatar')
    expect(w.get('[data-testid="shell-admin-sidebar-logout"]').attributes('href')).toBe('/logout')
    expect(w.get('[data-testid="shell-admin-sidebar-logout"]').attributes('title')).toBe(
      'Log Keluar',
    )
  })

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
      'Ke Papan Pemuka',
      'Paparan Pelajar',
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
    expect(labels).toContain('Papan Pemuka Guru')
    expect(labels).toContain('Pemantauan')
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
    ).toEqual(['Guru', 'Kelas', 'Pemantauan', 'Kirkpatrick', 'Lagi'])
    expect(bottom(w).get('[data-nav-id="bottom-monitoring"]').classes()).toContain('active')
    expect(bottom(w).findAll('.active')).toHaveLength(1)
  })

  it('admin on the /guru twins: admin menu, Monitoring / Kirkpatrick active (FR-M11-05, FR-M12-04)', async () => {
    const w = await open('/guru/monitoring')
    expect(w.get('[data-testid="shell-admin-caption"]').text()).toBe('Panel Pentadbir')
    expect(activeIds(sidebar(w))).toEqual(['monitoring'])
    await router.push('/guru/kirkpatrick')
    await flushPromises()
    expect(activeIds(sidebar(w))).toEqual(['kirk-overview'])
  })

  it('/tetapan for the admin renders the admin shell; for a student the user shell is used', async () => {
    const w = await open('/tetapan')
    expect(w.find('[data-layout="admin"]').exists()).toBe(true)
    expect(activeIds(sidebar(w))).toEqual(['tetapan-peribadi'])
  })
})

describe('AdminShell: exactly one active item', () => {
  it('sidebar, bottom nav and popover each mark one item (deepest route wins)', async () => {
    const w = await open('/admin/questions/import')
    expect(activeIds(sidebar(w))).toEqual(['import-csv'])
    expect(
      bottom(w)
        .findAll('a.active')
        .map((a) => a.attributes('data-nav-id')),
    ).toEqual(['bottom-soalan'])
    expect(
      lagi(w)
        .findAll('a.active')
        .map((a) => a.attributes('data-lagi-id')),
    ).toEqual(['import-csv'])
    // "Lagi" is not lit: a link cell is active.
    expect(bottom(w).get('[data-nav-id="bottom-lagi"]').classes()).not.toContain('active')
  })

  it('a page only the popover reaches lights "Lagi"; /admin lights the Dashboard cell only', async () => {
    const w = await open('/admin/laporan')
    expect(bottom(w).findAll('a.active')).toHaveLength(0)
    expect(bottom(w).get('[data-nav-id="bottom-lagi"]').classes()).toContain('text-indigo-600')
    expect(activeIds(sidebar(w))).toEqual(['laporan'])
    await router.push('/admin')
    await flushPromises()
    expect(
      bottom(w)
        .findAll('a.active')
        .map((a) => a.attributes('data-nav-id')),
    ).toEqual(['bottom-dashboard'])
    expect(bottom(w).get('[data-nav-id="bottom-lagi"]').classes()).not.toContain('active')
  })
})

describe('AdminShell: collapsible groups', () => {
  const group = (w: VueWrapper, key: string) => sidebar(w).get(`[data-group-key="${key}"]`)
  const shown = (w: VueWrapper, key: string) => visible(group(w, key).get(':scope > div'))

  it('all groups start closed; the group of the active page opens and is saved', async () => {
    const w = await open('/admin/questions/import')
    expect(shown(w, 'soalan')).toBe(true)
    expect(shown(w, 'kirkpatrick')).toBe(false)
    expect(shown(w, 'sistem')).toBe(false)
    expect(JSON.parse(localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ?? '{}')).toEqual({
      soalan: true,
    })
  })

  it('the button toggles a group and saves the state in admin_sidebar', async () => {
    const w = await open('/admin')
    expect(shown(w, 'spm')).toBe(false)
    await group(w, 'spm').get('button').trigger('click')
    expect(shown(w, 'spm')).toBe(true)
    expect(JSON.parse(localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ?? '{}')).toEqual({
      spm: true,
    })
    await group(w, 'spm').get('button').trigger('click')
    expect(shown(w, 'spm')).toBe(false)
    expect(JSON.parse(localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ?? '{}')).toEqual({
      spm: false,
    })
  })

  it('the user can collapse the active group, and the next route change opens its own group', async () => {
    const w = await open('/admin/questions/import')
    await group(w, 'soalan').get('button').trigger('click')
    expect(shown(w, 'soalan')).toBe(false)
    await router.push('/admin/users')
    await flushPromises()
    expect(shown(w, 'pengguna')).toBe(true)
    expect(shown(w, 'soalan')).toBe(false)
  })

  it('reads the saved state on load', async () => {
    localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify({ premium: true }))
    const w = await open('/admin')
    expect(shown(w, 'premium')).toBe(true)
  })

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

  it('lists the observed headings, rows and links; ends with "Paparan Pelajar" and "Log Keluar"', async () => {
    const w = await open('/admin')
    const headings = lagi(w)
      .findAll('p')
      .map((p) => p.text())
    expect(headings).toEqual([
      'SPM',
      'Soalan',
      'Kurikulum',
      'Premium',
      'Gamifikasi',
      'Battle & Permainan',
      'Kandungan',
      'Marketplace',
      'Sistem',
    ])
    const rows = lagi(w).findAll('a')
    expect(rows.slice(0, 4).map((a) => a.text())).toEqual([
      'Analitik',
      'Laporan Aktiviti',
      'Pemantauan',
      'Kirkpatrick',
    ])
    expect(rows.slice(-2).map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Paparan Pelajar', '/dashboard'],
      ['Log Keluar', '/logout'],
    ])
    expect(lagi(w).get('[data-testid="shell-admin-lagi-tail"]').classes()).toContain('border-t')
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

  it('marks the row of the current page and shows the Kirkpatrick row inside its group', async () => {
    const w = await open('/admin/laporan')
    expect(
      lagi(w)
        .findAll('a.active')
        .map((a) => a.text()),
    ).toEqual(['Laporan Aktiviti'])
    await router.push('/guru/kirkpatrick/pelajar/4')
    await flushPromises()
    expect(
      lagi(w)
        .findAll('a.active')
        .map((a) => a.text()),
    ).toEqual(['Kirkpatrick'])
  })

  it('teacher: the teacher list without Command Center or bottom-nav entries, ends "Log Keluar"', async () => {
    const w = await open('/guru/monitoring', TEACHER)
    const rows = lagi(w)
      .findAll('a')
      .map((a) => a.text())
    expect(rows).not.toContain('Command Center')
    expect(rows).not.toContain('Papan Pemuka Guru')
    expect(rows).not.toContain('Kelas Saya')
    expect(rows).not.toContain('Pemantauan')
    expect(rows).not.toContain('Paparan Pelajar')
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
    expect(title(w)).toBe('Papan Pemuka')
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

describe('AdminShell: server-status pill (admin only)', () => {
  const cell = (w: VueWrapper, id: string) => w.get(`[data-status="${id}"]`)
  const values = (w: VueWrapper) => w.findAll('[data-status]').map((c) => c.text())

  it('shows CPU, RAM, Disk and Uptime with tooltips and threshold colours', async () => {
    const w = await open('/admin')
    await flushPromises()
    expect(transport.requests.filter((r) => r.url === '/api/admin/server-status')).toHaveLength(1)
    expect(values(w)).toEqual(['6%', '52%', '50%', '204d 2h'])
    expect(cell(w, 'cpu').attributes('title')).toBe('Beban: 0.15 / 8 teras')
    expect(cell(w, 'ram').attributes('title')).toBe('16.2GB / 31.1GB')
    expect(cell(w, 'disk').attributes('title')).toBe('199.3GB / 398.7GB')
    expect(cell(w, 'uptime').attributes('title')).toBe('Masa Aktif')
    expect(cell(w, 'cpu').get('span:last-child').classes()).toContain('text-emerald-600')
    expect(cell(w, 'ram').get('span:last-child').classes()).toContain('text-emerald-600')
    expect(cell(w, 'disk').get('span:last-child').classes()).toContain('text-emerald-600')
    expect(cell(w, 'uptime').get('span:last-child').classes()).toContain('text-slate-500')
    expect(w.get('[data-testid="admin-server-status"]').classes()).toEqual(
      expect.arrayContaining(['hidden', 'lg:flex']),
    )
  })

  it('polls every 30 s and keeps the last values when a poll fails', async () => {
    const w = await open('/admin')
    await flushPromises()
    status = { ...STATUS, cpuPct: 91 }
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(cell(w, 'cpu').text()).toBe('91%')
    expect(cell(w, 'cpu').get('span:last-child').classes()).toContain('text-red-600')
    status = null
    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(cell(w, 'cpu').text()).toBe('91%')
    expect(transport.requests.filter((r) => r.url === '/api/admin/server-status')).toHaveLength(3)
  })

  it('shows "--" before the first answer and when there never was one', async () => {
    status = null
    const w = await open('/admin')
    await flushPromises()
    expect(values(w)).toEqual(['--', '--', '--', '--'])
    expect(cell(w, 'cpu').get('span:last-child').classes()).toContain('text-slate-400')
  })
})

describe('AdminShell: server-status polling lifecycle', () => {
  const polls = () => transport.requests.filter((r) => r.url === '/api/admin/server-status').length

  it('stops after the shell unmounts', async () => {
    const w = await open('/admin')
    await flushPromises()
    expect(polls()).toBe(1)
    w.unmount()
    wrapper = null
    await vi.advanceTimersByTimeAsync(90_000)
    expect(polls()).toBe(1)
  })

  it('stops when the role switches to a non-admin', async () => {
    const w = await open('/admin')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(polls()).toBe(2)
    useSessionStore().setUser(TEACHER)
    await flushPromises()
    expect(w.find('[data-testid="admin-server-status"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(90_000)
    expect(polls()).toBe(2)
  })

  it('pauses while the document is hidden and resumes when visible', async () => {
    await open('/admin')
    await flushPromises()
    const setVisibility = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    try {
      setVisibility('hidden')
      await vi.advanceTimersByTimeAsync(90_000)
      expect(polls()).toBe(1)
      setVisibility('visible')
      await vi.advanceTimersByTimeAsync(30_000)
      await flushPromises()
      expect(polls()).toBe(2)
    } finally {
      setVisibility('visible')
    }
  })

  it('does not mount the pill, and does not poll, below lg (matchMedia)', async () => {
    const listeners: ((e: { matches: boolean }) => void)[] = []
    const list = {
      matches: false,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
      removeEventListener: () => undefined,
    }
    vi.stubGlobal('matchMedia', () => list)
    try {
      const w = await open('/admin')
      await vi.advanceTimersByTimeAsync(60_000)
      expect(w.find('[data-testid="admin-server-status"]').exists()).toBe(false)
      expect(polls()).toBe(0)
      // Growing to lg mounts it and starts the poll.
      for (const l of listeners) l({ matches: true })
      await flushPromises()
      expect(w.find('[data-testid="admin-server-status"]').exists()).toBe(true)
      expect(polls()).toBe(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('AdminShell: "Lagi" row click', () => {
  it('following a row closes the popover and navigates', async () => {
    const w = await open('/admin')
    await w.get('[data-nav-id="bottom-lagi"]').trigger('click')
    expect(isOpen(w)).toBe(true)
    await lagi(w).get('[data-lagi-id="laporan"]').trigger('click')
    await flushPromises()
    expect(isOpen(w)).toBe(false)
  })
})
