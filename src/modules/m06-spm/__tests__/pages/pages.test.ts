// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { LatihTubiConfig, LatihTubiList } from '../../api'
import DatabankPage from '../../pages/DatabankPage.vue'
import HistoryPage from '../../pages/HistoryPage.vue'
import LatihTubiConfigPage from '../../pages/LatihTubiConfigPage.vue'
import LatihTubiListPage from '../../pages/LatihTubiListPage.vue'
import SpmHubPage from '../../pages/SpmHubPage.vue'

const api = vi.hoisted(() => ({
  fetchSpmOverview: vi.fn(),
  fetchDatabank: vi.fn(),
  fetchLatihTubiList: vi.fn(),
  fetchLatihTubiConfig: vi.fn(),
}))
vi.mock('../../api', () => api)

const m05 = vi.hoisted(() => ({ fetchSessions: vi.fn() }))
vi.mock('@/modules/m05-practice', () => ({
  fetchSessions: m05.fetchSessions,
  QuizRunner: {},
  subjectGlyph: () => 'i-ph-books-duotone',
  subjectAccent: () => 'action',
}))

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string): Promise<VueWrapper> {
  const Stub = defineComponent({ setup: () => () => h('div') })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm', component: SpmHubPage },
      { path: '/spm/history', component: HistoryPage },
      { path: '/spm/latih-tubi/:code', component: LatihTubiConfigPage },
      { path: '/:rest(.*)*', component: Stub },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => {
  for (const f of [...Object.values(api), ...Object.values(m05)]) f.mockReset()
  outcome.setRouteOutcome.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S1 SpmHubPage', () => {
  beforeEach(() => {
    api.fetchSpmOverview.mockResolvedValue({
      stats: {
        totalQuestions: 20529,
        subjectCount: 25,
        yearsAvailable: 0,
        trackingAQuestions: 1769,
      },
      modules: { databank: 14673, latihTubi: 14673, trackingA: 1769, subjektifSets: 4059 },
      me: { sessions: 4, avgAccuracy: 21.8, coins: 26, answered: 84 },
    })
  })

  it('renders the pill, title, lead and the four stat cards with separators', async () => {
    const w = await render(SpmHubPage, '/spm')
    expect(t(w, 'spm-pill').text()).toBe('MOD SPM')
    expect(t(w, 'spm-title').text()).toBe('Persediaan SPM')
    expect(t(w, 'spm-lead').text()).toContain('Latihan lengkap untuk pelajar Tingkatan 4 & 5.')
    const stats = w.findAll('[data-testid^=spm-stat-]')
    const expected = [
      ['20,529', 'Jumlah Soalan'],
      ['25', 'Subjek SPM'],
      ['0', 'Tahun Tersedia'],
      ['1,769', 'Soalan Tracking A'],
    ]
    expect(stats).toHaveLength(4)
    stats.forEach((s, i) => {
      expect(s.text()).toContain(expected[i]![0])
      expect(s.text()).toContain(expected[i]![1])
    })
  })

  it('renders four whole-card links with chips and "Mula"', async () => {
    const w = await render(SpmHubPage, '/spm')
    const cards = w.findAll('[data-testid^=spm-module-]')
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      '/spm/tahun-lepas',
      '/spm/latih-tubi',
      '/spm/ramalan',
      '/spm/subjektif',
    ])
    expect(cards.map((c) => c.get('[data-testid=module-chip]').text())).toEqual([
      '14,673 soalan',
      '14,673 soalan',
      '1,769 soalan',
      '4,059 set subjektif',
    ])
    for (const c of cards) {
      expect(c.text()).toContain('Mula')
      expect(c.find('[data-testid=module-icon]').exists()).toBe(true)
    }
  })

  it('shows "Prestasi SPM Anda" with one decimal and the history link', async () => {
    const w = await render(SpmHubPage, '/spm')
    const mine = w.findAll('[data-testid^=spm-mine-]')
    ;['4', '21.8%', '26', '84'].forEach((v, i) => expect(mine[i]!.text()).toContain(v))
    expect(w.text()).toContain('Syiling Diperoleh')
    expect(t(w, 'spm-history-link').attributes('href')).toBe('/spm/history')
  })

  it('shows 0.0% for a student with no activity and an error box with a retry', async () => {
    api.fetchSpmOverview.mockResolvedValueOnce({
      stats: {
        totalQuestions: 20529,
        subjectCount: 25,
        yearsAvailable: 0,
        trackingAQuestions: 1769,
      },
      modules: { databank: 14673, latihTubi: 14673, trackingA: 1769, subjektifSets: 4059 },
      me: { sessions: 0, avgAccuracy: 0, coins: 0, answered: 0 },
    })
    const w = await render(SpmHubPage, '/spm')
    expect(t(w, 'spm-mine-accuracy').text()).toContain('0.0%')
    wrapper?.unmount()

    api.fetchSpmOverview.mockRejectedValueOnce(new Error('x'))
    const e = await render(SpmHubPage, '/spm')
    expect(e.text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(e, 'spm-retry').trigger('click')
    await flushPromises()
    expect(e.find('[data-testid=spm-stats]').exists()).toBe(true)
  })
})

describe('S2 DatabankPage', () => {
  it('lists cards with count, 5/10/20 links and a plain "Mula"', async () => {
    api.fetchDatabank.mockResolvedValue([
      {
        code: 'BM',
        name: 'Bahasa Melayu',
        nameEn: 'Malay Language',
        icon: 'fa-book-open',
        color: '#3B82F6',
        databankCount: 514,
      },
      {
        code: 'MATH',
        name: 'Matematik',
        nameEn: 'Mathematics',
        icon: 'fa-calculator',
        color: '#EF4444',
        databankCount: 1681,
      },
    ])
    const w = await render(DatabankPage, '/spm/tahun-lepas?subject=MATH')
    expect(t(w, 'spm-heading').text()).toBe('Databank Soalan SPM')
    expect(t(w, 'spm-sub').text()).toBe('Pilih subjek dan mula jawab dari bank soalan')
    expect(t(w, 'spm-back').attributes('href')).toBe('/spm')
    const cards = w.findAll('[data-testid^=databank-card-]')
    expect(cards).toHaveLength(2)
    expect(t(w, 'databank-card-MATH').get('[data-testid=databank-count]').text()).toBe(
      '1,681 soalan dalam databank',
    )
    const links = t(w, 'databank-card-BM').findAll('a')
    expect(links.map((l) => l.attributes('href'))).toEqual([
      '/spm/tahun-lepas/BM/quiz?count=5',
      '/spm/tahun-lepas/BM/quiz?count=10',
      '/spm/tahun-lepas/BM/quiz?count=20',
    ])
    const mula = t(w, 'databank-card-BM').get('[data-testid=databank-mula]')
    expect(mula.text()).toBe('Mula')
    expect(mula.element.closest('a')).toBeNull()
  })
})

describe('S2 DatabankPage empty subject (T14 B-08)', () => {
  it('a 0-question subject is not listed (V2 section 2.8)', async () => {
    api.fetchDatabank.mockResolvedValue([
      { code: 'BIO', name: 'Biologi', nameEn: 'Biology', icon: 'fa-dna', color: '#10B981', databankCount: 0 },
      { code: 'BM', name: 'Bahasa Melayu', nameEn: 'Malay Language', icon: 'fa-book-open', color: '#3B82F6', databankCount: 5 },
    ])
    const w = await render(DatabankPage, '/spm/tahun-lepas')
    expect(w.find('[data-testid=databank-card-BIO]').exists()).toBe(false)
    expect(w.findAll('[data-testid^=databank-card-]')).toHaveLength(1)
  })
})

describe('S3 LatihTubiListPage', () => {
  const card = (over: Record<string, unknown>) => ({
    code: 'BM',
    name: 'Bahasa Melayu',
    nameEn: 'Malay Language',
    icon: 'fa-book-open',
    color: '#3B82F6',
    total: 514,
    targetType: 'custom',
    targetSize: 34,
    locked: false,
    ...over,
  })
  const LIST = {
    teras: [
      card({}),
      card({
        code: 'PM',
        name: 'Pendidikan Moral',
        total: 1353,
        targetType: null,
        targetSize: null,
      }),
    ],
    elektif: [
      card({
        code: 'BA',
        name: 'Bahasa Arab',
        nameEn: 'Arabic Language',
        total: 12,
        targetType: 'latihan',
        targetSize: 40,
        locked: true,
      }),
    ],
  } as unknown as LatihTubiList

  it('renders sections with counts, target chips and the locked card', async () => {
    api.fetchLatihTubiList.mockResolvedValue(LIST)
    const w = await render(LatihTubiListPage, '/spm/latih-tubi')
    expect(t(w, 'spm-heading').text()).toBe('Latih Tubi SPM')
    expect(w.findAll('[data-testid=section-heading]').map((h) => h.text())).toEqual([
      'Subjek Teras (2)',
      'Subjek Elektif (1)',
    ])
    const bm = t(w, 'latih-tubi-card-BM')
    expect(bm.attributes('href')).toBe('/spm/latih-tubi/BM')
    expect(bm.get('[data-testid=latih-tubi-count]').text()).toBe('514 soalan')
    expect(bm.get('[data-testid=latih-tubi-target]').text()).toBe('Target Custom: 34')
    expect(t(w, 'latih-tubi-card-PM').find('[data-testid=latih-tubi-target]').exists()).toBe(false)
    const ba = t(w, 'latih-tubi-card-BA')
    expect(ba.attributes('href')).toBe('javascript:void(0)')
    expect(ba.classes()).toContain('pointer-events-none')
    expect(ba.get('[data-testid=latih-tubi-locked]').text()).toBe('Locked: 12/40')
    expect(ba.get('[data-testid=latih-tubi-count]').text()).toBe('12 soalan')
  })
})

describe('S3 LatihTubiListPage empty subject (T14 B-08)', () => {
  it('hides a subject with 0 questions, as V2 does', async () => {
    const c = (code: string, total: number) => ({
      code, name: code, nameEn: code, icon: 'fa-book-open', color: '#000', total,
      targetType: 'latihan', targetSize: 40, locked: total < 40,
    })
    api.fetchLatihTubiList.mockResolvedValue({ teras: [c('BIO', 0)], elektif: [c('BA', 0), c('EKON', 5)] })
    const w = await render(LatihTubiListPage, '/spm/latih-tubi')
    expect(w.find('[data-testid=latih-tubi-card-BIO]').exists()).toBe(false)
    expect(w.find('[data-testid=latih-tubi-card-BA]').exists()).toBe(false)
    expect(t(w, 'latih-tubi-card-EKON').get('[data-testid=latih-tubi-locked]').text()).toBe('Locked: 5/40')
    expect(w.findAll('[data-testid=section-heading]').map((h) => h.text())).toEqual([
      'Subjek Teras (0)',
      'Subjek Elektif (1)',
    ])
  })
})

describe('S4 LatihTubiConfigPage', () => {
  const MATH: LatihTubiConfig = {
    code: 'MATH',
    name: 'Matematik',
    icon: 'fa-calculator',
    color: '#EF4444',
    total: 1681,
    targetType: 'spm',
    targetSize: 40,
    levelCounts: { '10': 976, '11': 705 },
    difficultyStats: { '1': 3, '2': 514, '3': 577, '4': 85, '5': 0 },
    difficultyByLevel: {
      '10': { '1': 0, '2': 309, '3': 410, '4': 58, '5': 0 },
      '11': { '1': 0, '2': 205, '3': 167, '4': 27, '5': 0 },
    },
    countOptions: [{ value: 40, label: '40 (Target SPM)', isTarget: true }],
    defaultCount: 40,
  }
  const PERNIAGA: LatihTubiConfig = {
    ...MATH,
    code: 'PERNIAGA',
    name: 'Perniagaan',
    targetType: null,
    targetSize: null,
    countOptions: [5, 10, 20, 30, 40, 50, 60].map((v) => ({
      value: v,
      label: String(v),
      isTarget: false,
    })),
    defaultCount: 10,
  }

  it('shows header, level and difficulty counts, target option and helper', async () => {
    api.fetchLatihTubiConfig.mockResolvedValue(MATH)
    const w = await render(LatihTubiConfigPage, '/spm/latih-tubi/MATH')
    expect(t(w, 'config-title').text()).toBe('Matematik')
    expect(t(w, 'config-sub').text().replace(/\s+/g, ' ')).toBe(
      '1,681 soalan tersedia · Target SPM set: 40 soalan',
    )
    expect(t(w, 'level-10').get('[data-testid=level-count]').text()).toBe('976 soalan')
    expect(w.findAll('[data-testid=difficulty-count]').map((d) => d.text())).toEqual([
      '514 soalan',
      '577 soalan',
      '85 soalan',
      '0 soalan',
    ])
    expect(w.findAll('[data-testid^=count-]').map((c) => c.text())).toEqual(['40 (Target SPM)'])
    expect(t(w, 'config-helper').text()).toBe(
      'Set penuh target spm untuk Matematik disasar pada 40 soalan.',
    )
    expect(t(w, 'config-start').attributes('href')).toBe('/spm/latih-tubi/MATH/quiz?count=40')
  })

  it('toggles level and difficulty, switches counts and updates the href', async () => {
    api.fetchLatihTubiConfig.mockResolvedValue(MATH)
    const w = await render(LatihTubiConfigPage, '/spm/latih-tubi/MATH')
    await t(w, 'level-11').trigger('click')
    await t(w, 'difficulty-4').trigger('click')
    expect(t(w, 'config-start').attributes('href')).toBe(
      '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4',
    )
    expect(w.findAll('[data-testid=difficulty-count]').map((d) => d.text())).toEqual([
      '205 soalan',
      '167 soalan',
      '27 soalan',
      '0 soalan',
    ])
    await t(w, 'level-11').trigger('click')
    await t(w, 'difficulty-4').trigger('click')
    expect(t(w, 'config-start').attributes('href')).toBe('/spm/latih-tubi/MATH/quiz?count=40')
    expect(w.findAll('[data-testid=difficulty-count]')[0]?.text()).toBe('514 soalan')
  })

  it('offers 5-60 for a subject without a target (default 10)', async () => {
    api.fetchLatihTubiConfig.mockResolvedValue(PERNIAGA)
    const w = await render(LatihTubiConfigPage, '/spm/latih-tubi/PERNIAGA')
    expect(w.findAll('[data-testid^=count-]').map((c) => c.text())).toEqual([
      '5',
      '10',
      '20',
      '30',
      '40',
      '50',
      '60',
    ])
    expect(t(w, 'config-helper').text()).toBe('Pilih bilangan soalan ikut keperluan latihan anda.')
    expect(t(w, 'config-sub').text()).toBe('1,681 soalan tersedia')
    await t(w, 'count-30').trigger('click')
    expect(t(w, 'config-start').attributes('href')).toBe('/spm/latih-tubi/PERNIAGA/quiz?count=30')
  })

  it('answers an unknown code with the global 404 outcome', async () => {
    api.fetchLatihTubiConfig.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(LatihTubiConfigPage, '/spm/latih-tubi/XYZ')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })
})

describe('S10 HistoryPage', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'a',
    mode: 'past_year',
    subjectId: 3,
    subjectCode: 'MATH',
    questionCount: 5,
    correctCount: 1,
    percent: 20,
    coinsEarned: 1,
    timeSpent: 36,
    completedAt: '2026-05-19T03:26:00+08:00',
    ...over,
  })
  const META = {
    activeType: null,
    stats: { sessions: 4, avgAccuracyPct: 21.8, coins: 26, answered: 84 },
  }

  it('renders stats, filters and rows with exact texts', async () => {
    m05.fetchSessions.mockResolvedValue({
      data: [
        row({}),
        row({
          id: 'b',
          mode: 'latih_tubi',
          questionCount: 34,
          correctCount: 11,
          percent: 32,
          coinsEarned: 11,
          timeSpent: 105,
        }),
      ],
      meta: META,
    })
    const w = await render(HistoryPage, '/spm/history')
    expect(t(w, 'spm-heading').text()).toBe('Sejarah Kuiz SPM')
    const hs = w.findAll('[data-testid^=history-stat-]')
    ;['4', '21.8%', '26', '84'].forEach((v, i) => expect(hs[i]!.text()).toContain(v))
    expect(w.text()).toContain('Jumlah Syiling')
    expect(m05.fetchSessions).toHaveBeenCalledWith(
      { modes: ['past_year', 'latih_tubi', 'ramalan'], type: null },
      expect.anything(),
    )
    const rows = w.findAll('[data-testid=history-row]')
    expect(rows).toHaveLength(2)
    const first = rows[0]!
    expect(first.get('[data-testid=row-score]').text()).toBe('20%')
    expect(first.get('[data-testid=row-badge]').text()).toBe('Tahun Lepas')
    expect(first.get('[data-testid=row-correct]').text()).toBe('1/5 betul')
    expect(first.get('[data-testid=row-meta]').text().replace(/\s+/g, ' ')).toBe(
      '19 May 2026, 03:26 AM · 0m 36s',
    )
    expect(first.get('[data-testid=row-coins]').text()).toBe('+1 🪙')
    expect(t(w, 'history-filter-all').attributes('data-active')).toBe('true')
  })

  it('marks the active filter and passes the type', async () => {
    m05.fetchSessions.mockResolvedValue({
      data: [row({})],
      meta: { ...META, activeType: 'past_year' },
    })
    const w = await render(HistoryPage, '/spm/history?type=past_year')
    expect(m05.fetchSessions.mock.calls[0]?.[0]).toEqual({
      modes: ['past_year', 'latih_tubi', 'ramalan'],
      type: 'past_year',
    })
    expect(t(w, 'history-filter-past_year').attributes('data-active')).toBe('true')
    expect(t(w, 'history-filter-all').attributes('data-active')).toBe('false')
    expect(t(w, 'history-filter-latih_tubi').attributes('href')).toBe(
      '/spm/history?type=latih_tubi',
    )
  })

  it('treats an unknown type as all rows with no filter active', async () => {
    m05.fetchSessions.mockResolvedValue({ data: [row({})], meta: META })
    const w = await render(HistoryPage, '/spm/history?type=zzz')
    expect(m05.fetchSessions.mock.calls[0]?.[0].type).toBeNull()
    for (const id of ['all', 'past_year', 'latih_tubi', 'ramalan']) {
      expect(t(w, `history-filter-${id}`).attributes('data-active')).toBe('false')
    }
  })

  it('shows the empty block with "Mula Kuiz SPM"', async () => {
    m05.fetchSessions.mockResolvedValue({ data: [], meta: META })
    const w = await render(HistoryPage, '/spm/history?type=ramalan')
    expect(t(w, 'history-empty').text()).toContain('Belum Ada Sejarah')
    expect(t(w, 'history-empty').text()).toContain(
      'Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini.',
    )
    expect(t(w, 'history-empty-cta').attributes('href')).toBe('/spm')
  })
})
