// @vitest-environment jsdom
// S3-T02: the Set Builder landing against a stub BuilderApi: Jana set fields (API-BIJAK-11), Mula kosong, the one paper list.
import type { BijakPoolPreview } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SetBuilderLandingPage from '../admin/builder/pages/SetBuilderLandingPage.vue'
import type { BuilderApi } from '../admin/builder/server/api'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import type { AdminPaperSummary } from '../domain/admin-types'

const preview = (over: Partial<BijakPoolPreview> = {}): BijakPoolPreview =>
  ({
    blueprint: { version: 1, source: 'Disahkan' },
    publishedTotal: 50,
    eligibleTotal: 50,
    verdict: 'boleh',
    firstFailure: null,
    excluded: { total: 0, byReason: [] },
    warnings: [],
    sections: [{ position: 1, label: 'Bahagian A', slots: 40, eligible: 50, modeExcluded: 0 }],
    groupTotal: 3,
    contractTotal: 40,
    filters: { years: [2025, 2024], negeri: ['Johor', 'SBP'] },
    levelScope: 't5',
    ...over,
  }) as never

const row = (over: Partial<AdminPaperSummary> = {}): AdminPaperSummary => ({
  id: 'p1', title: 'Set Satu', subject: 'SEJ', subjectName: 'Sejarah', kertas: 1, code: '1249/1', status: 'draf', questionCount: 40, marks: 40, budget: 40, ok: true, updatedAt: 1,
  levelScope: 't4', origins: [{ negeri: 'Perlis', count: 10 }, { negeri: 'Perak', count: 8 }, { negeri: 'Pahang', count: 7 }, { negeri: 'Selangor', count: 6 }, { negeri: 'Johor', count: 5 }, { negeri: 'SBP', count: 4 }],
  ...over,
})

function stub(over: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const m: Record<string, ReturnType<typeof vi.fn>> = {
    listSets: vi.fn().mockResolvedValue([row()]),
    builderSubjects: vi.fn().mockResolvedValue([{ code: 'SEJ', name: 'Sejarah', kertas: [1, 2], levelScopes: { 1: 't5', 2: 't4_t5' } }]),
    poolPreview: vi.fn().mockResolvedValue(preview()),
    generate: vi.fn().mockResolvedValue('new1'),
    getEditor: vi.fn().mockResolvedValue({ paper: { sections: [{ questionIds: ['a', 'b'] }] } }),
    create: vi.fn().mockResolvedValue('new2'),
    copy: vi.fn().mockResolvedValue('new3'),
    deleteSet: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
  return { m, api: m as unknown as BuilderApi }
}

let wrapper: VueWrapper | null = null
const stubC = { template: '<i/>' }
async function render(api: BuilderApi): Promise<{ w: VueWrapper; push: ReturnType<typeof vi.spyOn> }> {
  setBuilderServerForTests(api)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/studio/sets', component: SetBuilderLandingPage },
      { path: '/admin/studio/sets/:paper/builder', component: stubC },
      { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: stubC },
      { path: '/admin/spm/kontrak', name: 'm28.admin.kontrak', component: stubC },
      { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stubC },
      { path: '/admin/spm/kontrak/:subjek/:kertas/kolam', name: 'm28.admin.kontrak.pool', component: stubC },
    ],
  })
  await router.push('/admin/studio/sets')
  const push = vi.spyOn(router, 'push')
  wrapper = mount(SetBuilderLandingPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { w: wrapper, push }
}
async function pick(w: VueWrapper, testid: string, value: string): Promise<void> {
  await w.get(`[data-testid="${testid}"]`).setValue(value)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  setBuilderServerForTests(null)
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('Jana set (FR-ADM-Q13.2, API-BIJAK-11)', () => {
  it('prefills the title, the count and the scope from the contract, so one click generates (AC-ADM-Q13.1)', async () => {
    const { m, api } = stub()
    const { w, push } = await render(api)
    expect(w.get('[data-testid="gen-reason"]').text()).toBe('Sila pilih subjek.')
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    expect((w.get('[data-testid="gen-title"]').element as HTMLInputElement).value).toBe('Percubaan SPM Sejarah Kertas 1 (draf)')
    expect((w.get('[data-testid="gen-count"]').element as HTMLInputElement).value).toBe('40')
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="generate-form"]').trigger('submit')
    await flushPromises()
    expect(m.generate).toHaveBeenCalledWith('SEJ', 1, { title: 'Percubaan SPM Sejarah Kertas 1 (draf)', levelScope: 't5' })
    expect(push).toHaveBeenCalledWith('/admin/studio/sets/new1/builder')
  })

  it('sends Tahun, Negeri, a smaller count and the scope; the preview follows them', async () => {
    const { m, api } = stub()
    const { w } = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    await w.get('[data-testid="gen-year-2025"]').trigger('click')
    await w.get('[data-testid="gen-negeri-SBP"]').trigger('click')
    await flushPromises()
    expect(m.poolPreview).toHaveBeenLastCalledWith('SEJ', 1, { years: [2025], negeri: ['SBP'] })
    vi.useFakeTimers()
    await w.get('[data-testid="gen-count"]').setValue('10')
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    await flushPromises()
    expect(m.poolPreview).toHaveBeenLastCalledWith('SEJ', 1, { years: [2025], negeri: ['SBP'], count: 10 })
    expect(w.get('[data-testid="gen-scaled"]').text()).toContain('Kurang daripada 40')
    await pick(w, 'gen-scope', 't4_t5')
    await w.get('[data-testid="gen-title"]').setValue('Set Mac')
    await w.get('[data-testid="generate-form"]').trigger('submit')
    await flushPromises()
    expect(m.generate).toHaveBeenCalledWith('SEJ', 1, { years: [2025], negeri: ['SBP'], count: 10, title: 'Set Mac', levelScope: 't4_t5' })
  })

  it('the count, title and pool messages; the button stays off (13-04, 13-07, 13-10)', async () => {
    const { m, api } = stub()
    const { w } = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    await w.get('[data-testid="gen-count"]').setValue('0')
    expect(w.get('[data-testid="generate-form"]').text()).toContain('Bilangan soalan mesti antara 1 dan 100.')
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="gen-count"]').setValue('41')
    expect(w.get('[data-testid="generate-form"]').text()).toContain('Bilangan soalan melebihi jumlah kontrak (40).')
    await w.get('[data-testid="gen-count"]').setValue('40')
    await w.get('[data-testid="gen-title"]').setValue('  ')
    expect(w.get('[data-testid="generate-form"]').text()).toContain('Tajuk set diperlukan.')
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    expect(m.generate).not.toHaveBeenCalled()
  })

  it('a scaled size above 100 is refused like the API refuses it; a contract total above 100 is sent as no count', async () => {
    const big = preview({ contractTotal: 150, publishedTotal: 200, eligibleTotal: 200 })
    const { api } = stub({ poolPreview: vi.fn().mockResolvedValue(big) })
    const { w } = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    expect(w.get('[data-testid="generate-form"]').text()).not.toContain('Bilangan soalan mesti antara 1 dan 100.')
    await w.get('[data-testid="gen-count"]').setValue('101')
    expect(w.get('[data-testid="generate-form"]').text()).toContain('Bilangan soalan mesti antara 1 dan 100.')
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="gen-count"]').setValue('100')
    expect(w.get('[data-testid="generate-form"]').text()).not.toContain('Bilangan soalan mesti antara 1 dan 100.')
  })

  it('the pool counts questions and groups, and warns (FR-ADM-Q13.3)', async () => {
    const { api } = stub({ poolPreview: vi.fn().mockResolvedValue(preview({ eligibleTotal: 40 })) })
    const { w } = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    expect(w.get('[data-testid="pool-available"]').text()).toBe('40 soalan tersedia · 3 kumpulan rangsangan')
    expect(w.get('[data-testid="pool-aside"]').text()).toContain('Anda meminta 40 daripadanya.')
    expect(w.get('[data-testid="pool-aside"]').text()).toContain('Sama dengan jumlah kolam — setiap set akan serupa.')
  })

  it('a pool too small for the set keeps the button off and says to reduce', async () => {
    const { api } = stub({ poolPreview: vi.fn().mockResolvedValue(preview({ eligibleTotal: 20, verdict: 'tidak_boleh' })) })
    const { w } = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="pool-aside"]').text()).toContain('Kurangkan bilangan soalan atau longgarkan penapis.')
  })

  it('Tahun and Negeri stay hidden while their column holds no data', async () => {
    const { api } = stub({ poolPreview: vi.fn().mockResolvedValue(preview({ filters: { years: [], negeri: [] } })) })
    const { w } = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    expect(w.find('[data-testid="gen-years"]').exists()).toBe(false)
    expect(w.find('[data-testid="gen-negeri"]').exists()).toBe(false)
  })
})

describe('Mula kosong (13-01 to 13-03)', () => {
  it('says what is missing, then creates with the prefilled title and the scope', async () => {
    const { m, api } = stub()
    const { w, push } = await render(api)
    await w.get('[data-testid="blank-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="blank-form"]').text()).toContain('Tajuk set diperlukan.')
    expect(w.get('[data-testid="blank-form"]').text()).toContain('Sila pilih subjek.')
    expect(m.create).not.toHaveBeenCalled()
    await pick(w, 'blank-subject', 'SEJ')
    await w.get('[data-testid="blank-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="blank-form"]').text()).toContain('Kertas tidak sah.')
    await pick(w, 'blank-kertas', '2')
    await w.get('[data-testid="blank-form"]').trigger('submit')
    await flushPromises()
    expect(m.create).toHaveBeenCalledWith({ subject: 'SEJ', kertas: 2, title: 'Percubaan SPM Sejarah Kertas 2 (draf)', levelScope: 't4_t5' })
    expect(push).toHaveBeenCalledWith('/admin/studio/sets/new2/builder')
  })
})

describe('Set sedia ada (FR-ADM-Q13.1, FR-ADM-Q13.4)', () => {
  it('shows subject, kertas, questions, marks, Dilihat murid, the origin chips and Sunting kontrak; the header has Kontrak Simulasi', async () => {
    const { w } = await render(stub().api)
    expect(w.text()).toContain('Set sedia ada')
    const set = w.get('[data-testid="set-p1"]')
    expect(set.text()).toContain('Sejarah · Kertas 1 · 40 soalan · 40 markah')
    expect(w.get('[data-testid="set-scope-p1"]').text()).toBe('Dilihat murid: Tingkatan 4')
    const origins = w.get('[data-testid="set-origins-p1"]').text()
    expect(origins).toContain('Perlis 10')
    expect(origins).toContain('+2 lagi')
    expect(w.get('[data-testid="set-contract-p1"]').attributes('href')).toBe('/admin/spm/kontrak/SEJ/1')
    expect(w.get('[data-testid="landing-contract"]').attributes('href')).toBe('/admin/spm/kontrak')
  })

  it('a paper older than the decision reads Semua tingkatan; an empty list says Tiada set lagi.', async () => {
    const { w } = await render(stub({ listSets: vi.fn().mockResolvedValue([row({ levelScope: null })]) }).api)
    expect(w.get('[data-testid="set-scope-p1"]').text()).toContain('Semua tingkatan')
    w.unmount()
    const { w: empty } = await render(stub({ listSets: vi.fn().mockResolvedValue([]) }).api)
    expect(empty.text()).toContain('Tiada set lagi.')
  })

  it('Padam a draft asks first; a Terbit set is refused with the PRD line and the API is not called', async () => {
    const { m, api } = stub({ listSets: vi.fn().mockResolvedValue([row(), row({ id: 'p2', status: 'terbit', title: 'Set Dua' })]) })
    const { w } = await render(api)
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    await w.get('[data-testid="set-delete-p1"]').trigger('click')
    await flushPromises()
    expect(m.deleteSet).toHaveBeenCalledWith('p1')
    m.deleteSet!.mockClear()
    await w.get('[data-testid="set-delete-p2"]').trigger('click')
    await flushPromises()
    expect(m.deleteSet).not.toHaveBeenCalled()
  })

  it('shows 25 a page, and the next 25 on Muat lagi', async () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ id: `s${String(i)}`, title: `Set ${String(i)}` }))
    const { w } = await render(stub({ listSets: vi.fn().mockResolvedValue(many) }).api)
    expect(w.findAll('[data-testid^="set-open-"]')).toHaveLength(25)
    await w.get('[data-testid="sets-more"]').trigger('click')
    expect(w.findAll('[data-testid^="set-open-"]')).toHaveLength(30)
    expect(w.find('[data-testid="sets-more"]').exists()).toBe(false)
  })
})
