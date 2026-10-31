// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import StudioListPage from '../../pages/StudioListPage.vue'

const studio = vi.hoisted(() => ({
  studioAvailable: vi.fn(() => true),
  STUDIO_UNAVAILABLE: 'Studio hanya tersedia apabila sistem disambungkan ke pelayan sebenar.',
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

const row = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  questionText: `Soalan contoh ${id}`,
  subject: { id: '3', name: 'Matematik' },
  level: { id: '7', name: 'Tingkatan 4' },
  status,
  isActive: true,
  sourceType: 'trial',
  sourceFile: null,
  ...extra,
})
const page = (rows: unknown[], total = rows.length) => ({
  data: rows,
  meta: { page: 1, pageSize: 25, totalItems: total, totalPages: Math.max(1, Math.ceil(total / 25)), counts: { draft: 4, review: 3, approved: 20, archived: 1 } },
})

let wrapper: VueWrapper | null = null
let router: Router
async function render(url = '/admin/studio'): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/studio', component: StudioListPage },
      { path: '/admin/studio/questions/:id/sunting', component: stub },
      { path: '/admin/studio/questions/create', component: stub },
    ],
  })
  await router.push(url)
  wrapper = mount(StudioListPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  for (const f of Object.values(studio)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset()
  studio.studioAvailable.mockReturnValue(true)
  studio.fetchStudioList.mockResolvedValue(page([row('11', 'draft'), row('12', 'approved', { dskpComplete: false }), row('13', 'review')], 30))
  studio.fetchServabilityBatch.mockResolvedValue({
    reports: [{ questionId: '12', versionNo: 1, servedCount: 4, total: 6, activities: [] }],
    notFound: [],
  })
  lookups.fetchSubjects.mockReset().mockResolvedValue({ data: [{ id: 3, name: 'Matematik' }], meta: {} })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('StudioListPage (S1 to S6)', () => {
  it('shows the V2 subtitle, the four status tiles with counts and "Cipta baharu"', async () => {
    const w = await render()
    expect(w.text()).toContain('Bank soalan kanonikal - cipta, semak, terbit')
    const tiles = t(w, 'studio-tiles').text().replace(/\s+/g, ' ')
    for (const word of ['Draft', 'Reviewed', 'Approved', 'Archived']) expect(tiles).toContain(word)
    expect(tiles).toContain('20')
    expect(t(w, 'studio-create').attributes('href')).toBe('/admin/studio/questions/create')
  })

  it('asks the API for 25 per page and passes the supported filters', async () => {
    await render('/admin/studio?subject_id=3&status=review&search=litar')
    expect(studio.fetchStudioList).toHaveBeenLastCalledWith(expect.objectContaining({ subjectId: '3', status: 'review', search: 'litar', page: 1, pageSize: 25 }))
  })

  it('has Subjek and Status selects with "Semua ..." and the Tapis / Set Semula buttons', async () => {
    const w = await render()
    expect(t(w, 'studio-subject-filter').text()).toContain('Semua subjek')
    expect(t(w, 'studio-status-filter').text()).toContain('Semua status')
    expect(w.text()).toContain('Tapis')
  })

  it('lists No., Soalan, Kertas, Sumber, Status with the V2 badge words and the servability caption', async () => {
    const w = await render()
    const heads = w.findAll('th').map((h) => h.text())
    expect(heads).toEqual(expect.arrayContaining(['No.', 'Soalan', 'Kertas', 'Sumber', 'Status']))
    expect(w.findAll('[data-testid="studio-row-status"]').map((b) => b.text())).toEqual(['Draft', 'Approved', 'Reviewed'])
    expect(t(w, 'studio-row-served').text()).toBe('Dilihat murid di 4/6')
    expect(t(w, 'studio-row-dskp').text()).toBe('Belum ditanda DSKP')
  })

  it('row actions: Edit for a draft, Edit sebagai draf for an approved question, Sembunyikan only where the lifecycle allows', async () => {
    const w = await render()
    const labelsOf = (testid: string) => w.findAll(`[data-testid="${testid}"]`).length
    expect(labelsOf('studio-row-edit')).toBeGreaterThanOrEqual(1)
    expect(labelsOf('studio-row-edit-draft')).toBeGreaterThanOrEqual(1)
    // draft and approved rows can be hidden, the reviewed one cannot
    expect(labelsOf('studio-row-hide')).toBe(2)
  })

  it('"Sembunyikan" asks "Arkibkan soalan ini?" then archives with a reason and flashes', async () => {
    studio.moveQuestionStatus.mockResolvedValue({ question: { id: '12', status: 'archived' }, servability: null })
    const w = await render()
    const hide = w.findAll('[data-testid="studio-row-hide"]')[1]!
    await hide.trigger('click')
    await flushPromises()
    expect(studio.moveQuestionStatus).toHaveBeenCalledWith('12', 'archived', 'Disembunyikan dari Studio.')
    expect(useFlashStore().current?.message).toBe('Soalan diarkibkan — tidak lagi dipapar kepada pelajar.')
    expect(studio.fetchStudioList).toHaveBeenCalledTimes(2)
  })

  it('"Edit sebagai draf" creates the draft and opens the editor', async () => {
    studio.editAsDraft.mockResolvedValue('12')
    const w = await render()
    await w.get('[data-testid="studio-row-edit-draft"]').trigger('click')
    await flushPromises()
    expect(studio.editAsDraft).toHaveBeenCalledWith('12')
    expect(router.currentRoute.value.fullPath).toBe('/admin/studio/questions/12/sunting')
    expect(useFlashStore().pending?.message).toBe('Draf baharu #12 dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan.')
  })

  it('empty states: never and filtered', async () => {
    studio.fetchStudioList.mockResolvedValue(page([]))
    let w = await render()
    expect(t(w, 'studio-empty').text()).toContain('Belum ada soalan.')
    w.unmount()
    w = await render('/admin/studio?status=archived')
    expect(t(w, 'studio-empty').text()).toContain('Tiada soalan dijumpai.')
  })

  it('shows the load error with a retry', async () => {
    studio.fetchStudioList.mockRejectedValueOnce(new Error('x'))
    const w = await render()
    expect(w.find('[data-testid="studio-error"]').exists()).toBe(true)
    await t(w, 'studio-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="studio-table"]').exists()).toBe(true)
  })
})
