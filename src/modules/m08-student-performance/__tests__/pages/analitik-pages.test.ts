// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type { Analytics, AnalyticsSubject, StudentPerformance, WeakSp } from '../../api/types'
import AnalitikPelajarPage from '../../pages/AnalitikPelajarPage.vue'
import Prestasi360Page from '../../pages/Prestasi360Page.vue'

const api = vi.hoisted(() => ({
  fetchAnalytics: vi.fn(),
  fetchStudentPerformance: vi.fn(),
}))
vi.mock('../../api/performance', () => api)

let wrapper: VueWrapper | null = null

async function render(component: object, path: string, route = path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
/** The big number of a stat tile. */
const num = (w: VueWrapper, id: string) => t(w, id).find('.tabular').text()
const exists = (w: VueWrapper, id: string) => w.find(`[data-testid=${id}]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
  document.title = ''
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

// ---------------------------------------------------------------------------------------------
// S7
// ---------------------------------------------------------------------------------------------

function weak(i: number, subject: 'BM' | 'SEJ', accuracy: number, available = 16): WeakSp {
  return {
    spId: i,
    code: `5.1.${String(i)}`,
    title: `Tajuk ${String(i)} ${'y'.repeat(120)}`,
    subjectName: subject === 'BM' ? 'Bahasa Melayu' : 'Sejarah',
    subjectCode: subject,
    answered: 3,
    accuracy,
    available,
    focusCount: Math.min(available, 25),
  }
}

const bmWeak = [1, 2, 3, 4, 5, 6].map((i) => weak(i, 'BM', i, i === 6 ? 50 : 16))
const sejWeak = [11, 12, 13, 14, 15].map((i) => weak(i, 'SEJ', i))

const BM: AnalyticsSubject = {
  subjectId: 1,
  name: 'Bahasa Melayu',
  code: 'BM',
  accuracy: 40.5,
  answered: 79,
  trend: 'stable',
  projection: { low: 'G', high: 'C' },
  counts: { mahir: 3, sederhana: 6, lemah: 6, belum: 0 },
  ringTotal: 3,
  weak: bmWeak,
  map: {
    caption: 'KSSR Bahasa Melayu Darjah 4',
    tiles: [
      { spId: 101, code: '1.1', title: 'Membaca', status: 'belum' },
      { spId: 102, code: '2.1', title: 'Menulis', status: 'lemah' },
    ],
  },
}
const SEJ: AnalyticsSubject = {
  subjectId: 5,
  name: 'Sejarah',
  code: 'SEJ',
  accuracy: 62,
  answered: 40,
  trend: 'up',
  projection: { low: 'C', high: 'B' },
  counts: { mahir: 8, sederhana: 2, lemah: 5, belum: 0 },
  ringTotal: 23,
  weak: sejWeak,
  map: { caption: 'KSSR Sejarah Darjah 4', tiles: [] },
}
const ANALYTICS: Analytics = {
  userLevelId: 4,
  topWeak: [bmWeak[0]!, bmWeak[1]!, bmWeak[2]!, sejWeak[0]!],
  subjects: [BM, SEJ],
}

describe('S7 AnalitikPelajarPage', () => {
  it('shows the top block of 4 cards, cut at 70 characters, with the capped focus link', async () => {
    api.fetchAnalytics.mockResolvedValue(ANALYTICS)
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    expect(t(w, 'top-weak').text()).toContain('Topik Perlu Perhatian Utama (4)')
    const cards = w.findAll('[data-testid=top-weak] [data-testid^=weak-card-]')
    expect(cards).toHaveLength(4)
    expect(cards[0]?.text()).toContain('1%')
    expect(cards[0]?.text()).toContain('Bahasa Melayu · 3 soalan dijawab')
    expect(cards[0]?.text()).toContain('...')
    const link = cards[0]?.get('a')
    expect(link?.text()).toBe('Latihan Fokus (16 soalan)')
    expect(link?.attributes('href')).toBe('/practice/BM/quiz?level=4&dskp_sp_id=1&count=16')
  })

  it('caps the label and the link at 25 (DV-M08-14)', async () => {
    api.fetchAnalytics.mockResolvedValue({
      ...ANALYTICS,
      topWeak: [weak(9, 'BM', 0, 50)],
    })
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    const link = w.get('[data-testid=top-weak] a')
    expect(link.text()).toBe('Latihan Fokus (25 soalan)')
    expect(link.attributes('href')).toContain('count=25')
  })

  it('leaves the trend icon of a stable subject slate and shows the up arrow for a rising one', async () => {
    api.fetchAnalytics.mockResolvedValue(ANALYTICS)
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    const cards = w.findAll('[data-testid=top-weak] [data-testid^=weak-card-]')
    expect(cards[0]?.find('[data-testid=trend-stable]').exists()).toBe(true)
    expect(cards[3]?.find('[data-testid=trend-up]').exists()).toBe(true)
  })

  it('shows the tabs with rounded accuracy, the first subject active and its pane', async () => {
    api.fetchAnalytics.mockResolvedValue(ANALYTICS)
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    expect(t(w, 'tab-1').text()).toContain('Bahasa Melayu')
    expect(t(w, 'tab-1').text()).toContain('41%')
    expect(t(w, 'tab-1').attributes('aria-pressed')).toBe('true')
    expect(t(w, 'tab-5').attributes('aria-pressed')).toBe('false')
    expect(t(w, 'ring-arc').text()).toContain('3')
    expect(t(w, 'ring-arc').text()).toContain('/ 3 SP')
    expect(t(w, 'ring-arc').attributes('aria-valuenow')).toBe('3')
    expect(t(w, 'ring-arc').attributes('aria-valuemax')).toBe('3')
    expect(w.findAll('[data-testid=ring-legend] > li').map((x) => x.text())).toEqual([
      'Mahir 3',
      'Sederhana 6',
      'Lemah 6',
      'Belum cuba 0',
    ])
    expect(t(w, 'kpi-acc').text()).toBe('40.5%')
    expect(t(w, 'kpi-acc').classes()).toContain('text-error')
    expect(t(w, 'kpi-answered').text()).toBe('79')
    expect(t(w, 'kpi-grade').text()).toBe('G – C')
    expect(exists(w, 'kpi-trend')).toBe(true)
    expect(t(w, 'encourage-box').text()).toContain('Jangan putus asa!')
    expect(t(w, 'map-caption').text()).toBe('KSSR Bahasa Melayu Darjah 4')
    expect(t(w, 'tile-101').attributes('title')).toBe('1.1: Membaca — Belum cuba')
    expect(t(w, 'tile-101').text()).toBe('1.1')
    expect(t(w, 'map-legend').text()).toContain('Mahir (75%+)')
    expect(t(w, 'map-legend').text()).toContain('Klik untuk latihan fokus')
  })

  it('opens the full list of the active subject, keeps it open across tabs and counts n − 4', async () => {
    api.fetchAnalytics.mockResolvedValue(ANALYTICS)
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    expect(t(w, 'more-weak').text()).toContain('Masih ada topik lemah lain untuk subjek ini.')
    expect(t(w, 'more-count').text()).toBe('2')
    expect(t(w, 'toggle-weak').text()).toBe('Lihat semua 6 topik lemah')
    expect(exists(w, 'all-weak')).toBe(false)

    await t(w, 'toggle-weak').trigger('click')
    await flushPromises()
    expect(t(w, 'toggle-weak').text()).toBe('Sembunyi senarai penuh')
    expect(w.findAll('[data-testid=all-weak] [data-testid^=weak-card-]')).toHaveLength(6)
    // Cards of the list are cut at 100 characters and ascending by accuracy.
    const first = w.get('[data-testid=all-weak] [data-testid^=weak-card-]')
    expect(first.text()).toContain('1%')
    expect(first.text()).toContain('...')

    await t(w, 'tab-5').trigger('click')
    await flushPromises()
    expect(t(w, 'toggle-weak').text()).toBe('Sembunyi senarai penuh')
    expect(w.findAll('[data-testid=all-weak] [data-testid^=weak-card-]')).toHaveLength(5)
    expect(t(w, 'more-count').text()).toBe('1')
    expect(t(w, 'ring-arc').text()).toContain('/ 23 SP')
    // 62 % ≥ 50: no encouragement box (PROPOSED).
    expect(exists(w, 'encourage-box')).toBe(false)
  })

  it('shows no toggle for a subject with 4 weak SPs or fewer', async () => {
    api.fetchAnalytics.mockResolvedValue({
      ...ANALYTICS,
      subjects: [{ ...BM, weak: bmWeak.slice(0, 4) }],
    })
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    expect(exists(w, 'more-weak')).toBe(false)
  })

  it('shows only "Topik Perlu Perhatian Utama (0)" without an SP record (PROPOSED)', async () => {
    api.fetchAnalytics.mockResolvedValue({ userLevelId: 4, topWeak: [], subjects: [] })
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    expect(t(w, 'top-weak').text()).toContain('Topik Perlu Perhatian Utama (0)')
    expect(w.findAll('[data-testid=top-weak] [data-testid^=weak-card-]')).toHaveLength(0)
    expect(exists(w, 'subject-tabs')).toBe(false)
    expect(exists(w, 'ring-card')).toBe(false)
    expect(exists(w, 'more-weak')).toBe(false)
  })

  it('shows the load-error box with a retry button', async () => {
    api.fetchAnalytics.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render(AnalitikPelajarPage, '/analitik/pelajar')
    expect(t(w, 'page-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    expect(t(w, 'page-error').text()).toContain('Cuba Semula')
  })
})

// ---------------------------------------------------------------------------------------------
// S6
// ---------------------------------------------------------------------------------------------

const DAY = 86_400_000
const heatmap = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 25) - (89 - i) * DAY).toISOString().slice(0, 10)
  return { date, sessions: date === '2026-09-24' ? 1 : 0 }
})

const S6: StudentPerformance = {
  user: { id: 3001, name: 'Murid Demo 01', initial: 'M' },
  heroAccuracy: 86,
  streak: 2,
  stats: { sessions: 3, accuracy: 85.7, answered: 14, seconds: 840 },
  headcount: [
    {
      configId: 504,
      subject: 'Sejarah',
      className: '5 MARIKH - Sejarah',
      year: 2026,
      status: 'below',
      tov: 50,
      chips: [
        { label: 'TOV', value: 50, tone: 'none' },
        { label: 'OTR2', value: 40, tone: 'below' },
        { label: 'ETR', value: 65, tone: 'none' },
      ],
      etr: 65,
    },
    {
      configId: 501,
      subject: 'Kimia',
      className: '5 MARIKH - Kimia',
      year: 2026,
      status: 'none',
      tov: 60,
      chips: [
        { label: 'TOV', value: 60, tone: 'none' },
        { label: 'ETR', value: null, tone: 'none' },
      ],
      etr: null,
    },
  ],
  mastery: [
    {
      subjectCode: 'CHEM',
      subjectName: 'Kimia',
      color: '#7C3AED',
      accuracy: 88.9,
      sessions: 2,
      answered: 9,
    },
    {
      subjectCode: 'SEJ',
      subjectName: 'Sejarah',
      color: '#F59E0B',
      accuracy: 53,
      sessions: 1,
      answered: 5,
    },
  ],
  activity: { streakCurrent: 2, streakBest: 4, koinTotal: 1234, practiceDays: 3 },
  badges: [{ icon: 'fa-seedling', name: 'Pemula Rajin' }],
  heatmap,
  weakTopics: [
    {
      spId: 9001,
      label: `9.0.1 — ${'Sel Elektrolisis '.repeat(8)}`,
      code: '9.0.1',
      subjectCode: 'CHEM',
      levelId: 11,
      attempts: 3,
      accuracy: 0,
      focusCount: 25,
    },
    {
      spId: 34,
      label: 'Topik Tanpa Kod',
      code: null,
      subjectCode: 'MATH',
      levelId: null,
      attempts: 1,
      accuracy: 20,
      focusCount: 4,
    },
  ],
  suggestions: [
    {
      kind: 'inactive',
      text: 'Sudah 8 hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan.',
    },
    {
      kind: 'subject',
      text: 'Tingkatkan prestasi Sejarah (purata 53%) dengan 3 sesi latihan fokus minggu ini.',
    },
  ],
}

const EMPTY_S6: StudentPerformance = {
  ...S6,
  user: { id: 1, name: 'Admin Demo', initial: 'A' },
  heroAccuracy: 0,
  streak: 1,
  stats: { sessions: 0, accuracy: 0, answered: 0, seconds: 0 },
  headcount: [],
  mastery: [],
  activity: { streakCurrent: 1, streakBest: 5, koinTotal: 256, practiceDays: 13 },
  badges: [],
  weakTopics: [],
  suggestions: [
    {
      kind: 'start',
      text: 'Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!',
    },
  ],
}

const PATH = '/prestasi/:userId(\\d+)'

describe('S6 Prestasi360Page', () => {
  it('shows the hero, the 4 stat cards and sets the tab title from the name', async () => {
    api.fetchStudentPerformance.mockResolvedValue(S6)
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    expect(api.fetchStudentPerformance).toHaveBeenCalledWith(3001, expect.anything())
    expect(t(w, 'hero-name').text()).toBe('Murid Demo 01')
    expect(t(w, 'avatar').text()).toBe('M')
    expect(t(w, 'hero').text()).toContain('Prestasi 360 — Dashboard Individu')
    expect(t(w, 'hero-accuracy').text()).toBe('86%')
    expect(t(w, 'hero-streak').text()).toBe('2')
    expect(t(w, 'hero-mini').classes()).toContain('lg:flex')
    expect(['sesi', 'ketepatan', 'soalan', 'masa'].map((id) => num(w, `stat-${id}`))).toEqual([
      '3',
      '85.7%',
      '14',
      '14m',
    ])
    expect(document.title).toBe('Prestasi 360 — Murid Demo 01 — PRESTASIPLUS')
  })

  it('shows the zero state for the admin: 0 / 0.0% / 0 / 0m, no headcount, no badge card', async () => {
    api.fetchStudentPerformance.mockResolvedValue(EMPTY_S6)
    const w = await render(Prestasi360Page, '/prestasi/1', PATH)
    expect(['sesi', 'ketepatan', 'soalan', 'masa'].map((id) => num(w, `stat-${id}`))).toEqual([
      '0',
      '0.0%',
      '0',
      '0m',
    ])
    expect(exists(w, 'headcount-block')).toBe(false)
    expect(exists(w, 'badges-card')).toBe(false)
    expect(t(w, 'mastery-empty').text()).toContain('Belum ada data latihan.')
    expect(t(w, 'mastery-start').attributes('href')).toBe('/practice')
    expect(t(w, 'weak-empty').text()).toContain('Tiada topik lemah! Teruskan usaha.')
    expect(['kombo', 'rekod', 'koin', 'hari'].map((id) => num(w, `activity-${id}`))).toEqual([
      '1',
      '5',
      '256',
      '13',
    ])
  })

  it('shows one headcount card per config with the status pill and the chip row that wraps', async () => {
    api.fetchStudentPerformance.mockResolvedValue(S6)
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    const first = t(w, 'headcount-504')
    expect(first.text()).toContain('Sejarah')
    expect(first.text()).toContain('5 MARIKH - Sejarah · 2026')
    expect(first.get('[data-testid=status-pill]').text()).toBe('Below')
    expect(first.findAll('[data-testid=chip]').map((c) => c.text())).toEqual([
      'TOV: 50%',
      'OTR2: 40%',
      'ETR: 65%',
    ])
    expect(first.get('[data-testid=chip-row]').classes()).toContain('flex-wrap')
    expect(first.get('a').attributes('href')).toBe('/headcount/student/3001')
    const second = t(w, 'headcount-501')
    expect(second.get('[data-testid=status-pill]').text()).toBe('—')
    expect(second.findAll('[data-testid=chip]')[1]?.text()).toBe('ETR: —')
  })

  it('shows the subject tiles, activity values with the Koin separator and the badges', async () => {
    api.fetchStudentPerformance.mockResolvedValue(S6)
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    const chem = t(w, 'mastery-CHEM')
    expect(chem.text()).toContain('CH')
    expect(chem.text()).toContain('Kimia')
    expect(chem.text()).toContain('89%')
    expect(chem.text()).toContain('2 sesi · 9 soalan')
    expect(chem.get('[data-testid=pct]').classes()).toContain('text-success')
    expect(t(w, 'mastery-SEJ').get('[data-testid=pct]').classes()).toContain('text-error')
    expect(['kombo', 'rekod', 'koin', 'hari'].map((id) => num(w, `activity-${id}`))).toEqual([
      '2',
      '4',
      '1,234',
      '3',
    ])
    expect(t(w, 'badges-card').text()).toContain('Lencana (1)')
    expect(t(w, 'badge').attributes('title')).toBe('Pemula Rajin')
  })

  it('draws 90 heatmap cells oldest first and toggles the tooltip on click', async () => {
    api.fetchStudentPerformance.mockResolvedValue(S6)
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    const cells = w.findAll('[data-testid=heat-cell]')
    expect(cells).toHaveLength(90)
    expect(cells[0]?.attributes('data-date')).toBe(heatmap[0]?.date)
    expect(exists(w, 'heat-tooltip')).toBe(false)

    const cell = w.get('[data-date="2026-09-24"]')
    expect(cell.classes()).toContain('bg-primary/15')
    await cell.trigger('mouseenter')
    expect(t(w, 'heat-tooltip').text()).toBe('24/09 (Khamis) — 1 sesi')
    await cell.trigger('pointerleave', { pointerType: 'mouse' })
    expect(exists(w, 'heat-tooltip')).toBe(false)

    // Mouse: hover then click pins, but leaving with the mouse clears it again (FR-M08-42).
    await cell.trigger('mouseenter')
    await cell.trigger('click')
    expect(exists(w, 'heat-tooltip')).toBe(true)
    await cell.trigger('pointerleave', { pointerType: 'mouse' })
    expect(exists(w, 'heat-tooltip')).toBe(false)

    // Touch: a tap fires mouseenter and then click; the tooltip stays after the pointer leaves, a second tap hides it.
    await cell.trigger('mouseenter')
    await cell.trigger('click')
    expect(t(w, 'heat-tooltip').text()).toBe('24/09 (Khamis) — 1 sesi')
    await cell.trigger('pointerleave', { pointerType: 'touch' })
    expect(exists(w, 'heat-tooltip')).toBe(true)
    await cell.trigger('click')
    expect(exists(w, 'heat-tooltip')).toBe(false)
    expect(w.get('[data-testid=heatmap-card]').text()).toContain('sesi/hari')
  })

  it('links the weak topics to the focus quiz, cutting the label and leaving `level` out when unknown', async () => {
    api.fetchStudentPerformance.mockResolvedValue(S6)
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    const rows = w.findAll('[data-testid=weak-list] li')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('...')
    expect(rows[0]?.text()).toContain('CHEM · 3 percubaan')
    expect(rows[0]?.text()).toContain('Fokus 25')
    expect(rows[0]?.get('a').attributes('href')).toBe(
      '/practice/CHEM/quiz?level=11&dskp_sp_id=9001&count=25',
    )
    expect(rows[0]?.get('a').attributes('title')).toBe('Klik untuk 25 soalan fokus')
    expect(rows[1]?.text()).toContain('Topik Tanpa Kod')
    expect(rows[1]?.get('a').attributes('href')).toBe('/practice/MATH/quiz?dskp_sp_id=34&count=4')
    expect(t(w, 'weak-block').text()).toContain(
      'Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja.',
    )
  })

  it('lists the Cadangan sentences in order', async () => {
    api.fetchStudentPerformance.mockResolvedValue(S6)
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    const rows = w.findAll('[data-testid=suggestion]')
    expect(rows.map((r) => r.text())).toEqual(S6.suggestions.map((s) => s.text))
  })

  it('renders the standard 404 outcome for an unknown id and 403 for a forbidden one', async () => {
    api.fetchStudentPerformance.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(Prestasi360Page, '/prestasi/99999999', PATH)
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    setRouteOutcome(null)

    api.fetchStudentPerformance.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await render(Prestasi360Page, '/prestasi/3001', PATH)
    expect(useRouteOutcome().value).toBe(403)
  })

  it('shows the load-error box for any other failure', async () => {
    api.fetchStudentPerformance.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render(Prestasi360Page, '/prestasi/3001', PATH)
    expect(t(w, 'page-error').text()).toContain('Cuba Semula')
    expect(useRouteOutcome().value).toBeNull()
  })
})
