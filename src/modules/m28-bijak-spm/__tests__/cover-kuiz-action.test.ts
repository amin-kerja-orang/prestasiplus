// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import PaperCoverPage from '../pages/PaperCoverPage.vue'

/** S3-T07: the paper cover omits the Kuiz action when the API says the paper Kuiz is unavailable (out of scope, no open sitting). */
const server = vi.hoisted(() => ({ getCover: vi.fn(), findInProgress: vi.fn(), startAttempt: vi.fn(), listPapers: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const base = {
  id: 'p1', title: 'Set 1', subjectName: 'Matematik', code: '1449/1', kertas: 1, durationMin: 75, marks: 10,
  subject: 'MAT', year: 2025, instructions: ['Jawab semua.'], reference: [], sections: [], questionCount: 10,
}
let wrapper: VueWrapper | null = null
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  server.findInProgress.mockResolvedValue(null)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountCover(cover: Record<string, unknown>, open: unknown = null): Promise<boolean> {
  server.getCover.mockResolvedValue({ ...base, ...cover })
  server.findInProgress.mockResolvedValue(open)
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak/kertas/:paperId', component: PaperCoverPage },
      { path: '/spm/bijak', component: stub },
      { path: '/x', name: 'm28.bijak.attempt', component: stub },
    ],
  })
  await router.push('/spm/bijak/kertas/p1')
  wrapper = mount({ template: '<RouterView/>' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return document.body.querySelector('[data-testid=paper-kuiz-link]') !== null
}

describe('cover Kuiz action (S3-T07)', () => {
  it('is present in scope (field absent)', async () => {
    expect(await mountCover({ status: 'belum' })).toBe(true)
  })
  it('is absent on an out-of-scope paper with only a submitted sitting', async () => {
    expect(await mountCover({ status: 'selesai', lastScore: { score: 5, max: 10 }, kuizAvailable: false })).toBe(false)
  })
  it('is present with an own open sitting on an out-of-scope paper (field absent)', async () => {
    const open = { attemptId: 'a1', mode: 'exam', title: 'Set 1', elapsedSeconds: 60, fresh: false }
    expect(await mountCover({ status: 'sedang', attemptId: 'a1' }, open)).toBe(true)
  })
})
