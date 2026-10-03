// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component, PropType } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { QuizRunner, type QuizApi, type StartSessionRequest } from '@/modules/m05-practice'

import DatabankQuizPage from '../../pages/DatabankQuizPage.vue'
import LatihTubiQuizPage from '../../pages/LatihTubiQuizPage.vue'

const m05 = vi.hoisted(() => ({ startSession: vi.fn() }))

/** Stub runner: records its props and starts through `api.start` like the real one. */
vi.mock('@/modules/m05-practice', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    QuizRunner: defineComponent({
      props: {
        start: { type: Object as PropType<StartSessionRequest>, default: null },
        api: { type: Object as PropType<QuizApi>, default: undefined },
        backUrl: { type: String, default: '' },
        report: { type: Object, default: null },
        retry: { type: String, default: '' },
      },
      setup(props) {
        void props.api?.start(props.start)
        return () => h('div', { 'data-testid': 'runner' })
      },
    }),
    startSession: m05.startSession,
    checkAnswer: vi.fn(),
    submitSession: vi.fn(),
  }
})
const Runner = QuizRunner as unknown as Component

/** A prop of the mounted runner stub. */
const propOf = (w: VueWrapper, key: string): unknown =>
  (w.getComponent(Runner) as unknown as { props(k: string): unknown }).props(key)

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/tahun-lepas/:code/quiz', component: DatabankQuizPage },
      { path: '/spm/latih-tubi/:code/quiz', component: LatihTubiQuizPage },
      { path: '/spm/latih-tubi/:code', component: { template: '<div id="s4" />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  m05.startSession.mockReset()
})

describe('Q1 DatabankQuizPage', () => {
  it('starts a past_year session for the code and count, with the spm report', async () => {
    const w = await render(DatabankQuizPage, '/spm/tahun-lepas/BM/quiz?count=10')
    const runner = { props: (k: string) => propOf(w, k) }
    expect(runner.props('start')).toEqual({ mode: 'past_year', subjectCode: 'BM', count: 10 })
    expect(runner.props('backUrl')).toBe('/spm/tahun-lepas')
    expect(runner.props('report')).toEqual({ source: 'spm' })
    expect(runner.props('retry')).toBe('restart')
  })
})

describe('Q2 LatihTubiQuizPage', () => {
  it('maps count, level and difficulty to the M05 request', async () => {
    const w = await render(
      LatihTubiQuizPage,
      '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4',
    )
    expect(propOf(w, 'start')).toEqual({
      mode: 'latih_tubi',
      subjectCode: 'MATH',
      count: 40,
      levelId: 11,
      difficulty: 4,
    })
    expect(propOf(w, 'backUrl')).toBe('/spm/latih-tubi/MATH')
  })

  it('maps question_id to targetQuestionId', async () => {
    const w = await render(
      LatihTubiQuizPage,
      '/spm/latih-tubi/MATH/quiz?question_id=570024&count=1',
    )
    expect(propOf(w, 'start')).toEqual({
      mode: 'latih_tubi',
      subjectCode: 'MATH',
      count: 1,
      targetQuestionId: 570024,
    })
  })

  it('shows the no-question message with a link back to S4', async () => {
    m05.startSession.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'NOT_ENOUGH_QUESTIONS',
        message: 'Soalan tidak mencukupi.',
      }),
    )
    const w = await render(
      LatihTubiQuizPage,
      '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=5',
    )
    expect(w.get('[data-testid=spm-no-questions]').text()).toContain(
      'Tiada soalan untuk tetapan ini. Sila ubah tetapan kuiz.',
    )
    expect(w.get('[data-testid=spm-no-questions-back]').attributes('href')).toBe(
      '/spm/latih-tubi/MATH',
    )
    expect(w.find('[data-testid=runner]').exists()).toBe(false)
  })

  it('goes back to S4 without a message when the question is refused', async () => {
    m05.startSession.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { targetQuestionId: 'x' },
      }),
    )
    const w = await render(
      LatihTubiQuizPage,
      '/spm/latih-tubi/MATH/quiz?question_id=136891&count=1',
    )
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/spm/latih-tubi/MATH')
    expect(w.find('[data-testid=spm-no-questions]').exists()).toBe(false)
  })
})
