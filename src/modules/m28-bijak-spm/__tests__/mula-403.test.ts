// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { BANK, PAPERS } from '../data/registry'
import PaperCoverPage from '../pages/PaperCoverPage.vue'
import { BijakError } from '../server/errors'
import { BijakServer, MemoryStorage, PAPER_UNAVAILABLE } from '../server/store'

const MSG = 'Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.'

const server = vi.hoisted(() => ({
  getCover: vi.fn(),
  findInProgress: vi.fn(),
  startAttempt: vi.fn(),
  listPapers: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

let wrapper: VueWrapper | null = null
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  server.getCover.mockResolvedValue({
    id: 'p1', title: 'Set 1', subjectName: 'Matematik', code: '1449/1', kertas: 1, durationMin: 75, marks: 10,
    subject: 'MAT', year: 2025, status: 'baru', instructions: ['Jawab semua.'], reference: [], sections: [],
    questionCount: 10,
  })
  server.findInProgress.mockResolvedValue(null)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountCover(): Promise<void> {
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
}

const startButton = (): HTMLElement | null =>
  [...document.body.querySelectorAll<HTMLElement>('[data-testid=cover-hero] button')].find((b) => b.textContent?.includes('Mula')) ?? null

describe('H-C5: "Mula" on a paper that cannot start (403)', () => {
  it('shows the API BM message, not the generic line', async () => {
    server.startAttempt.mockRejectedValue(new BijakError('forbidden', MSG))
    await mountCover()
    const start = startButton()
    expect(start).not.toBeNull()
    start!.click()
    await flushPromises()
    const alert = document.body.querySelector('[role=alert]')
    expect(alert?.textContent).toContain(MSG)
    expect(document.body.textContent).not.toContain('Percubaan tidak dapat dimulakan')
  })

  it('keeps the generic line for any other failure', async () => {
    server.startAttempt.mockRejectedValue(new Error('boom'))
    await mountCover()
    startButton()!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Percubaan tidak dapat dimulakan. Cuba lagi.')
  })
})

describe('mock server mirrors the API refusal', () => {
  it('throws forbidden with the BM line when a placed question is no longer served', async () => {
    const paper = PAPERS[0]!
    const qid = paper.sections[0]!.questionIds[0]!
    const saved = BANK.questions.get(qid)!
    BANK.questions.delete(qid)
    try {
      const s = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
      await expect(s.startAttempt(7, paper.id, 'exam')).rejects.toMatchObject({ code: 'forbidden', message: MSG })
      expect(PAPER_UNAVAILABLE).toBe(MSG)
    } finally {
      BANK.questions.set(qid, saved)
    }
  })
})
