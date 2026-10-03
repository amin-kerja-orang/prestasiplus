// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { TeacherReport } from '../../api/types'
import { LAPORAN_COPY } from '../../components/laporan/copy'
import LaporanPage from '../../pages/LaporanPage.vue'
import { emptyReport, student, teacherReport } from './fixtures'

const api = vi.hoisted(() => ({ fetchTeacherReport: vi.fn() }))
vi.mock('../../api', () => api)

let wrapper: VueWrapper | undefined
let router: Router

async function mountAt(url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/guru/laporan', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(LaporanPage, {
    global: { plugins: [router], stubs: { ChartCanvas: true } },
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()
const text = (w: VueWrapper, id: string) => t(w, id).text().replace(/\s+/g, ' ')

function respond(
  report: TeacherReport | ((q: { range?: number; classroomId?: number }) => TeacherReport),
) {
  api.fetchTeacherReport.mockImplementation((q: { range?: number; classroomId?: number }) =>
    Promise.resolve(typeof report === 'function' ? report(q) : report),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  respond(emptyReport())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S1 Laporan: admin zero state (E2E-M11-09, E2E-M11-07)', () => {
  it('shows the zero cards with no red line and "-%"', async () => {
    const w = await mountAt('/guru/laporan')
    expect(text(w, 'card-login')).toContain('0%')
    expect(text(w, 'card-login')).toContain('0 / 0 pelajar')
    expect(has(w, 'card-login-missing')).toBe(false)
    expect(text(w, 'card-latihan')).toContain('0 / 0 pelajar')
    expect(text(w, 'card-aktiviti')).toContain('30 hari lepas')
    expect(t(w, 'card-aktiviti').get('[data-testid="card-value"]').text()).toBe('0')
    expect(t(w, 'card-skor').get('[data-testid="card-value"]').text()).toBe('-%')
    expect(text(w, 'card-login')).toContain('Klik untuk lihat senarai')
    expect(text(w, 'card-skor')).toContain('Klik untuk lihat pecahan')
  })

  it('offers only "Semua Kelas" and marks "30 Hari" active', async () => {
    const w = await mountAt('/guru/laporan')
    expect(w.text()).toContain('Tapis:')
    const options = w.findAll('[data-testid="filter-classroom"] option')
    expect(options.map((o) => o.text())).toEqual(['Semua Kelas'])
    expect(t(w, 'range-30').attributes('data-active')).toBe('true')
    expect(t(w, 'range-7').attributes('data-active')).toBe('false')
    expect(t(w, 'range-7').attributes('href')).toBe('/guru/laporan?range=7')
    expect(t(w, 'range-90').attributes('href')).toBe('/guru/laporan?range=90')
  })

  it.each(['999', 'abc', '', '-7', '7.5'])('treats range=%s as 30', async (raw) => {
    const w = await mountAt(`/guru/laporan?range=${raw}`)
    expect(api.fetchTeacherReport).toHaveBeenCalledWith({ range: 30 }, expect.anything())
    expect(t(w, 'range-30').attributes('data-active')).toBe('true')
  })

  it('shows "Belum ada aktiviti" and the proposed empty latihan copy', async () => {
    const w = await mountAt('/guru/laporan')
    expect(text(w, 'list-active-empty')).toBe('Belum ada aktiviti')
    expect(text(w, 'list-idle-empty')).toBe('Semua pelajar sudah aktif buat latihan!')
  })

  it.each([
    ['7', '7 hari lepas'],
    ['90', '90 hari lepas'],
  ])('range=%s changes the card and trend labels', async (range, label) => {
    respond((q) => emptyReport({ range: q.range as 7 | 90 }))
    const w = await mountAt(`/guru/laporan?range=${range}`)
    expect(text(w, 'card-aktiviti')).toContain(label)
    expect(text(w, 'trend-range')).toBe(label)
  })
})

describe('S1 Laporan: teacher view (E2E-M11-10, 08)', () => {
  beforeEach(() => respond(teacherReport()))

  it('shows 100 % cards and the activity and score figures', async () => {
    const w = await mountAt('/guru/laporan')
    expect(text(w, 'card-login')).toContain('100%')
    expect(text(w, 'card-login')).toContain('8 / 8 pelajar')
    expect(has(w, 'card-login-missing')).toBe(false)
    expect(text(w, 'card-latihan')).toContain('100%')
    expect(t(w, 'card-aktiviti').get('[data-testid="card-value"]').text()).toBe('14')
    expect(t(w, 'card-skor').get('[data-testid="card-value"]').text()).toBe('46%')
  })

  it('shows the red "belum pernah login" line only when some pupils never logged in', async () => {
    respond(teacherReport({ population: { total: 8, loggedIn: 5, practised: 8 } }))
    const w = await mountAt('/guru/laporan')
    expect(text(w, 'card-login')).toContain('63%')
    expect(text(w, 'card-login-missing')).toBe('3 belum pernah login')
  })

  it('lists the class options with the current class selected', async () => {
    respond(teacherReport({ classroomId: 2001 }))
    const w = await mountAt('/guru/laporan?range=7&classroom_id=2001')
    expect(api.fetchTeacherReport).toHaveBeenCalledWith(
      { range: 7, classroomId: 2001 },
      expect.anything(),
    )
    const select = t(w, 'filter-classroom').element as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'Semua Kelas',
      '5 MARIKH - Kimia',
      '5 MARIKH - Sejarah',
    ])
    expect(select.value).toBe('2001')
  })

  it('changing the class keeps the range (?range=7&classroom_id=2001)', async () => {
    const w = await mountAt('/guru/laporan?range=7')
    const select = t(w, 'filter-classroom')
    ;(select.element as HTMLSelectElement).value = '2001'
    await select.trigger('change')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ range: '7', classroom_id: '2001' })
    expect(api.fetchTeacherReport).toHaveBeenLastCalledWith(
      { range: 7, classroomId: 2001 },
      expect.anything(),
    )
  })

  it('a range pill drops the class (?range=90 only)', async () => {
    const w = await mountAt('/guru/laporan?range=7&classroom_id=2001')
    await t(w, 'range-90').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/guru/laporan?range=90')
    expect(api.fetchTeacherReport).toHaveBeenLastCalledWith({ range: 90 }, expect.anything())
  })

  it('"Paling Aktif" lists the active pupils with "{n} aktiviti"', async () => {
    const w = await mountAt('/guru/laporan')
    const rows = t(w, 'list-active-rows').findAll('[data-testid="student-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Murid Demo 01')
    expect(rows[0]!.get('[data-testid="student-activities"]').text()).toBe('3 aktiviti')
  })

  it('the idle list shows the pupils with "Belum pernah login" only for those who never logged in', async () => {
    respond(
      teacherReport({
        notPractised: [
          student(1, 'Murid A', { neverLoggedIn: true }),
          student(2, 'Murid B', { neverLoggedIn: false }),
        ],
      }),
    )
    const w = await mountAt('/guru/laporan')
    const rows = t(w, 'list-idle-rows').findAll('[data-testid="student-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('[data-testid="student-never"]').text()).toBe('Belum pernah login')
    expect(rows[1]!.find('[data-testid="student-never"]').exists()).toBe(false)
    expect(rows[0]!.get('[data-testid="student-email"]').classes()).toContain('truncate')
  })
})

describe('S1 Laporan: expandable cards (FR-M11-17, E2E-M11-11/12)', () => {
  it('opens one panel at a time, with ring, and closes on a second click', async () => {
    const w = await mountAt('/guru/laporan')
    expect(has(w, 'panel-login')).toBe(false)

    await t(w, 'card-login').trigger('click')
    expect(has(w, 'panel-login')).toBe(true)
    expect(t(w, 'card-login').classes()).toContain('ring-blue-400')
    expect(t(w, 'card-login').attributes('data-open')).toBe('true')

    await t(w, 'card-skor').trigger('click')
    expect(has(w, 'panel-login')).toBe(false)
    expect(has(w, 'panel-skor')).toBe(true)
    expect(t(w, 'card-skor').classes()).toContain('ring-amber-400')

    await t(w, 'card-skor').trigger('click')
    expect(has(w, 'panel-skor')).toBe(false)
    expect(t(w, 'card-skor').classes().join(' ')).not.toContain('ring-2')
  })

  it('login and latihan panels show the zero copy', async () => {
    const w = await mountAt('/guru/laporan')
    await t(w, 'card-login').trigger('click')
    expect(text(w, 'panel-login')).toContain('Pelajar Belum Pernah Login (0)')
    expect(text(w, 'panel-login')).toContain('Semua pelajar sudah pernah login!')
    await t(w, 'card-latihan').trigger('click')
    expect(text(w, 'panel-latihan')).toContain('Pelajar Belum Pernah Buat Latihan (0)')
    expect(text(w, 'panel-latihan')).toContain('Semua pelajar sudah aktif buat latihan!')
  })

  it('the login panel lists every pupil who never logged in, the latihan panel every pupil without practice', async () => {
    const never = Array.from({ length: 12 }, (_, i) =>
      student(100 + i, `Murid ${i}`, { neverLoggedIn: true }),
    )
    respond(
      teacherReport({
        population: { total: 20, loggedIn: 8, practised: 8 },
        notLoggedIn: never,
        notPractised: never.slice(0, 10),
        notPractisedAll: never,
      }),
    )
    const w = await mountAt('/guru/laporan')
    await t(w, 'card-login').trigger('click')
    expect(text(w, 'panel-login')).toContain('Pelajar Belum Pernah Login (12)')
    expect(t(w, 'panel-login-list').findAll('li')).toHaveLength(12)
    await t(w, 'card-latihan').trigger('click')
    expect(text(w, 'panel-latihan')).toContain('Pelajar Belum Pernah Buat Latihan (12)')
    expect(t(w, 'panel-latihan-list').findAll('li')).toHaveLength(12)
    // the list card is capped at 10 (BR-M11-07)
    expect(t(w, 'list-idle-rows').findAll('li')).toHaveLength(10)
  })

  it('the activity panel title follows the range and shows the 7 tiles', async () => {
    respond((q) => teacherReport({ range: q.range as 7 }))
    const w = await mountAt('/guru/laporan?range=7')
    await t(w, 'card-aktiviti').trigger('click')
    expect(text(w, 'panel-title')).toBe('Pecahan Aktiviti (7 Hari Lepas)')
    const tiles = w.findAll(
      '[data-testid="panel-aktiviti"] [data-testid^="tile-"]:not([data-testid="tile-value"])',
    )
    expect(tiles.map((x) => x.text().replace(/^(\d+)/, '$1 '))).toEqual([
      '14 Kuiz',
      '0 Struktur',
      '0 Latih Tubi',
      '0 Tracking A',
      '0 Battle',
      '0 Permainan',
      '14 Jumlah',
    ])
  })

  it('the score panel has 5 bars (no Permainan); "-%" is red over an empty red-400 bar', async () => {
    respond(teacherReport())
    const w = await mountAt('/guru/laporan')
    await t(w, 'card-skor').trigger('click')
    const panel = t(w, 'panel-skor')
    expect(panel.text()).toContain('Pecahan Skor Purata')
    expect(panel.text()).not.toContain('Permainan')
    expect(
      panel.findAll(
        '[data-testid^="bar-"]:not([data-testid="bar-value"]):not([data-testid="bar-fill"])',
      ),
    ).toHaveLength(5)
    const kuiz = t(w, 'bar-kuiz')
    expect(kuiz.get('[data-testid="bar-value"]').text()).toBe('46%')
    expect(kuiz.get('[data-testid="bar-value"]').classes()).toContain('text-red-600')
    expect(kuiz.get('[data-testid="bar-fill"]').attributes('style')).toContain('width: 46%')
    const struktur = t(w, 'bar-struktur')
    expect(struktur.get('[data-testid="bar-value"]').text()).toBe('-%')
    expect(struktur.get('[data-testid="bar-value"]').classes()).toContain('text-red-500')
    expect(struktur.get('[data-testid="bar-fill"]').classes()).toContain('bg-red-400')
    expect(struktur.get('[data-testid="bar-fill"]').attributes('style')).toContain('width: 0%')
  })

  it('uses the green / amber bands for higher scores (BR-M11-22)', async () => {
    respond(
      teacherReport({
        score: {
          overall: 70,
          byType: { kuiz: 70, struktur: null, latihTubi: 55, trackingA: null, battle: null },
        },
      }),
    )
    const w = await mountAt('/guru/laporan')
    await t(w, 'card-skor').trigger('click')
    expect(t(w, 'bar-kuiz').get('[data-testid="bar-value"]').classes()).toContain('text-green-600')
    expect(t(w, 'bar-latihTubi').get('[data-testid="bar-value"]').classes()).toContain(
      'text-amber-600',
    )
  })

  it('a query change closes the open panel (a page load does)', async () => {
    const w = await mountAt('/guru/laporan')
    await t(w, 'card-login').trigger('click')
    expect(has(w, 'panel-login')).toBe(true)
    await router.push('/guru/laporan?range=7')
    await flushPromises()
    expect(has(w, 'panel-login')).toBe(false)
  })
})

describe('S1 Laporan: trend chart (FR-M11-22)', () => {
  it('passes one label and count per day and the live dataset style', async () => {
    const trend = [
      { date: '15/09', count: 4 },
      { date: '16/09', count: 0 },
    ]
    respond(teacherReport({ trend }))
    const w = await mountAt('/guru/laporan')
    const chart = w.findComponent({ name: 'ChartCanvas' })
    expect(chart.exists()).toBe(true)
    const props = chart.props() as {
      type: string
      data: { labels: string[]; datasets: Record<string, unknown>[] }
      options: {
        plugins: {
          legend: { display: boolean }
          tooltip: {
            backgroundColor: string
            callbacks: { label: (c: { parsed: { y: number } }) => string }
          }
        }
        scales: { x: { ticks: unknown }; y: unknown }
      }
      testId: string
    }
    expect(props.type).toBe('line')
    expect(props.testId).toBe('laporan-trend-chart')
    expect(props.data.labels).toEqual(['15/09', '16/09'])
    expect(props.data.datasets[0]).toMatchObject({
      label: 'Aktiviti',
      data: [4, 0],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
    })
    expect(props.options.plugins.legend.display).toBe(false)
    expect(props.options.plugins.tooltip.backgroundColor).toBe('#1e293b')
    expect(props.options.plugins.tooltip.callbacks.label({ parsed: { y: 3 } })).toBe('3 aktiviti')
    expect(props.options.scales.x.ticks).toEqual({ font: { size: 12 }, maxTicksLimit: 15 })
    expect(props.options.scales.y).toMatchObject({
      beginAtZero: true,
      ticks: { stepSize: 1, font: { size: 12 } },
    })
    expect(text(w, 'trend-card')).toContain(LAPORAN_COPY.trendTitle)
  })
})

describe('S1 Laporan: states', () => {
  it('shows a spinner until the report arrives', async () => {
    let release!: (r: TeacherReport) => void
    api.fetchTeacherReport.mockImplementation(() => new Promise((res) => (release = res)))
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/guru/laporan', component: { template: '<div />' } }],
    })
    await router.push('/guru/laporan')
    wrapper = mount(LaporanPage, { global: { plugins: [router], stubs: { ChartCanvas: true } } })
    expect(has(wrapper, 'laporan-loading')).toBe(true)
    release(emptyReport())
    await flushPromises()
    expect(has(wrapper, 'laporan-loading')).toBe(false)
    expect(has(wrapper, 'summary-cards')).toBe(true)
  })

  // @provisional: the error copy is PROPOSED (no M11 copy in the SRS)
  it('@provisional shows the error message when the request fails', async () => {
    api.fetchTeacherReport.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await mountAt('/guru/laporan')
    expect(w.text()).toContain('Ralat berlaku. Sila cuba lagi.')
    expect(has(w, 'summary-cards')).toBe(false)
  })
})
