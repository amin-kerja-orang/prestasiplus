// @vitest-environment jsdom
import type { IntakeItemRow } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import SubmissionListPage from '../../pages/SubmissionListPage.vue'

const api = vi.hoisted(() => ({
  SUBMISSION_PAGE_SIZE: 20,
  fetchSubmissionItems: vi.fn(),
  fetchSubmissionCounts: vi.fn(),
  fetchBatchFiles: vi.fn(),
  downloadSubmissionFile: vi.fn(),
}))
vi.mock('../../api/submissions', () => api)
const save = vi.hoisted(() => ({ saveBlob: vi.fn() }))
vi.mock('@/lib/save-blob', () => save)

const INTRO = 'Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit).'

function item(id: string, extra: Partial<IntakeItemRow> = {}): IntakeItemRow {
  return {
    id,
    label: '1',
    stemPreview: `Soalan ujian ${id}`,
    subject: 'Sains',
    batchId: '40',
    state: 'generated',
    question: null,
    uploader: { id: '9', name: 'Cikgu Demo 01' },
    createdAt: '2026-03-09T08:49:00+08:00',
    ...extra,
  } as IntakeItemRow
}

function result(rows: IntakeItemRow[], totalItems = rows.length) {
  return { data: rows, meta: { page: 1, pageSize: 20, totalItems, totalPages: 1 } }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/question-submissions'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/question-submissions', component: SubmissionListPage },
      { path: '/admin/spm/soalan/ekstrak/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(SubmissionListPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchSubmissionItems.mockReset()
  api.fetchSubmissionCounts.mockReset()
  api.fetchBatchFiles.mockReset()
  api.downloadSubmissionFile.mockReset()
  save.saveBlob.mockReset()
  api.fetchSubmissionItems.mockResolvedValue(result([item('1'), item('2')]))
  api.fetchSubmissionCounts.mockResolvedValue({ all: 6, pending: 2, processing: 3, done: 1 })
  api.fetchBatchFiles.mockResolvedValue(
    new Map([['40', [{ id: '7', originalName: 'kertas-a.pdf' }]]]),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SubmissionListPage (R1-ADM-Q-12)', () => {
  it('shows the four tiles and no Ditolak tile', async () => {
    const w = await render()
    expect(w.get('[data-testid=submissions-count-all]').text()).toBe('6Jumlah')
    expect(w.get('[data-testid=submissions-count-pending]').text()).toBe('2Pending')
    expect(w.get('[data-testid=submissions-count-processing]').text()).toBe('3Processing')
    expect(w.get('[data-testid=submissions-count-done]').text()).toBe('1Selesai')
    expect(w.findAll('[data-ds="stat-row"] li')).toHaveLength(4)
    expect(w.get('[data-ds="stat-row"]').text()).not.toContain('Ditolak')
  })

  it('gives DsPage the intro, which the portal header reads', async () => {
    const w = await render()
    expect(w.text()).toContain(INTRO)
  })

  it('offers the status filter with the display keys and Tapis, and resets', async () => {
    let w = await render()
    const options = w.findAll('[data-testid=submissions-status] option').map((o) => o.text())
    expect(options).toEqual(['Semua Status', 'Pending', 'Processing', 'Selesai', 'Ditolak'])
    expect(w.get('[data-testid=submissions-filter] button[type=submit]').text()).toBe('Tapis')
    w.unmount()
    w = await render('/admin/question-submissions?status=Selesai')
    expect(api.fetchSubmissionItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Selesai' }),
    )
    const reset = w
      .get('[data-testid=submissions-filter]')
      .findAll('button')
      .find((b) => b.text() === 'Reset')
    await reset?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('submits the status filter as the query string', async () => {
    const w = await render()
    await w.get('[data-testid=submissions-status]').setValue('Pending')
    await w.get('[data-testid=submissions-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'Pending' })
  })

  it('renders the columns and a row by role label, never by name or e-mail', async () => {
    const w = await render()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      'Guru / Sekolah',
      'Tajuk',
      'Fail',
      'Status',
      'Tarikh',
      'Tindakan',
    ])
    const text = w.findAll('tbody tr')[0]?.text() ?? ''
    expect(text).toContain('Guru')
    expect(text).not.toContain('Cikgu Demo 01')
    expect(text).not.toContain('@')
    expect(text).toContain('Soalan ujian 1')
    expect(text).toContain('Sains')
    expect(text).toContain('kertas-a.pdf')
    expect(text).toContain('Pending')
  })

  it('links each row to Semak on the review screen of its batch', async () => {
    const w = await render()
    const link = w.get('[data-testid=submission-semak]')
    expect(link.text()).toBe('Semak')
    expect(link.attributes('href')).toBe('/admin/spm/soalan/ekstrak/40')
  })

  it('maps the row status: accepted is Processing until the question is approved', async () => {
    api.fetchSubmissionItems.mockResolvedValue(
      result([
        item('1', { state: 'accepted', question: { id: '5', version: 1, status: 'draft' } }),
        item('2', { state: 'accepted', question: { id: '6', version: 1, status: 'approved' } }),
        item('3', { state: 'rejected' }),
      ]),
    )
    const w = await render()
    expect(w.findAll('[data-testid=submission-status]').map((b) => b.text())).toEqual([
      'Processing',
      'Selesai',
      'Ditolak',
    ])
  })

  it('a filtered list keeps the word of the filter (the server reads the live version)', async () => {
    api.fetchSubmissionItems.mockResolvedValue(
      result([item('1', { state: 'accepted', question: { id: '5', version: 2, status: 'draft' } })]),
    )
    const w = await render('/admin/question-submissions?status=Selesai')
    expect(w.get('[data-testid=submission-status]').text()).toBe('Selesai')
  })

  it('shows the PRD empty text', async () => {
    api.fetchSubmissionItems.mockResolvedValue(result([]))
    api.fetchBatchFiles.mockResolvedValue(new Map())
    const w = await render()
    expect(w.get('[data-testid=submissions-empty]').text()).toBe(
      'Tiada kertas soalan dihantar oleh guru lagi.',
    )
    expect(w.find('[data-testid=submissions-error]').exists()).toBe(false)
  })

  it('names a refused filter value (field 12-01)', async () => {
    api.fetchSubmissionItems.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x' }),
    )
    const w = await render('/admin/question-submissions?status=done')
    expect(w.get('[data-testid=submissions-error]').text()).toContain('Nilai penapis tidak sah.')
  })

  it('offers a retry after any other load failure', async () => {
    api.fetchSubmissionItems.mockRejectedValueOnce(new Error('network'))
    const w = await render()
    expect(w.get('[data-testid=submissions-error]').text()).not.toContain('Nilai penapis')
    await w.get('[data-testid=submissions-retry]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=submissions-error]').exists()).toBe(false)
    expect(w.text()).toContain('Soalan ujian 1')
  })

  it('downloads a file by its id and name', async () => {
    const blob = new Blob(['x'])
    api.downloadSubmissionFile.mockResolvedValue({ blob, filename: null })
    const w = await render()
    await w.get('[data-testid=submission-file]').trigger('click')
    await flushPromises()
    expect(api.downloadSubmissionFile).toHaveBeenCalledWith('7')
    expect(save.saveBlob).toHaveBeenCalledWith(blob, 'kertas-a.pdf')
  })

  it('flashes a failed download', async () => {
    api.downloadSubmissionFile.mockRejectedValue(new Error('gagal'))
    const w = await render()
    await w.get('[data-testid=submission-file]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
  })

  it('moves to another page through the URL, keeping the filter', async () => {
    api.fetchSubmissionItems.mockResolvedValue(
      result(Array.from({ length: 20 }, (_, i) => item(String(i))), 45),
    )
    const w = await render('/admin/question-submissions?status=Pending')
    w.getComponent({ name: 'DsDataTable' }).vm.$emit('update:page', 2)
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'Pending', page: '2' })
    expect(api.fetchSubmissionItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'Pending', page: 2 }),
    )
  })
})
