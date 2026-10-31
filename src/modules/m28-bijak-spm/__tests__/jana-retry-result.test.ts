// @vitest-environment jsdom
// BJS-F5 / design 7.4: "Cuba lagi" on a Jana Kertas result shows the S1-d alert under the button.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ResultPage from '../pages/ResultPage.vue'
import { BijakError } from '../server/errors'

const server = vi.hoisted(() => ({
  getResult: vi.fn(),
  generatePaper: vi.fn(),
  retryAttempt: vi.fn(),
  pastSittings: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
let wrapper: VueWrapper | null = null
let router: ReturnType<typeof createRouter>

function resultView(paperKind: 'jana' | 'pilihan'): unknown {
  return {
    attempt: {
      id: 'a1',
      paperId: 'p1',
      paperKind,
      subject: 'MAT',
      kertas: 1,
      title: 'Kertas Contoh',
      status: 'submitted',
    },
    paper: { questions: [], sections: [] },
    result: {
      score: 10,
      max: 20,
      percent: 50,
      points: 0,
      coins: 0,
      provisional: false,
      pendingReview: 0,
      sections: [],
      questions: [],
    },
  }
}

async function render(kind: 'jana' | 'pilihan'): Promise<void> {
  server.getResult.mockResolvedValue(resultView(kind))
  const stub = { template: '<i/>' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/r/:attemptId', name: 'm28.bijak.result', component: ResultPage },
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/spm/bijak/sejarah', component: stub },
      { path: '/spm/bijak/kertas/:paperId', name: 'm28.bijak.cover', component: stub },
      { path: '/spm/bijak/percubaan/:attemptId', name: 'm28.bijak.attempt', component: stub },
    ],
  })
  await router.push('/r/a1')
  wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  server.getResult.mockReset()
  server.generatePaper.mockReset()
  server.retryAttempt.mockReset()
  server.pastSittings.mockResolvedValue({ lastSubmittedAttemptId: null, sittings: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ResultPage retry (Jana Kertas)', () => {
  it('shortage: stays on the page and shows the capped alert under the button', async () => {
    server.generatePaper.mockResolvedValue({
      ok: false,
      reason: 'shortage',
      shortages: Array.from({ length: 7 }, (_, i) => ({ section: `Bahagian ${i + 1}`, need: 5, have: 1 })),
    })
    await render('jana')
    q('[data-testid="retry"]')!.click()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/r/a1')
    expect(document.body.querySelectorAll('[data-testid="shortage-line"]')).toHaveLength(5)
    expect(q('[data-testid="shortage-more"]')?.textContent).toContain('Tunjuk 2 lagi')
    expect(q('[data-testid="win-screen"]')).not.toBeNull()
  })

  it('503 limit: shows the solver-budget message and stays', async () => {
    server.generatePaper.mockResolvedValue({ ok: false, reason: 'limit', limitSections: [] })
    await render('jana')
    q('[data-testid="retry"]')!.click()
    await flushPromises()
    expect(q('[data-testid="retry-message"]')?.textContent).toContain(
      'Kertas tidak dapat disusun sekarang. Cuba lagi.',
    )
    expect(router.currentRoute.value.path).toBe('/r/a1')
  })

  it('no longer usable: shows the AC-03.6 copy', async () => {
    server.generatePaper.mockResolvedValue({ ok: false, reason: 'no_blueprint' })
    await render('jana')
    q('[data-testid="retry"]')!.click()
    await flushPromises()
    expect(q('[data-testid="retry-message"]')?.textContent).toContain(
      'Belum ada kontrak untuk subjek dan kertas ini',
    )
  })

  it('success: opens the new paper cover', async () => {
    server.generatePaper.mockResolvedValue({ ok: true, paperId: 'jana-9' })
    await render('jana')
    q('[data-testid="retry"]')!.click()
    await flushPromises()
    expect(router.currentRoute.value.params.paperId).toBe('jana-9')
  })

  it('Kertas Pilihan: Cuba Lagi starts a new attempt on the same paper without generating', async () => {
    server.retryAttempt.mockResolvedValue({ attemptId: 'a2' })
    await render('pilihan')
    q('[data-testid="retry"]')!.click()
    await flushPromises()
    expect(server.generatePaper).not.toHaveBeenCalled()
    expect(server.retryAttempt).toHaveBeenCalledWith(7, 'a1')
    expect(router.currentRoute.value.name).toBe('m28.bijak.attempt')
    expect(router.currentRoute.value.params.attemptId).toBe('a2')
  })

  it('Kertas Pilihan: a 409 shows its plain BM message and stays on the result', async () => {
    server.retryAttempt.mockRejectedValue(
      new BijakError('bad_request', 'Hantar percubaan ini dahulu sebelum mencuba semula.'),
    )
    await render('pilihan')
    q('[data-testid="retry"]')!.click()
    await flushPromises()
    expect(q('[data-testid="retry-message"]')?.textContent).toContain(
      'Hantar percubaan ini dahulu sebelum mencuba semula.',
    )
    expect(router.currentRoute.value.path).toBe('/r/a1')
  })
})
