// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import PartResultCard from '../components/PartResultCard.vue'
import ResultPage from '../pages/ResultPage.vue'

/** FR-PA-26, 46 section 3.7 and 4.2 row 6: status chip, "{score} / {max}", whole-number percent, the provisional banner. FR-MUR-13-12: the verdict line. */
const server = vi.hoisted(() => ({ getResult: vi.fn(), pastSittings: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
let wrapper: VueWrapper | null = null

async function render(status: string, result: object): Promise<void> {
  server.getResult.mockResolvedValue({
    attempt: { id: 'a1', paperId: 'p1', paperKind: 'pilihan', subject: 'MAT', kertas: 1, title: 'K', status },
    paper: { sections: [], questions: [{ id: 'q1', number: 1, stem: 'S', parts: [] }] },
    result: { points: 0, coins: 0, sections: [], questions: [{ questionId: 'q1', number: 1, counted: true, awarded: 0, marks: 1, parts: [] }], ...result },
  })
  const stub = { template: '<i/>' }
  const router = createRouter({
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
  server.pastSittings.mockResolvedValue({ lastSubmittedAttemptId: null, sittings: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Semakan summary (FR-PA-26)', () => {
  it.each([
    ['submitted', 'Dihantar'],
    ['auto_submitted', 'Dihantar automatik'],
  ])('status %s shows the chip "%s"', async (status, label) => {
    await render(status, { score: 13, max: 15, percent: 86.7, provisional: false, pendingReview: 0 })
    expect(q('[data-testid=result-status]')?.textContent?.trim()).toBe(label)
  })

  it('shows "{score} / {max}" and rounds the stored percent half up to a whole number', async () => {
    await render('submitted', { score: 13, max: 15, percent: 86.7, provisional: false, pendingReview: 0 })
    expect(q('[data-testid=result-score]')?.textContent?.trim()).toBe('13 / 15')
    expect(q('[data-testid=result-percent]')?.textContent?.trim()).toBe('87%')
  })

  it('86.5 rounds up', async () => {
    await render('submitted', { score: 173, max: 200, percent: 86.5, provisional: false, pendingReview: 0 })
    expect(q('[data-testid=result-percent]')?.textContent?.trim()).toBe('87%')
  })

  it('the provisional banner uses the exact text', async () => {
    await render('submitted', { score: 1, max: 5, percent: 20, provisional: true, pendingReview: 2 })
    expect(q('[data-testid=provisional]')?.textContent?.trim()).toBe('Markah sementara - 2 bahagian belum dimarkah.')
  })
})

describe('part verdict (FR-MUR-13-12)', () => {
  const part = (status: string, awarded: number) =>
    mount(PartResultCard, {
      props: { result: { partId: 'p1', label: '(a)', prompt: '', marks: 2, awarded, status, confidence: 'high', points: [], answer: {}, scheme: { kind: 'accepted', accepted: [] } } as never },
      global: { stubs: { RichText: true, MathText: true } },
    })

  it.each([
    ['betul', 2, '✓ Betul (2/2)'],
    ['salah', 0, '✗ Salah (0/2)'],
  ])('%s carries its marks', (status, awarded, text) => {
    const w = part(status, awarded)
    expect(w.get('[data-testid=part-status]').text()).toBe(text)
    expect(w.find('[data-testid=part-marks]').exists()).toBe(false)
    w.unmount()
  })

  it('a part marked in part keeps its own marks line', () => {
    const w = part('separa', 1)
    expect(w.get('[data-testid=part-status]').text()).toBe('Separa')
    expect(w.get('[data-testid=part-marks]').text()).toBe('1 / 2')
    w.unmount()
  })
})
