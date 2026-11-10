// @vitest-environment jsdom
/**
 * V2 parity (migration 0265): the Kertas Subjektif page-image documents. The pupil list shows them beside the question-based papers (one list,
 * grouped by subject), the viewer (`/kertas-subjektif/dokumen/:id`) shows the page images and reveals the scheme on demand, and the admin
 * list switches between the two kinds with one filter bar and Terbit / Sembunyikan for a document.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { API_ERROR_CODES, ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import { setBuilderServerForTests } from '../admin/builder/server/client'
import { MockBuilderServer } from '../admin/builder/server/memory'
import SubjektifDokumenPreviewPage from '../admin/papers/SubjektifDokumenPreviewPage.vue'
import SubjektifPaperListPage from '../admin/papers/SubjektifPaperListPage.vue'
import { SUBJEKTIF_ROUTES } from '../admin/papers/ui'
import SubjektifAttemptPage from '../pages/SubjektifAttemptPage.vue'
import SubjektifDokumenPage from '../pages/SubjektifDokumenPage.vue'
import { setKertasDokumenServerForTests } from '../server/documents-client'
import { createMockKertasDokumenApi } from '../server/documents-mock'
import type { KertasDokumen, KertasDokumenApi, KertasDokumenSummary } from '../server/documents-types'

const bijak = vi.hoisted(() => ({
  subjects: () => [{ code: 'SEJ', name: 'Sejarah' }],
  serverNow: () => Date.now(),
  listPapers: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => bijak, browserStorage: () => window.localStorage }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const MenuStub = defineComponent({
  props: { items: { type: Array, default: () => [] } },
  setup(props, { slots }) {
    return () =>
      h('div', [
        slots.default?.(),
        ...(props.items as Record<string, unknown>[][]).flat().map((i) => h('button', { 'data-testid': i['data-testid'] as string, disabled: i.disabled === true, onClick: () => (i.onSelect as () => void)() }, String(i.label))),
      ])
  },
})

let wrapper: VueWrapper | null = null
const stub = { template: '<i/>' }
const body = (): HTMLElement => document.body
const byTid = (id: string): HTMLElement | null => body().querySelector(`[data-testid="${id}"]`)
const text = (id: string): string => byTid(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const summary = (id: string, over: Partial<KertasDokumenSummary> = {}): KertasDokumenSummary => ({
  id,
  title: `Dokumen ${id}`,
  subject: 'SEJ',
  subjectName: 'Sejarah',
  kertas: 2,
  negeri: 'Johor',
  year: 2024,
  pageCount: 3,
  schemePageCount: 1,
  marks: 100,
  durationMinutes: 150,
  ...over,
})
const page = (n: number, kind = 'p'): { position: number; url: string; width: number; height: number } => ({ position: n, url: `/api/files/${kind}${n}`, width: 794, height: 1123 })
const full = (over: Partial<KertasDokumen> = {}): KertasDokumen => ({ ...summary('7'), paperPages: [page(1), page(2), page(3)], schemePages: [page(1, 's')], ...over })

const paper = (id: string, subject: string, subjectName: string, kertas: number, examBoard: string) => ({
  id, title: `Kertas ${id}`, subject, subjectName, kertas, year: 2025, code: 'X', durationMin: 0, questionCount: 3, marks: 20, kind: 'pilihan', status: 'belum', surface: 'subjektif', examBoard,
})

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }))
  bijak.listPapers.mockReset()
  bijak.listPapers.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  setKertasDokumenServerForTests(null)
  setBuilderServerForTests(null)
  vi.unstubAllGlobals()
})

function pupilRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/kertas-subjektif', name: 'm28.kertas-subjektif', component: SubjektifAttemptPage },
      { path: '/kertas-subjektif/dokumen/:id', name: 'm28.kertas-subjektif.dokumen', component: SubjektifDokumenPage },
      { path: '/kertas-subjektif/:paperId', name: 'm28.kertas-subjektif.paper', component: SubjektifAttemptPage },
    ],
  })
}
async function renderPupil(path: string): Promise<void> {
  const router = pupilRouter()
  await router.push(path)
  wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

describe('pupil list: documents beside the question papers', () => {
  it('lists both kinds in one subject group (Kertas, then negeri), with the V2 card for a document and `Buka`', async () => {
    bijak.listPapers.mockResolvedValue([paper('p1', 'SEJ', 'Sejarah', 2, 'selangor')])
    const docs: KertasDokumenSummary[] = [summary('1', { negeri: 'Kedah' }), summary('2', { kertas: 3, negeri: 'Johor', marks: null, durationMinutes: null })]
    setKertasDokumenServerForTests({ list: () => Promise.resolve(docs) } as unknown as KertasDokumenApi)
    await renderPupil('/kertas-subjektif')
    expect(text('paper-count')).toBe('3 kertas')
    const group = byTid('group-SEJ')!
    // Kertas 2: Kedah (document) before Selangor (paper); then Kertas 3 (document)
    const order = [...group.querySelectorAll('[data-testid^="paper-"],[data-testid^="dokumen-"]')].map((e) => e.getAttribute('data-testid')).filter((t) => /^(paper-p\d|dokumen-\d)$/.test(t ?? ''))
    expect(order).toEqual(['dokumen-1', 'paper-p1', 'dokumen-2'])
    const card = text('dokumen-1')
    expect(card).toContain('Kedah')
    expect(card).toContain('Kertas 2')
    expect(card).toContain('3 m/s')
    expect(card).toContain('100 markah')
    expect(card).toContain('150 min')
    expect(card).toContain('Buka')
    const bare = text('dokumen-2')
    expect(bare).not.toContain('markah')
    expect(bare).not.toContain('min')
    expect(byTid('open-dokumen-1')?.getAttribute('href')).toBe('/kertas-subjektif/dokumen/1')
  })

  it('a document with no subject goes under "Lain-lain" and counts in the biggest-group order', async () => {
    bijak.listPapers.mockResolvedValue([paper('p1', 'SEJ', 'Sejarah', 2, 'selangor')])
    setKertasDokumenServerForTests({ list: () => Promise.resolve([summary('8', { subject: null, subjectName: null }), summary('9', { subject: null, subjectName: null, kertas: 4 })]) } as unknown as KertasDokumenApi)
    await renderPupil('/kertas-subjektif')
    const ids = [...body().querySelectorAll('[data-testid^="group-"]')].map((g) => g.getAttribute('data-testid'))
    expect(ids).toEqual(['group-LAIN', 'group-SEJ'])
    expect(byTid('group-LAIN')?.textContent).toContain('Lain-lain')
  })

  it('shows the V2 empty copy only when there is no paper and no document', async () => {
    setKertasDokumenServerForTests({ list: () => Promise.resolve([]) } as unknown as KertasDokumenApi)
    await renderPupil('/kertas-subjektif')
    expect(body().textContent).toContain('Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi.')
    wrapper?.unmount()
    setKertasDokumenServerForTests({ list: () => Promise.resolve([summary('1')]) } as unknown as KertasDokumenApi)
    await renderPupil('/kertas-subjektif')
    expect(byTid('list-empty')).toBeNull()
    expect(text('paper-count')).toBe('1 kertas')
  })

  it('still lists the question papers when the documents cannot be read', async () => {
    bijak.listPapers.mockResolvedValue([paper('p1', 'SEJ', 'Sejarah', 2, 'selangor')])
    setKertasDokumenServerForTests({ list: () => Promise.reject(new Error('down')) } as unknown as KertasDokumenApi)
    await renderPupil('/kertas-subjektif')
    expect(text('paper-count')).toBe('1 kertas')
    expect(byTid('paper-p1')).not.toBeNull()
  })
})

describe('pupil viewer: /kertas-subjektif/dokumen/:id', () => {
  const server = (doc: KertasDokumen | Error): KertasDokumenApi => ({ get: () => (doc instanceof Error ? Promise.reject(doc) : Promise.resolve(doc)) }) as unknown as KertasDokumenApi

  it('shows the heading, the page images in order (lazy, with their alt text) and no scheme until the press', async () => {
    setKertasDokumenServerForTests(server(full()))
    await renderPupil('/kertas-subjektif/dokumen/7')
    expect(body().textContent).toContain('Sejarah — Kertas 2')
    expect(body().textContent).toContain('Johor 2024')
    expect(text('dokumen-marks')).toBe('100 markah')
    expect(text('dokumen-minutes')).toBe('150 min')
    const imgs = [...byTid('dokumen-pages')!.querySelectorAll('img')]
    expect(imgs.map((i) => i.getAttribute('alt'))).toEqual(['Muka surat 1', 'Muka surat 2', 'Muka surat 3'])
    expect(imgs.every((i) => i.getAttribute('loading') === 'lazy')).toBe(true)
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/api/files/p1', '/api/files/p2', '/api/files/p3'])
    expect(byTid('dokumen-scheme')).toBeNull()
    expect(text('dokumen-scheme-show')).toContain('Tunjuk Skema Pemarkahan')
    expect(text('dokumen-scheme-show')).toContain('(cuba jawab dahulu)')
  })

  it('reveals the scheme on the press and hides it again with Sembunyi', async () => {
    setKertasDokumenServerForTests(server(full()))
    await renderPupil('/kertas-subjektif/dokumen/7')
    byTid('dokumen-scheme-show')!.click()
    await flushPromises()
    expect(byTid('dokumen-scheme-show')).toBeNull()
    expect(text('dokumen-scheme')).toContain('Skema Pemarkahan')
    expect(byTid('dokumen-scheme-page-1')?.getAttribute('alt')).toBe('Skema muka surat 1')
    byTid('dokumen-scheme-hide')!.click()
    await flushPromises()
    expect(byTid('dokumen-scheme')).toBeNull()
    expect(byTid('dokumen-scheme-show')).not.toBeNull()
  })

  it('says so when there is no scheme, and when the images are not ready; the title shows when there is no negeri', async () => {
    setKertasDokumenServerForTests(server(full({ schemePages: [], paperPages: [], negeri: null, marks: null, durationMinutes: null })))
    await renderPupil('/kertas-subjektif/dokumen/7')
    expect(text('dokumen-no-scheme')).toBe('Skema pemarkahan tidak tersedia untuk kertas ini.')
    expect(text('dokumen-no-pages')).toContain('Imej kertas belum tersedia.')
    expect(byTid('dokumen-meta')).toBeNull()
    expect(body().textContent).toContain('Dokumen 7')
  })

  it('a Draf or unknown document (404) shows the not-found state with a way back', async () => {
    setKertasDokumenServerForTests(server(new ApiError({ status: 404, code: API_ERROR_CODES.NOT_FOUND, message: 'Kertas tidak ditemui' })))
    await renderPupil('/kertas-subjektif/dokumen/99')
    expect(byTid('dokumen-not-found')).not.toBeNull()
    expect(body().textContent).toContain('Kertas ini tidak dijumpai.')
    expect(byTid('dokumen-viewer')).toBeNull()
  })
})

describe('mock server rules (the in-browser twin of the API)', () => {
  it('lists published documents only, refuses a Draf and an unknown id with a 404, and the tiles ignore the filters', async () => {
    const api = createMockKertasDokumenApi()
    const list = await api.list()
    expect(list.map((d) => d.id)).toEqual(['1', '3', '2'])
    await expect(api.get('4')).rejects.toMatchObject({ status: 404 })
    await expect(api.get('nope')).rejects.toMatchObject({ status: 404 })
    const admin = await api.adminList({ status: 'draf', page: 1, pageSize: 30 })
    expect(admin.total).toBe(2)
    expect(admin.counts).toEqual({ total: 5, published: 3, withScheme: 3 })
  })

  it('Terbit needs a page (the V2 copy) and the toggle flips the state', async () => {
    const api = createMockKertasDokumenApi()
    await expect(api.toggle('5')).rejects.toMatchObject({ status: 422, message: '“Kertas Tanpa Halaman” tiada halaman — tidak boleh diterbitkan.' })
    expect(await api.toggle('4')).toMatchObject({ status: 'terbit' })
    expect((await api.list()).map((d) => d.id)).toContain('4')
    expect(await api.toggle('4')).toMatchObject({ status: 'draf' })
  })
})

/* ------------------------------------------------------------------------------------ admin */
async function renderAdminList(): Promise<void> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: SUBJEKTIF_ROUTES.list, component: SubjektifPaperListPage },
      { path: '/d/:id', name: SUBJEKTIF_ROUTES.detail, component: stub },
      { path: '/dokumen/:id', name: SUBJEKTIF_ROUTES.dokumen, component: SubjektifDokumenPreviewPage },
    ],
  })
  await router.push('/')
  wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router], stubs: { UDropdownMenu: MenuStub, DropdownMenu: MenuStub } }, attachTo: document.body })
  await flushPromises()
}
async function click(id: string): Promise<void> {
  const el = byTid(id)
  if (!el) throw new Error(`missing ${id}`)
  el.click()
  await flushPromises()
}

describe('admin list: Kertas Soalan | Kertas Imbasan', () => {
  beforeEach(() => {
    setBuilderServerForTests(new MockBuilderServer())
    setKertasDokumenServerForTests(createMockKertasDokumenApi())
  })

  it('opens on the question papers; the switch shows the documents with the V2 tiles, columns and no Baharu', async () => {
    await renderAdminList()
    expect(byTid('sj-table')).not.toBeNull()
    expect(byTid('sj-new')).not.toBeNull()
    expect(byTid('sjd-list')).toBeNull()
    await click('sj-kind-dokumen')
    expect(byTid('sjd-list')).not.toBeNull()
    expect(byTid('sj-table')).toBeNull()
    expect(byTid('sj-new')).toBeNull()
    const tiles = text('sjd-list')
    for (const t of ['Jumlah Kertas', 'Diterbitkan', 'Ada Skema']) expect(tiles).toContain(t)
    const heads = [...byTid('sjd-table')!.querySelectorAll('th')].map((t) => t.textContent?.trim())
    expect(heads).toEqual(['Subjek', 'Kertas', 'Negeri', 'Tahun', 'Halaman', 'Status', 'Tindakan'])
    const rows = byTid('sjd-table')!.textContent ?? ''
    expect(rows).toContain('4 + 3 skema') // 4 pages + 3 scheme pages
    expect(rows).toContain('tiada skema')
    // the same filter bar serves both kinds
    expect(byTid('sj-filters')).not.toBeNull()
    await click('sj-kind-soalan')
    expect(byTid('sj-table')).not.toBeNull()
  })

  it('filters the documents with the shared bar (status Draf) and keeps the tiles over the whole set', async () => {
    await renderAdminList()
    await click('sj-kind-dokumen')
    const sel = byTid('sj-filter-status') as HTMLSelectElement
    sel.value = 'draf'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    ;(body().querySelector('[data-ds=filter-bar]') as HTMLFormElement).requestSubmit()
    await flushPromises()
    const rows = [...byTid('sjd-table')!.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(2)
    expect(byTid('sjd-list')!.textContent).toContain('5') // Jumlah Kertas stays 5
  })

  it('Terbit refuses a document with no page (disabled), Sembunyikan and Terbit flash the V2 copy and refresh the status', async () => {
    await renderAdminList()
    await click('sj-kind-dokumen')
    expect((byTid('sjd-toggle-5') as HTMLButtonElement).disabled).toBe(true)
    await click('sjd-toggle-1') // published -> hidden
    expect(useFlashStore().current?.message).toBe('“Sejarah Kertas 2 Percubaan Johor” disembunyikan daripada pelajar.')
    await click('sjd-toggle-4') // draf with pages -> published
    expect(useFlashStore().current?.message).toBe('“Matematik Kertas 2 Percubaan Perak” kini diterbitkan.')
  })

  it('Pratonton opens the preview (any status) with the pages and the status badge', async () => {
    setKertasDokumenServerForTests(createMockKertasDokumenApi())
    await renderAdminList()
    await click('sj-kind-dokumen')
    await click('sjd-preview-4')
    await flushPromises()
    expect(byTid('sj-dokumen-title')?.textContent).toContain('Matematik Kertas 2 Percubaan Perak')
    expect(byTid('dokumen-pages')!.querySelectorAll('img')).toHaveLength(4)
  })
})
