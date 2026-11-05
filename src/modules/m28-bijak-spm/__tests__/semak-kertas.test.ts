// @vitest-environment jsdom
// S3-T02: `/admin/spm/kertas/:id` is "Semak Kertas Simulasi": review, metadata and Terbit over the same data; the Bahagian are edited in the Set Builder.
import type { BijakBuilderReview } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import routes from '../routes/admin-papers'
import StudentViewDrawer from '../admin/builder/components/StudentViewDrawer.vue'
import { ADMIN_ROUTES } from '../admin/papers/ui'
import PaperEditorPage from '../admin/papers/PaperEditorPage.vue'
import type { BuilderApi } from '../admin/builder/server/api'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import type { AdminPaper, PaperEditorData } from '../domain/admin-types'

const h = vi.hoisted((): { server: unknown } => ({ server: undefined }))
vi.mock('../server/client', () => ({
  bijakServer: () => h.server,
  bijakAdminServer: () => h.server,
}))

function editor(over: Partial<AdminPaper> = {}): PaperEditorData {
  const paper = {
    id: 'p1', title: 'Kertas Ujian', subject: 'MAT', kertas: 1, year: 2026, code: '1449/1', durationMin: 90, instructions: [],
    status: 'draf', createdAt: 1, updatedAt: 1, levelScope: 't5',
    sections: [{ id: 's1', label: 'Objektif', markBudget: 1, questionCount: 1, rule: { type: 'all' }, questionIds: ['q1'] }],
    ...over,
  } as unknown as AdminPaper
  const q = { id: 'q1', preview: 'Soalan q1', marks: 1, kind: 'objektif' as const, topic: 'T', status: 'terbit' as const, kertas: 1, subject: 'MAT' }
  return { paper, blueprint: null, questions: [q], groups: [] }
}
const review = (over: Partial<BijakBuilderReview> = {}): BijakBuilderReview => ({
  paperId: 'p1', status: 'draf', ok: true, blockers: [], blockerDetails: [], canOverride: false, notes: [], blueprintNeedsReview: false,
  visibleToStudents: false, totalMarks: 1, totalBudget: 1, rows: [], ...over,
})

let wrapper: VueWrapper | null = null
const publish = vi.fn()
async function render(ed: PaperEditorData, rv: BijakBuilderReview = review(), query = ''): Promise<VueWrapper> {
  h.server = { getPaperEditor: vi.fn().mockResolvedValue(ed), unpublishPaper: vi.fn() }
  setBuilderServerForTests({
    review: vi.fn().mockResolvedValue(rv),
    publish,
    studentView: vi.fn().mockResolvedValue({ title: 'T', subject: 'MAT', subjectName: 'Matematik', kertas: 1, year: 2026, code: 'x', durationMin: 1, instructions: [], reference: [], questionCount: 1, marks: 1, sections: [] }),
  } as unknown as BuilderApi)
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: PaperEditorPage },
      { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stub },
      { path: '/:p(.*)*', component: stub },
    ],
  })
  await router.push(`/admin/spm/kertas/p1${query}`)
  wrapper = mount(PaperEditorPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
  publish.mockReset()
  publish.mockResolvedValue({ ok: true, errors: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  setBuilderServerForTests(null)
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('Semak Kertas Simulasi', () => {
  it('has the heading, the back link to the Set Builder landing, and one button to edit there', async () => {
    const w = await render(editor())
    expect((routes.find((r) => r.path === '/admin/spm/kertas/:id')!.meta as { header: { title: string } }).header.title).toBe('Semak Kertas Simulasi')
    expect(w.get('[data-testid="paper-heading"]').text()).toBe('Kertas Ujian')
    const back = w.get('[data-ds="back-link"]')
    expect(back.text()).toContain('Kembali ke Simulasi')
    expect(back.attributes('href')).toBe('/admin/studio/sets')
    expect(w.get('[data-testid="paper-edit-in-builder"]').text()).toContain('Sunting di Set Builder')
    expect(w.get('[data-testid="paper-edit-in-builder"]').attributes('href')).toBe('/admin/studio/sets/p1/builder')
  })

  it('no section editing is left here, and no Simpan draf; the Bahagian still read with their chips', async () => {
    const w = await render(editor())
    for (const id of ['paper-question-ops', 'paper-edit-blocks', 'add-0', 'write-0', 'remove-q1', 'paper-save', 'paper-title', 'picker']) expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(false)
    expect(w.get('[data-testid="section-0-badges"]').text()).toContain('Soalan 1 / 1')
    expect(w.get('[data-testid="unit-q1"]').text()).toContain('Soalan q1')
  })

  it('metadata, reference and the contract block stay', async () => {
    const w = await render(editor())
    for (const id of ['paper-meta', 'paper-reference', 'paper-contract', 'paper-review', 'budget-check']) expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
    expect((w.get('[data-testid="meta-code"]').element as HTMLInputElement).disabled).toBe(false)
  })

  it('Terbitkan off carries the title; on, it confirms and publishes (AC-ADM-Q15.1)', async () => {
    const blocked = await render(editor(), review({ ok: false, blockers: ['x', 'y', 'z'], blockerDetails: ['x', 'y', 'z'].map((message) => ({ code: 'COUNT_TOO_FEW' as const, message, overridable: false })) }))
    expect(blocked.get('[data-testid="paper-publish"]').attributes('disabled')).toBeDefined()
    expect(blocked.get('[data-testid="paper-publish"]').attributes('title')).toBe('Betulkan 3 masalah dahulu')
    blocked.unmount()
    const w = await render(editor())
    expect(w.get('[data-testid="paper-publish"]').text()).toContain('Terbitkan')
    await w.get('[data-testid="paper-publish"]').trigger('click')
    await flushPromises()
    expect(publish).toHaveBeenCalledWith('p1')
  })

  it('the Dilihat murid line names the Tingkatan and the subject (FR-ADM-Q15.3)', async () => {
    const w = await render(editor())
    expect(w.get('[data-testid="review-visible"]').text()).toContain('Tingkatan 5 · MAT')
  })

  it('a published paper keeps Sembunyikan and Lihat di Bijak SPM', async () => {
    const w = await render(editor({ status: 'terbit' }))
    expect(w.get('[data-testid="paper-unpublish"]').text()).toContain('Sembunyikan')
    expect(w.get('[data-testid="paper-view-student"]').text()).toContain('Lihat di Bijak SPM')
    expect(w.find('[data-testid="paper-publish"]').exists()).toBe(false)
  })

  it('back from Tulis soalan baharu: the note points at Import & Semakan (PO decision item 9)', async () => {
    const w = await render(editor(), review(), '?menunggu=1')
    const link = w.get('[data-testid="paper-open-import"]')
    expect(link.text()).toContain('Buka Import & Semakan')
    expect(link.attributes('href')).toBe('/admin/spm/soalan/ekstrak')
  })

  it('FR-ADM-Q07.7: an imported draft is published from the preview only; any other paper keeps the page button and a plain drawer', async () => {
    const plain = await render(editor())
    await plain.get('[data-testid="paper-student-view"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-testid="student-view-publish"]')).toBeNull()
    plain.unmount()
    document.body.innerHTML = ''

    const w = await render(editor({ sourceBatchId: '77' }))
    expect(w.find('[data-testid="paper-publish"]').exists()).toBe(false)
    expect(w.get('[data-testid="paper-publish-from-preview"]').text()).toContain('pratonton')
    await w.get('[data-testid="paper-student-view"]').trigger('click')
    await flushPromises()
    const inside = document.querySelector('[data-testid="student-view-publish"]') as HTMLElement
    expect(inside).not.toBeNull()
    inside.click()
    await flushPromises()
    expect(publish).toHaveBeenCalledWith('p1')
  })
})

describe('the redirects of the old Pembina Kertas (FR-ADM-Q15.6)', () => {
  it('the list and baharu redirect to the Set Builder, keep their names, and baharu stays before :id', () => {
    const byPath = (p: string) => routes.find((r) => r.path === p)!
    expect(byPath('/admin/spm/kertas').redirect).toBe('/admin/studio/sets')
    expect(byPath('/admin/spm/kertas').name).toBe(ADMIN_ROUTES.papers)
    expect(byPath('/admin/spm/kertas/baharu').redirect).toBe('/admin/studio/sets')
    expect(byPath('/admin/spm/kertas/baharu').name).toBe(ADMIN_ROUTES.paperNew)
    expect(byPath('/admin/spm/kertas/:id').name).toBe(ADMIN_ROUTES.paperEdit)
    const paths = routes.map((r) => r.path)
    expect(paths.indexOf('/admin/spm/kertas/baharu')).toBeLessThan(paths.indexOf('/admin/spm/kertas/:id'))
  })

  it('the drawer is opt-in: no prop, no button', () => {
    const w = mount(StudentViewDrawer, { props: { view: null } })
    expect(w.find('[data-testid="student-view-publish"]').exists()).toBe(false)
    w.unmount()
  })
})
