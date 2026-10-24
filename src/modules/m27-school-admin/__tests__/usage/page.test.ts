// @vitest-environment jsdom
/**
 * M27 S1 component tests (SRS M27 Part B FR-M27-44, 51…57; AC-M27-13.1, 13.4, 15.1…15.4, 16.1…16.4) against a
 * mocked client: exact BM copy, tile order and sub-lines, period handling, mode card, empty cards, footnote,
 * breadcrumb, 403 and error states. Figures from the owners are covered by the handler tests and the E2E.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { SchoolUsage } from '../../api/school-admin'
import { normalisePeriod } from '../../components/usage/usage-format'
import StatistikPenggunaanPage from '../../pages/StatistikPenggunaanPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchSchoolUsage: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  fetchSchoolUsage: api.fetchSchoolUsage,
}))

const LABELS = { today: 'Hari Ini', '7days': '7 Hari', '30days': '30 Hari' } as const

function usage(over: Partial<SchoolUsage> = {}): SchoolUsage {
  const period = over.period ?? '30days'
  return {
    school: { id: 900001, name: 'SMK Contoh Ujian' },
    period,
    label: LABELS[period],
    tiles: {
      pupils: 1234,
      teachers: 9,
      activePupils: 812,
      participationPct: 66,
      sessions: 1500,
      answers: 21000,
      accuracy: 61.44,
    },
    modes: [
      { label: 'Latihan', sessions: 1000, accuracy: 55.26 },
      { label: 'Bab', sessions: 400, accuracy: null },
      { label: 'Ulang Kaji', sessions: 100, accuracy: 40 },
    ],
    ...over,
  }
}

const EMPTY_TILES: SchoolUsage['tiles'] = {
  pupils: 0,
  teachers: 0,
  activePupils: 0,
  participationPct: 0,
  sessions: 0,
  answers: 0,
  accuracy: null,
}

let router: Router

async function mountPage(
  data: SchoolUsage | ApiError,
  url = '/admin-sekolah/statistik-penggunaan',
): Promise<VueWrapper> {
  if (data instanceof ApiError) api.fetchSchoolUsage.mockRejectedValue(data)
  else api.fetchSchoolUsage.mockResolvedValue(data)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(StatistikPenggunaanPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  api.fetchSchoolUsage.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
})

describe('route (FR-M27-38, 40, 44)', () => {
  it('declares S1 in the user shell for school_admin only, with the 403 outcome and the tab title', () => {
    const s1 = routes.find((r) => r.path === '/admin-sekolah/statistik-penggunaan')
    expect(s1?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Statistik Penggunaan - PRESTASIPLUS',
      header: { title: 'Statistik Penggunaan' },
    })
  })
})

describe('period rule (BR-M27-21)', () => {
  it.each([
    ['today', 'today'],
    ['7days', '7days'],
    ['30days', '30days'],
    ['bogus', '30days'],
    ['', '30days'],
    [undefined, '30days'],
    [['7days', 'today'], '7days'],
  ])('maps %j to %s', (raw, expected) => {
    expect(normalisePeriod(raw)).toBe(expected)
  })
})

describe('header, breadcrumb and pills (FR-M27-44, 51; AC 13.1, 13.4, 15.1, 15.3)', () => {
  it('sets the shell subtitle to the school name', async () => {
    await mountPage(usage())
    expect(usePageMeta().state.header).toEqual({
      title: 'Statistik Penggunaan',
      subtitle: 'SMK Contoh Ujian',
    })
  })

  it('renders "← Dashboard Sekolah" as a link to /admin-sekolah and the bold title as text', async () => {
    const w = await mountPage(usage())
    const back = w.get('[data-testid="su-breadcrumb"] a')
    expect(back.text()).toBe('Papan Pemuka Sekolah')
    expect(back.attributes('href')).toBe('/admin-sekolah')
    const current = w.get('[data-testid="su-breadcrumb"] [aria-current="page"]')
    expect(current.text()).toBe('Statistik Penggunaan')
    expect(current.element.tagName).not.toBe('A')
    expect(current.classes()).toContain('text-highlighted')
  })

  it('shows the three pills in order, each a link, with 30 Hari active by default', async () => {
    const w = await mountPage(usage())
    const pills = w.findAll('[data-testid^="su-pill-"]')
    expect(pills.map((p) => p.text())).toEqual(['Hari Ini', '7 Hari', '30 Hari'])
    expect(pills.map((p) => p.element.tagName)).toEqual(['A', 'A', 'A'])
    expect(pills.map((p) => p.attributes('href'))).toEqual([
      '/admin-sekolah/statistik-penggunaan?period=today',
      '/admin-sekolah/statistik-penggunaan?period=7days',
      '/admin-sekolah/statistik-penggunaan?period=30days',
    ])
    expect(pills.map((p) => p.attributes('data-active'))).toEqual(['false', 'false', 'true'])
    expect(api.fetchSchoolUsage).toHaveBeenCalledWith(expect.objectContaining({ period: '30days' }))
  })

  it('activates "7 Hari" for ?period=7days and asks the endpoint for it', async () => {
    const w = await mountPage(usage({ period: '7days' }), '/x?period=7days')
    expect(text(w, 'su-pill-7days')).toBe('7 Hari')
    expect(w.get('[data-testid="su-pill-7days"]').attributes('data-active')).toBe('true')
    expect(w.get('[data-testid="su-pill-30days"]').attributes('data-active')).toBe('false')
    expect(api.fetchSchoolUsage).toHaveBeenCalledWith(expect.objectContaining({ period: '7days' }))
  })

  it('treats an unknown period as 30 days', async () => {
    const w = await mountPage(usage(), '/x?period=bogus')
    expect(w.get('[data-testid="su-pill-30days"]').attributes('data-active')).toBe('true')
    expect(api.fetchSchoolUsage).toHaveBeenCalledWith(expect.objectContaining({ period: '30days' }))
  })

  it('fetches again when the period in the URL changes', async () => {
    const w = await mountPage(usage())
    api.fetchSchoolUsage.mockResolvedValue(usage({ period: 'today' }))
    await router.push('/x?period=today')
    await flushPromises()
    expect(api.fetchSchoolUsage).toHaveBeenCalledTimes(2)
    expect(w.get('[data-testid="su-pill-today"]').attributes('data-active')).toBe('true')
  })
})

describe('tiles (FR-M27-52, 53; AC 15.1, 15.2)', () => {
  it('shows seven tiles in order with ms-MY counts, sub-lines, integer and one-decimal percents', async () => {
    const w = await mountPage(usage())
    expect(w.findAll('[data-testid="su-tile-label"]').map((e) => e.text())).toEqual([
      'Pelajar',
      'Guru',
      'Pelajar Aktif',
      'Penglibatan',
      'Sesi Latihan',
      'Soalan Dijawab',
      'Purata Ketepatan',
    ])
    expect(w.findAll('[data-testid="su-tile-value"]').map((e) => e.text())).toEqual([
      '1,234',
      '9',
      '812',
      '66%',
      '1,500',
      '21,000',
      '61.4%',
    ])
    expect(w.findAll('[data-testid="su-tile-sub"]').map((e) => e.text())).toEqual([
      'daripada 1,234',
      'daripada pelajar daftar',
    ])
    expect(w.get('[data-testid="su-tiles"]').find('a').exists()).toBe(false)
    expect(has(w, 'su-footnote')).toBe(false)
  })

  it('shows zeros, "0%" and the dash for a school without pupils (AC 15.4)', async () => {
    const w = await mountPage(usage({ tiles: EMPTY_TILES, modes: [] }))
    expect(w.findAll('[data-testid="su-tile-value"]').map((e) => e.text())).toEqual([
      '0',
      '0',
      '0',
      '0%',
      '0',
      '0',
      '—',
    ])
    expect(text(w, 'su-tile-participation')).toContain('daripada pelajar daftar')
    expect(text(w, 'su-tile-active')).toContain('daripada 0')
  })
})

describe('Mengikut Mod Latihan (FR-M27-54; AC 16.1)', () => {
  it('renders the heading, the three columns and one row per mode in the given order', async () => {
    const w = await mountPage(usage())
    expect(text(w, 'su-modes-title')).toBe('Mengikut Mod Latihan')
    expect(w.findAll('[data-testid="su-modes-table"] th').map((e) => e.text())).toEqual([
      'Mod',
      'Sesi',
      'Ketepatan Purata',
    ])
    expect(w.findAll('[data-testid="su-mode-label"]').map((e) => e.text())).toEqual([
      'Latihan',
      'Bab',
      'Ulang Kaji',
    ])
    expect(w.findAll('[data-testid="su-mode-sessions"]').map((e) => e.text())).toEqual([
      '1,000',
      '400',
      '100',
    ])
    expect(w.findAll('[data-testid="su-mode-accuracy"]').map((e) => e.text())).toEqual([
      '55.3%',
      '—',
      '40.0%',
    ])
    expect(has(w, 'su-empty')).toBe(false)
  })

  it('keeps the table inside its own wrapper (DsDataTable scrolls inside itself)', async () => {
    const w = await mountPage(usage())
    expect(w.find('[data-testid="su-modes-scroll"] [data-testid="su-modes-table"]').exists()).toBe(true)
  })
})

describe('empty states and footnote (FR-M27-55, 56; AC 16.2…16.4)', () => {
  it('30 days: the empty card with the 30 Hari sentence, the dash tile and the footnote', async () => {
    const w = await mountPage(usage({ tiles: EMPTY_TILES, modes: [] }))
    expect(has(w, 'su-modes')).toBe(false)
    expect(text(w, 'su-empty-title')).toBe('Tiada data untuk tempoh ini')
    expect(text(w, 'su-empty-text')).toBe('Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas.')
    expect(text(w, 'su-tile-accuracy')).toContain('—')
    expect(text(w, 'su-footnote')).toBe(
      'Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini.',
    )
  })

  it('7 days: the sentence reads "7 Hari"', async () => {
    const w = await mountPage(usage({ period: '7days', tiles: EMPTY_TILES, modes: [] }), '/x?period=7days')
    expect(text(w, 'su-empty-text')).toBe('Tiada aktiviti latihan dalam tempoh 7 Hari yang lepas.')
  })

  it('today: the sentence with "7 Hari" and "30 Hari" as links to the periods', async () => {
    const w = await mountPage(
      usage({ period: 'today', tiles: EMPTY_TILES, modes: [] }),
      '/x?period=today',
    )
    expect(text(w, 'su-empty-text').replace(/\s+/g, ' ')).toBe(
      'Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari.',
    )
    expect(w.get('[data-testid="su-empty-7days"]').attributes('href')).toBe(
      '/admin-sekolah/statistik-penggunaan?period=7days',
    )
    expect(w.get('[data-testid="su-empty-30days"]').attributes('href')).toBe(
      '/admin-sekolah/statistik-penggunaan?period=30days',
    )
  })

  it('has no export control (FR-M27-56)', async () => {
    const w = await mountPage(usage())
    expect(w.text()).not.toMatch(/Eksport|Muat Turun|CSV/i)
    expect(w.find('button').exists()).toBe(false)
  })
})

describe('states (FR-M27-48)', () => {
  it('shows the spinner only while loading', async () => {
    api.fetchSchoolUsage.mockReturnValue(new Promise(() => undefined))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/')
    const w = mount(StatistikPenggunaanPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'su-loading')).toBe(true)
    expect(has(w, 'su-tiles')).toBe(false)
    expect(w.text()).toBe('')
  })

  it('renders the global 403 outcome in place for a 403', async () => {
    const w = await mountPage(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Akses ditolak.',
        method: 'GET',
        url: '/api/admin-sekolah/usage',
      }),
    )
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'su-error')).toBe(false)
    expect(has(w, 'su-tiles')).toBe(false)
  })

  it('shows the server message for another failure and no figures', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Ralat pelayan.',
        method: 'GET',
        url: '/api/admin-sekolah/usage',
      }),
    )
    expect(useRouteOutcome().value).toBeNull()
    expect(text(w, 'su-error')).toContain('Ralat pelayan.')
    expect(has(w, 'su-tiles')).toBe(false)
  })
})
