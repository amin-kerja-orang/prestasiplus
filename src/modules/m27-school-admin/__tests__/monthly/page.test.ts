// @vitest-environment jsdom
/**
 * M27 S5 "Laporan Bulanan" component tests (SRS M27 Part B v1.8 FR-M27-44, 81…87; AC-M27-23.1…23.4, 24.1…24.4)
 * against a mocked client: heading and month links, the four cards, "Statistik Bulanan", subject boxes, the
 * footer and the print button, the empty month and the error states.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

import type { MonthlyReport } from '../../api/school-admin'
import { generatedAtLabel, monthLabel } from '../../components/monthly/monthly-format'
import LaporanBulananPage from '../../pages/LaporanBulananPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchMonthlyReport: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  fetchMonthlyReport: api.fetchMonthlyReport,
}))

function report(over: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    school: { id: 1, name: 'SMK Contoh Ujian' },
    month: '2026-09',
    label: 'September 2026',
    prev: '2026-08',
    next: null,
    cards: {
      participationPct: 60,
      active: 6,
      registered: 10,
      answers: 1234,
      perPupil: 206,
      accuracy: 61.44,
      sessions: 82,
    },
    months: [
      {
        month: '2026-08',
        label: 'Ogos 2026',
        answers: 200,
        correct: 100,
        activePupils: 4,
        perPupil: 50,
        accuracy: 50,
      },
      {
        month: '2026-09',
        label: 'September 2026',
        answers: 1234,
        correct: 666,
        activePupils: 6,
        perPupil: 205.7,
        accuracy: 61.4,
      },
    ],
    total: { answers: 1434, correct: 766, accuracy: 53.4 },
    subjects: {
      strongest: { name: 'Sejarah', accuracy: 71.25, answers: 400, pupils: 5 },
      weakest: { name: 'Kimia', accuracy: 40, answers: 100, pupils: 3 },
      rows: [
        { name: 'Sejarah', accuracy: 71.25, answers: 400, pupils: 5 },
        { name: 'Kimia', accuracy: 40, answers: 100, pupils: 3 },
      ],
    },
    generatedAt: '2026-09-25T15:40:00+08:00',
    ...over,
  }
}

const EMPTY_MONTH: Partial<MonthlyReport> = {
  month: '2026-07',
  label: 'Julai 2026',
  prev: '2026-06',
  next: '2026-08',
  cards: {
    participationPct: 0,
    active: 0,
    registered: 10,
    answers: 0,
    perPupil: 0,
    accuracy: null,
    sessions: 0,
  },
  months: [],
  total: null,
  subjects: { strongest: null, weakest: null, rows: [] },
}

let router: Router

async function mountPage(
  data: MonthlyReport | ApiError,
  url = '/admin-sekolah/laporan-bulanan',
): Promise<VueWrapper> {
  if (data instanceof ApiError) api.fetchMonthlyReport.mockRejectedValue(data)
  else api.fetchMonthlyReport.mockResolvedValue(data)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(LaporanBulananPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  api.fetchMonthlyReport.mockReset()
  setRouteOutcome(null)
  usePageMeta().reset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('route and header (FR-M27-38, 40, 44)', () => {
  it('declares S5 in the user shell for school_admin only', () => {
    const s5 = routes.find((r) => r.path === '/admin-sekolah/laporan-bulanan')
    expect(s5?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Laporan Bulanan - PRESTASIPLUS',
      header: { title: 'Laporan Bulanan' },
    })
  })

  it('sets the sub-line to the school name and shows the breadcrumb', async () => {
    const w = await mountPage(report())
    expect(usePageMeta().state.header).toEqual({
      title: 'Laporan Bulanan',
      subtitle: 'SMK Contoh Ujian',
    })
    expect(text(w, 'lb-crumb-back')).toBe('← Dashboard Sekolah')
    expect(w.get('[data-testid="lb-crumb-back"]').attributes('href')).toBe('/admin-sekolah')
    expect(text(w, 'lb-crumb-current')).toBe('Laporan Bulanan')
    expect(w.get('[data-testid="lb-crumb-current"]').element.tagName).not.toBe('A')
  })
})

describe('heading and month links (FR-M27-81; AC-M27-23.1, 23.3)', () => {
  it('shows "Laporan {Bulan} {yyyy}" and the previous link only for the current month', async () => {
    const w = await mountPage(report())
    expect(text(w, 'lb-heading')).toBe('Laporan September 2026')
    expect(text(w, 'lb-prev')).toBe('← Ogos 2026')
    expect(w.get('[data-testid="lb-prev"]').attributes('href')).toBe(
      '/admin-sekolah/laporan-bulanan?bulan=2026-08',
    )
    expect(has(w, 'lb-next')).toBe(false)
  })

  it('shows both links for a past month', async () => {
    const w = await mountPage(
      report({ month: '2026-08', label: 'Ogos 2026', prev: '2026-07', next: '2026-09' }),
      '/admin-sekolah/laporan-bulanan?bulan=2026-08',
    )
    expect(text(w, 'lb-heading')).toBe('Laporan Ogos 2026')
    expect(text(w, 'lb-prev')).toBe('← Julai 2026')
    expect(text(w, 'lb-next')).toBe('September 2026 →')
    expect(w.get('[data-testid="lb-next"]').attributes('href')).toBe(
      '/admin-sekolah/laporan-bulanan?bulan=2026-09',
    )
    expect(api.fetchMonthlyReport).toHaveBeenCalledWith(
      expect.objectContaining({ bulan: '2026-08' }),
    )
  })

  it('passes an invalid month through (the API gives the current one)', async () => {
    await mountPage(report(), '/admin-sekolah/laporan-bulanan?bulan=x')
    expect(api.fetchMonthlyReport).toHaveBeenCalledWith(expect.objectContaining({ bulan: 'x' }))
  })

  it('names months in BM', () => {
    expect(monthLabel('2026-03')).toBe('Mac 2026')
    expect(monthLabel('2026-05')).toBe('Mei 2026')
    expect(monthLabel('2026-08')).toBe('Ogos 2026')
    expect(monthLabel('2026-12')).toBe('Disember 2026')
  })
})

describe('cards (FR-M27-82, 83; AC-M27-23.2, 23.4)', () => {
  it('shows four cards in order with the sub-lines', async () => {
    const w = await mountPage(report())
    const labels = texts(w, 'lb-card-label')
    expect(labels).toEqual(['Penglibatan', 'Soalan Dijawab', 'Ketepatan', 'Sesi Latihan'])
    expect(texts(w, 'lb-card-value')).toEqual(['60%', '1,234', '61.4%', '82'])
    expect(texts(w, 'lb-card-sub')).toEqual(['6 aktif / 10 daftar', '206 soalan/pelajar'])
  })

  it('shows "0%", "0", "—", "0" and no section below for a month without answers', async () => {
    const w = await mountPage(report(EMPTY_MONTH))
    expect(texts(w, 'lb-card-value')).toEqual(['0%', '0', '—', '0'])
    expect(has(w, 'lb-table-title')).toBe(false)
    expect(has(w, 'lb-subjects')).toBe(false)
  })
})

describe('Statistik Bulanan (FR-M27-84; AC-M27-24.1, 24.2)', () => {
  it('shows the title, subtitle, columns, rows and the "Jumlah" footer', async () => {
    const w = await mountPage(report())
    expect(text(w, 'lb-table-title')).toBe('Statistik Bulanan')
    expect(text(w, 'lb-table-subtitle')).toBe('12 bulan terakhir — pecahan prestasi mengikut bulan')
    expect(w.findAll('[data-testid="lb-table"] th').map((e) => e.text())).toEqual([
      'Bulan',
      'Soalan Dijawab',
      'Soalan Betul',
      'Pelajar Aktif',
      'Purata/Pelajar',
      'Accuracy',
    ])
    // the "Jumlah" row closes the table
    const rows = w.findAll('[data-testid="lb-table"] tbody tr')
    expect(rows.map((r) => r.findAll('td').map((c) => c.text()))).toEqual([
      ['Ogos 2026', '200', '100', '4', '50.0', '50.0%'],
      ['September 2026', '1,234', '666', '6', '205.7', '61.4%'],
      ['Jumlah', '1,434', '766', '—', '—', '53.4%'],
    ])
  })

  it('has no footer with one row', async () => {
    const base = report()
    const w = await mountPage({ ...base, months: base.months.slice(1), total: base.total })
    const rows = w.findAll('[data-testid="lb-table"] tbody tr')
    expect(rows).toHaveLength(1)
    expect(w.text()).not.toContain('Jumlah')
  })

  it('shows "Tiada data" and "Tiada aktiviti direkodkan buat masa ini" without a month with sessions', async () => {
    const w = await mountPage(report({ months: [], total: null }))
    expect(text(w, 'lb-table-empty')).toContain('Tiada data')
    expect(text(w, 'lb-table-empty')).toContain('Tiada aktiviti direkodkan buat masa ini')
    expect(has(w, 'lb-table')).toBe(false)
  })
})

describe('Prestasi Mengikut Subjek (FR-M27-85; AC-M27-24.3)', () => {
  it('shows the two boxes and one row per subject', async () => {
    const w = await mountPage(report())
    expect(text(w, 'lb-subjects-title')).toBe('Prestasi Mengikut Subjek')
    expect(text(w, 'lb-strongest')).toContain('SUBJEK TERKUAT')
    expect(text(w, 'lb-strongest-name')).toBe('Sejarah')
    expect(text(w, 'lb-strongest-figure')).toBe('71.3% (400 soalan)')
    expect(text(w, 'lb-weakest')).toContain('SUBJEK PERLU PERHATIAN')
    expect(text(w, 'lb-weakest-name')).toBe('Kimia')
    expect(text(w, 'lb-weakest-figure')).toBe('40.0% (100 soalan)')
    expect(texts(w, 'lb-subject-name')).toEqual(['Sejarah', 'Kimia'])
    expect(texts(w, 'lb-subject-figure')).toEqual([
      '71.3% · 400 soalan · 5 pelajar',
      '40.0% · 100 soalan · 3 pelajar',
    ])
  })

  it('shows one subject in both boxes', async () => {
    const only = { name: 'Sejarah', accuracy: 60, answers: 10, pupils: 2 }
    const w = await mountPage(
      report({ subjects: { strongest: only, weakest: only, rows: [only] } }),
    )
    expect(text(w, 'lb-strongest-name')).toBe('Sejarah')
    expect(text(w, 'lb-weakest-name')).toBe('Sejarah')
  })
})

describe('footer and print (FR-M27-86; AC-M27-24.4)', () => {
  it('formats the request minute in MYT', () => {
    expect(generatedAtLabel('2026-09-25T15:40:00+08:00')).toBe('25 Sep 2026, 03:40 PM')
    expect(generatedAtLabel('2026-09-25T00:05:00+08:00')).toBe('25 Sep 2026, 12:05 AM')
  })

  it('shows the footer text and calls window.print() once on "Cetak / PDF"', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const w = await mountPage(report())
    expect(text(w, 'lb-generated')).toBe('Laporan dijana: 25 Sep 2026, 03:40 PM · PrestasiPlus')
    const button = w.get('[data-testid="lb-print"]')
    expect(button.text()).toBe('Cetak / PDF')
    await button.trigger('click')
    expect(print).toHaveBeenCalledTimes(1)
  })
})

describe('states (FR-M27-48)', () => {
  it('shows the spinner only while loading', async () => {
    api.fetchMonthlyReport.mockReturnValue(new Promise(() => undefined))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/')
    const w = mount(LaporanBulananPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(has(w, 'lb-loading')).toBe(true)
    expect(has(w, 'lb-cards')).toBe(false)
  })

  it('renders the global 403 outcome in place for a 403', async () => {
    const w = await mountPage(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Akses ditolak.',
        method: 'GET',
        url: '/api/admin-sekolah/laporan-bulanan',
      }),
    )
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'lb-error')).toBe(false)
    expect(has(w, 'lb-cards')).toBe(false)
  })

  it('shows the server message for another failure', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Ralat pelayan.',
        method: 'GET',
        url: '/api/admin-sekolah/laporan-bulanan',
      }),
    )
    expect(text(w, 'lb-error')).toContain('Ralat pelayan.')
    expect(has(w, 'lb-cards')).toBe(false)
  })
})
