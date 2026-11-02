// @vitest-environment jsdom
// REQ-B-042: "Tambah soalan dari bank" lists the builder's section pool (same eligibility as the Set
// Builder bank), not the editor's own Kertas-tagged question list; a K1 paper's pool MCQs have kertas 0.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { BANK } from '../data/registry'
import PaperEditorPage from '../admin/papers/PaperEditorPage.vue'
import type { AdminPaper, PaperEditorData, SectionPoolPage } from '../domain/admin-types'
import { BijakServer, MemoryStorage } from '../server/store'
import { createHttpBijakAdminServer } from '../server/http-admin'

describe('http client: sectionPool', () => {
  const unit = (id: string, extra: object = {}) => ({
    questionIds: [id],
    questions: [{ id, preview: `P ${id}`, marks: 1, kind: 'objektif', topic: 'T', status: 'approved', kertas: 0, subject: 'MAT' }],
    marks: 1, eligible: true, reasons: [], placed: false, ...extra,
  })
  it('GETs the section pool with q, page and pageSize and maps the units (kertas 0 kept)', async () => {
    const requests: TransportRequest[] = []
    const transport: Transport = {
      request: (req: TransportRequest): Promise<TransportResponse> => {
        requests.push(req)
        if (req.url === '/api/session') return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c' } } })
        return Promise.resolve({ status: 200, headers: {}, body: { data: [unit('a'), unit('g1', { groupId: 'grp', questionIds: ['g1', 'g2'], stimulus: { id: 'st1', kind: 'image', label: 'Rajah 2', alt: 'a' } })], meta: { totalItems: 59, totalPages: 3 } } })
      },
    }
    const server = createHttpBijakAdminServer({ client: new ApiClient({ transport }) })
    const page = await server.sectionPool('p1', 's1', { q: ' tolak ', page: 2, pageSize: 20 })
    const req = requests.find((r) => r.url.includes('/pool'))!
    expect(req.method).toBe('GET')
    expect(req.url).toBe('/api/admin/papers/p1/sections/s1/pool')
    expect(req.query).toEqual({ q: 'tolak', page: '2', pageSize: '20' })
    expect(page.units[1]!.stimulus).toMatchObject({ id: 'st1', label: 'Rajah 2' })
    expect(page.units[0]!.stimulus).toBeUndefined()
    expect(page.total).toBe(59)
    expect(page.totalPages).toBe(3)
    expect(page.units).toHaveLength(2)
    expect(page.units[0]!.questions[0]).toMatchObject({ status: 'terbit', kertas: 0 })
    expect(page.units[1]!.groupId).toBe('grp')
  })
})

describe('mock sectionPool mirrors it', () => {
  it('lists approved questions of the paper subject and kertas as units, paged', async () => {
    const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const id = await server.createPaper({ subject: 'MAT', kertas: 1, title: 'T' })
    const ed = await server.getPaperEditor(id)
    const sid = ed.paper.sections[0]!.id
    const all = await server.sectionPool(id, sid, { pageSize: 500 })
    expect(all.units.length).toBeGreaterThan(0)
    expect(all.units.every((u) => u.eligible && !u.placed)).toBe(true)
    const p1 = await server.sectionPool(id, sid, { pageSize: 3 })
    expect(p1.units).toHaveLength(3)
    expect(p1.totalPages).toBe(Math.ceil(all.total / 3))
    const hit = await server.sectionPool(id, sid, { q: all.units[0]!.questions[0]!.preview.slice(0, 12) })
    expect(hit.total).toBeGreaterThan(0)
    await expect(server.sectionPool(id, 'nope')).rejects.toBeTruthy()
  })

  it('K1: the MCQ pool is listed and eligible; groups carry their stimulus; a kertas-2 pool is not offered', async () => {
    const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const id = await server.createPaper({ subject: 'MAT', kertas: 1, title: 'T' })
    const sid = (await server.getPaperEditor(id)).paper.sections[0]!.id
    const all = await server.sectionPool(id, sid, { pageSize: 500 })
    const eligible = all.units.filter((u) => u.eligible)
    expect(eligible.length).toBeGreaterThan(0)
    expect(eligible.every((u) => u.questions.every((q) => q.id.startsWith('mat1-')))).toBe(true)
    const groups = all.units.filter((u) => u.groupId)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.every((u) => u.stimulus && u.stimulus.label)).toBe(true)
    expect(all.units.filter((u) => !u.groupId).every((u) => u.stimulus === undefined)).toBe(true)
    // deterministic
    expect(await server.sectionPool(id, sid, { pageSize: 500 })).toEqual(all)
  })

  it('kertas = the lowest pool-code digit; an incomplete group is dropped; groupId only for more than one member (D90)', async () => {
    const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const poolOf = async (kertas: 1 | 2) => {
      const id = await server.createPaper({ subject: 'MAT', kertas, title: 'T' })
      const sid = (await server.getPaperEditor(id)).paper.sections[0]!.id
      return server.sectionPool(id, sid, { pageSize: 1000 })
    }
    const k1 = await poolOf(1)
    const lone = k1.units.find((u) => !u.groupId)!.questionIds[0]!
    const group = k1.units.find((u) => u.groupId)!
    expect(group.questionIds.length).toBeGreaterThan(1)
    expect(k1.units.every((u) => !u.groupId || u.questionIds.length > 1)).toBe(true)

    const added = { questionId: lone, pool: 'MAT2-ZZZ' }
    const q = BANK.questions.get(group.questionIds[0]!)!
    const subject = q.curriculum.subject
    BANK.pool.push(added)
    try {
      // lowest digit stays 1: still K1, and (a `some` match) not pulled into K2
      expect((await poolOf(1)).units.some((u) => u.questionIds.includes(lone))).toBe(true)
      expect((await poolOf(2)).units.some((u) => u.questionIds.includes(lone))).toBe(false)
      // one member leaves the subject: the group is not offered at all
      q.curriculum.subject = 'BM'
      const broken = await poolOf(1)
      expect(broken.units.some((u) => u.groupId === group.groupId)).toBe(false)
      expect(broken.units.some((u) => group.questionIds.some((m) => u.questionIds.includes(m)))).toBe(false)
    } finally {
      q.curriculum.subject = subject
      BANK.pool.splice(BANK.pool.indexOf(added), 1)
    }
    expect((await poolOf(1)).units.some((u) => u.groupId === group.groupId)).toBe(true)
  })
})

const h = vi.hoisted((): { server: unknown } => ({ server: undefined }))
vi.mock('../server/client', () => ({
  bijakServer: () => h.server,
  bijakAdminServer: () => h.server,
}))

function editor(): PaperEditorData {
  const paper = {
    id: 'p1', title: 'K1', subject: 'MAT', kertas: 1, year: 2026, code: '1449/1', durationMin: 90, instructions: [],
    status: 'draf', createdAt: 1, updatedAt: 1,
    sections: [{ id: 's1', label: 'Objektif', markBudget: 2, questionCount: 2, rule: { type: 'all' }, questionIds: [] }],
  } as unknown as AdminPaper
  // K1 case: the editor's own question list is EMPTY (the pool MCQs are not Kertas-1 tagged).
  return { paper, blueprint: null, questions: [], groups: [] }
}
const mk = (id: string) => ({
  questionIds: [id],
  questions: [{ id, preview: `Soalan ${id}`, marks: 1, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 0, subject: 'MAT' }],
  marks: 1, eligible: true, reasons: [], placed: false,
})

describe('PaperEditorPage picker', () => {
  let wrapper: VueWrapper | null = null
  const sectionPool = vi.fn()
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    sectionPool.mockReset()
    h.server = { getPaperEditor: vi.fn().mockResolvedValue(editor()), sectionPool }
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
  async function render(): Promise<VueWrapper> {
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: PaperEditorPage },
        { path: '/admin/spm/kertas', name: 'm28.admin.papers', component: stub },
        { path: '/admin/spm/semakan', name: 'm28.admin.review', component: stub },
        { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stub },
        { path: '/:p(.*)*', component: stub },
      ],
    })
    await router.push('/admin/spm/kertas/p1')
    wrapper = mount(PaperEditorPage, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('K1: lists the pool even though the editor knows no questions, and adds a unit', async () => {
    const page: SectionPoolPage = { units: [mk('m1'), mk('m2'), mk('m3')], total: 59, totalPages: 3 } as never
    sectionPool.mockResolvedValue(page)
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    expect(sectionPool).toHaveBeenCalledWith('p1', 's1', { q: '', page: 1, pageSize: 20 })
    expect(document.querySelectorAll('[data-testid^="pick-add-"]').length).toBe(3)
    ;(document.querySelector('[data-testid="pick-add-m1"]') as HTMLElement).click()
    await flushPromises()
    // the local section now holds m1 and the picked unit is no longer offered
    expect(document.querySelector('[data-testid="pick-add-m1"]')).toBeNull()
    expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Soalan 1 / 2')
    expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Markah 1 / 2')
  })

  const grp = {
    groupId: 'g9',
    stimulus: { id: 's9', kind: 'image', label: 'Rajah 9', alt: 'a' },
    questionIds: ['g9a', 'g9b'],
    questions: ['g9a', 'g9b'].map((id) => ({ id, groupId: 'g9', preview: `Soalan ${id}`, marks: 2, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 0, subject: 'MAT' })),
    marks: 4, eligible: true, reasons: [], placed: false,
  }

  it('a group from the pool is ONE unit with its marks, and its stimulus label shows before any reload', async () => {
    sectionPool.mockResolvedValue({ units: [grp, mk('m1')], total: 2, totalPages: 1 })
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="pick-g9"]')!.textContent).toContain('Kumpulan Rajah 9 · 2 soalan')
    ;(document.querySelector('[data-testid="pick-add-g9"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-testid="pick-g9"]')).toBeNull()
    const unit = w.get('[data-testid="unit-group-g9"]')
    expect(unit.text()).toContain('Kumpulan rangsangan Rajah 9 · 2 soalan')
    expect(w.findAll('[data-testid^="unit-group-"]')).toHaveLength(1)
    expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Soalan 2 / 2')
    expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Markah 4 / 2')
  })

  // REQ-A-008 (D90): a pool group carries 0 to 3 stimuli; one without any is still a labelled unit.
  const stim = (id: string, label: string) => ({ id, kind: 'diagram', label, alt: label })
  const withStimuli = (gid: string, stimuli: ReturnType<typeof stim>[]) => ({
    marks: grp.marks,
    eligible: true,
    reasons: [],
    placed: false,
    groupId: gid,
    questionIds: [`${gid}a`, `${gid}b`],
    questions: [`${gid}a`, `${gid}b`].map((id) => ({ ...grp.questions[0]!, id, groupId: gid, preview: `Soalan ${id}` })),
    ...(stimuli.length ? { stimulus: stimuli[0], stimuli } : { stimuli }),
  })
  it.each([
    [0, [], 'Kumpulan · 2 soalan', 'Kumpulan rangsangan · 2 soalan'],
    [1, [stim('a', 'Rajah 1')], 'Kumpulan Rajah 1 · 2 soalan', 'Kumpulan rangsangan Rajah 1 · 2 soalan'],
    [
      3,
      [stim('a', 'Rajah 1'), stim('b', 'Petikan A'), stim('c', 'Jadual 1')],
      'Kumpulan Rajah 1 dan Petikan A dan Jadual 1 · 2 soalan',
      'Kumpulan rangsangan Rajah 1 dan Petikan A dan Jadual 1 · 2 soalan',
    ],
  ])('a pool group with %i stimuli is offered and added as one labelled unit', async (_n, stimuli, pickText, unitText) => {
    sectionPool.mockResolvedValue({ units: [withStimuli('gx', stimuli)], total: 1, totalPages: 1 })
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="pick-gx"]')!.textContent).toContain(pickText)
    ;(document.querySelector('[data-testid="pick-add-gx"]') as HTMLElement).click()
    await flushPromises()
    expect(w.get('[data-testid="unit-group-gx"]').text()).toContain(unitText)
    expect(w.findAll('[data-testid^="unit-group-"]')).toHaveLength(1)
  })

  it('"Muat lagi" appends the next page rows; a fully filtered page shows no empty text next to it', async () => {
    sectionPool.mockResolvedValueOnce({ units: [mk('m1')], total: 2, totalPages: 2 })
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    sectionPool.mockResolvedValueOnce({ units: [mk('m2')], total: 2, totalPages: 2 })
    ;(document.querySelector('[data-testid="picker-more"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelectorAll('[data-testid^="pick-add-"]').length).toBe(2)
    expect(document.querySelector('[data-testid="picker-more"]')).toBeNull()
    // reopen: page 1 is entirely ineligible, more pages exist -> button only
    sectionPool.mockResolvedValueOnce({ units: [{ ...mk('x1'), eligible: false }], total: 30, totalPages: 2 })
    ;(document.querySelector('[data-testid="pick-add-m1"]') as HTMLElement).click()
    await flushPromises()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="picker-empty"]')).toBeNull()
    expect(document.querySelector('[data-testid="picker-more"]')).not.toBeNull()
  })

  it('drops a stale response and appends with the query that produced the list', async () => {
    vi.useFakeTimers()
    let release: (v: unknown) => void = () => {}
    sectionPool.mockResolvedValueOnce({ units: [mk('m1')], total: 40, totalPages: 2 })
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    const input = document.querySelector('[data-testid="picker-search"]') as HTMLInputElement
    // slow answer for 'aa', then a faster one for 'bb': 'aa' must not overwrite
    sectionPool.mockImplementationOnce(() => new Promise((r) => (release = r)))
    input.value = 'aa'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(300)
    sectionPool.mockResolvedValueOnce({ units: [mk('bb1')], total: 1, totalPages: 1 })
    input.value = 'bb'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(300)
    await flushPromises()
    release({ units: [mk('aa1')], total: 1, totalPages: 1 })
    await flushPromises()
    expect(document.querySelector('[data-testid="pick-add-bb1"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="pick-add-aa1"]')).toBeNull()

    // "Muat lagi" during the debounce window of a new query still pages the CURRENT list's query
    sectionPool.mockResolvedValueOnce({ units: [mk('bb1')], total: 40, totalPages: 2 })
    input.value = 'cc'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(300)
    await flushPromises()
    input.value = 'dd'
    input.dispatchEvent(new Event('input'))
    sectionPool.mockResolvedValueOnce({ units: [mk('cc2')], total: 40, totalPages: 2 })
    ;(document.querySelector('[data-testid="picker-more"]') as HTMLElement).click()
    await flushPromises()
    expect(sectionPool.mock.calls.at(-1)![2]).toMatchObject({ q: 'cc', page: 2 })
  })

  it('a failed search offers "Cuba lagi", which retries', async () => {
    sectionPool.mockRejectedValueOnce(new Error('x'))
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="picker-error"]')).not.toBeNull()
    sectionPool.mockResolvedValueOnce({ units: [mk('m1')], total: 1, totalPages: 1 })
    ;(document.querySelector('[data-testid="picker-retry"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-testid="picker-error"]')).toBeNull()
    expect(document.querySelector('[data-testid="pick-add-m1"]')).not.toBeNull()
  })

  it('search is debounced; "Muat lagi" asks the next page; a failure is shown', async () => {
    vi.useFakeTimers()
    sectionPool.mockResolvedValue({ units: [mk('m1')], total: 40, totalPages: 2 })
    const w = await render()
    await w.get('[data-testid="add-0"]').trigger('click')
    await flushPromises()
    const input = document.querySelector('[data-testid="picker-search"]') as HTMLInputElement
    input.value = 'a'
    input.dispatchEvent(new Event('input'))
    input.value = 'ab'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(sectionPool.mock.calls.map((c) => (c[2] as { q: string }).q)).toEqual(['', 'ab'])
    ;(document.querySelector('[data-testid="picker-more"]') as HTMLElement).click()
    await flushPromises()
    expect(sectionPool.mock.calls.at(-1)![2]).toMatchObject({ q: 'ab', page: 2 })
    sectionPool.mockRejectedValue(new Error('x'))
    input.value = 'zz'
    input.dispatchEvent(new Event('input'))
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(document.querySelector('[data-testid="picker-error"]')).not.toBeNull()
  })
})
