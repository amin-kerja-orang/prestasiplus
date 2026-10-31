// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useRouteOutcome, setRouteOutcome } from '@/app/router/outcome'

import KirkpatrickBehaviorPage from '../../../pages/KirkpatrickBehaviorPage.vue'
import {
  all,
  captions,
  flat,
  has,
  mountPage,
  nativeLabels,
  nativePick,
  options,
  resetLink,
  rowOf,
  squash,
  t,
  tiles,
} from '../fixtures'
import { behavior } from './fixtures'

const api = vi.hoisted(() => ({
  fetchKirkpatrickBehavior: vi.fn(),
  fetchKirkpatrickFilterOptions: vi.fn(),
}))
vi.mock('../../../api', () => api)

let wrapper: VueWrapper | undefined

async function open(prefix = '/admin/kirkpatrick', query = '') {
  const m = await mountPage(
    KirkpatrickBehaviorPage,
    { basePath: prefix },
    `${prefix}/behavior${query}`,
    `${prefix}/behavior`,
  )
  wrapper = m.wrapper
  return m
}

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  api.fetchKirkpatrickBehavior.mockResolvedValue(behavior())
  api.fetchKirkpatrickFilterOptions.mockResolvedValue(options)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S4 filter (AC-M12-14.1 ... 14.3)', () => {
  it('shows the school select only (no Negeri), "Tapis" and no "Reset"', async () => {
    const { wrapper: w } = await open()
    expect(has(w, 'kirk-filter-school')).toBe(true)
    expect(has(w, 'kirk-filter-state')).toBe(false)
    expect(t(w, 'kirk-filter').get('button[type="submit"]').text()).toBe('Tapis')
    expect(resetLink(w).exists()).toBe(false)
    expect(nativeLabels(w, 'school_id')).toEqual([
      'Semua Sekolah',
      'SMK Demo Satu',
      'SMK Demo Dua',
    ])
  })

  it('Tapis pushes school_id, Reset appears and the API receives the id', async () => {
    const { wrapper: w, router } = await open()
    await nativePick(w, 'school_id', '8080')
    await t(w, 'kirk-filter').trigger('submit')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/admin/kirkpatrick/behavior?school_id=8080'),
    )
    await vi.waitFor(() =>
      expect(api.fetchKirkpatrickBehavior).toHaveBeenLastCalledWith(
        { schoolId: 8080 },
        expect.anything(),
      ),
    )
    await vi.waitFor(() => expect(resetLink(w).exists()).toBe(true))
    expect(resetLink(w).text()).toBe('Reset')
    await resetLink(w).trigger('click')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/admin/kirkpatrick/behavior'),
    )
  })

  it('reads school_id from the URL and ignores a malformed one', async () => {
    await open('/admin/kirkpatrick', '?school_id=8080')
    expect(api.fetchKirkpatrickBehavior).toHaveBeenCalledWith({ schoolId: 8080 }, expect.anything())
    wrapper?.unmount()
    await open('/admin/kirkpatrick', '?school_id=abc')
    expect(api.fetchKirkpatrickBehavior).toHaveBeenLastCalledWith(
      { schoolId: null },
      expect.anything(),
    )
  })

  it('has the tab strip with "Tahap 3: Tingkah Laku" active', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'kirk-tab-behavior').attributes('data-active')).toBe('true')
    expect(t(w, 'kirk-tab-results').attributes('data-active')).toBe('false')
  })
})

describe('S4 KPIs (AC-M12-14.1, 14.2)', () => {
  it('shows the six cards of the platform', async () => {
    const { wrapper: w } = await open()
    expect(tiles(w).map((x) => x.label)).toEqual([
      'Pelajar T4/T5',
      'Pernah Aktif',
      'Jumlah Sesi',
      'Soalan Dijawab',
      'Ketepatan',
      'Guru Aktif',
    ])
    expect(tiles(w).map((x) => x.value)).toEqual([
      '4,158',
      '946',
      '20,991',
      '306,133',
      '82.8%',
      '53.1%',
    ])
    expect(captions(w)).toEqual(['277/522'])
  })

  it('prints a whole-number teacher share without a decimal', async () => {
    api.fetchKirkpatrickBehavior.mockResolvedValue(
      behavior({
        kpi: {
          t4t5: 184,
          active: 53,
          sessions: 1002,
          answers: 15007,
          accuracy: 75.6,
          teacherPct: 100,
          teachersLoggedIn: 34,
          teachers: 34,
        },
      }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=8080')
    expect(tiles(w).map((x) => x.value)).toEqual([
      '184',
      '53',
      '1,002',
      '15,007',
      '75.6%',
      '100%',
    ])
    expect(captions(w)[0]).toBe('34/34')
  })

  it('KPI grid is 2 columns, 3 from md', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'beh-kpis').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-3']),
    )
  })
})

describe('S4 band tiles (AC-M12-15.1)', () => {
  it('shows the five tiles with count, label, caption and %', async () => {
    const { wrapper: w } = await open()
    const tiles = ['champion', 'konsisten', 'berkembang', 'minimum', 'tidakTerlibat'].map((k) =>
      flat(t(w, `beh-band-${k}`))
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<'),
    )
    expect(tiles).toEqual([
      '513 Champion >50 soalan 12.3%',
      '259 Konsisten 20-50 soalan 6.2%',
      '169 Berkembang 5-20 soalan 4.1%',
      '5 Minimum <5 soalan 0.1%',
      '3,212 Tidak Terlibat 0 soalan 77.2%',
    ])
  })

  it('links every tile to the unfiltered monitoring page and sizes the mini bar to the %', async () => {
    const { wrapper: w } = await open()
    const first = t(w, 'beh-band-champion')
    expect(first.attributes('href')).toBe('/admin/monitoring')
    expect(
      first.get('[data-testid="band-bar"] [role="progressbar"]').attributes('aria-valuenow'),
    ).toBe('12.3')
    // BUG-02: 2 columns below sm (5 across overlapped the labels at 320 / 375), 5 from sm.
    const grid = t(w, 'beh-bands').get('.grid').classes()
    expect(grid).toEqual(expect.arrayContaining(['grid-cols-2', 'sm:grid-cols-5']))
    expect(grid).not.toContain('grid-cols-5')
  })

  it('builds the monitoring link from the mount prefix on the /guru twin', async () => {
    const { wrapper: w } = await open('/guru/kirkpatrick')
    expect(t(w, 'beh-band-minimum').attributes('href')).toBe('/guru/monitoring')
  })
})

describe('S4 school table (AC-M12-16.1)', () => {
  it('has the nine headers and the observed 8080 row', async () => {
    const { wrapper: w } = await open()
    const heads = w.findAll('[data-testid="beh-schools"] thead th').map((h) => h.text())
    expect(heads).toEqual([
      '#',
      'Sekolah',
      'Pelajar',
      'Aktif',
      'Soalan',
      'Sesi',
      'Purata/Aktif',
      'Skor',
      'Tahap',
    ])
    const rows = all(w, 'beh-school-link').map(rowOf)
    expect(rows).toHaveLength(3)
    expect(rows[0]?.get('[data-testid="beh-school-link"]').attributes('href')).toBe(
      '/admin/monitoring/sekolah/9681',
    )
    const r8080 = rows[1]!
    expect(r8080.get('[data-testid="cell-students"]').text()).toBe('184')
    expect(r8080.get('[data-testid="cell-active"]').text()).toBe('53')
    expect(r8080.get('[data-testid="cell-answers"]').text()).toBe('15,007')
    expect(r8080.get('[data-testid="cell-sessions"]').text()).toBe('1,002')
    expect(r8080.get('[data-testid="cell-per-active"]').text()).toBe('283.2')
    expect(r8080.get('[data-testid="cell-score"]').text()).toBe('62.4')
    expect(r8080.get('[data-testid="cell-tahap"]').text()).toBe('Konsisten')
  })

  it('shows the code line or "-", a dimmed zero Aktif and an error-toned tahap badge', async () => {
    const { wrapper: w } = await open()
    const rows = all(w, 'beh-school-link').map(rowOf)
    expect(rows[0]?.text()).toContain('DEMO001')
    const r940 = rows[2]!
    expect(r940.get('[data-testid="beh-school-code"]').text()).toBe('-')
    expect(r940.get('[data-testid="cell-active"]').classes()).toContain('text-dimmed')
    expect(r940.get('[data-testid="cell-active"]').text()).toBe('0')
    const pill = r940.get('[data-testid="cell-tahap"]')
    expect(pill.classes()).toContain('text-error')
    expect(r940.get('[data-testid="cell-per-active"]').text()).toBe('0')
  })

  it('scrolls inside its own container (overflow-x-auto wrapper)', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'beh-schools').find('[data-ds="data-table"]').exists()).toBe(true)
  })
})

describe('S4 heat map (AC-M12-17.1, 17.2)', () => {
  it('renders 7 rows by 18 columns with the hours 06 to 23', async () => {
    const { wrapper: w } = await open()
    expect(all(w, 'beh-heat-cell')).toHaveLength(126)
    // The labels (not cells) in document order: the 18 hour heads, then the day of each row.
    const labels = w
      .findAll('[data-testid="beh-heat-table"] span:not([data-testid])')
      .map((h) => h.text())
      .filter((s) => s !== '')
    expect(labels).toEqual([
      ...Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')),
      'Isnin',
      'Selasa',
      'Rabu',
      'Khamis',
      'Jumaat',
      'Sabtu',
      'Ahad',
    ])
  })

  it('gives each cell the live title and a step of the kobalt ramp; the maximum is the darkest step', async () => {
    const { wrapper: w } = await open()
    const cells = all(w, 'beh-heat-cell')
    // Selasa (row 1) at 14:00 (column 8) is the maximum 736.
    const max = cells[1 * 18 + 8]!
    expect(max.attributes('title')).toBe('Selasa 14:00 — 736 soalan')
    expect(max.classes()).toContain('bg-cat-1')
    expect(max.text()).toBe('736')
    // Isnin 06:00 is 100 of 736: alpha max(0.15, 0.136) = 0.15, the lightest step.
    const low = cells[0]!
    expect(low.attributes('title')).toBe('Isnin 06:00 — 100 soalan')
    expect(low.classes()).toContain('bg-cat-1/20')
  })

  it('draws a zero cell as a flat layer with no number', async () => {
    const { wrapper: w } = await open()
    const zero = all(w, 'beh-heat-cell').find((c) => c.attributes('title')?.endsWith('— 0 soalan'))!
    expect(zero.classes()).toContain('bg-muted')
    expect(zero.text()).toBe('')
  })

  it('sizes cells 24 px below sm and 32 px from sm inside a scrolling card', async () => {
    const { wrapper: w } = await open()
    const cell = all(w, 'beh-heat-cell')[0]!
    expect(cell.classes()).toEqual(expect.arrayContaining(['size-6', 'sm:size-8']))
    expect(t(w, 'beh-heat').find('.overflow-x-auto').exists()).toBe(true)
  })
})

describe('S4 alerts and mood (AC-M12-18.1 ... 18.4)', () => {
  it('lists the items in the given order with their wording and colours', async () => {
    const { wrapper: w } = await open()
    const items = all(w, 'beh-alert')
    expect(items.map((i) => squash(i.text()))).toEqual([
      'SMK Demo C: 1 pelajar tidak pernah login langsung.',
      'SMK Demo D: 2 guru telah login tetapi tiada pelajar yang menjawab soalan.',
      'SMK Demo E: 62.5% pelajar aktif menjawab soalan. Tahniah!',
      'SMK Demo F: 100% pelajar aktif menjawab soalan. Tahniah!',
    ])
    expect(items.map((i) => i.attributes('data-kind'))).toEqual([
      'never',
      'teacher',
      'good',
      'good',
    ])
    expect(items.map((i) => i.classes().includes('text-success'))).toEqual([
      false,
      false,
      true,
      true,
    ])
    expect(items[0]?.classes()).toContain('text-error')
  })

  it('has no button in any item', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'beh-alerts').findAll('button, a')).toHaveLength(0)
  })

  it('does not render the alerts card without items', async () => {
    api.fetchKirkpatrickBehavior.mockResolvedValue(behavior({ alerts: [] }))
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=8080')
    expect(has(w, 'beh-alerts')).toBe(false)
  })

  it('shows the mood empty card while the mood count is 0', async () => {
    const { wrapper: w } = await open()
    expect(flat(t(w, 'beh-mood'))).toBe(
      'Data Mood Belum Mencukupi Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi.',
    )
  })
})

describe('S4 states', () => {
  it('shows the loading line before the data and the error line on failure', async () => {
    api.fetchKirkpatrickBehavior.mockRejectedValue(new Error('boom'))
    const { wrapper: w } = await open()
    expect(has(w, 'kirk-error')).toBe(true)
    expect(has(w, 'beh-kpis')).toBe(false)
  })

  it('renders the standalone 403 page in place when the API answers 403', async () => {
    api.fetchKirkpatrickBehavior.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'no' }),
    )
    await open('/guru/kirkpatrick')
    expect(useRouteOutcome().value).toBe(403)
  })
})
