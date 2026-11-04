// @vitest-environment jsdom
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

const data = {
  attempt: {
    id: 'a1',
    paperId: 'p1',
    paperKind: 'pilihan',
    subject: 'MAT',
    kertas: 1,
    title: 'K',
    status: 'submitted',
  },
  paper: { sections: [], questions: [{ id: 'q1', number: 1, stem: 'S', parts: [] }] },
  result: {
    score: 0,
    max: 1,
    percent: 0,
    points: 0,
    coins: 0,
    provisional: false,
    pendingReview: 0,
    sections: [],
    questions: [{ questionId: 'q1', number: 1, counted: true, awarded: 0, marks: 1, parts: [] }],
  },
}

let wrapper: VueWrapper | null = null
let routerRef: ReturnType<typeof createRouter> | null = null
async function render(path: string, status = 'submitted'): Promise<void> {
  server.getResult.mockResolvedValue({ ...data, attempt: { ...data.attempt, status } })
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
  routerRef = router
  await router.push(path)
  wrapper = mount(
    { template: '<RouterView />' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
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

describe('AC-PA-21: banner after the automatic submit at 0', () => {
  it('AC-PA-21: auto=1 shows "Masa tamat. Jawapan anda telah dihantar secara automatik." once', async () => {
    await render('/r/a1?auto=1')
    const all = document.body.querySelectorAll('[data-testid=auto-submit-banner]')
    expect(all).toHaveLength(1)
    expect(all[0]!.textContent).toContain(
      'Masa tamat. Jawapan anda telah dihantar secara automatik.',
    )
  })

  it('AC-PA-21: no marker, no banner', async () => {
    await render('/r/a1')
    expect(document.body.querySelector('[data-testid=auto-submit-banner]')).toBeNull()
  })

  it('AC-PA-21: an auto_submitted attempt with auto=1 shows exactly one banner', async () => {
    await render('/r/a1?auto=1', 'auto_submitted')
    expect(document.body.querySelectorAll('[data-testid=auto-submit-banner]')).toHaveLength(1)
    expect(document.body.querySelector('[data-testid=auto-submitted]')).toBeNull()
  })

  it('AC-PA-21: auto_submitted without the marker keeps the existing notice', async () => {
    await render('/r/a1', 'auto_submitted')
    expect(document.body.querySelector('[data-testid=auto-submit-banner]')).toBeNull()
    expect(document.body.querySelector('[data-testid=auto-submitted]')).not.toBeNull()
  })

  it('AC-PA-21: the marker is dropped from the URL after it is read', async () => {
    await render('/r/a1?auto=1')
    expect(routerRef!.currentRoute.value.query.auto).toBeUndefined()
    expect(document.body.querySelectorAll('[data-testid=auto-submit-banner]')).toHaveLength(1)
  })
})
