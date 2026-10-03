// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import KirkpatrickOverviewPage from '../../../pages/KirkpatrickOverviewPage.vue'
import { all, has, mountPage, options, overview, flat, squash, t } from '../fixtures'

const api = vi.hoisted(() => ({
  fetchKirkpatrickOverview: vi.fn(),
  fetchKirkpatrickFilterOptions: vi.fn(),
}))
vi.mock('../../../api', () => api)

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', () => outcome)

let wrapper: VueWrapper | undefined

async function open(url = '/admin/kirkpatrick', props: Record<string, unknown> = {}) {
  const prefix = url.split('?')[0]!
  const m = await mountPage(KirkpatrickOverviewPage, { basePath: prefix, ...props }, url, prefix)
  wrapper = m.wrapper
  return m
}

const values = (w: VueWrapper, id: string) => all(w, id).map((e) => e.text())

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchKirkpatrickOverview.mockResolvedValue(overview())
  api.fetchKirkpatrickFilterOptions.mockResolvedValue(options)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S1 level cards and flow (AC-M12-06.1, 06.2, 07.1)', () => {
  it('shows the four cards in order with their texts and targets', async () => {
    const { wrapper: w } = await open()
    const cards = t(w, 'kirk-levels').findAll('a')
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      '/admin/kirkpatrick/results',
      '/admin/kirkpatrick/behavior',
      '/admin/kirkpatrick/learning',
      '/admin/kirkpatrick/reaction',
    ])
    expect(flat(t(w, 'kirk-level-t4'))).toBe(
      'Tahap 4: Hasil 4.30 GPS Sekolah · 4378 rekod headcount Lihat detail',
    )
    expect(flat(t(w, 'kirk-level-t3'))).toBe(
      'Tahap 3: Tingkah Laku 946 /4158 Pelajar aktif · 20991 sesi · 82.8% ketepatan Lihat detail',
    )
    expect(flat(t(w, 'kirk-level-t2'))).toBe(
      'Tahap 2: Pembelajaran 82.8% Ketepatan · 306,133 soalan dijawab Lihat detail',
    )
    expect(flat(t(w, 'kirk-level-t1'))).toBe(
      'Tahap 1: Reaksi 4.6 /5 Kepuasan purata · 336 respon Lihat detail',
    )
  })

  it('shows the flow pills and the hint', async () => {
    const { wrapper: w } = await open()
    const flow = t(w, 'kirk-flow')
    expect(flow.text()).toContain('Klik mana-mana tahap untuk lihat detail')
    const pills = t(w, 'kirk-flow-circles').findAll('[data-testid="kirk-flow-pill"]')
    expect(pills.map((p) => p.text())).toEqual([
      '4.6/5',
      '82.8% ketepatan',
      '946 pelajar aktif',
      'GPS 4.30',
    ])
    expect(w.findAll('[data-testid="kirk-flow-list"] a')).toHaveLength(4)
  })

  it('school without SPM history: "Belum Ada Data" and pill "GPS -" (AC-M12-06.4)', async () => {
    api.fetchKirkpatrickOverview.mockResolvedValue(
      overview({ t4: { gps: null, gpsYear: null, recordsLabel: 4378 } }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick?school_id=9167')
    expect(flat(t(w, 'kirk-level-t4'))).toContain('Belum Ada Data Import keputusan peperiksaan')
    expect(t(w, 'kirk-level-t4').text()).not.toContain('rekod headcount')
    expect(values(w, 'kirk-flow-pill')).toContain('GPS -')
  })
})

describe('S1 filter (AC-M12-05.1, 05.2)', () => {
  it('lists the options, no Reset by default, and calls the API without a scope', async () => {
    const { wrapper: w } = await open()
    expect(w.findAll('[data-testid="kirk-filter-school"] option').map((o) => o.text())).toEqual([
      'Semua Sekolah',
      'SMK Demo Satu',
      'SMK Demo Dua',
    ])
    expect(w.findAll('[data-testid="kirk-filter-state"] option').map((o) => o.text())).toEqual([
      'Semua Negeri',
      'Johor',
      'Kelantan',
    ])
    expect(t(w, 'kirk-filter-apply').text()).toBe('Tapis')
    expect(has(w, 'kirk-filter-reset')).toBe(false)
    expect(api.fetchKirkpatrickOverview).toHaveBeenCalledWith(
      { schoolId: null, state: '' },
      expect.anything(),
    )
  })

  it('"Tapis" navigates with school_id and state, then Reset appears', async () => {
    const { wrapper: w, router } = await open()
    await t(w, 'kirk-filter-school').setValue('8080')
    await t(w, 'kirk-filter').trigger('submit')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.fullPath).toBe('/admin/kirkpatrick?school_id=8080&state=')
    })
    await vi.waitFor(() => {
      expect(api.fetchKirkpatrickOverview).toHaveBeenLastCalledWith(
        { schoolId: 8080, state: '' },
        expect.anything(),
      )
    })
    await vi.waitFor(() => expect(has(w, 'kirk-filter-reset')).toBe(true))
    expect(t(w, 'kirk-filter-reset').attributes('href')).toBe('/admin/kirkpatrick')
    expect((t(w, 'kirk-filter-school').element as HTMLSelectElement).value).toBe('8080')
  })

  it('a bookmarked ?state= is preloaded and sent', async () => {
    const { wrapper: w } = await open('/admin/kirkpatrick?state=Kelantan')
    expect((t(w, 'kirk-filter-state').element as HTMLSelectElement).value).toBe('Kelantan')
    expect(has(w, 'kirk-filter-reset')).toBe(true)
    expect(api.fetchKirkpatrickOverview).toHaveBeenCalledWith(
      { schoolId: null, state: 'Kelantan' },
      expect.anything(),
    )
  })
})

describe('S1 comparison (AC-M12-08.1..08.5)', () => {
  it('default: ranges, panel values, green deltas, Ringkasan', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'kirk-comparison-subtitle').text()).toBe('Januari 2026 vs September 2026')
    expect(values(w, 'kirk-panel-range')).toEqual([
      '01 Jan 2026 - 31 Jan 2026',
      '01 Sep 2026 - 25 Sep 2026',
    ])
    const panel = (id: string) =>
      t(w, id)
        .findAll('[data-testid="kirk-panel-value"]')
        .map((e) => e.text())
    expect(panel('kirk-panel-before')).toEqual(['2', '33.3%', '3', '0'])
    expect(panel('kirk-panel-after')).toEqual(['58', '87%', '13,968', '28'])
    expect(values(w, 'kirk-delta-value')).toEqual(['+56', '+53.7%', '+13965', '+28'])
    for (const d of t(w, 'kirk-deltas').element.children) {
      expect(d.getAttribute('data-tone')).toBe('up')
    }
    expect(squash(t(w, 'kirk-summary').text())).toBe(
      'Ringkasan: Peningkatan 53.7% dalam ketepatan jawapan. 56 pelajar baru mula aktif. Jumlah jawapan meningkat 465500%. 28 pelajar naik ke tahap Champion.',
    )
  })

  it('negative deltas are red with a down arrow', async () => {
    api.fetchKirkpatrickOverview.mockResolvedValue(
      overview({
        comparison: {
          ...overview().comparison,
          delta: { active: -11, accuracy: -16.6, answers: -451, champions: -2 },
          sentences: [
            'Penurunan 16.6% dalam ketepatan jawapan.',
            '11 pelajar kurang aktif berbanding sebelumnya.',
          ],
        },
      }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick?school_id=8080')
    expect(values(w, 'kirk-delta-value')).toEqual(['-11', '-16.6%', '-451', '-2'])
    expect(t(w, 'kirk-delta-active').attributes('data-tone')).toBe('down')
    expect(t(w, 'kirk-delta-active').classes()).toContain('border-red-200')
  })

  it('no data: "Tiada Data vs Tiada Data", "-" ranges, 0 values, one sentence', async () => {
    api.fetchKirkpatrickOverview.mockResolvedValue(
      overview({
        comparison: {
          subtitle: 'Tiada Data vs Tiada Data',
          before: null,
          after: null,
          delta: null,
          sentences: ['Data tidak mencukupi untuk perbandingan.'],
        },
      }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick?state=Kelantan')
    expect(t(w, 'kirk-comparison-subtitle').text()).toBe('Tiada Data vs Tiada Data')
    expect(values(w, 'kirk-panel-range')).toEqual(['-', '-'])
    expect(
      t(w, 'kirk-panel-before')
        .findAll('[data-testid="kirk-panel-value"]')
        .map((e) => e.text()),
    ).toEqual(['0', '0%', '0', '0'])
    expect(values(w, 'kirk-delta-value')).toEqual(['0', '0%', '0', '0'])
    expect(t(w, 'kirk-summary').text()).toContain('Data tidak mencukupi untuk perbandingan.')
  })
})

describe('S1 KPI row, bands and info (AC-M12-09.1..09.3)', () => {
  it('KPI links and values', async () => {
    const { wrapper: w } = await open()
    const kpis = t(w, 'kirk-kpis')
    expect(kpis.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/admin/monitoring',
      '/admin/kirkpatrick/learning',
      '/admin/monitoring',
      '/admin/kirkpatrick/learning',
    ])
    expect(flat(kpis)).toBe(
      'Pelajar Berdaftar (T4/T5) 4,158 Soalan Dijawab 306,133 Guru Aktif 277 /522 Ketepatan Keseluruhan 82.8%',
    )
  })

  it('five band tiles (counts without separator) link to behavior', async () => {
    const { wrapper: w } = await open()
    const tiles = t(w, 'kirk-bands').findAll('a')
    expect(tiles.map((a) => a.attributes('href'))).toEqual(
      Array(5).fill('/admin/kirkpatrick/behavior'),
    )
    expect(values(w, 'kirk-band-count')).toEqual(['513', '259', '169', '5', '3212'])
    expect(values(w, 'kirk-band-pct')).toEqual(['12.3%', '6.2%', '4.1%', '0.1%', '77.2%'])
    expect(t(w, 'kirk-bands').text()).toContain('Tidak Terlibat')
  })

  it('static info card text', async () => {
    const { wrapper: w } = await open()
    const text = squash(t(w, 'kirk-info').text())
    expect(text).toContain('Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan')
    expect(text).toContain(
      'Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959).',
    )
  })
})

describe('mounts', () => {
  it('guru twin builds its links from its own prefix', async () => {
    const { wrapper: w } = await open('/guru/kirkpatrick')
    expect(t(w, 'kirk-level-t2').attributes('href')).toBe('/guru/kirkpatrick/learning')
    expect(t(w, 'kirk-kpi-registered').attributes('href')).toBe('/guru/monitoring')
  })

  it('alias (detailLinks off): no level links, no "Lihat detail", monitoring links stay', async () => {
    const { wrapper: w } = await open('/admin-sekolah/kirkpatrick', { detailLinks: false })
    const hrefs = w.findAll('a').map((a) => a.attributes('href') ?? '')
    expect(hrefs).toEqual(['/admin-sekolah/monitoring', '/admin-sekolah/monitoring'])
    expect(w.text()).not.toContain('Lihat detail')
    expect(t(w, 'kirk-level-t3').text()).toContain('946/4158')
    expect(all(w, 'kirk-band-count')).toHaveLength(5)
  })
})

describe('states', () => {
  it('shows the loading line, then the content', async () => {
    let resolve!: (v: unknown) => void
    api.fetchKirkpatrickOverview.mockReturnValue(new Promise((r) => (resolve = r)))
    const { wrapper: w } = await open()
    expect(has(w, 'kirk-loading')).toBe(true)
    expect(has(w, 'kirk-levels')).toBe(false)
    resolve(overview())
    await vi.waitFor(() => expect(has(w, 'kirk-levels')).toBe(true))
    expect(has(w, 'kirk-loading')).toBe(false)
  })

  it('a server error shows the load error copy', async () => {
    api.fetchKirkpatrickOverview.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const { wrapper: w } = await open()
    expect(t(w, 'kirk-error').text()).toBe('Gagal memuatkan data. Sila cuba lagi.')
    expect(has(w, 'kirk-levels')).toBe(false)
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
  })

  it('a 403 renders the standalone 403 page in place', async () => {
    api.fetchKirkpatrickOverview.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await open()
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(403)
  })
})
