// @vitest-environment jsdom
/**
 * M27 S0 component tests (SRS M27 v1.3 FR-M27-03, 12…25, 28, 30…37; AC-M27-02, 03, 04, 05, 06, 10, 11) against
 * a mocked client: exact BM copy, structure, links, optional chips, empty and no-data states, the 403 and error
 * states. Figures from the owners are covered by the handler tests and the E2E smoke.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import UProgress from '@nuxt/ui/components/Progress.vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { SchoolDashboard } from '../../api/dashboard'
import SchoolDashboardPage from '../../pages/SchoolDashboardPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchSchoolDashboard: vi.fn() }))
vi.mock('../../api/dashboard', async (importActual) => ({
  ...(await importActual<typeof import('../../api/dashboard')>()),
  fetchSchoolDashboard: api.fetchSchoolDashboard,
}))

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']

function dashboard(over: Partial<SchoolDashboard> = {}): SchoolDashboard {
  return {
    school: {
      id: 1,
      name: 'SMK Contoh Ujian',
      state: 'Selangor',
      ppd: 'PPD CONTOH',
      code: 'UJI0001',
    },
    roleLabel: 'Admin Sekolah',
    perutusan: [
      {
        id: 4,
        title: 'Tajuk Perutusan Ujian',
        createdAt: '2026-03-20T10:00:00+08:00',
        author: { initials: 'AD', roleLabel: 'Pengetua' },
      },
    ],
    cards: {
      pupils: 1234,
      teachers: 9,
      activeClasses: 12,
      subscription: { status: 'none', label: 'Belum Ada' },
    },
    performance: {
      gps: { value: 3.17, grade: 'B+', band: 'Baik', entries: 211 },
      risk: { safe: 7, watch: 5, high: 2, total: 14 },
      practice: { accuracy: 61.4, sessions: 57, questions: 803 },
      levels: [
        { code: 't4', name: 'Tingkatan 4', accuracy: 66.2 },
        { code: 't5', name: 'Tingkatan 5', accuracy: 71.8 },
      ],
      distribution: GRADES.map((grade, i) => ({ grade, count: i * 10, pct: i })),
      total: 450,
    },
    ...over,
  }
}

async function mountPage(data: SchoolDashboard | ApiError): Promise<VueWrapper> {
  if (data instanceof ApiError) api.fetchSchoolDashboard.mockRejectedValue(data)
  else api.fetchSchoolDashboard.mockResolvedValue(data)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/admin-sekolah')
  await router.isReady()
  const wrapper = mount(SchoolDashboardPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  api.fetchSchoolDashboard.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('route (FR-M27-01, 03, 07, 10)', () => {
  it('declares S0 in the user shell for school_admin only, with the 403 outcome', () => {
    const s0 = routes.find((r) => r.path === '/admin-sekolah')
    expect(s0?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Papan Pemuka Sekolah - PRESTASIPLUS',
      header: { title: 'Papan Pemuka Sekolah' },
    })
  })

  it('defines no /admin-sekolah/pilih-sekolah route (it falls to the 404 page)', () => {
    const paths = routes.map((r) => r.path)
    expect(paths).toContain('/admin-sekolah')
    expect(paths).not.toContain('/admin-sekolah/pilih-sekolah')
  })
})

describe('header and Perutusan card (FR-M27-03, 12…17)', () => {
  it('sets the shell subtitle to the school name', async () => {
    await mountPage(dashboard())
    expect(usePageMeta().state.header).toEqual({
      title: 'Papan Pemuka Sekolah',
      subtitle: 'SMK Contoh Ujian',
    })
  })

  it('renders heading, link, and one plain-text row with initials, title and role · time', async () => {
    const w = await mountPage(dashboard())
    const card = w.get('[data-testid="sd-perutusan"]')
    expect(card.get('h2').text()).toBe('Perutusan Terkini')
    const all = w.get('[data-testid="sd-perutusan-all"]')
    expect(all.text()).toBe('Lihat semua →')
    expect(all.attributes('href')).toBe('/perutusan')
    expect(w.findAll('[data-testid="sd-perutusan-row"]')).toHaveLength(1)
    expect(text(w, 'sd-perutusan-initials')).toBe('AD')
    expect(text(w, 'sd-perutusan-title')).toBe('Tajuk Perutusan Ujian')
    expect(text(w, 'sd-perutusan-meta')).toBe('Pengetua · 6 bulan yang lepas')
    expect(w.find('[data-testid="sd-perutusan-row"] a').exists()).toBe(false)
  })

  it('hides the list but keeps the header with no posts, and shows no sentence', async () => {
    const w = await mountPage(dashboard({ perutusan: [] }))
    expect(has(w, 'sd-perutusan')).toBe(true)
    expect(has(w, 'sd-perutusan-rows')).toBe(false)
    expect(text(w, 'sd-perutusan')).toBe('Perutusan Terkini Lihat semua →')
  })
})

describe('breadcrumb and banner (FR-M27-18…21)', () => {
  it('renders "← Papan Pemuka" as a link to /dashboard and the bold current page as text', async () => {
    const w = await mountPage(dashboard())
    const back = w.get('[data-testid="sd-breadcrumb"] a')
    expect(back.text()).toBe('Papan Pemuka')
    expect(back.attributes('href')).toBe('/dashboard')
    const current = w.get('[data-testid="sd-breadcrumb"] [aria-current="page"]')
    expect(current.text()).toBe('Papan Pemuka Sekolah')
    expect(current.element.tagName).not.toBe('A')
    expect(current.classes()).toContain('text-highlighted')
    // order: card, breadcrumb, banner
    const order = ['sd-perutusan', 'sd-breadcrumb', 'sd-banner'].map((id) =>
      w.html().indexOf(`data-testid="${id}"`),
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('prints the stored name, as stored, the role line and the three chips as text', async () => {
    const w = await mountPage(dashboard())
    const name = w.get('[data-testid="sd-banner-name"]')
    expect(name.text()).toBe('SMK Contoh Ujian')
    expect(text(w, 'sd-banner-role')).toBe('Admin Sekolah')
    expect(text(w, 'sd-chip-state')).toBe('Selangor')
    expect(text(w, 'sd-chip-ppd')).toBe('PPD CONTOH')
    expect(text(w, 'sd-chip-code')).toBe('# Kod: UJI0001')
    expect(w.find('[data-testid="sd-banner"] a').exists()).toBe(false)
  })

  it('omits the PPD and code chips when empty, with no placeholder', async () => {
    const w = await mountPage(
      dashboard({
        school: { id: 2, name: 'SK Contoh', state: 'Johor', ppd: null, code: null },
      }),
    )
    expect(text(w, 'sd-chips')).toBe('Johor')
    expect(has(w, 'sd-chip-ppd')).toBe(false)
    expect(has(w, 'sd-chip-code')).toBe(false)
  })
})

describe('summary cards (FR-M27-23, 24, 30)', () => {
  it('shows four cards in order with labels, ms-MY values; none is a link', async () => {
    const w = await mountPage(dashboard())
    const cards = w.findAll(
      '[data-testid^="sd-card-"][data-testid$="s"], [data-testid="sd-card-subscription"]',
    )
    expect(cards.length).toBeGreaterThanOrEqual(4)
    const labels = w.findAll('[data-testid="sd-card-label"]').map((e) => e.text())
    expect(labels).toEqual(['Jumlah Pelajar', 'Jumlah Guru', 'Kelas Aktif', 'Langganan'])
    expect(w.findAll('[data-testid="sd-card-value"]').map((e) => e.text())).toEqual([
      '1,234',
      '9',
      '12',
      'Belum Ada',
    ])
    expect(w.get('[data-testid="sd-cards"]').find('a').exists()).toBe(false)
  })

  it('shows "Belum Ada" and the subscription label (DV-M27-04)', async () => {
    const grey = await mountPage(dashboard())
    expect(grey.get('[data-testid="sd-card-subscription"]').text()).toContain('Belum Ada')
    const green = await mountPage(
      dashboard({
        cards: {
          pupils: 1,
          teachers: 1,
          activeClasses: 1,
          subscription: { status: 'grace', label: 'Tempoh Ihsan' },
        },
      }),
    )
    const card = green.get('[data-testid="sd-card-subscription"]')
    expect(card.text()).toContain('Tempoh Ihsan')
  })
})

describe('Ringkasan Prestasi (FR-M27-31…37)', () => {
  it('renders the head, the four panels and exact copy', async () => {
    const w = await mountPage(dashboard())
    expect(text(w, 'sd-performance-title')).toBe('Ringkasan Prestasi')
    expect(text(w, 'sd-performance-subtitle')).toBe(
      'GPS, risiko murid, ketepatan latihan & perbandingan tingkatan',
    )
    expect(text(w, 'sd-panel-gps')).toContain('GPS Sekolah')
    expect(text(w, 'sd-gps-value')).toBe('3.17')
    expect(text(w, 'sd-gps-grade')).toBe('B+ · Baik')
    expect(text(w, 'sd-gps-entries')).toBe('211 entri headcount')
    expect(text(w, 'sd-panel-risk')).toContain('Amaran Awal')
    expect(['sd-risk-safe', 'sd-risk-watch', 'sd-risk-high'].map((id) => text(w, id))).toEqual([
      '7',
      '5',
      '2',
    ])
    expect(text(w, 'sd-panel-risk')).toContain('Selamat')
    expect(text(w, 'sd-panel-risk')).toContain('Berhati')
    expect(text(w, 'sd-panel-risk')).toContain('Berisiko')
    expect(text(w, 'sd-risk-total')).toBe('14 murid dinilai')
    expect(text(w, 'sd-panel-practice')).toContain('Latihan')
    expect(text(w, 'sd-practice-accuracy')).toBe('61.4%')
    expect(text(w, 'sd-panel-practice')).toContain('Purata Ketepatan')
    expect(text(w, 'sd-practice-counts')).toBe('57 sesi · 803 soalan')
  })

  it('shows the Tingkatan panel as a link with coloured rows and "Klik untuk butiran"', async () => {
    const w = await mountPage(dashboard())
    const panel = w.get('[data-testid="sd-panel-levels"]')
    expect(panel.element.tagName).toBe('A')
    expect(panel.attributes('href')).toBe('/prestasi/tingkatan')
    const rows = w.findAll('[data-testid="sd-level-row"]')
    expect(rows.map((r) => r.get('span').text())).toEqual(['Tingkatan 4', 'Tingkatan 5'])
    expect(w.findAll('[data-testid="sd-level-pct"]').map((e) => e.text())).toEqual([
      '66.2%',
      '71.8%',
    ])
    expect(w.findAll('[data-testid="sd-level-pct"]')[0]?.classes()).toContain('text-warning')
    expect(panel.text()).toContain('Klik untuk butiran')
    expect(w.findAllComponents(UProgress)[0]?.props('modelValue')).toBe(66.2)
  })

  it.each([
    [49.9, 'text-error'],
    [50, 'text-warning'],
    [69.9, 'text-warning'],
    [70, 'text-success'],
  ])('colours a level at %s with %s', async (accuracy, cls) => {
    const base = dashboard()
    const w = await mountPage({
      ...base,
      performance: {
        ...base.performance,
        levels: [
          { code: 't4', name: 'Tingkatan 4', accuracy },
          { code: 't5', name: 'Tingkatan 5', accuracy: 0 },
        ],
      },
    })
    expect(w.findAll('[data-testid="sd-level-pct"]')[0]?.classes()).toContain(cls)
  })

  it('lists the ten grades with counts, percentages, the full link and the total', async () => {
    const w = await mountPage(dashboard())
    expect(text(w, 'sd-grades-heading')).toBe('Taburan Gred (Anggaran)')
    const full = w.get('[data-testid="sd-grades-full"]')
    expect(full.text()).toBe('Lihat penuh →')
    expect(full.attributes('href')).toBe('/prestasi/sekolah')
    // the grades are drawn by DsChart; its data table carries the letters, the counts and the percents
    const chart = text(w, 'sd-grades-chart')
    for (const g of GRADES) expect(chart).toContain(g)
    expect(chart).toContain('G (9.0%)')
    expect(chart).toContain('90')
    expect(text(w, 'sd-grades-total')).toBe('Jumlah: 450 rekod')
  })

  it('renders the no-data states (BR-M27-18)', async () => {
    const base = dashboard()
    const w = await mountPage({
      ...base,
      performance: {
        gps: { value: null, grade: null, band: null, entries: 0 },
        risk: { safe: 0, watch: 0, high: 0, total: 0 },
        practice: { accuracy: null, sessions: 0, questions: 0 },
        levels: base.performance.levels.map((l) => ({ ...l, accuracy: 0 })),
        distribution: GRADES.map((grade) => ({ grade, count: 0, pct: 0 })),
        total: 0,
      },
    })
    expect(text(w, 'sd-gps-value')).toBe('—')
    expect(has(w, 'sd-gps-grade')).toBe(false)
    expect(text(w, 'sd-gps-entries')).toBe('0 entri headcount')
    expect(['sd-risk-safe', 'sd-risk-watch', 'sd-risk-high'].map((id) => text(w, id))).toEqual([
      '0',
      '0',
      '0',
    ])
    expect(text(w, 'sd-risk-total')).toBe('0 murid dinilai')
    expect(text(w, 'sd-practice-accuracy')).toBe('—')
    expect(text(w, 'sd-practice-counts')).toBe('0 sesi · 0 soalan')
    expect(w.findAll('[data-testid="sd-level-row"]')).toHaveLength(2)
    for (const g of GRADES) expect(text(w, 'sd-grades-chart')).toContain(g)
    expect(text(w, 'sd-grades-total')).toBe('Jumlah: 0 rekod')
  })

  it('leaves the Amaran Awal panel out while M18 gives no risk (XR-M27-08)', async () => {
    const base = dashboard()
    const w = await mountPage({ ...base, performance: { ...base.performance, risk: null } })
    expect(has(w, 'sd-panel-risk')).toBe(false)
    expect(has(w, 'sd-panel-gps')).toBe(true)
  })
})

describe('states (FR-M27-28)', () => {
  it('shows the spinner only while loading', async () => {
    api.fetchSchoolDashboard.mockReturnValue(new Promise(() => undefined))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/')
    const w = mount(SchoolDashboardPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'sd-loading')).toBe(true)
    expect(has(w, 'sd-perutusan')).toBe(false)
    expect(w.text()).toBe('')
  })

  it('renders the global 403 outcome in place for a 403', async () => {
    const w = await mountPage(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Akses ditolak.',
        method: 'GET',
        url: '/api/admin-sekolah/dashboard',
      }),
    )
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'sd-error')).toBe(false)
    expect(has(w, 'sd-perutusan')).toBe(false)
  })

  it('shows the server message for another failure and no school data', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Ralat pelayan.',
        method: 'GET',
        url: '/api/admin-sekolah/dashboard',
      }),
    )
    expect(useRouteOutcome().value).toBeNull()
    expect(text(w, 'sd-error')).toContain('Ralat pelayan.')
    expect(has(w, 'sd-banner')).toBe(false)
  })
})
