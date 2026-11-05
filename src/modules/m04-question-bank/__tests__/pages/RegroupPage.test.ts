// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { API_ERROR_CODES, ApiError } from '@/api'

import RegroupPage from '../../pages/RegroupPage.vue'

const api = vi.hoisted(() => ({
  fetchRegroupWorklist: vi.fn(),
  dismissQuestionFlag: vi.fn(),
  regroupQuestions: vi.fn(),
  undoRegroup: vi.fn(),
  listStimuliToAttach: vi.fn(),
}))
vi.mock('../../api/questions', () => api)
const lookups = vi.hoisted(() => ({
  fetchSubjects: vi.fn(() => Promise.resolve({ data: [{ id: 3, name: 'Sains' }], meta: {} })),
  fetchEducationLevels: vi.fn(() => Promise.resolve({ data: [{ id: 7, name: 'Tingkatan 4' }], meta: {} })),
}))
vi.mock('../../api/lookups', () => lookups)

const row = (over: Record<string, unknown> = {}) => ({
  questionId: '11',
  numberLabel: '14',
  stemExcerpt: 'Rajah 14 menunjukkan dua tin.',
  subject: 'Sains',
  level: 'Tingkatan 4',
  flag: 'stimulus_missing',
  paper: { id: '5', paperCode: '1449/1', year: 2023, examType: 'SPM' },
  reference: 'numbered',
  ...over,
})

const page = (data: unknown[], counts: Record<string, unknown> = {}) => ({
  data,
  meta: {
    totalItems: data.length,
    totalPages: 1,
    pageSize: 20,
    page: 1,
    counts: { bySubject: { '3': 1 }, byLevel: { '7': 1 }, byFlag: { stimulus_missing: 1, figure_only: 0, stem_duplicated: 0 }, open: 1, done: 3, ...counts },
  },
})

let wrapper: VueWrapper | null = null
let router: Router
async function render(url = '/admin/questions?tab=regroup'): Promise<VueWrapper> {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })
  await router.push(url)
  wrapper = mount(RegroupPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchRegroupWorklist.mockReset().mockResolvedValue(page([row()]))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('RegroupPage (R1-ADM-QE-08, frame)', () => {
  it('shows the header counts and the row columns; the regroup tab is active', async () => {
    const w = await render()
    expect(t(w, 'regroup-header').text()).toBe('1 perlu tindakan · 3 selesai')
    const r = t(w, 'regroup-row-11')
    expect(r.text()).toContain('Rajah 14 menunjukkan dua tin.')
    expect(t(w, 'regroup-source').text()).toBe('1449/1 SPM (2023) · No. 14')
    expect(t(w, 'regroup-count-subject-3').text()).toBe('Sains: 1')
    expect(t(w, 'regroup-count-level-7').text()).toBe('Tingkatan 4: 1')
    expect(t(w, 'regroup-flag').text()).toBe('stimulus_missing')
    expect(t(w, 'regroup-reference').text()).toBe('bernombor')
    expect(t(w, 'question-area-tab-regroup').attributes('data-active')).toBe('true')
    expect(t(w, 'question-area-tab-senarai').attributes('data-active')).toBe('false')
  })

  it('an unnumbered reference reads "tanpa nombor"; a row with no paper reads a dash', async () => {
    api.fetchRegroupWorklist.mockResolvedValue(page([row({ reference: 'unnumbered', paper: null, numberLabel: null })], { done: 0 }))
    const w = await render()
    expect(t(w, 'regroup-reference').text()).toBe('tanpa nombor')
    expect(t(w, 'regroup-source').text()).toBe('—')
    expect(t(w, 'regroup-header').text()).toBe('1 perlu tindakan · 0 selesai')
  })

  it('shows the empty text, and a failed read offers a retry', async () => {
    api.fetchRegroupWorklist.mockResolvedValue(page([]))
    const w = await render()
    expect(t(w, 'regroup-empty').text()).toContain('Tiada soalan perlu dikumpulkan semula.')
    w.unmount()
    api.fetchRegroupWorklist.mockRejectedValue(new Error('x'))
    const e = await render()
    expect(e.find('[data-testid="regroup-retry"]').exists()).toBe(true)
  })

  it('sends the URL filters and keeps the tab when one changes', async () => {
    await render('/admin/questions?tab=regroup&subject_id=3&flag=figure_only&page=2')
    expect(api.fetchRegroupWorklist).toHaveBeenCalledWith({ subjectId: '3', educationLevelId: '', flag: 'figure_only', page: 2 }, expect.anything())
    const w = wrapper as VueWrapper
    const flag = t(w, 'regroup-flag-filter').element as HTMLSelectElement
    flag.value = 'stimulus_missing'
    flag.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ tab: 'regroup', subject_id: '3', flag: 'stimulus_missing' })
  })
})

const click = async (w: VueWrapper, id: string) => {
  await t(w, id).trigger('click')
  await flushPromises()
}
const set = async (w: VueWrapper, id: string, value: string) => {
  const el = t(w, id).element as HTMLSelectElement
  el.value = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
}
const apiError = (message: string) => new ApiError({ status: 409, code: API_ERROR_CODES.CONFLICT, message })

describe('RegroupPage row actions (API-Q-12, API-Q-24, API-Q-36)', () => {
  beforeEach(() => {
    api.dismissQuestionFlag.mockReset().mockResolvedValue({ data: { id: '11', flags: [] } })
    api.regroupQuestions.mockReset().mockResolvedValue({ data: { id: '90' }, meta: { auditId: '700' } })
    api.undoRegroup.mockReset().mockResolvedValue({ data: { restored: 3 } })
    api.listStimuliToAttach.mockReset().mockResolvedValue({
      data: [
        { id: '40', kind: 'image', label: 'Rajah 14', excerpt: null, groupCount: 0 },
        { id: '41', kind: 'image', label: 'Dalam kumpulan', excerpt: null, groupCount: 1 },
      ],
    })
  })

  it('Bukan masalah asks the confirm text, sends the stored flag and reloads', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const w = await render()
    await click(w, 'regroup-dismiss-11')
    expect(confirm).toHaveBeenCalledWith('Tandakan sebagai bukan masalah?')
    expect(api.dismissQuestionFlag).toHaveBeenCalledWith('11', 'stimulus_missing')
    expect(api.fetchRegroupWorklist).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="regroup-action-error"]').exists()).toBe(false)
  })

  it('Bukan masalah cancelled sends nothing; a failure shows an error and does not reload', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = await render()
    await click(w, 'regroup-dismiss-11')
    expect(api.dismissQuestionFlag).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    api.dismissQuestionFlag.mockRejectedValue(apiError('Bendera tidak sepadan.'))
    await click(w, 'regroup-dismiss-11')
    expect(t(w, 'regroup-action-error').text()).toBeTruthy()
    expect(api.fetchRegroupWorklist).toHaveBeenCalledTimes(1)
  })

  it('Lampirkan rangsangan lists only stimuli in no group and regroups the one row with stimulusId', async () => {
    const w = await render()
    await click(w, 'regroup-attach-11')
    const options = t(w, 'regroup-pick-11')
      .findAll('option')
      .map((o) => o.text())
    expect(options).toEqual(['Rangsangan', '#40 Rajah 14'])
    expect((t(w, 'regroup-pick-go-11').element as HTMLButtonElement).disabled).toBe(true)
    await set(w, 'regroup-pick-11', '40')
    await click(w, 'regroup-pick-go-11')
    expect(api.regroupQuestions).toHaveBeenCalledWith({ stimulusId: '40', memberQuestionIds: ['11'] })
    expect(t(w, 'regroup-undo-bar').text()).toContain('Kumpulan #90 dicipta.')
  })

  it('Lampirkan rangsangan: a failed picker read shows the load error; a failed regroup shows the message', async () => {
    api.listStimuliToAttach.mockRejectedValue(new Error('x'))
    const w = await render()
    await click(w, 'regroup-attach-11')
    expect(t(w, 'regroup-picker-error-11').text()).toBe('Maaf, berlaku ralat. Sila cuba semula.')
  })

  it('a failed attach regroup shows the server message', async () => {
    api.regroupQuestions.mockRejectedValue(apiError('Rangsangan sudah dalam kumpulan.'))
    const w = await render()
    await click(w, 'regroup-attach-11')
    await set(w, 'regroup-pick-11', '40')
    await click(w, 'regroup-pick-go-11')
    expect(w.find('[data-testid="regroup-action-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="regroup-undo-bar"]').exists()).toBe(false)
  })

  it('Muat naik gambar opens Audit Rajah; stem_duplicated rows have no attach or upload', async () => {
    api.fetchRegroupWorklist.mockResolvedValue(page([row(), row({ questionId: '12', flag: 'stem_duplicated' })]))
    const w = await render()
    expect(t(w, 'regroup-upload-11').attributes('href')).toBe('/admin/soalan-gambar')
    expect(w.find('[data-testid="regroup-attach-12"]').exists()).toBe(false)
    expect(w.find('[data-testid="regroup-upload-12"]').exists()).toBe(false)
    expect(w.find('[data-testid="regroup-dismiss-12"]').exists()).toBe(true)
  })

  describe('Kumpulkan and Buat asal', () => {
    const rows = () => [
      row({ questionId: '10', flag: 'figure_only', numberLabel: '13' }),
      row({ questionId: '11', numberLabel: '14' }),
      row({ questionId: '12', numberLabel: '15' }),
      row({ questionId: '13', numberLabel: '20' }),
    ]
    beforeEach(() => api.fetchRegroupWorklist.mockResolvedValue(page(rows(), { open: 4 })))

    it('regroups the selected consecutive rows under the figure row, then Buat asal undoes it', async () => {
      const w = await render()
      expect(w.find('[data-testid="regroup-group"]').exists()).toBe(false)
      for (const id of ['10', '11', '12']) await click(w, `regroup-select-${id}`)
      await click(w, 'regroup-group')
      expect(api.regroupQuestions).toHaveBeenCalledWith({ figureQuestionId: '10', memberQuestionIds: ['11', '12'] })
      expect(api.fetchRegroupWorklist).toHaveBeenCalledTimes(2)
      await click(w, 'regroup-undo')
      expect(api.undoRegroup).toHaveBeenCalledWith('700')
      expect(w.find('[data-testid="regroup-undo-bar"]').exists()).toBe(false)
      expect(api.fetchRegroupWorklist).toHaveBeenCalledTimes(3)
    })

    it('refuses a gap with "Pilih baris yang berturutan sahaja." and sends nothing', async () => {
      const w = await render()
      for (const id of ['10', '11', '13']) await click(w, `regroup-select-${id}`)
      expect(t(w, 'regroup-not-consecutive').text()).toBe('Pilih baris yang berturutan sahaja.')
      expect((t(w, 'regroup-group').element as HTMLButtonElement).disabled).toBe(true)
      expect(api.regroupQuestions).not.toHaveBeenCalled()
    })

    it('Kumpulkan stays disabled without a figure_only row', async () => {
      const w = await render()
      await click(w, 'regroup-select-11')
      await click(w, 'regroup-select-12')
      expect((t(w, 'regroup-group').element as HTMLButtonElement).disabled).toBe(true)
    })

    it('a failed regroup shows the error and keeps the selection; a refused undo shows the server text', async () => {
      api.regroupQuestions.mockRejectedValueOnce(apiError('Kumpulan lain.'))
      const w = await render()
      for (const id of ['10', '11']) await click(w, `regroup-select-${id}`)
      await click(w, 'regroup-group')
      expect(t(w, 'regroup-action-error').text()).toContain('Kumpulan lain.')
      expect(api.fetchRegroupWorklist).toHaveBeenCalledTimes(1)
      await click(w, 'regroup-group')
      api.undoRegroup.mockRejectedValue(apiError('Kumpulan telah diubah selepas kumpul semula; tidak boleh dibuat asal.'))
      await click(w, 'regroup-undo')
      expect(t(w, 'regroup-action-error').text()).toContain('tidak boleh dibuat asal.')
      expect(w.find('[data-testid="regroup-undo"]').exists()).toBe(true)
    })
  })

  it('the Sebab filter offers stem_duplicated and sends it to the API', async () => {
    await render('/admin/questions?tab=regroup&flag=stem_duplicated')
    expect(api.fetchRegroupWorklist).toHaveBeenCalledWith(expect.objectContaining({ flag: 'stem_duplicated' }), expect.anything())
    const options = (wrapper as VueWrapper)
      .get('[data-testid="regroup-flag-filter"]')
      .findAll('option')
      .map((o) => o.text())
    expect(options).toEqual(['Semua', 'stimulus_missing', 'figure_only', 'stem_duplicated'])
  })
})
