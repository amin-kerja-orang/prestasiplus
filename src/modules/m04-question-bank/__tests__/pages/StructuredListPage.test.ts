// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { StructuredRow } from '../../api/structured'
import StructuredListPage from '../../pages/StructuredListPage.vue'

const api = vi.hoisted(() => ({ fetchStructuredQuestions: vi.fn() }))
vi.mock('../../api/structured', () => api)
vi.mock('../../lib/lookup-options', () => ({
  fetchSubjectOptions: vi.fn(() =>
    Promise.resolve([
      { id: 12, name: 'Bahasa Melayu' },
      { id: 9, name: 'Fizik' },
    ]),
  ),
  fetchLevelOptions: vi.fn(() =>
    Promise.resolve([
      { id: 10, name: 'Tingkatan 4' },
      { id: 11, name: 'Tingkatan 5' },
    ]),
  ),
}))

function row(id: number): StructuredRow {
  return {
    id,
    stimulusExcerpt: `Stimulus ${String(id)}...`,
    subject: { id: 12, name: 'Perniagaan' },
    level: { id: 11, name: 'Tingkatan 5' },
    kbatLevel: 3,
    totalMarks: 8,
    subCount: 1,
  }
}

function result(rows: StructuredRow[], total = rows.length, page = 1) {
  return {
    data: rows,
    meta: {
      page,
      pageSize: 25,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 25)),
      from: rows.length ? (page - 1) * 25 + 1 : null,
      to: rows.length ? (page - 1) * 25 + rows.length : null,
      stats: {
        total: 4064,
        published: 4064,
        bySubject: [
          { name: 'Bahasa Inggeris', count: 774 },
          { name: 'Biologi', count: 219 },
        ],
      },
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/structured-questions'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/structured-questions', component: StructuredListPage },
      {
        path: '/admin/structured-questions/:id',
        name: 'm04.structured.detail',
        component: { template: '<div />' },
      },
      { path: '/guru/soalan-berstruktur/cipta', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(StructuredListPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchStructuredQuestions.mockReset()
  api.fetchStructuredQuestions.mockResolvedValue(result([row(4454), row(4455)], 4064))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StructuredListPage (M04 S8)', () => {
  it('renders the header, the create link, the stats and the subject pills', async () => {
    const w = await render()
    expect(w.get('h1').text()).toBe('Soalan Berstruktur')
    expect(w.text()).toContain('Semua soalan berstruktur SPM dalam sistem')
    const add = w.get('[data-testid=structured-add]')
    expect(add.text()).toBe('Tambah Soalan')
    expect(add.attributes('href')).toBe('/guru/soalan-berstruktur/cipta')
    expect(w.get('[data-testid=structured-stat-total]').text()).toContain('4,064')
    expect(w.get('[data-testid=structured-stat-total]').text()).toContain('Jumlah Soalan')
    expect(w.get('[data-testid=structured-stat-published]').text()).toContain('Published')
    expect(w.get('[data-testid=structured-by-subject]').text()).toContain('Agihan Mengikut Subjek')
    const pills = w.findAll('[data-testid=structured-subject-pill]').map((p) => p.text())
    expect(pills).toEqual(['Bahasa Inggeris: 774', 'Biologi: 219'])
  })

  it('offers the alphabetical subjects, the levels and the KBAT scale 2 to 5', async () => {
    const w = await render()
    const subjects = w.findAll('[data-testid=structured-subject] option').map((o) => o.text())
    expect(subjects).toEqual(['Semua Subjek', 'Bahasa Melayu', 'Fizik'])
    const levels = w.findAll('[data-testid=structured-level] option').map((o) => o.text())
    expect(levels).toEqual(['Semua', 'Tingkatan 4', 'Tingkatan 5'])
    const kbat = w.findAll('[data-testid=structured-kbat] option').map((o) => o.text())
    expect(kbat).toEqual([
      'Semua KBAT',
      'Memahami (L2)',
      'Mengaplikasi (L3)',
      'Menganalisis (L4)',
      'Menilai/Mencipta (L5)',
    ])
    expect(w.get('[data-testid=structured-search]').text()).toBe('Cari')
  })

  it('renders the columns and rows, hiding Subjek, Tgk, Markah and Sub-Q on small widths', async () => {
    const w = await render()
    const headers = w.findAll('thead th')
    expect(headers.map((th) => th.text())).toEqual([
      '#',
      'Stimulus / Soalan',
      'Subjek',
      'Tgk',
      'KBAT',
      'Markah',
      'Sub-Q',
      'Aksi',
    ])
    expect(headers[2]?.classes()).toContain('hidden')
    expect(headers[2]?.classes()).toContain('sm:table-cell')
    expect(headers[3]?.classes()).toContain('hidden')
    expect(headers[5]?.classes()).toContain('hidden')
    expect(headers[6]?.classes()).toContain('md:table-cell')
    const rows = w.findAll('[data-testid=structured-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('4454')
    expect(rows[0]?.text()).toContain('Perniagaan')
    expect(rows[0]?.text()).toContain('Tingkatan 5')
    expect(rows[0]?.get('[data-testid=structured-kbat-pill]').text()).toBe('L3')
    expect(rows[0]?.text()).toContain('8m')
    const view = rows[0]?.get('[data-testid=structured-view]')
    expect(view?.text()).toBe('Lihat')
    expect(view?.attributes('href')).toBe('/admin/structured-questions/4454')
  })

  it('shows the Malay counter and the English pager with the filters kept', async () => {
    const w = await render('/admin/structured-questions?kbat_level=5')
    expect(w.get('[data-testid=structured-counter]').text()).toBe(
      'Menunjukkan 1–2 daripada 4,064 soalan',
    )
    const next = w.get('nav[aria-label="Pagination Navigation"] a[rel=next]')
    expect(next.attributes('href')).toBe('/admin/structured-questions?kbat_level=5&page=2')
    await next.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ kbat_level: '5', page: '2' })
    expect(api.fetchStructuredQuestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ kbatLevel: '5', page: 2 }),
    )
  })

  it('has no Reset link unfiltered and shows it with a filter', async () => {
    let w = await render()
    expect(w.find('[data-testid=structured-reset]').exists()).toBe(false)
    w.unmount()
    w = await render('/admin/structured-questions?subject_id=9')
    expect(w.get('[data-testid=structured-reset]').attributes('href')).toBe(
      '/admin/structured-questions',
    )
  })

  it('submits the filter as the query string', async () => {
    const w = await render()
    await w.get('[data-testid=structured-subject]').setValue('9')
    await w.get('[data-testid=structured-kbat]').setValue('5')
    await w.get('[data-testid=structured-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject_id: '9', kbat_level: '5' })
    expect(api.fetchStructuredQuestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: '9', kbatLevel: '5', educationLevelId: null }),
    )
  })

  it('shows one empty row and the zero counter, without a pager', async () => {
    api.fetchStructuredQuestions.mockResolvedValue(result([], 0))
    const w = await render('/admin/structured-questions?subject_id=18')
    expect(w.get('[data-testid=structured-empty]').text()).toBe('Tiada soalan berstruktur ditemui')
    expect(w.get('[data-testid=structured-counter]').text()).toBe('Menunjukkan 0 daripada 0 soalan')
    expect(w.find('nav[aria-label="Pagination Navigation"]').exists()).toBe(false)
  })

  it('shows the red box with "Cuba Semula" when the list cannot load, then recovers', async () => {
    api.fetchStructuredQuestions.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=structured-error]').text()).toContain(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    const retry = w.get('[data-testid=structured-retry]')
    expect(retry.text()).toBe('Cuba Semula')
    await retry.trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=structured-error]').exists()).toBe(false)
    expect(w.findAll('[data-testid=structured-row]')).toHaveLength(2)
  })

  it('shows skeleton rows while the first load is pending', async () => {
    api.fetchStructuredQuestions.mockReturnValue(new Promise(() => undefined))
    const w = await render()
    expect(w.findAll('[data-testid=structured-skeleton]')).toHaveLength(5)
  })
})
