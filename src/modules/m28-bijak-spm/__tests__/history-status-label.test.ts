// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import HistoryPage from '../pages/HistoryPage.vue'

/** OPT-STATUS-ATTEMPT: the history status chip wording per attempt status. */
const server = vi.hoisted(() => ({ history: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return {
    useBijakUser: () => ref(7),
    useLearnerTheme: () => undefined,
    formatDateTime: () => '1 Jan 2026',
  }
})

let wrapper: VueWrapper | null = null
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('HistoryPage status chip', () => {
  it('shows "Belum dihantar" for an in-progress attempt', async () => {
    server.history.mockResolvedValue([
      { attemptId: 'a1', paperId: 'p1', title: 'Kertas 1', subjectName: 'Matematik', kertas: 1, kind: 'pilihan', mode: 'exam', durationSeconds: 60, status: 'in_progress', startedAt: '2026-01-01T00:00:00Z' },
    ])
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: HistoryPage },
        { path: '/a/:attemptId', name: 'm28.bijak.attempt', component: stub },
        { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
        { path: '/:p(.*)*', component: stub },
      ],
    })
    await router.push('/')
    wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    const chip = document.body.querySelector('[data-testid=history-status]')
    expect(chip?.textContent?.trim()).toBe('Belum dihantar')
  })

  it('C-71: the coin stat tile is labelled "Syiling", never "Koin"', async () => {
    server.history.mockResolvedValue([
      { attemptId: 'a1', paperId: 'p1', title: 'Kertas 1', subjectName: 'Matematik', kertas: 1, kind: 'pilihan', mode: 'exam', durationSeconds: 60, status: 'in_progress', startedAt: '2026-01-01T00:00:00Z' },
    ])
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: HistoryPage },
        { path: '/a/:attemptId', name: 'm28.bijak.attempt', component: stub },
        { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
        { path: '/:p(.*)*', component: stub },
      ],
    })
    await router.push('/')
    wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    const tiles = document.body.textContent ?? ''
    expect(tiles).toContain('Syiling')
    expect(tiles).not.toContain('Koin')
  })
})
