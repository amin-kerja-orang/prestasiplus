// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { CompStudentListItem } from '../../api/comp-students'
import CompStudentListPage from '../../pages/CompStudentListPage.vue'

const api = vi.hoisted(() => ({ fetchCompStudents: vi.fn(), bulkCompAction: vi.fn() }))
vi.mock('../../api/comp-students', () => api)

function student(id: number, extra: Partial<CompStudentListItem> = {}): CompStudentListItem {
  return {
    id,
    name: `PELAJAR DEMO ${String(id)} BIN DEMO`,
    username: `${String(id).padStart(6, '0')}@prestasiplus.my`,
    icNumber: id % 2 === 0 ? `09010110${String(id).padStart(4, '0')}` : null,
    schoolName: 'SEKOLAH CONTOH',
    classLabel: '5 BESTARI',
    teacherName: 'GURU DEMO',
    isActive: true,
    coinsEnabled: false,
    packageExpiresAt: '2026-12-31',
    ...extra,
  }
}

function result(rows: CompStudentListItem[], total = rows.length, page = 1, coinsOff = total) {
  return {
    data: rows,
    meta: {
      page,
      pageSize: 50,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 50)),
      from: rows.length ? (page - 1) * 50 + 1 : null,
      to: rows.length ? (page - 1) * 50 + rows.length : null,
      counts: { coinsOff, total },
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/comp-students'): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/comp-students', component: CompStudentListPage },
      { path: '/admin/comp-students/create', component: stub },
      { path: '/admin/comp-students/:id', component: stub },
    ],
  })
  await router.push(url)
  wrapper = mount(CompStudentListPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchCompStudents
    .mockReset()
    .mockResolvedValue(result([student(1), student(2), student(3)], 90, 1, 90))
  api.bulkCompAction.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('CompStudentListPage (M02 S6) content', () => {
  it('shows the summary, "Daftar Baru", the headers and a row with links and badges', async () => {
    const w = await render()
    expect(t(w, 'comp-summary').text().replace(/\s+/g, ' ')).toBe(
      'Syiling OFF: 90 / 90 pelajar komplimen',
    )
    expect(t(w, 'comp-add').attributes('href')).toBe('/admin/comp-students/create')
    expect(
      t(w, 'comp-table')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['', 'Nama', 'IC', 'Sekolah', 'Kelas / Cikgu', 'Akaun', 'Syiling', 'Pakej tamat'])
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.get('[data-testid=comp-name]').attributes('href')).toBe(
      '/admin/comp-students/1',
    )
    expect(rows[0]!.get('[data-testid=comp-account]').text()).toBe('Aktif')
    expect(rows[0]!.get('[data-testid=comp-coins]').text()).toBe('OFF')
    expect(rows[0]!.text()).toContain('31/12/2026')
    // No IC: an empty cell (FR-M02-66).
    expect(rows[0]!.findAll('td')[2]!.text()).toBe('')
    expect(rows[1]!.findAll('td')[2]!.text()).not.toBe('')
    // The username sits under the name.
    expect(rows[0]!.text()).toContain('000001@prestasiplus.my')
  })

  it('shows Tidak Aktif and ON for an inactive student with coins on', async () => {
    api.fetchCompStudents.mockResolvedValue(
      result([student(4, { isActive: false, coinsEnabled: true })]),
    )
    const w = await render()
    expect(t(w, 'comp-account').text()).toBe('Tidak Aktif')
    expect(t(w, 'comp-coins').text()).toBe('ON')
  })

  it('scrolls the table inside its card (DV-M02-05)', async () => {
    const w = await render()
    expect(w.find('[data-ds="data-table"] .overflow-x-auto').exists()).toBe(true)
  })

  it('shows the empty text with the "Daftar baru." link', async () => {
    api.fetchCompStudents.mockResolvedValue(result([], 0, 1, 0))
    const w = await render()
    expect(t(w, 'comp-empty').text().replace(/\s+/g, ' ')).toBe(
      'Tiada pelajar komplimen lagi. Daftar baru.',
    )
    expect(t(w, 'comp-empty-link').attributes('href')).toBe('/admin/comp-students/create')
  })

  it('a page past the last shows the empty text outside the table scroller, with the pager (FR-M02-69)', async () => {
    api.fetchCompStudents.mockResolvedValue(result([], 90, 9, 90))
    const w = await render('/admin/comp-students?page=9')
    expect(t(w, 'comp-empty').text().replace(/s+/g, ' ')).toBe(
      'Tiada pelajar komplimen lagi. Daftar baru.',
    )
    expect(t(w, 'comp-empty-link').attributes('href')).toBe('/admin/comp-students/create')
    expect(w.get('[data-ds="data-table-pager"]').find('nav').exists()).toBe(true)
  })

  it('shows a skeleton while loading, then the error box with a retry', async () => {
    let reject!: (e: unknown) => void
    api.fetchCompStudents.mockReturnValue(new Promise((_, r) => (reject = r)))
    const w = await render()
    expect(w.findAll('[data-testid=comp-skeleton]').length).toBeGreaterThan(0)
    expect(w.find('[data-testid=comp-summary]').exists()).toBe(false)
    reject(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    await flushPromises()
    expect(t(w, 'comp-error').text()).toContain(
      'Tidak dapat memuatkan senarai pelajar komplimen. Sila cuba semula.',
    )
    api.fetchCompStudents.mockResolvedValue(result([student(1)]))
    await w
      .findAll('button')
      .find((b) => b.text() === 'Cuba Semula')!
      .trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(1)
  })

  it('asks for the requested page and paginates at 50', async () => {
    api.fetchCompStudents.mockResolvedValue(result([student(51)], 90, 2))
    const w = await render('/admin/comp-students?page=2')
    expect(api.fetchCompStudents).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    expect(w.get('[data-ds="data-table-pager"]').text()).toContain(
      'Menunjukkan 51-90 daripada 90 hasil',
    )
  })
})

describe('CompStudentListPage (M02 S6) bulk bar', () => {
  it('appears on a tick with 4 actions and "Batal pilihan"; the header box selects the page', async () => {
    const w = await render()
    expect(w.find('[data-testid=comp-bulk-bar]').exists()).toBe(false)
    await w.findAll('[data-testid=comp-select]')[0]!.trigger('click')
    const bar = t(w, 'comp-bulk-bar')
    expect(bar.text()).toContain('1 dipilih')
    expect(bar.findAll('button').map((b) => b.text())).toEqual([
      'Matikan syiling',
      'Hidupkan syiling',
      'Nyahaktif akaun',
      'Aktifkan akaun',
      'Batal pilihan',
    ])
    await t(w, 'comp-select-all').trigger('click')
    expect(t(w, 'comp-selected-count').text()).toBe('3')
    await t(w, 'comp-bulk-clear').trigger('click')
    expect(w.find('[data-testid=comp-bulk-bar]').exists()).toBe(false)
    expect(t(w, 'comp-select-all').attributes('aria-checked')).toBe('false')
  })

  it('runs an action at once (no confirmation), reloads, clears the selection and flashes the status', async () => {
    api.bulkCompAction.mockResolvedValue({
      data: { updated: 2 },
      status: 'Tindakan berjaya dilaksanakan.',
    })
    const w = await render()
    await w.findAll('[data-testid=comp-select]')[0]!.trigger('click')
    await w.findAll('[data-testid=comp-select]')[1]!.trigger('click')
    api.fetchCompStudents.mockResolvedValue(
      result(
        [student(1, { coinsEnabled: true }), student(2, { coinsEnabled: true }), student(3)],
        90,
        1,
        88,
      ),
    )
    await t(w, 'comp-bulk-coins_on').trigger('click')
    await flushPromises()
    expect(api.bulkCompAction).toHaveBeenCalledWith('coins_on', [1, 2])
    expect(api.fetchCompStudents).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid=comp-bulk-bar]').exists()).toBe(false)
    expect(t(w, 'comp-summary').text().replace(/\s+/g, ' ')).toContain('88 / 90')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Tindakan berjaya dilaksanakan.',
    })
  })

  it('a failed action flashes the error and keeps the selection', async () => {
    api.bulkCompAction.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Gagal.' }),
    )
    const w = await render()
    await w.findAll('[data-testid=comp-select]')[0]!.trigger('click')
    await t(w, 'comp-bulk-deactivate').trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['Ralat berlaku. Sila cuba lagi.'],
    })
    expect(w.find('[data-testid=comp-bulk-bar]').exists()).toBe(true)
  })

  it('a page change clears the selection', async () => {
    const w = await render()
    await w.findAll('[data-testid=comp-select]')[0]!.trigger('click')
    await router.push('/admin/comp-students?page=2')
    await flushPromises()
    expect(w.find('[data-testid=comp-bulk-bar]').exists()).toBe(false)
  })
})
