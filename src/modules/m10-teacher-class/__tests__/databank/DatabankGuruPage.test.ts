// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DatabankQuestion,
  DatabankRow,
  DatabankQuestionsResult,
  DatabankSubjectTile,
} from '../../api/types'
import DatabankGuruPage from '../../pages/DatabankGuruPage.vue'

const guru = vi.hoisted(() => ({
  fetchDatabankOverview: vi.fn(),
  fetchDatabankQuestions: vi.fn(),
}))
vi.mock('../../api/guru', () => guru)

const tile = (subjectId: number, nameMs: string, nameEn: string, count: number): DatabankSubjectTile => ({
  subjectId,
  nameMs,
  nameEn,
  count,
})
const overview = {
  data: {
    totalQuestions: 1500,
    activeSubjects: 2,
    teras: [tile(1, 'Bahasa Melayu', 'Malay Language', 1000), tile(3, 'Matematik', 'Mathematics', 500)],
    elektif: [tile(9, 'Fizik', 'Physics', 0)],
  },
}
const q = (id: number, stem = `Soalan ${String(id)}`): DatabankQuestion => ({
  id,
  stemMs: stem,
  stemEn: null,
  type: 'mcq',
  options: [],
  stimuli: [],
  subjectId: 1,
  subject: 'Bahasa Melayu',
  levelLabel: 'Tingkatan 4',
  difficulty: 2,
  status: 'approved',
  groupPosition: null,
})
const result = (data: DatabankRow[], totalItems = data.length): DatabankQuestionsResult => ({
  data,
  meta: {
    page: 1,
    pageSize: 20,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / 20)),
    from: data.length === 0 ? 0 : 1,
    to: data.length,
    totalUnits: totalItems,
    totalQuestions: totalItems,
  },
})
const single = (id: number, text?: string): DatabankRow => ({
  unitId: `q${String(id)}`,
  group: null,
  questions: [q(id, text)],
})

const t = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const mountPage = async (): Promise<VueWrapper> => {
  const w = mount(DatabankGuruPage)
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  guru.fetchDatabankOverview.mockResolvedValue(overview)
  guru.fetchDatabankQuestions.mockResolvedValue(result([single(11), single(12)]))
})
afterEach(() => vi.clearAllMocks())

describe('S6-T19 Databank Soalan (guru)', () => {
  it('renders the hero, the two stat cards, the hint and the two groups of tiles', async () => {
    const w = await mountPage()
    const hero = t(w, 'databank-hero').text()
    expect(hero).toContain('Databank Soalan SPM')
    expect(hero).toContain('Terokai koleksi soalan sedia ada dalam bank soalan PrestasiPlus')
    expect(t(w, 'databank-total').text()).toContain('1,500')
    expect(t(w, 'databank-total').text()).toContain('Jumlah Soalan')
    expect(t(w, 'databank-active').text()).toContain('2')
    expect(t(w, 'databank-active').text()).toContain('Subjek Aktif')
    expect(t(w, 'databank-hint').text()).toBe('Klik mana-mana subjek untuk lihat soalannya di bawah.')
    expect(t(w, 'databank-teras').text()).toContain('Subjek Teras (2)')
    expect(t(w, 'databank-elektif').text()).toContain('Subjek Elektif (1)')
    const first = t(w, 'databank-tile-1').text()
    expect(first).toContain('Bahasa Melayu')
    expect(first).toContain('Malay Language')
    expect(first).toContain('1,000 soalan')
    expect(t(w, 'databank-tile-9').text()).toContain('0 soalan')
    expect(t(w, 'databank-list-section').text()).toContain('Senarai Soalan')
  })

  it('has no edit, answer or delete control', async () => {
    const w = await mountPage()
    const labels = w.findAll('button').map((b) => b.text())
    expect(labels.some((l) => /edit|padam|arkib|hantar|jawab/i.test(l))).toBe(false)
  })

  it('a tile selects its subject, pressing it again clears the filter', async () => {
    const w = await mountPage()
    expect(guru.fetchDatabankQuestions.mock.calls[0]?.[0]).toEqual({ page: 1 })
    await t(w, 'databank-tile-3').trigger('click')
    await flushPromises()
    expect(t(w, 'databank-tile-3').attributes('aria-pressed')).toBe('true')
    expect(guru.fetchDatabankQuestions.mock.lastCall?.[0]).toEqual({ subjectId: 3, page: 1 })
    await t(w, 'databank-tile-3').trigger('click')
    await flushPromises()
    expect(t(w, 'databank-tile-3').attributes('aria-pressed')).toBe('false')
    expect(guru.fetchDatabankQuestions.mock.lastCall?.[0]).toEqual({ page: 1 })
  })

  it('search needs 2 characters: one shows the hint and does not call, two calls', async () => {
    const w = await mountPage()
    const calls = guru.fetchDatabankQuestions.mock.calls.length
    await t(w, 'databank-search').setValue('x')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'databank-search-hint').text()).toBe('Taip sekurang-kurangnya 2 aksara.')
    expect(guru.fetchDatabankQuestions.mock.calls.length).toBe(calls)

    await t(w, 'databank-search').setValue('Rajah 3')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(t(w, 'databank-search-hint').exists()).toBe(false)
    expect(guru.fetchDatabankQuestions.mock.lastCall?.[0]).toEqual({ q: 'Rajah 3', page: 1 })
  })

  it('shows the search placeholder and the "Cari" button', async () => {
    const w = await mountPage()
    expect(t(w, 'databank-search').attributes('placeholder')).toBe('Cari teks soalan...')
    expect(t(w, 'databank-search-submit').text()).toBe('Cari')
  })

  it('cuts the text with "..." after 55 characters and shows the row facts', async () => {
    guru.fetchDatabankQuestions.mockResolvedValue(result([single(21, 'A'.repeat(80))]))
    const w = await mountPage()
    const row = t(w, 'databank-question-21').text()
    expect(row).toContain(`${'A'.repeat(55)}...`)
    expect(row).not.toContain('A'.repeat(56))
    expect(row).toContain('#21')
    expect(row).toContain('Tingkatan 4')
    expect(row).toContain('Diluluskan')
    expect(row).toContain('⭐⭐')
  })

  it('a stimulus group shows its stimuli once, with all its questions', async () => {
    guru.fetchDatabankQuestions.mockResolvedValue(
      result([
        {
          unitId: 'g1',
          group: {
            id: 1,
            stimuli: [
              {
                id: 's1',
                kind: 'passage',
                label: 'Petikan A',
                bodyMs: 'Teks petikan unik.',
                bodyEn: null,
                imageId: null,
                alt: null,
                caption: null,
                sourceCitation: null,
                tableData: null,
              },
            ],
          },
          questions: [q(31), q(32)],
        },
        single(33),
      ]),
    )
    const w = await mountPage()
    expect(w.findAll('[data-testid="stimulus-group"]')).toHaveLength(1)
    expect(w.text().match(/Teks petikan unik\./g)).toHaveLength(1)
    const unit = t(w, 'databank-unit-g1')
    expect(unit.findAll('[data-testid^="databank-question-"]')).toHaveLength(2)
    expect(t(w, 'databank-question-33').exists()).toBe(true)
  })

  it('paginates 20 units per page', async () => {
    guru.fetchDatabankQuestions.mockResolvedValue(result([single(41)], 45))
    const w = await mountPage()
    expect(t(w, 'databank-pager-text').text()).toBe('Menunjukkan 1-1 daripada 45 hasil')
    await t(w, 'databank-next').trigger('click')
    await flushPromises()
    expect(guru.fetchDatabankQuestions.mock.lastCall?.[0]).toEqual({ page: 2 })
  })

  it('shows the empty copy when nothing matches', async () => {
    guru.fetchDatabankQuestions.mockResolvedValue(result([]))
    const w = await mountPage()
    expect(t(w, 'databank-empty').text()).toContain('Tiada soalan sepadan dengan carian anda.')
  })

  it('shows an error with a retry for the list and for the overview', async () => {
    guru.fetchDatabankQuestions.mockRejectedValueOnce(new Error('boom'))
    guru.fetchDatabankOverview.mockRejectedValueOnce(new Error('boom'))
    const w = await mountPage()
    expect(w.findAll('[data-state="error"]')).toHaveLength(2)
    await w.find('[data-state="error"] button').trigger('click')
    await flushPromises()
    expect(guru.fetchDatabankOverview).toHaveBeenCalledTimes(2)
    expect(t(w, 'databank-total').exists()).toBe(true)
  })

  it('shows a loading state before the data arrives', () => {
    guru.fetchDatabankOverview.mockReturnValue(new Promise(() => undefined))
    guru.fetchDatabankQuestions.mockReturnValue(new Promise(() => undefined))
    const w = mount(DatabankGuruPage)
    expect(w.findAll('[data-state="loading"]')).toHaveLength(2)
  })
})
