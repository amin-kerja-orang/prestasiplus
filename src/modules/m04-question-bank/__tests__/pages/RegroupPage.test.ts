// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import RegroupPage from '../../pages/RegroupPage.vue'

const api = vi.hoisted(() => ({ fetchRegroupWorklist: vi.fn() }))
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
  paper: { title: 'Kertas 1', year: 2023 },
  reference: 'Rajah 14',
  refKind: 'numbered',
  ...over,
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
  api.fetchRegroupWorklist.mockReset().mockResolvedValue({ data: [row()], meta: { totalItems: 1, pageSize: 20, page: 1, done: 3 } })
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
    expect(t(w, 'regroup-source').text()).toBe('Kertas 1 (2023) · No. 14')
    expect(t(w, 'regroup-flag').text()).toBe('stimulus_missing')
    expect(t(w, 'regroup-reference').text()).toBe('Rajah 14')
    expect(t(w, 'question-area-tab-regroup').attributes('data-active')).toBe('true')
    expect(t(w, 'question-area-tab-senarai').attributes('data-active')).toBe('false')
  })

  it('an unnumbered reference reads "tanpa nombor"; a row with no paper reads a dash', async () => {
    api.fetchRegroupWorklist.mockResolvedValue({ data: [row({ refKind: 'unnumbered', reference: null, paper: null, numberLabel: null })], meta: { totalItems: 1, pageSize: 20, page: 1 } })
    const w = await render()
    expect(t(w, 'regroup-reference').text()).toBe('tanpa nombor')
    expect(t(w, 'regroup-source').text()).toBe('—')
    expect(t(w, 'regroup-header').text()).toBe('1 perlu tindakan · 0 selesai')
  })

  it('shows the empty text, and a failed read offers a retry', async () => {
    api.fetchRegroupWorklist.mockResolvedValue({ data: [], meta: { totalItems: 0, pageSize: 20, page: 1 } })
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
