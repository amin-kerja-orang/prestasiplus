// @vitest-environment jsdom
// S3-T02 (review round 2): Semak Kertas shows the API's 422 `fields.title` of the metadata save on the title field, not as a flash.
import type { BijakBuilderReview } from '@pp/contract'
import { BIJAK_BUILDER_MESSAGES } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import { BuilderError, type BuilderApi } from '../admin/builder/server/api'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import PaperEditorPage from '../admin/papers/PaperEditorPage.vue'
import type { AdminPaper, PaperEditorData } from '../domain/admin-types'

const REQUIRED = BIJAK_BUILDER_MESSAGES.setTitleRequired
const h = vi.hoisted((): { server: unknown } => ({ server: undefined }))
vi.mock('../server/client', () => ({
  bijakServer: () => h.server,
  bijakAdminServer: () => h.server,
}))

describe('Semak Kertas: a 422 fields.title is shown on the title field', () => {
  let wrapper: VueWrapper | null = null

  const paper = {
    id: 'p1', title: 'Kertas Ujian', subject: 'MAT', kertas: 1, year: 2026, code: '1449/1', durationMin: 90, instructions: [],
    status: 'draf', createdAt: 1, updatedAt: 1, levelScope: 't5',
    sections: [{ id: 's1', label: 'Objektif', markBudget: 1, questionCount: 1, rule: { type: 'all' }, questionIds: ['q1'] }],
  } as unknown as AdminPaper
  const ed: PaperEditorData = {
    paper,
    blueprint: null,
    questions: [{ id: 'q1', preview: 'Soalan q1', marks: 1, kind: 'objektif', topic: 'T', status: 'terbit', kertas: 1, subject: 'MAT' }],
    groups: [],
  }
  const review: BijakBuilderReview = {
    paperId: 'p1', status: 'draf', ok: true, blockers: [], blockerDetails: [], canOverride: false, notes: [], blueprintNeedsReview: false,
    visibleToStudents: false, totalMarks: 1, totalBudget: 1, rows: [],
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

  it('saveMeta: the API title error sits on the field (no flash) and goes on the next edit', async () => {
    h.server = { getPaperEditor: vi.fn().mockResolvedValue(ed), unpublishPaper: vi.fn() }
    const updateHeader = vi.fn().mockRejectedValue(new BuilderError('invalid', REQUIRED, { fields: { title: REQUIRED } }))
    setBuilderServerForTests({ review: vi.fn().mockResolvedValue(review), updateHeader } as unknown as BuilderApi)
    const stubC = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: PaperEditorPage },
        { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stubC },
        { path: '/:p(.*)*', component: stubC },
      ],
    })
    await router.push('/admin/spm/kertas/p1')
    wrapper = mount(PaperEditorPage, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    const show = vi.spyOn(useFlashStore(), 'show')
    await wrapper.get('[data-testid="meta-form"]').trigger('submit')
    await flushPromises()
    expect(updateHeader).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="paper-meta"]').text()).toContain(REQUIRED)
    expect(show).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="meta-title"]').setValue('Kertas Lain')
    expect(wrapper.get('[data-testid="paper-meta"]').text()).not.toContain(REQUIRED)
  })
})
