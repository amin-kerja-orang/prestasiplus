// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { GuruSetResultsPage, QuestionSet } from '../../api/guru'
import type { GuruClass } from '../../api/types'
import SetSoalanGuruKeputusanPage from '../../pages/SetSoalanGuruKeputusanPage.vue'

/** R1-GUR-8b results: AC-GUR-8b-3 (4/5 = 80%), 8b-10 (class filter), colours, 25 per page, empty state. */

const api = vi.hoisted(() => ({
  fetchGuruSet: vi.fn(),
  fetchGuruClasses: vi.fn(),
  fetchGuruSetResults: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const klass = (id: number, name: string): GuruClass =>
  ({ id: String(id) as unknown as number, name, isActive: true }) as GuruClass
const set = (): QuestionSet => ({
  id: '5',
  title: 'Ujian 1',
  status: 'published',
  subjectId: '4',
  educationLevelId: null,
  questionIds: ['a'],
  classroomIds: ['1', '2'],
  locked: true,
  createdAt: '2026-10-01T09:00:00+08:00',
  updatedAt: '2026-10-02T09:00:00+08:00',
})
const result = (
  rows: { name: string; correct: number; total: number; accuracy: number; at?: string }[],
  extra: Partial<GuruSetResultsPage> = {},
): GuruSetResultsPage => ({
  summary: { penyertaan: rows.length, skorPurata: rows.length ? 80 : null, jumlahPercubaan: rows.length },
  rows: rows.map((r, i) => ({
    pupil: { id: String(i), name: r.name },
    correct: r.correct,
    total: r.total,
    accuracy: r.accuracy,
    attemptedAt: r.at ?? '2026-10-03T09:00:00+08:00',
  })),
  page: 1,
  totalPages: 1,
  totalItems: rows.length,
  ...extra,
})

let router: Router
let wrapper: VueWrapper | undefined

async function mountPage(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/set-soalan', component: { template: '<div />' } },
      { path: '/guru/set-soalan/:id/keputusan', component: SetSoalanGuruKeputusanPage },
    ],
  })
  await router.push('/guru/set-soalan/5/keputusan')
  await router.isReady()
  wrapper = mount(SetSoalanGuruKeputusanPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.fetchGuruSet.mockResolvedValue(set())
  api.fetchGuruClasses.mockResolvedValue({
    data: [klass(1, '5 Bestari'), klass(2, '5 Cekap'), klass(3, '4 Lain')],
    meta: {},
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('R1-GUR-8b results', () => {
  it('AC-GUR-8b-3: shows the title, the three tiles and a row "4/5" with "80%" and the date dd/mm/yyyy', async () => {
    api.fetchGuruSetResults.mockResolvedValue(
      result([{ name: 'Ali Contoh', correct: 4, total: 5, accuracy: 80 }]),
    )
    const w = await mountPage()
    expect(api.fetchGuruSetResults).toHaveBeenCalledWith('5', { page: 1 }, expect.anything())
    expect(w.get('[data-testid="set-results-title"]').text()).toBe('Keputusan: Ujian 1')
    expect(w.get('[data-testid="set-results-stat-penyertaan"]').text()).toContain('Penyertaan')
    expect(w.get('[data-testid="set-results-stat-penyertaan"]').text()).toContain('1')
    expect(w.get('[data-testid="set-results-stat-skor"]').text()).toContain('Skor Purata')
    expect(w.get('[data-testid="set-results-stat-skor"]').text()).toContain('80%')
    expect(w.get('[data-testid="set-results-stat-percubaan"]').text()).toContain('Jumlah Percubaan')
    const table = w.get('[data-testid="set-results-table"]')
    for (const h of ['#', 'Pelajar', 'Skor', 'Ketepatan', 'Tarikh']) expect(table.text()).toContain(h)
    expect(table.text()).toContain('Ali Contoh')
    expect(table.text()).toContain('4/5')
    expect(table.text()).toContain('80%')
    expect(table.text()).toContain('03/10/2026')
    expect(w.get('[data-testid="set-results-back"]').text()).toBe('Kembali ke Set Soalan')
    expect(w.get('[data-testid="set-results-back"]').attributes('href')).toBe('/guru/set-soalan')
  })

  it('shows Ketepatan as a whole number rounded half up: >= 70 green, >= 50 amber, else red', async () => {
    api.fetchGuruSetResults.mockResolvedValue(
      result([
        { name: 'A', correct: 7, total: 10, accuracy: 69.5 },
        { name: 'B', correct: 5, total: 10, accuracy: 49.5 },
        { name: 'C', correct: 4, total: 10, accuracy: 49.4 },
        { name: 'D', correct: 9, total: 10, accuracy: 90 },
        { name: 'E', correct: 5, total: 10, accuracy: 55.4 },
      ]),
    )
    const w = await mountPage()
    const badges = w.findAll('[data-testid="result-accuracy"]')
    expect(badges.map((b) => b.text())).toEqual(['70%', '50%', '49%', '90%', '55%'])
    expect(badges.map((b) => b.attributes('data-color'))).toEqual([
      'success',
      'warning',
      'error',
      'success',
      'warning',
    ])
  })

  it('AC-GUR-8b-10: the Kelas select has "Semua Kelas" then the set classes; choosing one reloads with classroomId', async () => {
    api.fetchGuruSetResults.mockResolvedValue(
      result([{ name: 'A', correct: 4, total: 5, accuracy: 80 }]),
    )
    const w = await mountPage()
    expect(w.findAll('[data-testid="set-results-class"] option').map((o) => o.text())).toEqual([
      'Semua Kelas',
      '5 Bestari',
      '5 Cekap',
    ])
    api.fetchGuruSetResults.mockResolvedValue(
      result([{ name: 'B', correct: 3, total: 5, accuracy: 60 }], {
        summary: { penyertaan: 1, skorPurata: 60, jumlahPercubaan: 1 },
      }),
    )
    await w.get('[data-testid="set-results-class"]').setValue('2')
    await flushPromises()
    expect(api.fetchGuruSetResults).toHaveBeenLastCalledWith(
      '5',
      { classroomId: '2', page: 1 },
      expect.anything(),
    )
    expect(w.get('[data-testid="set-results-stat-skor"]').text()).toContain('60%')
    expect(w.get('[data-testid="set-results-stat-penyertaan"]').text()).toContain('1')
  })

  it('shows "Belum ada pelajar menjawab set ini." with no attempt (tiles still show)', async () => {
    api.fetchGuruSetResults.mockResolvedValue(result([]))
    const w = await mountPage()
    expect(w.get('[data-testid="set-results-empty"]').text()).toContain(
      'Belum ada pelajar menjawab set ini.',
    )
    expect(w.find('[data-testid="set-results-table"]').exists()).toBe(false)
    expect(w.find('[data-testid="set-results-stat-skor"]').exists()).toBe(true)
  })

  it('pages by the server: 25 rows per page, the second page is requested with page=2 and numbered from 26', async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({
      name: `Murid ${String(i + 1)}`,
      correct: 4,
      total: 5,
      accuracy: 80,
    }))
    api.fetchGuruSetResults.mockResolvedValue(
      result(page1, { totalItems: 30, totalPages: 2 }),
    )
    const w = await mountPage()
    expect(w.findAll('[data-testid="result-pupil"]')).toHaveLength(25)
    api.fetchGuruSetResults.mockResolvedValue(
      result([{ name: 'Murid 26', correct: 1, total: 5, accuracy: 20 }], {
        totalItems: 30,
        totalPages: 2,
        page: 2,
      }),
    )
    expect(w.get('[data-ds="data-table-pager"]').text()).toContain('Menunjukkan 1-25 daripada 30 hasil')
    await w.get('[aria-label="Next page"]').trigger('click')
    await flushPromises()
    expect(api.fetchGuruSetResults).toHaveBeenLastCalledWith('5', { page: 2 }, expect.anything())
    const table = w.get('[data-testid="set-results-table"]')
    expect(table.text()).toContain('Murid 26')
    expect(table.text()).toContain('26')
  })

  it('shows an error box with a retry when the results fail', async () => {
    api.fetchGuruSetResults.mockRejectedValueOnce(new Error('boom'))
    const w = await mountPage()
    expect(w.get('[data-testid="set-results-error"]').text()).toContain('Gagal memuatkan keputusan.')
  })
})
