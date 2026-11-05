// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AttemptPage from '../pages/AttemptPage.vue'

/** FR-MUR-13-6, 46 section 3.5: "Semak" on auto-markable parts only, re-check after an edit, the cap message. */
const server = vi.hoisted(() => ({
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  checkQuestion: vi.fn(),
  submit: vi.fn(),
  serverNow: () => Date.now(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server, browserStorage: () => window.localStorage }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const MESSAGE = 'Had semakan untuk soalan ini telah dicapai.'
const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
let wrapper: VueWrapper | null = null

const partOf = (id: string, kind: string) => ({ id, label: '(a)', prompt: 'Soalan', marks: 1, answer: { kind } })
const question = (id: string, body: object) => ({ id, number: 1, sectionId: 's1', topic: 'T', formOrigin: 'T4', stem: 'Soalan?', marks: 1, ...body })
const MCQ = { mcq: { options: [{ id: 'a', text: 'Pilihan A' }, { id: 'b', text: 'Pilihan B' }] } }
const view = (questions: object[], checkCounts?: Record<string, number>) => ({
  attempt: { id: 'a1', paperId: 'p1', title: 'Set', code: '1449/1', mode: 'latihan', status: 'in_progress', startedAt: Date.now(), deadline: null, answers: {}, flags: [], picks: {}, position: 0, checked: [], ...(checkCounts ? { checkCounts } : {}) },
  sections: [{ id: 's1', label: 'A', rule: { type: 'all' }, questionIds: questions.map((x) => (x as { id: string }).id), marks: 1, effectiveMarks: 1 }],
  groups: [],
  checks: [],
  questions,
})
const result = (questionId: string, checksUsed: number, awarded = 0) => ({
  questionId, number: 1, sectionId: 's1', marks: 1, awarded, counted: true, attempted: true, checksUsed,
  parts: [{ partId: questionId, label: '', prompt: '', marks: 1, awarded, status: 'salah', confidence: 'high', points: [], answer: { choice: 'a' }, scheme: { kind: 'option', correctOption: 'b' } }],
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  server.saveAnswers.mockResolvedValue({ closed: false })
  server.checkQuestion.mockReset()
  window.localStorage.clear()
  window.sessionStorage.clear()
  Element.prototype.scrollTo = () => undefined
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function render(): Promise<void> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak/percubaan/:attemptId', name: 'm28.bijak.attempt', component: AttemptPage },
      { path: '/:p(.*)*', component: stub },
    ],
  })
  await router.push('/spm/bijak/percubaan/a1')
  wrapper = mount({ template: '<RouterView/>' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

describe('Semak (FR-MUR-13-6)', () => {
  it('a question with only essay parts offers no Semak', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', { parts: [partOf('p1', 'essay')] })]))
    await render()
    expect(q('[data-testid=check-button]')).toBeNull()
  })

  it('a question with an auto-markable part offers it', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', { parts: [partOf('p1', 'short_text'), partOf('p2', 'essay')] })]))
    await render()
    expect(q('[data-testid=check-button]')).not.toBeNull()
  })

  it('after a check, "Tukar jawapan" takes the verdict away, the option reacts again and Semak is offered', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', MCQ)]))
    server.checkQuestion.mockResolvedValue(result('q1', 1))
    await render()
    q('[data-testid=option-a]')!.click()
    await flushPromises()
    q('[data-testid=check-button]')!.click()
    await flushPromises()
    expect(server.checkQuestion).toHaveBeenCalledTimes(1)
    expect(q('[data-testid=check-button]')).toBeNull()
    q('[data-testid=check-change]')!.click()
    await flushPromises()
    expect(q('[data-testid=check-button]')).not.toBeNull()
    expect(q('[data-testid=check-change]')).toBeNull()
    q('[data-testid=option-b]')!.click()
    await flushPromises()
    expect(q('[data-testid=option-b]')?.getAttribute('data-state')).toBe('selected')
  })

  it('a save that fails sends no check, and says the existing line', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', MCQ)]))
    server.saveAnswers.mockRejectedValueOnce(new Error('500'))
    await render()
    q('[data-testid=option-a]')!.click()
    await flushPromises()
    q('[data-testid=check-button]')!.click()
    await flushPromises()
    expect(server.checkQuestion).not.toHaveBeenCalled()
    expect(q('[data-testid=submit-error]')?.textContent).toContain('Semakan tidak dapat dibuat sekarang. Cuba lagi.')
  })

  it('a structured part stays editable after a check; typing takes the verdict away', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', { parts: [partOf('p1', 'short_text')] })]))
    server.checkQuestion.mockResolvedValue({ ...result('q1', 1), parts: [] })
    await render()
    q('[data-testid=check-button]')!.click()
    await flushPromises()
    expect(q('[data-testid=check-button]')).toBeNull()
    const input = document.body.querySelector<HTMLTextAreaElement>('[data-testid=question-q1] textarea')!
    expect(input.disabled).toBe(false)
    input.value = 'jawapan'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(q('[data-testid=check-button]')).not.toBeNull()
  })

  it('the third check shows the exact message, offers no Semak and locks the options', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', MCQ)]))
    server.checkQuestion.mockResolvedValue(result('q1', 3))
    await render()
    q('[data-testid=option-a]')!.click()
    await flushPromises()
    expect(q('[data-testid=check-cap]')).toBeNull()
    q('[data-testid=check-button]')!.click()
    await flushPromises()
    expect(q('[data-testid=check-cap]')?.textContent).toContain(MESSAGE)
    expect(q('[data-testid=check-change]')).toBeNull()
    q('[data-testid=option-b]')!.click()
    await flushPromises()
    expect(q('[data-testid=check-button]')).toBeNull()
    expect(server.checkQuestion).toHaveBeenCalledTimes(1)
  })

  it('a reload at the cap keeps the message; the checked part is locked and the essay stays open', async () => {
    server.getAttemptView.mockResolvedValue(view([question('q1', { parts: [partOf('p1', 'short_text'), partOf('p2', 'essay')] })], { q1: 3 }))
    await render()
    expect(q('[data-testid=check-cap]')?.textContent).toContain(MESSAGE)
    const inputs = [...document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-testid=question-q1] input, [data-testid=question-q1] textarea')]
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    expect(inputs[0]!.disabled).toBe(true)
    expect(inputs.at(-1)!.disabled).toBe(false)
  })
})
