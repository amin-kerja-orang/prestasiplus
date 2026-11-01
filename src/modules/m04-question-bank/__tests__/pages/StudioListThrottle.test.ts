// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import StudioListPage from '../../pages/StudioListPage.vue'

const studio = vi.hoisted(() => ({
  studioAvailable: vi.fn(() => true),
  STUDIO_UNAVAILABLE: 'x',
  fetchStudioList: vi.fn(),
  fetchServabilityBatch: vi.fn(),
  moveQuestionStatus: vi.fn(),
  editAsDraft: vi.fn(),
  EditAsDraftRefused: class EditAsDraftRefused extends Error {
    lines: string[] = []
  },
  fetchStudioQuestion: vi.fn(),
  fetchGroup: vi.fn(),
}))
const lookups = vi.hoisted(() => ({ fetchSubjects: vi.fn() }))
vi.mock('../../api/studio', () => studio)
vi.mock('../../api/lookups', () => lookups)

const row = (id: string) => ({
  id,
  questionText: `Soalan ${id}`,
  subject: { id: '3', name: 'Matematik' },
  level: { id: '7', name: 'Tingkatan 4' },
  status: 'draft',
  isActive: true,
  sourceType: 'trial',
  sourceFile: null,
})
const page = (rows: unknown[]) => ({
  data: rows,
  meta: { page: 1, pageSize: 25, totalItems: rows.length, totalPages: 1, counts: { draft: 1, review: 0, approved: 0, archived: 0 } },
})

let wrapper: VueWrapper | null = null
let router: Router
async function render(): Promise<VueWrapper> {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/studio', component: StudioListPage }] })
  await router.push('/admin/studio')
  wrapper = mount(StudioListPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  studio.studioAvailable.mockReturnValue(true)
  studio.fetchStudioList.mockReset().mockResolvedValue(page([row('1')]))
  studio.fetchServabilityBatch.mockReset().mockResolvedValue({ reports: [], notFound: [] })
  lookups.fetchSubjects.mockReset().mockResolvedValue({ data: [], meta: {} })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Studio list under the read limit (REQ-A-027)', () => {
  it('reads once, 300 ms after the last keystroke, and a one-letter term still queries', async () => {
    const w = await render()
    const calls = studio.fetchStudioList.mock.calls.length
    const input = w.get('[data-testid="studio-search"]')
    await input.setValue('l')
    await vi.advanceTimersByTimeAsync(200)
    await input.setValue('li')
    await vi.advanceTimersByTimeAsync(200)
    expect(studio.fetchStudioList.mock.calls.length).toBe(calls)
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()
    expect(studio.fetchStudioList.mock.calls.length).toBe(calls + 1)
    expect(studio.fetchStudioList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'li' }))
    expect(router.currentRoute.value.query.search).toBe('li')
  })

  it('does not read again when the draft change leaves the URL as it is', async () => {
    const w = await render()
    const calls = studio.fetchStudioList.mock.calls.length
    await w.get('[data-testid="studio-search"]').setValue('   ')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(studio.fetchStudioList.mock.calls.length).toBe(calls)
  })

  it('shows the server 429 message, then the list again on retry', async () => {
    studio.fetchStudioList.mockRejectedValueOnce(new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Cuba sebentar lagi.', retryAfter: 9 }))
    const w = await render()
    expect(w.get('[data-testid="studio-error"]').text()).toContain('Terlalu banyak permintaan. Cuba sebentar lagi.')
    await w.get('[data-testid="studio-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="studio-error"]').exists()).toBe(false)
    expect(w.text()).toContain('Soalan 1')
  })

  it('shows the proposed BM text with the Retry-After seconds when the server sends no message', async () => {
    studio.fetchStudioList.mockRejectedValueOnce(new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'HTTP 429', retryAfter: 7 }))
    const w = await render()
    expect(w.get('[data-testid="studio-error"]').text()).toContain('Terlalu banyak carian dalam masa singkat. Cuba lagi dalam 7 saat.')
  })

  it('drops the stale answer: the last search wins even if an older read settles later', async () => {
    let releaseOld: (v: unknown) => void = () => {}
    studio.fetchStudioList.mockImplementation((arg: { search: string | null }) =>
      arg.search === 'a' ? new Promise((r) => (releaseOld = r)) : Promise.resolve(page([row(arg.search === 'ab' ? '2' : '1')])),
    )
    const w = await render()
    await w.get('[data-testid="studio-search"]').setValue('a')
    await vi.advanceTimersByTimeAsync(350)
    await w.get('[data-testid="studio-search"]').setValue('ab')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    releaseOld(page([row('9')]))
    await flushPromises()
    expect(w.text()).toContain('Soalan 2')
    expect(w.text()).not.toContain('Soalan 9')
  })
})
