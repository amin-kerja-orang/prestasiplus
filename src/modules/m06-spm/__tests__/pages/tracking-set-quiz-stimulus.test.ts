// @vitest-environment jsdom
/* eslint-disable vue/require-default-prop -- test stub of the M04 modal */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resetStimulusOpen } from '@/components/question-display/lib/useStimulusOpen'

import TrackingASetQuizPage from '../../pages/TrackingASetQuizPage.vue'

/**
 * T-C16 (D105, PO core requirement): the Tracking A set quiz mounts the shared `QuizRunner` (no second runner), so the rajah of a stimulus group
 * shows on EVERY member (question 1, 2, 3, not only the first), in the set's order, and a figure question of its own shows its figure inline.
 */
vi.mock('@/app/router/outcome', () => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({
    props: { open: Boolean, questionId: Number },
    setup: () => () => h('div'),
  }),
}))

const m05 = vi.hoisted(() => ({ startSession: vi.fn(), checkAnswer: vi.fn(), submitSession: vi.fn() }))
vi.mock('@/modules/m05-practice/api/practice', async (orig) => ({
  ...(await orig<typeof import('@/modules/m05-practice/api/practice')>()),
  startSession: m05.startSession,
  checkAnswer: m05.checkAnswer,
  submitSession: m05.submitSession,
}))

const RAJAH = [{ id: 'G1-1', kind: 'diagram' as const, label: 'Rajah 1', alt: 'Graf halaju lawan masa', image: { url: '/api/files/TOKENrajah1AAAAAAAA' } }]
const question = (id: number, text: string, over: Record<string, unknown> = {}) => ({
  id,
  questionText: text,
  textDirection: 'ltr',
  scriptType: 'rumi',
  wrongTimes: 0,
  hasDskp: true,
  contributor: null,
  options: [
    { id: 0, label: 'A', text: 'Tetap' },
    { id: 1, label: 'B', text: 'Bertambah' },
  ],
  ...over,
})
// The set in position order: a plain question, a group of 3 (group order), a figure question.
const SET = [
  question(1, 'Soalan biasa pertama'),
  question(2, 'Berdasarkan Rajah 1, apakah halaju?', { stimuli: RAJAH, group: { id: 'G1', index: 1, size: 3 } }),
  question(3, 'Berdasarkan Rajah 1, apakah pecutan?', { stimuli: RAJAH, group: { id: 'G1', index: 2, size: 3 } }),
  question(4, 'Berdasarkan Rajah 1, berapakah sesaran?', { stimuli: RAJAH, group: { id: 'G1', index: 3, size: 3 } }),
  question(5, 'Berapakah luas Rajah 2?', { stimuli: [{ id: 'q5-1', kind: 'image', label: '', alt: 'Segi tiga', image: { url: '/api/files/TOKENowngAAAAAAAAAA' } }] }),
]

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined })) as unknown as typeof window.matchMedia
  m05.startSession.mockResolvedValue({ sessionId: 's1', mode: 'ramalan', subject: { code: 'GEO', name: 'Geografi', color: '#3B82F6' }, questions: SET })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push('/spm/ramalan/GEO?year=2026&set=1')
  wrapper = mount(TrackingASetQuizPage, { props: { code: 'GEO', year: 2026, setNo: 1 }, global: { plugins: [router], stubs: { teleport: true } } })
  // The runner is an async component: its first load (a dynamic import, transformed on demand) can take seconds; wait for the start call.
  await vi.waitFor(() => expect(m05.startSession).toHaveBeenCalled(), { timeout: 30_000 })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

async function answerAndNext(w: VueWrapper): Promise<void> {
  await t(w, 'option-A').trigger('click')
  await t(w, 'btn-check').trigger('click')
  await flushPromises()
  await t(w, 'btn-next').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  window.scrollTo = vi.fn()
  resetStimulusOpen()
  m05.startSession.mockReset()
  m05.checkAnswer.mockReset().mockResolvedValue({ isCorrect: true, correctOptionId: 0, feedback: 'Betul!', explanation: null })
  m05.submitSession.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Tracking A set quiz: the rajah on every member, in set order', () => {
  it('starts the ramalan session and shows the questions in the served order with the rajah on each member of the group', async () => {
    const w = await render()
    expect(m05.startSession).toHaveBeenCalledWith({ mode: 'ramalan', subjectCode: 'GEO', year: 2026, setNo: 1 })
    expect(t(w, 'quiz-progress-text').text()).toBe('Soalan 1 daripada 5')
    expect(w.find('[data-testid=stimulus-pane]').exists()).toBe(false) // a plain question carries no rajah
    await answerAndNext(w)
    for (const n of [2, 3, 4]) {
      expect(t(w, 'quiz-progress-text').text()).toBe(`Soalan ${String(n)} daripada 5`)
      expect(t(w, 'question-text').text()).toContain('Rajah 1')
      const img = t(w, 'stimulus-pane').get('img')
      expect(img.attributes('src')).toBe('/api/files/TOKENrajah1AAAAAAAA')
      expect(img.attributes('alt')).toBe('Graf halaju lawan masa')
      await answerAndNext(w)
    }
    // The figure question of its own: inline, no pinned pane.
    expect(t(w, 'quiz-progress-text').text()).toBe('Soalan 5 daripada 5')
    expect(t(w, 'quiz-question').get('[data-layout=inline] img').attributes('src')).toBe('/api/files/TOKENowngAAAAAAAAAA')
    expect(w.find('[data-testid=stimulus-pane]').exists()).toBe(false)
  })
})
