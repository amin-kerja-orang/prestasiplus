// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AttemptPage from '../pages/AttemptPage.vue'
import { BijakError } from '../server/errors'

const server = vi.hoisted(() => ({
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  submit: vi.fn(),
  serverNow: () => Date.now(),
}))
vi.mock('../server/client', () => ({
  bijakServer: () => server,
  browserStorage: () => window.localStorage,
}))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): Element | null => document.body.querySelector(sel)
let wrapper: VueWrapper | null = null

beforeEach(() => {
  server.getAttemptView.mockReset()
  server.submit.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

async function render(): Promise<VueWrapper> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/spm/bijak/percubaan/:attemptId', name: 'm28.bijak.attempt', component: stub },
      { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
    ],
  })
  await router.push('/spm/bijak/percubaan/a1')
  wrapper = mount(AttemptPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function view(): unknown {
  return {
    attempt: {
      id: 'a1',
      title: 'Kertas Contoh',
      mode: 'exam',
      status: 'in_progress',
      startedAt: Date.now(),
      deadline: null,
      answers: {},
      flags: [],
      picks: {},
      position: 0,
    },
    sections: [],
    groups: [],
    checks: [],
    questions: [{ id: 'q1', number: 1, mcq: true, sectionId: 's1', stem: 'Soalan?', options: [] }],
  }
}

describe.each([
  ['forbidden', 'Akses ditolak'],
  ['not_found', 'Tidak ditemui'],
] as const)('AttemptPage load refused (%s)', (code, msg) => {
  it('shows the not-found state, no exam shell and no Hantar', async () => {
    server.getAttemptView.mockRejectedValue(new BijakError(code, msg))
    await render()
    expect(q('[data-testid=attempt-not-found]')?.textContent).toContain(
      'Percubaan ini tidak dijumpai.',
    )
    expect(!!q('[data-testid=attempt-back]')).toBe(true)
    expect(document.body.textContent).not.toContain('Soalan 0 / 0')
    expect(!!q('[data-testid=position]')).toBe(false)
    expect(!!q('[data-testid=submit]')).toBe(false)
    expect(!!q('[data-testid=submit-early]')).toBe(false)
    expect(server.submit).not.toHaveBeenCalled()
  })
})

describe('AttemptPage normal attempt', () => {
  it('still renders the shell with the submit button', async () => {
    server.getAttemptView.mockResolvedValue(view())
    await render()
    expect(!!q('[data-testid=attempt-not-found]')).toBe(false)
    expect(q('[data-testid=position]')?.textContent).toContain('Soalan 1 / 1')
    expect(!!q('[data-testid=submit]')).toBe(true)
  })
})
