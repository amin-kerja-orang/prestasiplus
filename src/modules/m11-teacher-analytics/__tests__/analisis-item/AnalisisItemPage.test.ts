// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { ItemAnalysis, ItemAnalysisRow } from '../../api/types'
import AnalisisItemPage from '../../pages/AnalisisItemPage.vue'

const api = vi.hoisted(() => ({ fetchItemAnalysis: vi.fn() }))
vi.mock('../../api', () => api)

const SUBJECTS = [
  { id: 18, name: 'Bahasa Arab' },
  { id: 1, name: 'Bahasa Melayu' },
  { id: 5, name: 'Kimia' },
]

const analysis = (over: Partial<ItemAnalysis> = {}): ItemAnalysis => ({
  options: { subjects: SUBJECTS, classes: [] },
  rows: [],
  ...over,
})

const row = (id: number, pct: number, over: Partial<ItemAnalysisRow> = {}): ItemAnalysisRow => ({
  questionId: id,
  textPlain: `Soalan ${id}`,
  subjectName: 'Kimia',
  attempts: 8,
  pct,
  band: pct > 70 ? 'mudah' : pct >= 40 ? 'sederhana' : 'sukar',
  discrimination: 0.5,
  ...over,
})

let wrapper: VueWrapper | undefined
let router: Router

async function mountAt(url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/guru/analisis-item', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(AnalisisItemPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()
/** The "Reset" button of the filter bar (live label, FR-M11-77). */
const resetButton = (w: VueWrapper) =>
  w
    .get('[data-testid="filter-card"]')
    .findAll('button')
    .find((b) => b.text() === 'Reset')

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchItemAnalysis.mockResolvedValue(analysis())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S6 Analisis Item: admin empty state (E2E-M11-43)', () => {
  it('shows the filter, legend and the empty card with no Reset', async () => {
    const w = await mountAt('/guru/analisis-item')
    expect(w.text()).toContain('Tapis:')
    expect(w.text()).toContain('Mata Pelajaran')
    expect(w.text()).toContain('Kelas')
    expect(w.findAll('[data-testid="filter-subject"] option').map((o) => o.text())).toEqual([
      'Semua Subjek',
      'Bahasa Arab',
      'Bahasa Melayu',
      'Kimia',
    ])
    expect(w.findAll('[data-testid="filter-classroom"] option').map((o) => o.text())).toEqual([
      'Semua Kelas',
    ])
    const legend = t(w, 'item-legend').text().replace(/\s+/g, ' ')
    expect(legend).toContain('> 70% (Mudah)')
    expect(legend).toContain('40–70% (Sederhana)')
    expect(legend).toContain('< 40% (Sukar)')
    expect(legend).toContain('Diskriminasi: >0.3 = baik, <0 = semak semula')
    expect(t(w, 'item-empty').text()).toContain('Tiada data analisis item untuk paparan ini.')
    expect(t(w, 'item-empty').text()).toContain('Pelajar perlu membuat latihan dahulu.')
    expect(resetButton(w)).toBeUndefined()
    expect(has(w, 'item-table')).toBe(false)
  })

  it('the legend has the mudah, sederhana and sukar bands', async () => {
    const w = await mountAt('/guru/analisis-item')
    const dots = t(w, 'item-legend').findAll('[data-band]')
    expect(dots.map((d) => d.attributes('data-band'))).toEqual(['mudah', 'sederhana', 'sukar'])
  })

  it('choosing a subject keeps the class and submits both fields', async () => {
    const w = await mountAt('/guru/analisis-item')
    const select = t(w, 'filter-subject')
    ;(select.element as HTMLSelectElement).value = '1'
    await select.trigger('change')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject_id: '1', classroom_id: '' })
    expect(api.fetchItemAnalysis).toHaveBeenLastCalledWith({ subjectId: 1 }, expect.anything())
    expect((t(w, 'filter-subject').element as HTMLSelectElement).value).toBe('1')
    expect(resetButton(w)).toBeDefined()
  })

  it('Reset goes to /guru/analisis-item and clears both filters', async () => {
    const w = await mountAt('/guru/analisis-item?subject_id=1&classroom_id=')
    const reset = resetButton(w)
    expect(reset?.text()).toBe('Reset')
    await reset?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/guru/analisis-item')
    expect(resetButton(w)).toBeUndefined()
  })

  it('an unknown class id is passed on, reads "Semua Kelas" and the card stays empty', async () => {
    const w = await mountAt('/guru/analisis-item?classroom_id=228')
    expect(api.fetchItemAnalysis).toHaveBeenCalledWith({ classroomId: 228 }, expect.anything())
    expect((t(w, 'filter-classroom').element as HTMLSelectElement).value).toBe('')
    expect(has(w, 'item-empty')).toBe(true)
    expect(resetButton(w)).toBeDefined()
  })
})

describe('S6 Analisis Item: teacher table (E2E-M11-44, provisional)', () => {
  beforeEach(() => {
    api.fetchItemAnalysis.mockResolvedValue(
      analysis({
        options: {
          subjects: SUBJECTS,
          classes: [
            { id: 2001, name: '5 MARIKH - Kimia' },
            { id: 2002, name: '5 MARIKH - Sejarah' },
          ],
        },
        rows: [
          row(5, 12.5, { discrimination: -0.5 }),
          row(4, 25, { discrimination: 0 }),
          row(2, 50, { discrimination: 0.333 }),
          row(1, 75, { discrimination: 1 }),
          row(9, 40, { discrimination: null }),
          row(8, 70, { discrimination: 0.3 }),
        ],
      }),
    )
  })

  it('renders one row per question with the dot, % betul and discrimination label', async () => {
    const w = await mountAt('/guru/analisis-item?classroom_id=2001')
    expect(has(w, 'item-empty')).toBe(false)
    const rows = w.findAll('[data-testid="item-row"]')
    expect(rows).toHaveLength(6)
    const byId = (id: number) => ({
      get: (sel: string) => w.get(`${sel}[data-question-id="${id}"]`),
      find: (sel: string) => w.find(`${sel}[data-question-id="${id}"]`),
    })

    expect(byId(5).get('[data-testid="item-pct"]').text()).toBe('12.5%')
    expect(byId(5).get('[data-testid="item-dot"]').attributes('data-band')).toBe('sukar')
    expect(byId(5).get('[data-testid="item-disc"]').text()).toBe('-0.50')
    expect(byId(5).get('[data-testid="item-disc-note"]').text()).toBe('semak semula')

    expect(byId(1).get('[data-testid="item-pct"]').text()).toBe('75%')
    expect(byId(1).get('[data-testid="item-dot"]').attributes('data-band')).toBe('mudah')
    expect(byId(1).get('[data-testid="item-disc"]').text()).toBe('1.00')
    expect(byId(1).get('[data-testid="item-disc-note"]').text()).toBe('baik')

    expect(byId(2).get('[data-testid="item-dot"]').attributes('data-band')).toBe('sederhana')
    expect(byId(2).get('[data-testid="item-disc"]').text()).toBe('0.33')
    expect(byId(2).get('[data-testid="item-disc-note"]').text()).toBe('baik')

    // boundaries: 0 and exactly 0.3 carry no label; null reads "-"
    expect(byId(4).find('[data-testid="item-disc-note"]').exists()).toBe(false)
    expect(byId(8).find('[data-testid="item-disc-note"]').exists()).toBe(false)
    expect(byId(8).get('[data-testid="item-dot"]').attributes('data-band')).toBe('sederhana')
    expect(byId(9).get('[data-testid="item-disc"]').text()).toBe('-')
    // 40 is Sederhana, as is 70 (40 ≤ p ≤ 70)
    expect(byId(9).get('[data-testid="item-dot"]').attributes('data-band')).toBe('sederhana')
  })

  it('keeps the API order (% betul ascending) and shows subject and attempts', async () => {
    const w = await mountAt('/guru/analisis-item?classroom_id=2001')
    const ids = w.findAll('[data-testid="item-row"]').map((r) => r.attributes('data-question-id'))
    expect(ids).toEqual(['5', '4', '2', '1', '9', '8'])
    expect(w.get('[data-testid="item-subject"][data-question-id="5"]').text()).toBe('Kimia')
    expect(w.get('[data-testid="item-attempts"][data-question-id="5"]').text()).toBe('8')
  })

  it('cuts the question text to 80 characters', async () => {
    api.fetchItemAnalysis.mockResolvedValue(
      analysis({ rows: [row(1, 50, { textPlain: 'x'.repeat(100) })] }),
    )
    const w = await mountAt('/guru/analisis-item')
    expect(t(w, 'item-question').text()).toBe(`${'x'.repeat(80)}…`)
  })

  it('scrolls inside its card (table in an overflow container)', async () => {
    const w = await mountAt('/guru/analisis-item')
    expect(t(w, 'item-table-card').find('.overflow-x-auto').exists()).toBe(true)
  })

  it('preloads the selected class and subject', async () => {
    const w = await mountAt('/guru/analisis-item?subject_id=5&classroom_id=2002')
    expect((t(w, 'filter-subject').element as HTMLSelectElement).value).toBe('5')
    expect((t(w, 'filter-classroom').element as HTMLSelectElement).value).toBe('2002')
    expect(api.fetchItemAnalysis).toHaveBeenCalledWith(
      { subjectId: 5, classroomId: 2002 },
      expect.anything(),
    )
  })
})

describe('S6 Analisis Item: http-mode string ids (SW3-01)', () => {
  // The API sends option ids as strings (contract `IdSchema`); the query ids are parsed to numbers.
  it('keeps the chosen subject and class selected when the option ids are strings', async () => {
    api.fetchItemAnalysis.mockResolvedValue(
      analysis({
        options: {
          subjects: [
            { id: '18', name: 'Bahasa Arab' },
            { id: '1', name: 'Bahasa Melayu' },
          ],
          classes: [{ id: '2002', name: '5 Amanah' }],
        },
      }),
    )
    const w = await mountAt('/guru/analisis-item?subject_id=1&classroom_id=2002')
    expect((t(w, 'filter-subject').element as HTMLSelectElement).value).toBe('1')
    expect((t(w, 'filter-classroom').element as HTMLSelectElement).value).toBe('2002')
  })

  it('still reads an id that is not an option as "Semua"', async () => {
    api.fetchItemAnalysis.mockResolvedValue(
      analysis({ options: { subjects: [{ id: '1', name: 'Bahasa Melayu' }], classes: [] } }),
    )
    const w = await mountAt('/guru/analisis-item?subject_id=99&classroom_id=7')
    expect((t(w, 'filter-subject').element as HTMLSelectElement).value).toBe('')
    expect((t(w, 'filter-classroom').element as HTMLSelectElement).value).toBe('')
  })
})

describe('S6 Analisis Item: states', () => {
  // @provisional: the error copy is the design-system default (no M11 copy in the SRS)
  it('@provisional shows an error message when the request fails', async () => {
    api.fetchItemAnalysis.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await mountAt('/guru/analisis-item')
    expect(w.text()).toContain('Tidak dapat memuatkan data. Sila cuba semula.')
    expect(has(w, 'item-legend')).toBe(false)
  })
})
