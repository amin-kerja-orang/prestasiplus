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
const summaryApi = vi.hoisted(() => ({ fetchQuestionSummary: vi.fn() }))
vi.mock('../../api/questions', () => summaryApi)

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
  summaryApi.fetchQuestionSummary.mockReset().mockResolvedValue(null)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('StudioListPage (S1 to S6)', () => {
  it('shows the KPI strip by Subjek from /summary, without an empty subject (plan S2-T01)', async () => {
    summaryApi.fetchQuestionSummary.mockResolvedValue({ total: 10, subjects: [{ id: '3', name: 'Matematik', icon: null, group: 'teras', total: 7, approved: 4 }, { id: '5', name: 'Fizik', icon: null, group: 'elektif', total: 0, approved: 0 }] })
    const w = await render()
    const strip = w.get('[data-testid="studio-kpis"]').text()
    expect(strip).toContain('Jumlah soalan')
    expect(strip).toContain('Matematik')
    expect(strip).toContain('4Matematik')
    expect(strip).not.toContain('Fizik')
  })

  it('shows the V2 subtitle, the four status tiles with counts and "Cipta baharu"', async () => {
    const w = await render()
    expect(w.text()).toContain('Bank soalan kanonikal - cipta, semak, terbit')
    const tiles = t(w, 'studio-tiles').text().replace(/\s+/g, ' ')
    for (const word of ['Draf', 'Menunggu Semakan', 'Diterbitkan', 'Diarkibkan']) expect(tiles).toContain(word)
    expect(tiles).toContain('20')
    expect(t(w, 'studio-create').attributes('href')).toBe('/admin/studio/questions/create')
  })

  it('asks the API for 25 per page and passes the supported filters', async () => {
    await render('/admin/studio?subject_id=3&status=review&search=litar')
    expect(studio.fetchStudioList).toHaveBeenLastCalledWith(expect.objectContaining({ subjectId: '3', status: 'review', search: 'litar', page: 1, pageSize: 25 }))
  })

  it('passes the source-paper filters Tahun, Negeri, Kertas and Jenis (T47) and shows them as chips', async () => {
    const w = await render('/admin/studio?tahun=2024&negeri=Selangor&kertas=2&jenis=percubaan')
    expect(studio.fetchStudioList).toHaveBeenLastCalledWith(expect.objectContaining({ tahun: '2024', negeri: 'Selangor', kertas: '2', jenis: 'percubaan' }))
    const text = w.text()
    for (const chip of ['Tahun: 2024', 'Negeri: Selangor', 'Kertas: 2', 'Jenis: Percubaan']) expect(text).toContain(chip)
    expect(t(w, 'studio-jenis-filter').text()).toContain('Semua jenis')
    expect(t(w, 'studio-kertas-filter').text()).toContain('Kertas 3')
  })

  it('drops a filter value the API would refuse instead of sending it', async () => {
    await render('/admin/studio?tahun=24&kertas=9&jenis=ujian')
    expect(studio.fetchStudioList).toHaveBeenLastCalledWith(expect.objectContaining({ tahun: null, kertas: null, jenis: null }))
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
    expect(w.findAll('[data-testid="studio-row-status"]').map((b) => b.text())).toEqual(['Draf', 'Diterbitkan', 'Menunggu Semakan'])
    expect(t(w, 'studio-row-served').text()).toBe('Dilihat murid di 4/6')
    expect(t(w, 'studio-row-dskp').text()).toBe('Belum ditanda DSKP')
  })

  it('shows the row kertas and numberLabel (REQ-C-010), else the old display (R1E2E-C2)', async () => {
    studio.fetchStudioList.mockResolvedValue(page([row('41', 'draft', { kertas: '2', numberLabel: '7(b)' }), row('42', 'draft')]))
    const w = await render()
    const nos = w.findAll('[data-testid="studio-row-id"]').map((b) => b.text())
    expect(nos).toEqual(['7(b)', '42'])
    const text = w.text()
    expect(text).toContain('Kertas 2')
    expect(text).toContain('Matematik · Tingkatan 4')
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

describe('StudioListPage phone cards (AC-ADM-R9)', () => {
  const LONG = `Halaju zarah ialah v = 3t^2 - 12t + 9 m/s, dengan t ialah masa dalam saat. ${'Cari halaju apabila zarah berhenti seketika. '.repeat(3)}`
  const sizes = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
  const heights = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')

  beforeEach(() => {
    // Below md: DsDataTable renders the card list. A clamped paragraph is taller inside than outside.
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 120 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 60 })
    studio.fetchStudioList.mockResolvedValue(page([row('21', 'approved', { questionText: LONG, kertas: '2', numberLabel: '4(a)' })]))
    studio.fetchServabilityBatch.mockResolvedValue({ reports: [{ questionId: '21', versionNo: 1, servedCount: 4, total: 6, activities: [] }], notFound: [] })
  })
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
    if (sizes) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sizes)
    if (heights) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heights)
  })

  it('shows the status badge, the full stem (not the 80 character excerpt), the kertas line and the served caption', async () => {
    const w = await render()
    expect(w.find('table').exists()).toBe(false)
    const card = t(w, 'studio-card')
    expect(card.get('[data-testid="studio-row-status"]').text()).toBe('Diterbitkan')
    expect(t(w, 'studio-card-stem').text()).toBe(LONG.trim())
    expect(t(w, 'studio-card-kertas').text()).toBe('Kertas 2')
    expect(t(w, 'studio-card-sumber').text()).toBe('Sumber: TRIAL')
    expect(t(w, 'studio-row-served').text()).toBe('Dilihat murid di 4/6')
  })

  it('clamps the stem to 3 lines and Lihat penuh expands it and back', async () => {
    const w = await render()
    expect(t(w, 'studio-card-stem').classes()).toContain('line-clamp-3')
    const more = t(w, 'studio-card-more')
    expect(more.text()).toBe('Lihat penuh')
    await more.trigger('click')
    expect(t(w, 'studio-card-stem').classes()).not.toContain('line-clamp-3')
    expect(t(w, 'studio-card-more').text()).toBe('Tunjuk kurang')
    expect(t(w, 'studio-card-more').attributes('aria-expanded')).toBe('true')
    await t(w, 'studio-card-more').trigger('click')
    expect(t(w, 'studio-card-stem').classes()).toContain('line-clamp-3')
  })

  it('measures the clamp again when the width changes', async () => {
    let height = 60
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => height })
    const w = await render()
    expect(w.find('[data-testid="studio-card-more"]').exists()).toBe(true)
    height = 120 // the stem fits after the rotation: no clamp, no toggle
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(w.find('[data-testid="studio-card-more"]').exists()).toBe(false)
    height = 60
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(w.find('[data-testid="studio-card-more"]').exists()).toBe(true)
  })

  it('keeps the row actions on the card', async () => {
    const w = await render()
    expect(w.find('[data-testid="studio-row-preview"]').exists()).toBe(true)
    expect(w.find('[data-testid="studio-row-edit-draft"]').exists()).toBe(true)
  })
})
