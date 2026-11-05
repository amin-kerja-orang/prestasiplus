// @vitest-environment jsdom
/* eslint-disable vue/require-default-prop, vue/one-component-per-file -- test stubs of the M04 modal and the drawer: props only record what the host passes */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resetStimulusOpen } from '@/components/question-display/lib/useStimulusOpen'

import type { QuizQuestion, StartSessionResponse } from '../../api/types'
import QuizRunner from '../../components/quiz/QuizRunner.vue'
import type { QuizApi } from '../../components/quiz/quiz-types'

vi.mock('@/components/overlay/native-dialogs', () => ({ alertNative: vi.fn() }))
vi.mock('@/app/router/outcome', () => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({ props: { open: Boolean }, setup: () => () => h('div') }),
}))

const DrawerStub = defineComponent({
  props: { open: Boolean, title: String },
  emits: ['update:open'],
  setup:
    (p, { slots }) =>
    () =>
      h('div', { 'data-testid': 'drawer' }, p.open ? slots.body?.() : null),
})

const base = { textDirection: 'ltr', scriptType: 'rumi', wrongTimes: 0, hasDskp: true, contributor: null } as const
const options = [
  { id: 0, label: 'A', text: 'satu' },
  { id: 1, label: 'B', text: 'dua' },
]
const figure = {
  id: '70',
  kind: 'diagram' as const,
  label: 'Rajah 1',
  text: null,
  caption: 'Segi tiga',
  alt: 'Segi tiga bersudut tegak',
  source: null,
  imageId: 'abcdefghijklmnopqrstuv',
  table: null,
}
const member = (id: number, index: number): QuizQuestion => ({
  ...base,
  id,
  questionText: `Soalan kumpulan ${String(index)}`,
  options,
  stimuli: [figure],
  group: { id: '9', index, size: 2 },
})

function session(): StartSessionResponse {
  return {
    sessionId: 's1',
    mode: 'latih_tubi',
    subject: { code: 'MATH', name: 'Matematik', color: '#3B82F6' },
    questions: [
      { ...base, id: 1, questionText: 'Soalan biasa', options, stimuli: [], group: null },
      member(2, 1),
      member(3, 2),
    ],
  }
}

let wrapper: VueWrapper | null = null
const api = { start: vi.fn(), check: vi.fn(), submit: vi.fn() }

async function mountRunner(wide: boolean): Promise<VueWrapper> {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push('/practice/MATH/quiz')
  wrapper = mount(QuizRunner, {
    props: {
      start: { mode: 'latih_tubi', subjectCode: 'MATH', count: 3 },
      headerTitle: 'Matematik',
      backUrl: '/practice/MATH',
      report: { source: 'latihan' },
      api: api as unknown as QuizApi,
    },
    global: { plugins: [router], stubs: { teleport: true, UDrawer: DrawerStub } },
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

/** Answers the question on screen and moves to the next. */
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
  api.start.mockResolvedValue(session())
  api.check.mockResolvedValue({ isCorrect: true, correctOptionId: 0, feedback: 'Betul', explanation: null })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
})

describe('QuizRunner stimulus panel (S5-T03 part B)', () => {
  it('a question without a stimulus shows no panel', async () => {
    const w = await mountRunner(true)
    expect(w.find('[data-testid=stimulus-group]').exists()).toBe(false)
    expect(t(w, 'question-text').text()).toBe('Soalan biasa')
  })

  it('a group shows its stimulus panel ONCE, one member per screen, the same panel for the next member', async () => {
    const w = await mountRunner(true)
    await answerAndNext(w) // the plain question
    expect(t(w, 'question-text').text()).toBe('Soalan kumpulan 1')
    expect(w.findAll('[data-testid=stimulus-group]')).toHaveLength(1)
    expect(w.findAll('[data-testid=stimulus-pane] img')).toHaveLength(1)
    expect(w.get('[data-testid=stimulus-pane] img').attributes('src')).toBe('/api/files/abcdefghijklmnopqrstuv')
    // Only the member on screen is in the question column.
    expect(w.findAll('[data-testid=quiz-question]')).toHaveLength(1)

    await answerAndNext(w) // second member
    expect(t(w, 'question-text').text()).toBe('Soalan kumpulan 2')
    expect(w.findAll('[data-testid=stimulus-group]')).toHaveLength(1)
    // The same group panel (one picture) now sits beside the second member: never a second copy.
    expect(w.findAll('[data-testid=stimulus-pane] img')).toHaveLength(1)
    expect(w.findAll('[data-testid=quiz-question]')).toHaveLength(1)
  })

  it('below 1024px the group stimulus is one chip "Lihat Rajah 1" and a sheet, not a second copy', async () => {
    const w = await mountRunner(false)
    await answerAndNext(w)
    expect(w.findAll('[data-testid=stimulus-group]')).toHaveLength(1)
    expect(t(w, 'stimulus-chip').text()).toContain('Rajah 1')
    expect(w.findAll('[data-testid=stimulus-pane]')).toHaveLength(0)
  })
})
