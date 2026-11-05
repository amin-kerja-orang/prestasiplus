// @vitest-environment jsdom
/**
 * M25-T2 S1 page and components (SRS M25 v1.2 FR-M25-09..25) against a mocked client: exact copy, order,
 * links, band classes, the grey tile, the empty state, loading, error, and the hidden Cikgu Pakar block.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { HeatmapChapter, HeatmapResponse } from '../api'
import {
  bandCellClass,
  cellHref,
  figuresLine,
  groupDigits,
  ratingText,
  tileLine,
} from '../components/heatmap/heatmap-copy'
import HeatmapTopikLemahPage from '../pages/HeatmapTopikLemahPage.vue'

const api = vi.hoisted(() => ({ getHeatmap: vi.fn(), getDutaRecommendation: vi.fn() }))
vi.mock('../api/heatmap', () => api)

const tile = (
  id: string,
  number: number | null,
  name: string,
  attempts: number,
  correct: number,
  accuracy: number | null,
  state: HeatmapChapter['state'],
): HeatmapChapter => ({ id, number, name, attempts, correct, accuracy, state })

const DATA: HeatmapResponse = {
  subjects: [
    {
      id: '1',
      code: 'BM',
      name: 'Bahasa Melayu',
      chapters: [
        tile('87', 1, 'Kemahiran Bahasa Tingkatan 4', 10, 4, 40, 'red'),
        tile('36', 2, 'Kemahiran Membaca', 7, 4, 57.1, 'amber'),
        tile('2', 3, 'Kemahiran Menulis', 1200, 960, 80, 'green'),
        tile('3', 4, 'Aspek Tatabahasa', 0, 0, null, 'belum-cuba'),
        tile('4', null, 'Tanpa Bab', 3, 1, 33.3, 'red'),
      ],
    },
    {
      id: '5',
      code: 'SEJ',
      name: 'Sejarah',
      chapters: [tile('382', 1, 'Sejarah Tingkatan 5 KSSM', 40, 14, 35, 'red')],
    },
  ],
}

let wrapper: VueWrapper | undefined

async function mountPage(heat: HeatmapResponse | ApiError | 'pending') {
  if (heat === 'pending') api.getHeatmap.mockReturnValue(new Promise(() => undefined))
  else if (heat instanceof ApiError) api.getHeatmap.mockRejectedValue(heat)
  else api.getHeatmap.mockResolvedValue(heat)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(HeatmapTopikLemahPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  api.getHeatmap.mockReset()
  api.getDutaRecommendation.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('copy helpers', () => {
  it('groups digits from 1,000 and formats the figures line and rating', () => {
    expect(groupDigits(999)).toBe('999')
    expect(groupDigits(1000)).toBe('1,000')
    expect(figuresLine(1200, 80)).toBe('1,200 cuba · 80% betul')
    expect(figuresLine(7, 57.1)).toBe('7 cuba · 57% betul')
    expect(figuresLine(2, 62.5)).toBe('2 cuba · 63% betul')
    expect(figuresLine(1, 0.5)).toBe('1 cuba · 1% betul')
    expect(ratingText(4.9)).toBe('4.90')
  })
})

describe('tile helpers', () => {
  it('a grey tile reads "Belum cuba", the others the figures line', () => {
    expect(tileLine(tile('1', 1, 'x', 0, 0, null, 'belum-cuba'))).toBe('Belum cuba')
    expect(tileLine(tile('1', 1, 'x', 10, 4, 40, 'red'))).toBe('10 cuba · 40% betul')
    expect(tileLine(tile('1', 1, 'x', 1, 1, 100, 'green'))).toBe('1 cuba · 100% betul')
  })
  it('has a grey class and the V3 classes for the bands', () => {
    expect(bandCellClass('belum-cuba')).toContain('text-muted')
    expect(bandCellClass('red')).toContain('bg-heat')
    expect(bandCellClass('amber')).toContain('bg-heat/35')
    expect(bandCellClass('green')).toContain('bg-elevated')
  })
  it('builds the tile link from the subject code only (Q-1), no query', () => {
    expect(cellHref({ code: 'MATH' })).toBe('/practice/chapter/MATH')
  })
})

describe('HeatmapTopikLemahPage', () => {
  it('shows only the spinner while #1 is pending (no cell, no hero)', async () => {
    const w = await mountPage('pending')
    expect(w.find('[data-testid="heatmap-loading"]').exists()).toBe(true)
    expect(w.find('[data-testid="heatmap-hero"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="heatmap-cell"]')).toHaveLength(0)
  })

  it('renders hero, legend, subject blocks and cells with exact copy and the practice link', async () => {
    const w = await mountPage(DATA)
    expect(w.get('h1').text()).toBe('Heatmap Topik Lemah')
    expect(w.get('[data-testid="heatmap-hero"] p').text()).toBe(
      'Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar.',
    )
    expect(w.findAll('[data-testid="heatmap-legend"] li').map((l) => l.text())).toEqual([
      'Lemah (< 50%)',
      'Sederhana (50-79%)',
      'Mantap (≥ 80%)',
      'Belum cuba',
    ])
    expect(w.findAll('h2').map((h) => h.text())).toEqual(['Bahasa Melayu', 'Sejarah'])
    const cells = w.findAll('[data-testid="heatmap-cell"]')
    expect(cells.map((c) => c.text())).toEqual([
      'Kemahiran Bahasa Tingkatan 410 cuba · 40% betul',
      'Kemahiran Membaca7 cuba · 57% betul',
      'Kemahiran Menulis1,200 cuba · 80% betul',
      'Aspek TatabahasaBelum cuba',
      'Tanpa Bab3 cuba · 33% betul',
      'Sejarah Tingkatan 5 KSSM40 cuba · 35% betul',
    ])
    expect(cells.map((c) => c.attributes('href'))).toEqual([
      ...Array(5).fill('/practice/chapter/BM'),
      '/practice/chapter/SEJ',
    ])
    for (const c of cells) expect(c.attributes('title')).toBeUndefined()
    expect(cells.map((c) => c.attributes('data-band'))).toEqual([
      'red',
      'amber',
      'green',
      'belum-cuba',
      'red',
      'red',
    ])
    expect(cells[0]!.classes()).toContain('bg-heat')
    expect(cells[1]!.classes()).toContain('bg-heat/35')
    expect(cells[2]!.classes()).toContain('bg-elevated')
    expect(cells[3]!.classes()).toContain('text-muted')
    // A 10-attempt tile and a grey tile need no minimum of 5 (a 3-attempt tile is shown).
    expect(cells[4]!.text()).toContain('3 cuba')
    // The grid is auto-fill (AC-MUR-14-4).
    expect(w.get('[data-testid="heatmap-grid"]').classes().join(' ')).toContain(
      'repeat(auto-fill,minmax(12rem,1fr))',
    )
    expect(w.find('[data-testid="heatmap-empty"]').exists()).toBe(false)
  })

  it('renders no gray cell and no subject block for an empty heatmap, with the SERVER empty state', async () => {
    const w = await mountPage({ subjects: [] })
    expect(w.findAll('[data-testid="heatmap-cell"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="heatmap-subject"]')).toHaveLength(0)
    expect(w.find('[data-testid="heatmap-hero"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="heatmap-legend"] li')).toHaveLength(4)
    const empty = w.get('[data-testid="heatmap-empty"]')
    expect(empty.text()).toContain('Belum ada data heatmap lagi.')
    expect(empty.text()).toContain(
      'Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini.',
    )
    const button = w.get('[data-testid="heatmap-empty-button"]')
    expect(button.text()).toBe('Mula Latih Tubi')
    expect(button.attributes('href')).toBe('/practice')
  })

  it('shows the error box and no partial cell when #1 fails', async () => {
    const w = await mountPage(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan ujian' }),
    )
    expect(w.get('[data-testid="heatmap-error"]').text()).toContain('Ralat pelayan ujian')
    expect(w.findAll('[data-testid="heatmap-cell"]')).toHaveLength(0)
    expect(w.find('[data-testid="heatmap-hero"]').exists()).toBe(false)
  })

  it('hides the Cikgu Pakar block in R1 (FR-MUR-14-2) and does not call #2', async () => {
    const w = await mountPage(DATA)
    expect(w.find('[data-testid="cikgu-pakar"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Cikgu Pakar')
    expect(api.getDutaRecommendation).not.toHaveBeenCalled()
  })

  it('calls only #1, once, with no user parameter', async () => {
    await mountPage(DATA)
    expect(api.getHeatmap).toHaveBeenCalledTimes(1)
    expect(Object.keys(api.getHeatmap.mock.calls[0]![0] as object)).toEqual(['signal'])
  })
})
