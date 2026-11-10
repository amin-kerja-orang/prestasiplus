// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import adminPaperRoutes from '../routes/admin-papers'

const server = vi.hoisted(() => ({ getReviewItem: vi.fn(), resubmit: vi.fn(), reviewDecision: vi.fn() }))
vi.mock('../server/client', () => ({ bijakAdminServer: () => server }))
vi.mock('@/composables/usePageMeta', () => ({ usePageMeta: () => ({ setHeader: vi.fn(), setTitle: vi.fn() }) }))

function detail(status: string, questionId: string | null) {
  return {
    item: { key: 'k', status, kind: 'objektif', kertas: 1, subjectName: 'Sains', confidence: 'tinggi', submittedAt: 0 },
    questions: [],
    history: [],
    gate: [],
    questionId,
  }
}

async function render(status: string, questionId: string | null) {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', 'http')
  server.getReviewItem.mockResolvedValue(detail(status, questionId))
  const { default: Page } = await import('../admin/papers/ReviewItemPage.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<i/>' } }, ...adminPaperRoutes],
  })
  await router.push('/admin/spm/semakan/k')
  const w = mount(Page as never, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return w
}

describe('review actions need a question (http mode, PO ruling #432)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it.each([
    ['semakan', 'action-correct'],
    ['ditolak', 'action-resubmit'],
  ])('%s: %s is disabled with the hint while the item has no question', async (status, testid) => {
    const w = await render(status, null)
    expect(w.find(`[data-testid="${testid}"]`).attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="no-question-hint"]').text()).toBe('Item ini belum mempunyai soalan.')
    w.unmount()
  })

  it.each([
    ['semakan', 'action-correct'],
    ['ditolak', 'action-resubmit'],
  ])('%s: %s is enabled and there is no hint once it has a question', async (status, testid) => {
    const w = await render(status, 'q1')
    expect(w.find(`[data-testid="${testid}"]`).attributes('disabled')).toBeUndefined()
    expect(w.find('[data-testid="no-question-hint"]').exists()).toBe(false)
    w.unmount()
  })
})
