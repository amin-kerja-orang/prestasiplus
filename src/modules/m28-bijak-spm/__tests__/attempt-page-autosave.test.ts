// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AttemptPage from '../pages/AttemptPage.vue'

/** FR-MUR-13-10: besides the 800 ms debounce, a flush on field blur and on question change. */
const server = vi.hoisted(() => ({
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  submit: vi.fn(),
  serverNow: () => Date.now(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server, browserStorage: () => window.localStorage }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
let wrapper: VueWrapper | null = null

const view = () => ({
  attempt: { id: 'a1', paperId: 'p1', title: 'Set', code: '1449/1', mode: 'exam', status: 'in_progress', startedAt: Date.now(), deadline: Date.now() + 3_600_000, answers: {}, flags: [], picks: {}, position: 0, checked: [] },
  sections: [{ id: 's1', label: 'A', rule: { type: 'all' }, questionIds: ['q1', 'q2'], marks: 2, effectiveMarks: 2 }],
  groups: [],
  checks: [],
  questions: ['q1', 'q2'].map((id, i) => ({ id, number: i + 1, sectionId: 's1', topic: 'T', formOrigin: 'T4', stem: 'Soalan?', marks: 1, parts: [{ id: `${id}-a`, label: '(a)', prompt: 'Soalan', marks: 1, answer: { kind: 'short_text' } }] })),
})

beforeEach(async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  server.saveAnswers.mockReset()
  server.saveAnswers.mockResolvedValue({ closed: false })
  server.getAttemptView.mockResolvedValue(view())
  window.localStorage.clear()
  window.sessionStorage.clear()
  Element.prototype.scrollTo = () => undefined
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
      { path: '/a/:attemptId', name: 'm28.bijak.attempt', component: stub },
    ],
  })
  await router.push('/a/a1')
  wrapper = mount(AttemptPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function type(value: string): HTMLTextAreaElement {
  const input = document.body.querySelector<HTMLTextAreaElement>('textarea')!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input
}
const sentParts = (): string[] => server.saveAnswers.mock.calls.flatMap((c) => (c[2] as { changes: { partId: string }[] }).changes.map((x) => x.partId))

describe('autosave triggers (FR-MUR-13-10)', () => {
  it('blur sends the field at once, before the debounce', async () => {
    const input = type('jawapan')
    await flushPromises()
    expect(server.saveAnswers).not.toHaveBeenCalled()
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await flushPromises()
    expect(sentParts()).toEqual(['q1-a'])
  })

  it('blur with nothing unsent sends nothing', async () => {
    q('textarea')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await flushPromises()
    expect(server.saveAnswers).not.toHaveBeenCalled()
  })

  it('a question change sends the answer at once', async () => {
    type('jawapan')
    await flushPromises()
    q('[data-testid=next]')!.click()
    await flushPromises()
    expect(sentParts()).toEqual(['q1-a'])
  })
})
