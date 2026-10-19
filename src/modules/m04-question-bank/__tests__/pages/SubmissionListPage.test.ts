// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { QuestionSubmission } from '../../api/submissions'
import SubmissionListPage from '../../pages/SubmissionListPage.vue'

const api = vi.hoisted(() => ({
  fetchQuestionSubmissions: vi.fn(),
  updateSubmissionStatus: vi.fn(),
  downloadSubmissionFile: vi.fn(),
}))
vi.mock('../../api/submissions', () => api)

function paper(id: number, extra: Partial<QuestionSubmission> = {}): QuestionSubmission {
  return {
    id,
    teacherId: 4501,
    subjectText: 'Perniagaan',
    levelCode: 'T5',
    year: 2026,
    paperType: 'Buku Latihan',
    authorCredit: 'Cikgu Demo 01',
    note: 'Latih tubi kelas',
    files: [{ index: 0, name: 'kertas-a.docx', size: 10, mime: 'application/msword' }],
    status: 'done',
    adminNotes: 'nota lama',
    createdAt: '2026-03-09T08:49:00+08:00',
    teacher: {
      id: 4501,
      name: 'Cikgu Demo 01',
      email: 'demo01@example.test',
      school: 'SMK Contoh',
    },
    ...extra,
  }
}

function result(rows: QuestionSubmission[]) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 100,
      totalItems: rows.length,
      totalPages: 1,
      counts: { all: 6, pending: 1, processing: 3, done: 1, rejected: 1 },
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/question-submissions'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/question-submissions', component: SubmissionListPage }],
  })
  await router.push(url)
  wrapper = mount(SubmissionListPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchQuestionSubmissions.mockResolvedValue(
    result([paper(6), paper(5, { status: 'processing', adminNotes: null, note: null })]),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SubmissionListPage (M04 S10)', () => {
  it('shows the four counters and no Ditolak card', async () => {
    const w = await render()
    expect(w.get('[data-testid=submissions-count-all]').text()).toBe('6Jumlah')
    expect(w.get('[data-testid=submissions-count-pending]').text()).toBe('1Pending')
    expect(w.get('[data-testid=submissions-count-processing]').text()).toBe('3Processing')
    expect(w.get('[data-testid=submissions-count-done]').text()).toBe('1Selesai')
    expect(w.findAll('[data-ds="stat-row"] li')).toHaveLength(4)
    expect(w.get('[data-ds="stat-row"]').text()).not.toContain('Ditolak')
  })

  it('offers the status filter with Tapis and resets from the filter bar', async () => {
    let w = await render()
    const options = w.findAll('[data-testid=submissions-status] option').map((o) => o.text())
    expect(options).toEqual(['Semua Status', 'Pending', 'Processing', 'Selesai', 'Ditolak'])
    expect(w.get('[data-testid=submissions-filter] button[type=submit]').text()).toBe('Tapis')
    w.unmount()
    w = await render('/admin/question-submissions?status=done')
    expect(api.fetchQuestionSubmissions).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'done' }),
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
    await w.get('[data-testid=submissions-status]').setValue('pending')
    await w.get('[data-testid=submissions-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'pending' })
  })

  it('renders the columns and a row with teacher, paper, file, status pill and date', async () => {
    const w = await render()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      'Guru / Sekolah',
      'Soalan',
      'Fail',
      'Status',
      'Tarikh',
      'Tindakan',
    ])
    const row = w.findAll('tbody tr')[0]
    const text = row?.text() ?? ''
    expect(text).toContain('Cikgu Demo 01')
    expect(text).toContain('demo01@example.test')
    expect(text).toContain('SMK Contoh')
    expect(text).toContain('Perniagaan')
    expect(text).toContain('T5')
    expect(text).toContain('(2026)')
    expect(text).toContain('Buku Latihan')
    expect(text).toContain('Oleh: Cikgu Demo 01')
    expect(text).toContain('Latih tubi kelas')
    expect(text).toContain('kertas-a.docx')
    expect(row?.get('[data-testid=submission-status]').text()).toBe('Selesai')
    expect(row?.get('[data-testid=submission-admin-notes]').text()).toBe('nota lama')
    expect(text).toContain('09 Mar 2026')
    expect(text).toContain('08:49')
    const second = w.findAll('tbody tr')[1]
    expect(second?.get('[data-testid=submission-status]').text()).toBe('Processing')
    expect(second?.find('[data-testid=submission-admin-notes]').exists()).toBe(false)
  })

  it('shows "Tiada rekod ditemui" when there is no paper', async () => {
    api.fetchQuestionSubmissions.mockResolvedValue(result([]))
    const w = await render('/admin/question-submissions?status=rejected')
    expect(w.get('[data-testid=submissions-empty]').text()).toBe('Tiada rekod ditemui')
  })

  it('"Kemaskini" toggles the inline panel with the current status and note', async () => {
    const w = await render()
    const row = w.findAll('tbody tr')[0]
    expect(row?.find('[data-testid=submission-panel]').exists()).toBe(false)
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    const status = row?.get('[data-testid=submission-panel-status]')
    expect((status?.element as HTMLSelectElement).value).toBe('done')
    expect(status?.attributes('required')).toBeDefined()
    const notes = row?.get('[data-testid=submission-panel-notes]')
    expect((notes?.element as HTMLTextAreaElement).value).toBe('nota lama')
    expect(notes?.attributes('maxlength')).toBe('1000')
    expect(notes?.attributes('placeholder')).toBe('Nota admin (pilihan)...')
    expect(row?.get('[data-testid=submission-panel-save]').text()).toBe('Simpan')
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    expect(row?.find('[data-testid=submission-panel]').exists()).toBe(false)
  })

  it('re-syncs the panel fields from the stored paper each time it opens', async () => {
    const w = await render()
    const row = w.findAll('tbody tr')[0]
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    await row?.get('[data-testid=submission-panel-status]').setValue('rejected')
    await row?.get('[data-testid=submission-panel-notes]').setValue('belum disimpan')
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    const status = row?.get('[data-testid=submission-panel-status]').element as HTMLSelectElement
    const notes = row?.get('[data-testid=submission-panel-notes]').element as HTMLTextAreaElement
    expect(status.value).toBe('done')
    expect(notes.value).toBe('nota lama')
  })

  it('saves without a confirm, reloads and flashes the API status', async () => {
    api.updateSubmissionStatus.mockResolvedValue({
      data: paper(6),
      status: 'Status kertas soalan berjaya dikemaskini.',
    })
    const confirm = vi.spyOn(window, 'confirm')
    const w = await render()
    const calls = api.fetchQuestionSubmissions.mock.calls.length
    const row = w.findAll('tbody tr')[0]
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    await row?.get('[data-testid=submission-panel-status]').setValue('rejected')
    await row?.get('[data-testid=submission-panel-notes]').setValue('tidak lengkap')
    await row?.get('[data-testid=submission-panel]').trigger('submit')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(api.updateSubmissionStatus).toHaveBeenCalledWith(6, {
      status: 'rejected',
      adminNotes: 'tidak lengkap',
    })
    expect(api.fetchQuestionSubmissions.mock.calls.length).toBe(calls + 1)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Status kertas soalan berjaya dikemaskini.',
    })
  })

  it('shows a non-validation failure as a red flash', async () => {
    api.updateSubmissionStatus.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Kertas tidak dijumpai.' }),
    )
    const w = await render()
    const row = w.findAll('tbody tr')[0]
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    await row?.get('[data-testid=submission-panel]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current).toEqual({ type: 'error', message: ['Kertas tidak dijumpai.'] })
  })

  it('shows a server field message under its field (SRS §5), not as a flash', async () => {
    api.updateSubmissionStatus.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Data tidak sah.',
        fields: { adminNotes: 'Nota terlalu panjang.' },
      }),
    )
    const w = await render()
    const row = w.findAll('tbody tr')[0]
    await row?.get('[data-testid=submission-toggle]').trigger('click')
    await row?.get('[data-testid=submission-panel]').trigger('submit')
    await flushPromises()
    expect(row?.get('[data-testid=submission-notes-error]').text()).toBe('Nota terlalu panjang.')
    expect(useFlashStore().current).toBeNull()
  })

  it('shows the red box with "Cuba Semula" when the list cannot load', async () => {
    api.fetchQuestionSubmissions.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=submissions-error]').text()).toContain('Cuba Semula')
    await w.get('[data-testid=submissions-retry]').trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })
})
