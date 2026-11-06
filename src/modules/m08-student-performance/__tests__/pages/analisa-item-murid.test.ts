// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { ItemAnalysisMe, ItemMeItem } from '../../api/types'
import AnalisaItemMuridPage from '../../pages/AnalisaItemMuridPage.vue'

const api = vi.hoisted(() => ({ fetchItemAnalysisMe: vi.fn() }))
vi.mock('../../api/performance', () => api)

const item = (id: number, over: Partial<ItemMeItem> = {}): ItemMeItem => ({
  questionId: id,
  category: 'pemulihan',
  attempts: 2,
  correct: 0,
  wrongTimes: 2,
  lastAnsweredAt: '2026-11-01T10:00:00+08:00',
  subject: 'Kimia',
  chapter: 'Bab 1',
  source: 'Latih Tubi',
  question: {
    id,
    questionText: `Soalan ${String(id)}`,
    questionType: 'mcq',
    options: ['a', 'b', 'c', 'd'],
    textDirection: 'ltr',
    scriptType: 'rumi',
  },
  stimulusGroup: null,
  explanation: null,
  ...over,
})

const GROUP = {
  id: 7,
  stimuli: [
    {
      id: 71,
      kind: 'passage' as const,
      label: 'Petikan A',
      body: { ms: 'Teks petikan kongsi.' },
      imageId: null,
      alt: null,
    },
  ],
  questionIds: [11, 12],
}

const EMPTY: ItemAnalysisMe = {
  tiles: { answered: 0, needRemedial: 0, needStrengthen: 0, mastery: null },
  subjects: [],
  counts: { isyaratAwal: 0, pemulihan: 0, pengukuhan: 0 },
  items: [],
}

const FULL: ItemAnalysisMe = {
  tiles: { answered: 20, needRemedial: 3, needStrengthen: 1, mastery: 57.9 },
  subjects: [
    {
      code: 'KIM',
      name: 'Kimia',
      attempts: 12,
      uniqueQuestions: 6,
      accuracy: 41.7,
      wrongAnswers: 7,
      weakRepeated: 3,
      earlySignalWeak: 1,
    },
    {
      code: 'SEJ',
      name: 'Sejarah',
      attempts: 8,
      uniqueQuestions: 5,
      accuracy: 87.5,
      wrongAnswers: 1,
      weakRepeated: 0,
      earlySignalWeak: 0,
    },
  ],
  counts: { isyaratAwal: 1, pemulihan: 3, pengukuhan: 1 },
  items: [
    item(10, { explanation: 'Kerana ikatan kovalen.' }),
    item(11, { stimulusGroup: GROUP }),
    item(12, { stimulusGroup: GROUP }),
    item(20, { category: 'pengukuhan', attempts: 3, correct: 1, wrongTimes: 2 }),
    item(30, { category: 'isyarat_awal', attempts: 1, correct: 0, wrongTimes: 1 }),
  ],
}

let wrapper: VueWrapper | undefined
let router: Router

async function mountAt(url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/analisa-item', component: AnalisaItemMuridPage }],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(AnalisaItemMuridPage, {
    global: { plugins: [router], stubs: { StimulusFigure: { template: '<figure data-testid="stimulus" />' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchItemAnalysisMe.mockReset()
  api.fetchItemAnalysisMe.mockResolvedValue(FULL)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('Analisa Item pupil page (R1-MUR-6)', () => {
  it('empty: four tiles at 0 / 0% and the exact empty copy with "Mula Berlatih →"', async () => {
    api.fetchItemAnalysisMe.mockResolvedValue(EMPTY)
    const w = await mountAt('/analisa-item')
    const tiles = t(w, 'stat-cards').text()
    for (const label of ['Soalan Dijawab', 'Perlu Pemulihan', 'Perlu Pengukuhan', 'Tahap Penguasaan']) {
      expect(tiles).toContain(label)
    }
    expect(tiles).toContain('0%')
    expect(t(w, 'murid-empty').text()).toContain('Belum ada data untuk dianalisa')
    expect(t(w, 'murid-empty').text()).toContain(
      'Mulakan latihan untuk melihat analisa item peribadi anda di sini.',
    )
    expect(t(w, 'mula-berlatih').text()).toBe('Mula Berlatih →')
    expect(has(w, 'subject-section')).toBe(false)
    expect(has(w, 'list-pemulihan')).toBe(false)
  })

  it('populated: tiles, whole-number %, subject cards with "{n} percubaan · {m} soalan unik"', async () => {
    const w = await mountAt('/analisa-item')
    expect(t(w, 'stat-cards').text()).toContain('58%')
    expect(t(w, 'stat-cards').text()).toContain('20')
    const kim = t(w, 'subject-KIM')
    expect(kim.get('[data-testid="subject-accuracy"]').text()).toBe('42%')
    expect(kim.get('[data-testid="subject-attempts"]').text()).toBe('12 percubaan · 6 soalan unik')
    expect(kim.text()).toContain('Jawapan salah')
    expect(kim.text()).toContain('Item berulang lemah')
    expect(kim.text()).toContain('Isyarat awal lemah')
    // ascending accuracy order
    const codes = w.findAll('[data-testid^="subject-"][data-testid$="KIM"], [data-testid^="subject-SEJ"]')
    expect(codes[0]?.attributes('data-testid')).toBe('subject-KIM')
    // the lists and their counts
    expect(t(w, 'count-pemulihan').text()).toBe('3 soalan')
    expect(t(w, 'count-pengukuhan').text()).toBe('1 soalan')
    expect(has(w, 'list-isyarat-awal')).toBe(true)
    expect(has(w, 'item-20')).toBe(true)
  })

  it('Isyarat Awal is hidden when empty; an empty list shows the exact line', async () => {
    api.fetchItemAnalysisMe.mockResolvedValue({
      ...FULL,
      counts: { isyaratAwal: 0, pemulihan: 0, pengukuhan: 1 },
      items: [item(20, { category: 'pengukuhan', attempts: 3, correct: 1, wrongTimes: 2 })],
    })
    const w = await mountAt('/analisa-item')
    expect(has(w, 'list-isyarat-awal')).toBe(false)
    expect(t(w, 'empty-pemulihan').text()).toBe('Tiada soalan dalam kategori ini setakat ini.')
  })

  it('"Ulang Kaji Subjek Ini" opens /practice/revision/:code', async () => {
    const w = await mountAt('/analisa-item')
    const link = t(w, 'ulang-kaji-KIM')
    expect(link.text()).toBe('Ulang Kaji Subjek Ini')
    expect(link.attributes('href')).toBe('/practice/revision/KIM')
  })

  it('a tapis change updates the query string and fetches again', async () => {
    const w = await mountAt('/analisa-item')
    expect(api.fetchItemAnalysisMe).toHaveBeenLastCalledWith(
      expect.objectContaining({ tapis: 'semua' }),
    )
    await t(w, 'tapis-selalu_salah').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tapis).toBe('selalu_salah')
    expect(api.fetchItemAnalysisMe).toHaveBeenCalledTimes(2)
    expect(api.fetchItemAnalysisMe).toHaveBeenLastCalledWith(
      expect.objectContaining({ tapis: 'selalu_salah' }),
    )
    await t(w, 'tapis-semua').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tapis).toBeUndefined()
    expect(api.fetchItemAnalysisMe).toHaveBeenCalledTimes(3)
  })

  it('reads tapis from the query string on load; an unknown value is "Semua"', async () => {
    await mountAt('/analisa-item?tapis=ada_betul')
    expect(api.fetchItemAnalysisMe).toHaveBeenLastCalledWith(
      expect.objectContaining({ tapis: 'ada_betul' }),
    )
    wrapper?.unmount()
    await mountAt('/analisa-item?tapis=zzz')
    expect(api.fetchItemAnalysisMe).toHaveBeenLastCalledWith(
      expect.objectContaining({ tapis: 'semua' }),
    )
  })

  it('Penjelasan shows only when the question has an explanation, and toggles', async () => {
    const w = await mountAt('/analisa-item')
    expect(has(w, 'penjelasan-toggle-10')).toBe(true)
    expect(has(w, 'penjelasan-toggle-20')).toBe(false)
    expect(has(w, 'penjelasan-toggle-11')).toBe(false)
    expect(has(w, 'penjelasan-10')).toBe(false)
    await t(w, 'penjelasan-toggle-10').trigger('click')
    expect(t(w, 'penjelasan-10').text()).toContain('Kerana ikatan kovalen.')
  })

  it('shows a stimulus once for a group of two questions', async () => {
    const w = await mountAt('/analisa-item')
    expect(w.findAll('[data-testid="stimulus-block"]')).toHaveLength(1)
    expect(w.findAll('[data-testid="stimulus"]')).toHaveLength(1)
    expect(has(w, 'item-11')).toBe(true)
    expect(has(w, 'item-12')).toBe(true)
  })
})
