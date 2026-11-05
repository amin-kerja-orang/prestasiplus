// @vitest-environment jsdom
/**
 * M27 S5 "Laporan Bulanan" component tests (SRS M27 Part B v1.8 FR-M27-44, 81…87; AC-M27-23.1…23.4, 24.1…24.4)
 * and R1-AS-50 against a mocked client: heading and month links, the eight cards, the daily and yearly trends,
 * "Statistik Bulanan", the subject section (always rendered), the footer and the print button and title, the empty
 * month and the error states.
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

const MONTHS12 = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis']
const yearly = (year: number, sessions: Record<number, number> = {}): MonthlyReport['yearly'] => ({
  year,
  months: MONTHS12.map((label, i) => ({ month: `${String(year)}-${String(i + 1).padStart(2, '0')}`, label, sessions: sessions[i + 1] ?? 0 })),
})
const daily = (days: number, answers: Record<number, number> = {}): MonthlyReport['daily'] =>
  Array.from({ length: days }, (_, i) => ({ day: i + 1, answers: answers[i + 1] ?? 0 }))

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
      teachers: 12,
      busiestMonth: { month: '2026-09', label: 'Sep', sessions: 82 },
    },
    daily: daily(30, { 2: 400, 15: 834 }),
    yearly: yearly(2026, { 8: 30, 9: 82 }),
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
      strongest: { name: 'Sejarah', accuracy: 71.25, answers: 400, pupils: 5, sessions: 12 },
      weakest: { name: 'Kimia', accuracy: 40, answers: 100, pupils: 3, sessions: 3 },
      rows: [
        { name: 'Sejarah', accuracy: 71.25, answers: 400, pupils: 5, sessions: 12 },
        { name: 'Kimia', accuracy: 40, answers: 100, pupils: 3, sessions: 3 },
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
    teachers: 12,
    busiestMonth: null,
  },
  daily: daily(31),
  yearly: yearly(2026),
  months: [],
  total: null,
  subjects: { strongest: null, weakest: null, rows: [] },
}

let router: Router
const mounted: VueWrapper[] = []

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
  mounted.push(wrapper)
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
  // The page listens to beforeprint / afterprint on window: unmount so no page of an earlier test reacts.
  for (const w of mounted.splice(0)) w.unmount()
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
    const back = w.get('[data-testid="lb-breadcrumb"] a')
    expect(back.text()).toBe('Dashboard Sekolah')
    expect(back.attributes('href')).toBe('/admin-sekolah')
    const cur = w.get('[data-testid="lb-breadcrumb"] [aria-current="page"]')
    expect(cur.text()).toBe('Laporan Bulanan')
    expect(cur.element.tagName).not.toBe('A')
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

describe('cards (R1-AS-50, FR-AS-50-2; AC-AS-50-2, 50-3)', () => {
  it('shows the eight cards in order with the PRD sub-lines', async () => {
    const w = await mountPage(report())
    expect(texts(w, 'lb-card-label')).toEqual([
      'Pelajar Berdaftar',
      'Kadar Penglibatan',
      'Soalan Dijawab',
      'Ketepatan',
      'Guru',
      'Soalan / Pelajar Aktif',
      'Bulan Paling Aktif',
      'Sesi Latihan',
    ])
    expect(texts(w, 'lb-card-value')).toEqual(['10', '60%', '1,234', '61%', '12', '206', 'Sep', '82'])
    expect(texts(w, 'lb-card-sub')).toEqual([
      '6 aktif',
      'daripada pelajar daftar',
      'sepanjang September',
      'purata jawapan betul',
      'berdaftar',
      'purata kedalaman penggunaan',
      '82 sesi',
    ])
  })

  it('names the shown month in "sepanjang {bulan}"', async () => {
    const w = await mountPage(report({ month: '2026-08', label: 'Ogos 2026' }))
    expect(texts(w, 'lb-card-sub')).toContain('sepanjang Ogos')
  })

  it('a month without answers: Ketepatan and Bulan Paling Aktif show the dash, the note shows and every section stays', async () => {
    const w = await mountPage(report(EMPTY_MONTH))
    expect(texts(w, 'lb-card-value')).toEqual(['10', '0%', '0', '—', '12', '0', '—', '0'])
    expect(text(w, 'lb-empty-note')).toBe('Tiada data untuk bulan ini.')
    for (const id of ['lb-daily', 'lb-yearly', 'lb-table-section', 'lb-subjects']) expect(has(w, id), id).toBe(true)
  })

  it('shows no empty note for a month with answers', async () => {
    const w = await mountPage(report())
    expect(has(w, 'lb-empty-note')).toBe(false)
  })
})

describe('Trend Harian and Trend Penggunaan Bulanan (FR-AS-50-2, 50-5)', () => {
  it('draws the daily chart with one entry per day of the month and the yearly chart titled with the year', async () => {
    const w = await mountPage(report())
    expect(text(w, 'lb-daily')).toContain('Trend Harian')
    const dailyTable = text(w, 'lb-daily-chart')
    expect(dailyTable).toContain('Trend Harian')
    expect(w.findAll('[data-testid="lb-daily-chart"] tbody tr')).toHaveLength(30)
    expect(text(w, 'lb-yearly')).toContain('Trend Penggunaan Bulanan 2026')
    const rows = w.findAll('[data-testid="lb-yearly-chart"] tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
    expect(rows.map((r) => r[0])).toEqual(MONTHS12)
    expect(rows[8]?.[1]).toBe('82')
  })

  it('passes every 5th label rule and the chosen month index to the charts', async () => {
    const w = await mountPage(report())
    const charts = w.findAllComponents({ name: 'DsChart' })
    const dailyChart = charts.find((c) => c.attributes('data-testid') === 'lb-daily-chart')
    const yearChart = charts.find((c) => c.attributes('data-testid') === 'lb-yearly-chart')
    expect((dailyChart?.props() as Record<string, unknown>).tickEvery).toBe(5)
    expect((yearChart?.props() as Record<string, unknown>).highlightIndex).toBe(8)
  })

  it('renders both charts for an empty month', async () => {
    const w = await mountPage(report(EMPTY_MONTH))
    expect(w.findAll('[data-testid="lb-daily-chart"] tbody tr')).toHaveLength(31)
    expect(w.findAll('[data-testid="lb-yearly-chart"] tbody tr')).toHaveLength(12)
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

describe('Prestasi Mengikut Subjek (R1-AS-50, FR-AS-50-3)', () => {
  it('shows the two boxes and one row per subject as "{n} sesi · {x}%"', async () => {
    const w = await mountPage(report())
    expect(text(w, 'lb-subjects-title')).toBe('Prestasi Mengikut Subjek')
    expect(text(w, 'lb-strongest')).toContain('SUBJEK TERKUAT')
    expect(text(w, 'lb-strongest-name')).toBe('Sejarah')
    expect(text(w, 'lb-strongest-figure')).toBe('71.3% (400 soalan)')
    expect(text(w, 'lb-weakest')).toContain('SUBJEK PERLU PERHATIAN')
    expect(text(w, 'lb-weakest-name')).toBe('Kimia')
    expect(text(w, 'lb-weakest-figure')).toBe('40.0% (100 soalan)')
    expect(texts(w, 'lb-subject-name')).toEqual(['Sejarah', 'Kimia'])
    expect(texts(w, 'lb-subject-figure')).toEqual(['12 sesi · 71%', '3 sesi · 40%'])
    expect(has(w, 'lb-subjects-empty')).toBe(false)
  })

  it('always renders, with "Tiada aktiviti latihan pada bulan ini." and no rows, for an empty month', async () => {
    const w = await mountPage(report(EMPTY_MONTH))
    expect(text(w, 'lb-subjects-title')).toBe('Prestasi Mengikut Subjek')
    expect(text(w, 'lb-subjects-empty')).toBe('Tiada aktiviti latihan pada bulan ini.')
    expect(w.findAll('[data-testid="lb-subject-row"]')).toHaveLength(0)
    expect(has(w, 'lb-strongest')).toBe(false)
  })

  it('shows one subject in both boxes', async () => {
    const only = { name: 'Sejarah', accuracy: 60, answers: 10, pupils: 2, sessions: 4 }
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

  it('prints A4 portrait without the app chrome: the report is the print sheet, buttons and month links are print:hidden (FR-AS-50-4)', async () => {
    const w = await mountPage(report())
    expect(w.get('[data-testid="lb-sheet"]').attributes('data-ds')).toBe('print-sheet')
    expect(w.get('[data-testid="lb-print"]').classes()).toContain('print:hidden')
    expect(w.get('[data-testid="lb-prev"]').element.parentElement?.className).toContain('print:hidden')
    expect(text(w, 'lb-print-title')).toBe('Laporan Bulanan — September 2026')
    expect(w.get('[data-testid="lb-print-title"]').classes()).toEqual(expect.arrayContaining(['hidden', 'print:block']))
  })

  it('sets the document title "Laporan Bulanan — {Bulan} {tahun}" while printing and restores it afterwards', async () => {
    document.title = 'Laporan Bulanan - PRESTASIPLUS'
    const w = await mountPage(report())
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.title).toBe('Laporan Bulanan — September 2026')
    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe('Laporan Bulanan - PRESTASIPLUS')
    expect(w.exists()).toBe(true)
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

  it('shows the BM load error, not the server text, for another failure (SWE)', async () => {
    const w = await mountPage(
      new ApiError({
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Server Error',
        method: 'GET',
        url: '/api/admin-sekolah/laporan-bulanan',
      }),
    )
    expect(text(w, 'lb-error')).toContain('Tidak dapat memuatkan data. Sila cuba semula.')
    expect(text(w, 'lb-error')).not.toContain('Server Error')
    expect(has(w, 'lb-cards')).toBe(false)
  })
})

describe('month hidden by the 5-pupil rule (SW7-04, DV-M27-25)', () => {
  const EMPTY = 'Tiada aktiviti direkodkan buat masa ini'
  const COHORT = 'Disembunyikan kerana kurang daripada 5 pelajar aktif.'
  const HIDDEN = report({
    cards: {
      participationPct: 20,
      active: 2,
      registered: 10,
      answers: 30,
      perPupil: 15,
      accuracy: null,
      sessions: 1,
      teachers: 3,
      busiestMonth: null,
    },
    months: [],
    total: null,
    subjects: { strongest: null, weakest: null, rows: [] },
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('http mode, answers but no accuracy and no month row: names the 5-pupil rule', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const w = await mountPage(HIDDEN)
    expect(text(w, 'lb-table-empty')).toContain('Tiada data')
    expect(text(w, 'lb-table-empty')).toContain(COHORT)
    expect(text(w, 'lb-table-empty')).not.toContain(EMPTY)
  })

  it('http mode, no answers at all: keeps "Tiada aktiviti direkodkan buat masa ini"', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const w = await mountPage(report({ ...EMPTY_MONTH }))
    // FR-AS-50-3: a month without answers still renders every section, with the plain empty copy.
    expect(text(w, 'lb-table-empty')).toContain(EMPTY)
    expect(text(w, 'lb-table-empty')).not.toContain(COHORT)
  })

  it('http mode, a shown month with rows: no hidden-month copy', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const w = await mountPage(report())
    expect(has(w, 'lb-table-empty')).toBe(false)
    expect(w.text()).not.toContain(COHORT)
  })

  it('mock mode (replicates live): the empty state is unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const w = await mountPage(HIDDEN)
    expect(text(w, 'lb-table-empty')).toContain(EMPTY)
    expect(text(w, 'lb-table-empty')).not.toContain(COHORT)
  })
})
