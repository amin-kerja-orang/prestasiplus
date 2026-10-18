// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { DiagramAudit } from '../../api/diagram-audit'
import DiagramAuditPage from '../../pages/DiagramAuditPage.vue'

const api = vi.hoisted(() => ({
  fetchDiagramAudit: vi.fn(),
  uploadDiagramImage: vi.fn(),
  dismissDiagram: vi.fn(),
}))
vi.mock('../../api/diagram-audit', () => api)
vi.mock('../../lib/lookup-options', () => ({
  fetchSubjectOptions: vi.fn(() =>
    Promise.resolve([
      { id: 11, name: 'Biologi' },
      { id: 9, name: 'Fizik' },
    ]),
  ),
  fetchSchoolNameOptions: vi.fn(() =>
    Promise.resolve([
      { id: 380, name: 'SMK CONTOH A' },
      { id: 381, name: 'SMK CONTOH B' },
    ]),
  ),
}))

function meta(total: number, page = 1) {
  return {
    page,
    pageSize: 20,
    totalItems: total,
    totalPages: Math.max(1, Math.ceil(total / 20)),
    from: total ? 1 : null,
    to: total ? Math.min(20, total) : null,
  }
}

function audit(mcqTotal = 6144, strTotal = 522): DiagramAudit {
  const person = { id: 1, name: 'Admin Demo' }
  return {
    data: {
      mcq: {
        items: mcqTotal
          ? [
              {
                id: 563393,
                questionText: 'Soalan MCQ perlu gambar.',
                subject: { id: 11, name: 'Biologi' },
                createdBy: person,
                sourceFile: 'T5-BT-BIO---BIOLOGI.pdf',
                sourcePage: 1,
              },
            ]
          : [],
        meta: meta(mcqTotal),
      },
      structured: {
        items: strTotal
          ? [
              {
                id: 4461,
                stimulusExcerpt: 'Soalan struktur\nBaris dua',
                subject: { id: 5, name: 'Perniagaan' },
                createdBy: person,
                sourceFile: null,
                sourcePage: null,
              },
            ]
          : [],
        meta: meta(strTotal),
      },
    },
    meta: {
      stats: { mcq: mcqTotal, structured: strTotal, total: mcqTotal + strTotal },
      bySubject: [
        { name: 'Biologi', count: 1587 },
        { name: 'Kimia', count: 1077 },
      ],
      unfilteredMcq: 6144,
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/soalan-gambar'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/soalan-gambar', component: DiagramAuditPage }],
  })
  await router.push(url)
  wrapper = mount(DiagramAuditPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchDiagramAudit.mockResolvedValue(audit())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('DiagramAuditPage (M04 S11)', () => {
  it('shows the three stat cards with separators and the top-10 pills', async () => {
    const w = await render()
    expect(w.get('[data-testid=diagrams-stat-mcq]').text()).toContain('6,144')
    expect(w.get('[data-testid=diagrams-stat-mcq]').text()).toContain('MCQ Perlu Gambar')
    expect(w.get('[data-testid=diagrams-stat-structured]').text()).toContain('522')
    expect(w.get('[data-testid=diagrams-stat-structured]').text()).toContain(
      'Struktur Perlu Gambar',
    )
    expect(w.get('[data-testid=diagrams-stat-total]').text()).toContain('6,666')
    expect(w.get('[data-testid=diagrams-by-subject]').text()).toContain(
      'MCQ Perlu Gambar Mengikut Mata Pelajaran',
    )
    expect(w.findAll('[data-testid=diagrams-pill]').map((p) => p.text())).toEqual([
      'Biologi: 1,587',
      'Kimia: 1,077',
    ])
  })

  it('offers the subjects and every school in the filter', async () => {
    const w = await render()
    expect(w.findAll('[data-testid=diagrams-subject] option').map((o) => o.text())).toEqual([
      'Semua Mata Pelajaran',
      'Biologi',
      'Fizik',
    ])
    expect(w.findAll('[data-testid=diagrams-school] option').map((o) => o.text())).toEqual([
      'Semua Sekolah',
      'SMK CONTOH A',
      'SMK CONTOH B',
    ])
    expect(w.get('[data-testid=diagrams-filter] button[type=submit]').text()).toBe('Tapis')
  })

  it('renders the MCQ and Struktur sections with counts and cards', async () => {
    const w = await render()
    expect(w.get('[data-testid=diagrams-mcq] h2').text()).toBe('MCQ (6144)')
    expect(w.get('[data-testid=diagrams-structured] h2').text()).toBe('Struktur (522)')
    const mcq = w.get('[data-testid=diagrams-mcq] [data-testid=diagram-card]')
    expect(mcq.text()).toContain('#563393')
    expect(mcq.text()).toContain('Biologi')
    expect(mcq.text()).toContain('oleh Admin Demo')
    expect(mcq.text()).toContain('T5-BT-BIO---BIOLOGI.pdf ms.1')
    const file = mcq.get('[data-testid=diagram-file]')
    expect(file.attributes('accept')).toBe('image/*')
    expect(file.attributes('required')).toBeDefined()
    expect(mcq.get('[data-testid=diagram-dismiss]').text()).toBe('Dismiss')
    const str = w.get('[data-testid=diagrams-structured] [data-testid=diagram-card]')
    expect(str.get('[data-testid=diagram-text]').classes()).toContain('whitespace-pre-line')
    expect(str.text()).not.toContain('ms.')
  })

  it('omits the MCQ section when its count is 0 and the Struktur one when its count is 0', async () => {
    api.fetchDiagramAudit.mockResolvedValue(audit(0, 522))
    let w = await render('/admin/soalan-gambar?school_id=380')
    expect(w.find('[data-testid=diagrams-mcq]').exists()).toBe(false)
    expect(w.find('[data-testid=diagrams-structured]').exists()).toBe(true)
    expect(w.find('[data-testid=diagrams-empty]').exists()).toBe(false)
    w.unmount()
    api.fetchDiagramAudit.mockResolvedValue(audit(5, 0))
    w = await render('/admin/soalan-gambar?subject_id=18')
    expect(w.find('[data-testid=diagrams-structured]').exists()).toBe(false)
    expect(w.get('[data-testid=diagrams-mcq] h2').text()).toBe('MCQ (5)')
  })

  it('shows the all-done message when both lists are empty', async () => {
    api.fetchDiagramAudit.mockResolvedValue(audit(0, 0))
    const w = await render('/admin/soalan-gambar?subject_id=19')
    expect(w.get('[data-testid=diagrams-empty]').text()).toBe(
      'Semua soalan sudah lengkap dengan gambar rajah!',
    )
  })

  it('pager links keep the filters, use their own page parameter and drop the other list page', async () => {
    const w = await render('/admin/soalan-gambar?subject_id=9&str_page=3')
    const next = w
      .get('[data-testid=diagrams-mcq-pager]')
      .findAll('button')
      .find((b) => b.text() === '2')
    await next?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject_id: '9', mcq_page: '2' })
    expect(api.fetchDiagramAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: '9', mcqPage: 2, strPage: 1 }),
    )
    const strNext = w
      .get('[data-testid=diagrams-structured-pager]')
      .findAll('button')
      .find((b) => b.text() === '2')
    await strNext?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject_id: '9', str_page: '2' })
  })

  it('shows a dash when the creator name is unknown', async () => {
    const data = audit()
    data.data.mcq.items[0]!.createdBy = { id: 9, name: null }
    api.fetchDiagramAudit.mockResolvedValue(data)
    const w = await render()
    const card = w.get('[data-testid=diagrams-mcq] [data-testid=diagram-card]')
    expect(card.text()).toContain('oleh —')
  })

  it('submits both filters as the query string', async () => {
    const w = await render()
    await w.get('[data-testid=diagrams-subject]').setValue('9')
    await w.get('[data-testid=diagrams-school]').setValue('381')
    await w.get('[data-testid=diagrams-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject_id: '9', school_id: '381' })
    expect(api.fetchDiagramAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: '9', schoolId: '381' }),
    )
  })

  it('dismiss calls the API without a confirm, reloads and flashes the API status', async () => {
    api.dismissDiagram.mockResolvedValue({
      data: { id: 563393, needsDiagram: false },
      status: 'Soalan telah dikeluarkan daripada senarai audit.',
    })
    const confirm = vi.spyOn(window, 'confirm')
    const w = await render()
    const calls = api.fetchDiagramAudit.mock.calls.length
    await w.get('[data-testid=diagrams-mcq] [data-testid=diagram-dismiss]').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(api.dismissDiagram).toHaveBeenCalledWith('mcq', 563393)
    expect(api.fetchDiagramAudit.mock.calls.length).toBe(calls + 1)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Soalan telah dikeluarkan daripada senarai audit.',
    })
  })

  it('upload sends the chosen image and flashes the API status', async () => {
    api.uploadDiagramImage.mockResolvedValue({
      data: { id: 4461, needsDiagram: false },
      status: 'Gambar rajah berjaya dimuat naik.',
    })
    const w = await render()
    const card = w.get('[data-testid=diagrams-structured] [data-testid=diagram-card]')
    const input = card.get('[data-testid=diagram-file]').element as HTMLInputElement
    const file = new File(['x'], 'rajah.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    await card.get('form').trigger('submit')
    await flushPromises()
    expect(api.uploadDiagramImage).toHaveBeenCalledWith('structured', 4461, file)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Gambar rajah berjaya dimuat naik.',
    })
  })

  it('a rejected upload shows the server message under the file field', async () => {
    api.uploadDiagramImage.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Data tidak sah.',
        fields: { image: 'Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.' },
      }),
    )
    const w = await render()
    const card = w.get('[data-testid=diagrams-mcq] [data-testid=diagram-card]')
    const input = card.get('[data-testid=diagram-file]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'rajah.svg', { type: 'image/svg+xml' })],
      configurable: true,
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    await card.get('form').trigger('submit')
    await flushPromises()
    expect(card.get('[data-testid=diagram-file-error]').text()).toBe(
      'Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.',
    )
    expect(useFlashStore().current).toBeNull()
  })

  it('shows the red box with "Cuba Semula" when the audit cannot load', async () => {
    api.fetchDiagramAudit.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(w.get('[data-testid=diagrams-error]').text()).toContain('Cuba Semula')
    await w.get('[data-testid=diagrams-retry]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=diagrams-mcq]').exists()).toBe(true)
  })
})
