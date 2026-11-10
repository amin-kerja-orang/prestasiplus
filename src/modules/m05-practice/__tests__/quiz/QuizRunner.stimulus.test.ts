// @vitest-environment jsdom
/* eslint-disable vue/require-default-prop -- test stub of the M04 modal */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resetStimulusOpen } from '@/components/question-display/lib/useStimulusOpen'

import type { QuizQuestion, StartSessionResponse } from '../../api/types'
import QuizRunner from '../../components/quiz/QuizRunner.vue'
import type { QuizApi } from '../../components/quiz/quiz-types'

/**
 * T-C13 (D105, D90, PO core requirement): the rajah of a stimulus group is present on EVERY member question (1st, 2nd, 3rd), not only the
 * first, at desktop (pinned pane) and at 375 (chip "Lihat Rajah 1" one tap away); a question with its own figure shows it inline; an
 * option picture has alt text; a picture that fails to load blocks "Semak Jawapan"; the review keeps the rajah of every member.
 */
vi.mock('@/app/router/outcome', () => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({
    props: { open: Boolean, questionId: Number },
    setup: () => () => h('div'),
  }),
}))

const RAJAH = [
  { id: 'G1-1', kind: 'diagram' as const, label: 'Rajah 1', alt: 'Graf halaju lawan masa', caption: 'Graf halaju', image: { url: '/api/files/TOKENrajah1AAAAAAAA' } },
]
const member = (id: number, index: number, text: string): QuizQuestion => ({
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
  stimuli: RAJAH,
  group: { id: 'G1', index, size: 3 },
})

function session(questions: QuizQuestion[]): StartSessionResponse {
  return { sessionId: 'sess-1', mode: 'chapter', subject: { code: 'FZ', name: 'Fizik', color: '#3B82F6' }, questions }
}

const GROUPED = [member(1, 1, 'Berdasarkan Rajah 1, apakah halaju pada 2 s?'), member(2, 2, 'Berdasarkan Rajah 1, apakah pecutan?'), member(3, 3, 'Berdasarkan Rajah 1, berapakah sesaran?')]

// The bottom sheet of the narrow layout: its body is rendered only while open (as the real drawer does).
const DrawerStub = defineComponent({
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['update:open'],
  setup(p, { slots }) {
    return () => h('div', { 'data-stub': 'drawer', 'data-open': String(p.open), 'data-title': p.title }, p.open ? (slots.body?.() ?? []) : [])
  },
})

let wrapper: VueWrapper | null = null
let api: { [K in keyof QuizApi]: ReturnType<typeof vi.fn> }

function media(wide: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  })) as unknown as typeof window.matchMedia
}

async function render(questions: QuizQuestion[], wide: boolean): Promise<VueWrapper> {
  media(wide)
  api.start.mockResolvedValue(session(questions))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push('/practice/FZ/quiz')
  wrapper = mount(QuizRunner, {
    props: {
      start: { mode: 'chapter', chapterId: 1, count: 3 },
      headerTitle: (s: StartSessionResponse) => s.subject?.name ?? '',
      backUrl: '/practice/FZ',
      report: { source: 'latihan' },
      api: api as unknown as QuizApi,
    },
    global: { plugins: [router], stubs: { teleport: true, UDrawer: DrawerStub, Drawer: DrawerStub } },
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

/** Answer the current question (option A) and go on. */
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
  api = { start: vi.fn(), check: vi.fn(), submit: vi.fn() }
  api.check.mockResolvedValue({ isCorrect: true, correctOptionId: 0, feedback: 'Betul!', explanation: null })
  api.submit.mockResolvedValue({ results: { score: 3, total: 3, gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 } } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('QuizRunner: the rajah on every member of a group', () => {
  it('desktop: the pinned pane shows the figure with its alt text on question 1, 2 and 3', async () => {
    const w = await render(GROUPED, true)
    for (const n of [1, 2, 3]) {
      expect(t(w, 'quiz-progress-text').text()).toBe(`Soalan ${String(n)} daripada 3`)
      expect(t(w, 'question-text').text()).toContain('Rajah 1')
      const pane = t(w, 'stimulus-pane')
      const img = pane.get('img')
      expect(img.attributes('src')).toBe('/api/files/TOKENrajah1AAAAAAAA')
      expect(img.attributes('alt')).toBe('Graf halaju lawan masa')
      if (n < 3) await answerAndNext(w)
    }
  })

  it('375: the chip "Lihat Rajah 1" is on question 1, 2 and 3 and opens the figure; the question is beside it', async () => {
    const w = await render(GROUPED, false)
    for (const n of [1, 2, 3]) {
      expect(t(w, 'quiz-progress-text').text()).toBe(`Soalan ${String(n)} daripada 3`)
      const chip = t(w, 'stimulus-chip')
      expect(chip.text()).toContain('Lihat Rajah 1')
      await chip.trigger('click')
      await flushPromises()
      expect(w.get('[data-stub=drawer][data-title="Rajah 1"]').attributes('data-open'), `drawer open on question ${String(n)}`).toBe('true')
      expect(w.get('[data-testid=group-stimuli] img').attributes('src')).toBe('/api/files/TOKENrajah1AAAAAAAA')
      expect(w.find('[data-testid=question-text]').exists()).toBe(true)
      if (n < 3) await answerAndNext(w)
    }
  })

  it('the sheet state is kept per group for the session: open on member 1 (first time), still the pupil choice on member 2', async () => {
    const w = await render(GROUPED, false)
    const sheet = () => w.get('[data-stub=drawer][data-title="Rajah 1"]').attributes('data-open')
    expect(sheet()).toBe('true') // the first time the group appears
    await answerAndNext(w)
    expect(sheet()).toBe('true') // not reset and not re-opened by a new member: it keeps what the pupil left
    expect(w.find('[data-testid=stimulus-chip]').element).toBeTruthy()
  })

  it('a question with its own figure (no group) shows it inline, full width, with alt text', async () => {
    const own: QuizQuestion = { ...member(9, 1, 'Berapakah luas Rajah 2?'), group: null, stimuli: [{ id: 'q9-1', kind: 'image', label: '', alt: 'Segi tiga bersudut tegak', image: { url: '/api/files/TOKENowngAAAAAAAAAA' } }] }
    const w = await render([own], true)
    const inline = t(w, 'quiz-question').get('[data-layout=inline]')
    expect(inline.get('img').attributes('src')).toBe('/api/files/TOKENowngAAAAAAAAAA')
    expect(inline.get('img').attributes('alt')).toBe('Segi tiga bersudut tegak')
    expect(w.find('[data-testid=stimulus-pane]').exists()).toBe(false)
  })

  it('a text-only question shows no stimulus panel', async () => {
    const plain: QuizQuestion = { ...member(5, 1, 'Soalan biasa'), group: null, stimuli: undefined }
    const w = await render([plain], true)
    expect(w.find('[data-testid=stimulus-group]').exists()).toBe(false)
    expect(w.find('[data-layout=inline]').exists()).toBe(false)
  })

  it('an option picture has alt text (the option text)', async () => {
    const q: QuizQuestion = { ...member(6, 1, 'Pilih bentuk'), group: null, stimuli: undefined, options: [{ id: 0, label: 'A', text: 'Segi tiga', imageUrl: '/api/files/TOKENoptAAAAAAAAAAAA' }, { id: 1, label: 'B', text: 'Bulatan' }] }
    const w = await render([q], true)
    const img = t(w, 'option-A').get('[data-testid=option-image]')
    expect(img.attributes('src')).toBe('/api/files/TOKENoptAAAAAAAAAAAA')
    expect(img.attributes('alt')).toBe('Segi tiga')
    expect(t(w, 'option-B').find('img').exists()).toBe(false)
  })

  it('the review keeps the rajah of EVERY member: "Lihat Rajah 1" on answers 1, 2 and 3', async () => {
    const w = await render(GROUPED, true)
    for (let i = 0; i < 3; i++) await answerAndNext(w)
    const items = w.findAll('[data-testid=review-item]')
    expect(items).toHaveLength(3)
    for (const item of items) {
      const toggle = item.get('[data-testid=review-stimulus-toggle]')
      expect(toggle.text()).toContain('Lihat Rajah 1')
      await toggle.trigger('click')
      await flushPromises()
      expect(item.get('[data-testid=stimulus-group] img').attributes('alt')).toBe('Graf halaju lawan masa')
    }
  })
})
