// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import PaperCoverPage from '../pages/PaperCoverPage.vue'

/** PO decision 12, FR-QA-47: `Mula` is disabled with the message before any click; an open sitting can still be resumed. */
const server = vi.hoisted(() => ({
  getCover: vi.fn(),
  findInProgress: vi.fn(),
  startAttempt: vi.fn(),
  listPapers: vi.fn(),
  listSittings: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const coverOf = (extra: object) => ({
  id: 'p1', title: 'Set 1', subjectName: 'Matematik', code: '1449/1', kertas: 1, durationMin: 75, marks: 10,
  subject: 'MAT', year: 2025, status: 'belum', instructions: ['Jawab semua.'], reference: [], sections: [],
  questionCount: 10, ...extra,
})
const OPEN = { attemptId: 'a9', title: 'Set 1', mode: 'exam', elapsedSeconds: 600, fresh: false }

let wrapper: VueWrapper | null = null
let router: Router
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  server.findInProgress.mockResolvedValue(null)
  server.startAttempt.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountCover(): Promise<void> {
  const stub = { template: '<i/>' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak/kertas/:paperId', component: PaperCoverPage },
      { path: '/spm/bijak', component: stub },
      { path: '/simulasi/:paperId/kuiz', component: stub },
      { path: '/x/:attemptId', name: 'm28.bijak.attempt', component: stub },
    ],
  })
  await router.push('/spm/bijak/kertas/p1')
  wrapper = mount({ template: '<RouterView/>' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

const byTest = (id: string): HTMLElement | null => document.body.querySelector<HTMLElement>(`[data-testid=${id}]`)
const heroButton = (): HTMLButtonElement | undefined =>
  [...document.body.querySelectorAll<HTMLButtonElement>('[data-testid=cover-hero] button')].find((b) => /Mula|Sambung/.test(b.textContent ?? ''))

describe('cover unavailable (PO decision 12)', () => {
  it('disables Mula and shows the message before any click', async () => {
    server.getCover.mockResolvedValue(coverOf({ unavailable: true, unavailableReason: 'QUESTION_WITHDRAWN' }))
    await mountCover()
    expect(heroButton()?.disabled).toBe(true)
    expect(heroButton()?.textContent).toContain('Mula')
    expect(byTest('cover-unavailable')?.textContent).toContain('Kertas belum tersedia')
    expect(byTest('mode-choice')).toBeNull()
    expect(byTest('paper-kuiz-link')).toBeNull()
    heroButton()?.click()
    await flushPromises()
    expect(server.startAttempt).not.toHaveBeenCalled()
  })

  it('leaves an available paper as it was', async () => {
    server.getCover.mockResolvedValue(coverOf({ unavailable: false }))
    await mountCover()
    expect(heroButton()?.disabled).toBe(false)
    expect(byTest('cover-unavailable')).toBeNull()
    expect(byTest('mode-choice')).not.toBeNull()
    expect(byTest('paper-kuiz-link')).not.toBeNull()
  })

  it('an open sitting can still be resumed; Mula Semula is not offered', async () => {
    server.getCover.mockResolvedValue(coverOf({ unavailable: true, unavailableReason: 'QUESTION_WITHDRAWN' }))
    server.findInProgress.mockResolvedValue(OPEN)
    server.startAttempt.mockResolvedValue({ attemptId: 'a9' })
    await mountCover()
    expect(byTest('cover-unavailable')).not.toBeNull()
    expect(byTest('restart')).toBeNull()
    expect(heroButton()?.disabled).toBe(false)
    expect(heroButton()?.textContent).toContain('Sambung')
    heroButton()?.click()
    await flushPromises()
    expect(server.startAttempt).toHaveBeenCalledWith(7, 'p1', 'exam', { restart: false })
    expect(router.currentRoute.value.path).toBe('/x/a9')
  })
})
