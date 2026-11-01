// @vitest-environment jsdom
// REQ-B-042: "Tambah soalan dari bank" lists the builder's section pool (same eligibility as the Set
// Builder bank), not the editor's own Kertas-tagged question list; a K1 paper's pool MCQs have kertas 0.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

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
        return Promise.resolve({ status: 200, headers: {}, body: { data: [unit('a'), unit('g1', { groupId: 'grp', questionIds: ['g1', 'g2'] })], meta: { totalItems: 59, totalPages: 3 } } })
      },
    }
    const server = createHttpBijakAdminServer({ client: new ApiClient({ transport }) })
    const page = await server.sectionPool('p1', 's1', { q: ' tolak ', page: 2, pageSize: 20 })
    const req = requests.find((r) => r.url.includes('/pool'))!
    expect(req.method).toBe('GET')
    expect(req.url.startsWith('/api/admin/papers/p1/sections/s1/pool')).toBe(true)
    const qs = req.url.includes('?') ? new URLSearchParams(req.url.split('?')[1]) : new URLSearchParams(Object.entries(req.query ?? {}).map(([k, v]) => [k, String(v)]))
    expect(qs.get('q')).toBe('tolak')
    expect(qs.get('page')).toBe('2')
    expect(qs.get('pageSize')).toBe('20')
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
