// @vitest-environment jsdom
// H-C7: the result page shows a question's own stimuli above its stem (V2 section 1.5); stemImage only
// when `stimuli` is absent, so a picture never shows twice.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ResultPage from '../pages/ResultPage.vue'

const server = vi.hoisted(() => ({ getResult: vi.fn(), pastSittings: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const pic = (id: string) => ({ id, kind: 'image', label: `Rajah ${id}`, alt: `Rajah ${id}`, src: `/api/files/${id}` })

function view(question: Record<string, unknown>): unknown {
  return {
    attempt: { id: 'a1', paperId: 'p1', paperKind: 'pilihan', subject: 'MAT', kertas: 1, title: 'K', status: 'submitted' },
    paper: {
      sections: [],
      questions: [{ id: 'q1', number: 1, stem: 'Teks soalan', parts: [], ...question }],
    },
    result: {
      score: 0, max: 1, percent: 0, points: 0, coins: 0, provisional: false, pendingReview: 0, sections: [],
      questions: [{ questionId: 'q1', number: 1, counted: true, awarded: 0, marks: 1, parts: [] }],
    },
  }
}

let wrapper: VueWrapper | null = null
async function render(question: Record<string, unknown>): Promise<void> {
  server.getResult.mockResolvedValue(view(question))
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
  server.getResult.mockReset()
  server.pastSittings.mockResolvedValue({ lastSubmittedAttemptId: null, sittings: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

const stack = (): HTMLElement | null => document.body.querySelector('[data-testid="own-stimuli"]')

describe('ResultPage own stimuli', () => {
  it('shows them above the stem', async () => {
    await render({ stimuli: [pic('a'), pic('b')] })
    expect(stack()?.getAttribute('data-count')).toBe('2')
    const card = document.body.querySelector('[data-testid="result-q-1"]')!
    const html = card.innerHTML
    expect(html.indexOf('own-stimuli')).toBeLessThan(html.indexOf('Teks soalan'))
  })

  it('falls back to stemImage when stimuli is absent', async () => {
    await render({ stemImage: pic('only') })
    expect(stack()?.getAttribute('data-count')).toBe('1')
  })

  it('never shows the picture twice when both fields are sent', async () => {
    const one = pic('same')
    await render({ stimuli: [one], stemImage: one })
    expect(document.body.querySelectorAll('[data-testid="own-stimuli"]')).toHaveLength(1)
    expect(stack()?.getAttribute('data-count')).toBe('1')
  })

  it('shows nothing for a question without own stimuli', async () => {
    await render({})
    expect(stack()).toBeNull()
  })
})
