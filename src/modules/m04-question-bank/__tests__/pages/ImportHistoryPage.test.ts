// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { QuestionImportRun } from '../../api/imports'
import ImportHistoryPage from '../../pages/ImportHistoryPage.vue'

const api = vi.hoisted(() => ({ fetchQuestionImports: vi.fn() }))
vi.mock('../../api/imports', () => api)

function run(id: number): QuestionImportRun {
  return {
    id,
    fileName: `fail-${String(id)}.csv`,
    importedCount: 10 + id,
    failedCount: id,
    failures: [],
    defaults: { subjectId: null, educationLevelId: null, difficultyLevel: 2 },
    createdBy: 1,
    createdAt: '2026-07-20T09:05:00+08:00',
    createdMonth: '2026-07',
  }
}

function result(rows: QuestionImportRun[], total = rows.length, page = 1) {
  return {
    data: rows,
    meta: {
      page,
      pageSize: 20,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 20)),
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  }
}

let wrapper: VueWrapper | null = null

async function render(url = '/admin/questions/import-history'): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions/import', component: stub },
      { path: '/admin/questions/import-history', component: ImportHistoryPage },
    ],
  })
  await router.push(url)
  wrapper = mount(ImportHistoryPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  api.fetchQuestionImports.mockReset().mockResolvedValue(result([run(2), run(1)], 1123))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ImportHistoryPage (M04 S5h)', () => {
  it('lists the runs with the four columns and the "Kembali" link', async () => {
    const w = await render()
    expect(t(w, 'history-back').attributes('href')).toBe('/admin/questions/import')
    expect(w.findAll('th').map((th) => th.text())).toEqual(['Tarikh', 'Fail', 'Diimport', 'Gagal'])
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.get('[data-testid=history-date]').text()).toBe('20/07/2026 09:05')
    expect(rows[0]?.get('[data-testid=history-file]').text()).toBe('fail-2.csv')
    expect(rows[0]?.get('[data-testid=history-imported]').text()).toBe('12')
    expect(rows[0]?.get('[data-testid=history-failed]').text()).toBe('2')
    expect(w.text()).toContain('daripada 1123 hasil')
  })

  it('asks the API for the page in the query', async () => {
    await render('/admin/questions/import-history?page=3')
    expect(api.fetchQuestionImports).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }))
  })

  it('shows "Tiada sejarah import." and no pager when there are no runs', async () => {
    api.fetchQuestionImports.mockResolvedValue(result([]))
    const w = await render()
    expect(t(w, 'history-empty').text()).toBe('Tiada sejarah import.')
    expect(w.find('[data-ds=data-table-pager]').exists()).toBe(false)
  })

  it('shows the red alert with "Cuba Semula" on a load failure and retries', async () => {
    api.fetchQuestionImports.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    const w = await render()
    expect(t(w, 'history-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w, 'history-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=history-error]').exists()).toBe(false)
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })
})
