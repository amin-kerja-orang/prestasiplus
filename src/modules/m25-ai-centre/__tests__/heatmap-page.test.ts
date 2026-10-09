// @vitest-environment jsdom
/**
 * M25-T2 S1 page and components (SRS M25 v1.2 FR-M25-09..25) against a mocked client: exact copy, order,
 * links, band classes, the empty state, loading, error, and the hidden Cikgu Pakar block.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { DutaCard, HeatmapResponse } from '../api'
import { figuresLine, groupDigits, ratingText } from '../components/heatmap/heatmap-copy'
import HeatmapTopikLemahPage from '../pages/HeatmapTopikLemahPage.vue'

const api = vi.hoisted(() => ({ getHeatmap: vi.fn(), getDutaRecommendation: vi.fn() }))
vi.mock('../api/heatmap', () => api)

const CARD: DutaCard = {
  slug: 'cikgu-demo-matematik',
  name: 'Cikgu Demo Matematik',
  initials: 'CM',
  tier: 'bintang',
  tagline: 'Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.',
  subject: 'Matematik',
  state: 'Johor',
  rating: 4.9,
  active: true,
}

const DATA: HeatmapResponse = {
  subjects: [
    {
      subjectId: 1,
      name: 'Bahasa Melayu',
      topics: [
        { chapterId: 87, name: 'Kemahiran Bahasa Tingkatan 4', attempts: 5, correct: 0, percent: 0, band: 'red' },
        { chapterId: 36, name: 'Kemahiran Membaca', attempts: 5, correct: 3, percent: 60, band: 'amber' },
        { chapterId: 2, name: 'Kemahiran Menulis', attempts: 1200, correct: 960, percent: 80, band: 'green' },
      ],
    },
    {
      subjectId: 5,
      name: 'Sejarah',
      topics: [
        { chapterId: 382, name: 'Sejarah Tingkatan 5 KSSM', attempts: 40, correct: 14, percent: 35, band: 'red' },
      ],
    },
  ],
}

let wrapper: VueWrapper | undefined

async function mountPage(
  heat: HeatmapResponse | ApiError | 'pending',
  duta: DutaCard | null | Error = CARD,
) {
  if (heat === 'pending') api.getHeatmap.mockReturnValue(new Promise(() => undefined))
  else if (heat instanceof ApiError) api.getHeatmap.mockRejectedValue(heat)
  else api.getHeatmap.mockResolvedValue(heat)
  if (duta instanceof Error) api.getDutaRecommendation.mockRejectedValue(duta)
  else api.getDutaRecommendation.mockResolvedValue(duta)
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
    expect(ratingText(4.9)).toBe('4.90')
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
      'Kemahiran Bahasa Tingkatan 45 cuba · 0% betul',
      'Kemahiran Membaca5 cuba · 60% betul',
      'Kemahiran Menulis1,200 cuba · 80% betul',
      'Sejarah Tingkatan 5 KSSM40 cuba · 35% betul',
    ])
    for (const c of cells) {
      expect(c.attributes('href')).toBe('/practice/chapter')
      expect(c.attributes('title')).toBeUndefined()
    }
    expect(cells.map((c) => c.attributes('data-band'))).toEqual(['red', 'amber', 'green', 'red'])
    expect(cells[0]!.classes()).toContain('bg-red-100')
    expect(cells[1]!.classes()).toContain('bg-amber-100')
    expect(cells[2]!.classes()).toContain('bg-emerald-100')
    expect(w.find('[data-testid="heatmap-empty"]').exists()).toBe(false)
  })

  it('renders no gray cell and no subject block for an empty heatmap, with the SERVER empty state', async () => {
    const w = await mountPage({ subjects: [] })
    expect(w.findAll('[data-testid="heatmap-cell"]')).toHaveLength(0)
    expect(w.findAll('h2')).toHaveLength(0)
    expect(w.find('[data-testid="heatmap-hero"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="heatmap-legend"] li')).toHaveLength(4)
    const empty = w.get('[data-testid="heatmap-empty"]')
    expect(empty.text()).toContain('Belum ada data heatmap.')
    expect(empty.text()).toContain(
      'Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini.',
    )
    const button = w.get('[data-testid="heatmap-empty-button"]')
    expect(button.text()).toBe('Mula Latih Tubi')
    expect(button.attributes('href')).toBe('/practice')
  })

  it('shows the error box and no partial cell when #1 fails', async () => {
    const w = await mountPage(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan ujian' }))
    expect(w.get('[data-testid="heatmap-error"]').text()).toContain('Ralat pelayan ujian')
    expect(w.findAll('[data-testid="heatmap-cell"]')).toHaveLength(0)
    expect(w.find('[data-testid="heatmap-hero"]').exists()).toBe(false)
  })

  it('renders the Cikgu Pakar card above the hero with initials, name h4, tagline and four pills', async () => {
    const w = await mountPage(DATA)
    const block = w.get('[data-testid="cikgu-pakar"]')
    expect(block.text()).toContain('🌟 Cikgu Pakar Untuk Topik Lemah')
    const order = w.findAll('[data-testid="cikgu-pakar"], [data-testid="heatmap-hero"], h2')
    expect(order.map((e) => e.attributes('data-testid') ?? e.text())).toEqual([
      'cikgu-pakar',
      'heatmap-hero',
      'Bahasa Melayu',
      'Sejarah',
    ])
    const card = w.get('[data-testid="cikgu-card"]')
    expect(card.attributes('href')).toBe('/bilik-duta/cikgu-demo-matematik')
    expect(card.attributes('title')).toBeUndefined()
    expect(w.get('[data-testid="cikgu-avatar"]').text()).toBe('CM')
    expect(w.get('[data-testid="cikgu-avatar"]').classes()).toEqual(
      expect.arrayContaining(['rounded-[50%]', 'size-14', 'from-indigo-700', 'to-fuchsia-600']),
    )
    expect(w.get('h4').text()).toBe('Cikgu Demo Matematik')
    expect(w.get('[data-testid="cikgu-tagline"]').text()).toBe(CARD.tagline)
    const pills = w.get('[data-testid="cikgu-pills"]').findAll('span')
    expect(pills.map((p) => p.text())).toEqual([
      '🥇 Duta Bintang',
      '📚 Matematik',
      '📍 Johor',
      '⭐ 4.90',
    ])
    for (const p of pills) expect(p.classes()).toContain('text-xs')
  })

  it.each([
    ['null', null],
    ['a failed #2', new Error('boom')],
  ])('hides the Cikgu Pakar block when #2 is %s and keeps the rest', async (_name, duta) => {
    const w = await mountPage(DATA, duta)
    expect(w.find('[data-testid="cikgu-pakar"]').exists()).toBe(false)
    expect(w.find('[data-testid="heatmap-hero"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="heatmap-cell"]')).toHaveLength(4)
  })

  it('calls only #1 and #2, once each, with no user parameter', async () => {
    await mountPage(DATA)
    expect(api.getHeatmap).toHaveBeenCalledTimes(1)
    expect(api.getDutaRecommendation).toHaveBeenCalledTimes(1)
    expect(Object.keys(api.getHeatmap.mock.calls[0]![0] as object)).toEqual(['signal'])
  })
})
