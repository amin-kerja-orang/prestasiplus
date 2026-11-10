// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'

import type { StructuredRubric } from '../../api/structured-rubric'
import StructuredRubricPage from '../../pages/StructuredRubricPage.vue'

const api = vi.hoisted(() => ({ fetchStructuredRubric: vi.fn(), saveStructuredRubric: vi.fn() }))
vi.mock('../../api/structured-rubric', () => api)
const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/composables', () => ({ useToast: () => toast }))

function rubric(): StructuredRubric {
  return {
    question: { id: '77', stimulus: 'Baris satu\nBaris dua', subject: 'Matematik', level: 'Tingkatan 4', status: 'approved', totalMarks: 5 },
    subs: [
      { id: '(a)', number: '(a)', body: 'Hitung nilai f(0).', marks: 2, editable: false, scheme: null, points: [] },
      {
        id: '(b)',
        number: '(b)',
        body: 'Cari punca-punca.',
        marks: 3,
        editable: true,
        scheme: 'Memfaktorkan.',
        points: [
          { id: 'k1', code: 'K', text: 'Memfaktorkan', marks: 1 },
          { id: 'n1', code: 'N', text: 'x = 1', marks: 2 },
        ],
      },
    ],
  }
}

let wrapper: VueWrapper | null = null
let push: ReturnType<typeof vi.spyOn>

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spm/subjektif', component: { template: '<div />' } },
      { path: '/admin/spm/subjektif/:id/sunting', component: StructuredRubricPage },
    ],
  })
  await router.push('/admin/spm/subjektif/77/sunting')
  push = vi.spyOn(router, 'push')
  wrapper = mount(StructuredRubricPage, { props: { id: '77' }, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  api.fetchStructuredRubric.mockReset().mockResolvedValue(rubric())
  api.saveStructuredRubric.mockReset().mockResolvedValue({ data: rubric(), status: 'Skema dan rubrik disimpan.' })
  toast.add.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StructuredRubricPage (V2 Subjektif Sunting)', () => {
  it('shows the question, the explanation and the fields of an editable leaf only', async () => {
    const w = await render()
    expect(w.get('[data-testid=rubric-back]').text()).toBe('Kembali ke Subjektif')
    expect(w.get('[data-testid=rubric-back]').attributes('href')).toBe('/admin/spm/subjektif')
    expect(w.text()).toContain('Skema & Rubrik Pemarkahan')
    expect(w.get('[data-testid=rubric-meta]').text()).toBe('Soalan #77 · Matematik · Tingkatan 4 · 5 markah')
    expect(w.get('[data-testid=rubric-status]').text()).toBe('Diluluskan')
    expect(w.get('[data-testid=rubric-stimulus]').classes()).toContain('whitespace-pre-line')
    expect(w.text()).toContain('Rubrik di sini yang menentukan pemarkahan automatik.')
    expect(w.findAll('[data-testid=rubric-sub]')).toHaveLength(2)
    expect(w.findAll('[data-testid=rubric-scheme-\\(b\\)]')).toHaveLength(1)
    expect(w.findAll('[data-testid=rubric-scheme-\\(a\\)]')).toHaveLength(0)
    expect(w.text()).toContain('Skema (ayat penuh)')
    expect(w.text()).toContain('Poin Rubrik')
    expect(w.findAll('[data-testid=rubric-point-text]').map((i) => (i.element as HTMLInputElement).value)).toEqual(['Memfaktorkan', 'x = 1'])
    expect(w.get('[data-testid=rubric-save]').text()).toBe('Simpan Skema & Rubrik')
  })

  it('Tambah adds a row and the trash button removes one', async () => {
    const w = await render()
    await w.get('[data-testid=rubric-add]').trigger('click')
    expect(w.findAll('[data-testid=rubric-point-text]')).toHaveLength(3)
    await w.findAll('[data-testid=rubric-remove]')[0]!.trigger('click')
    expect(w.findAll('[data-testid=rubric-point-text]').map((i) => (i.element as HTMLInputElement).value)).toEqual(['x = 1', ''])
  })

  it('saves every row of the editable leaves (blanks included), toasts the flash and returns to the lane', async () => {
    const w = await render()
    await w.get('[data-testid=rubric-add]').trigger('click')
    await w.findAll('[data-testid=rubric-point-text]')[2]!.setValue('Unit cm')
    await w.findAll('[data-testid=rubric-point-marks]')[2]!.setValue('4')
    await w.get('[data-testid=rubric-scheme-\\(b\\)]').setValue('  ')
    await w.get('[data-testid=rubric-form]').trigger('submit')
    await flushPromises()
    expect(api.saveStructuredRubric).toHaveBeenCalledWith('77', {
      subs: [{ id: '(b)', scheme: null, points: [{ text: 'Memfaktorkan', marks: 1 }, { text: 'x = 1', marks: 2 }, { text: 'Unit cm', marks: 4 }] }],
    })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Skema dan rubrik disimpan.' }))
    expect(push).toHaveBeenCalledWith('/admin/spm/subjektif')
  })

  it('shows a 422 field message under the right row and stays on the page', async () => {
    api.saveStructuredRubric.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields: { 'subs.0.points.1.marks': 'Markah poin mesti antara 1 dan 20.' } }),
    )
    const w = await render()
    await w.get('[data-testid=rubric-form]').trigger('submit')
    await flushPromises()
    const rows = w.findAll('[data-testid^=rubric-row-]')
    expect(rows[0]!.text()).not.toContain('antara 1 dan 20')
    expect(rows[1]!.text()).toContain('Markah poin mesti antara 1 dan 20.')
    expect(toast.add).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalledWith('/admin/spm/subjektif')
  })

  it('a typed 0 reaches the server instead of becoming 1', async () => {
    const w = await render()
    await w.findAll('[data-testid=rubric-point-marks]')[0]!.setValue('0')
    await w.get('[data-testid=rubric-form]').trigger('submit')
    await flushPromises()
    expect(api.saveStructuredRubric.mock.calls[0]![1].subs[0].points[0].marks).toBe(0)
  })

  it('an unknown id gives the 404 outcome; another failure keeps the retry box', async () => {
    api.fetchStructuredRubric.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await render()
    expect((await import('@/app/router')).useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    api.fetchStructuredRubric.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    const w = await render()
    expect(w.find('[data-testid=rubric-error]').exists()).toBe(true)
  })
})
