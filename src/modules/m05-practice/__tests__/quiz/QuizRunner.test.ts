// @vitest-environment jsdom
/* eslint-disable vue/require-default-prop -- test stub of the M04 modal: props only record what the host passes */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import type { StartSessionResponse } from '../../api/types'
import QuizRunner from '../../components/quiz/QuizRunner.vue'
import { REVISION_LABELS } from '../../components/quiz/quiz-labels'
import type { QuizApi } from '../../components/quiz/quiz-types'

const native = vi.hoisted(() => ({ alertNative: vi.fn() }))
vi.mock('@/components/overlay/native-dialogs', () => native)

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', () => outcome)

// The M04 report modal has its own tests; here only its props matter.
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({
    props: {
      open: Boolean,
      questionId: Number,
      variant: String,
      quizSessionId: String,
      source: String,
      failureText: String,
      tints: Object,
    },
    emits: ['update:open'],
    setup(props) {
      return () =>
        props.open
          ? h('div', {
              'data-testid': 'report-stub',
              'data-question': String(props.questionId),
              'data-source': String(props.source),
              'data-session': String(props.quizSessionId),
              'data-variant': String(props.variant),
              'data-tints': JSON.stringify(props.tints),
            })
          : null
    },
  }),
}))

function session(extra: Partial<StartSessionResponse> = {}): StartSessionResponse {
  return {
    sessionId: 's1',
    mode: 'revision',
    subject: { code: 'BM', name: 'Bahasa Melayu', color: '#3B82F6' },
    questions: [
      {
        id: 10,
        questionText: 'Apakah <b>ibu kota</b> Malaysia?',
        textDirection: 'ltr',
        scriptType: 'rumi',
        wrongTimes: 3,
        hasDskp: true,
        contributor: { name: 'Cikgu Contoh', profileUrl: 'https://contoh.my/guru/1' },
        options: [
          { id: 0, label: 'A', text: 'Johor Bahru' },
          { id: 1, label: 'B', text: 'Kuala Lumpur' },
        ],
      },
      {
        id: 11,
        questionText: 'Soalan dua',
        textDirection: 'rtl',
        scriptType: 'jawi',
        wrongTimes: 1,
        hasDskp: false,
        contributor: { name: 'Cikgu Tanpa Pautan', profileUrl: 'javascript:alert(1)' },
        options: [
          { id: 0, label: 'A', text: 'x' },
          { id: 1, label: 'B', text: 'y' },
        ],
      },
    ],
    revisionMeta: { selected: 2, totalWrong: 46 },
    ...extra,
  }
}

let wrapper: VueWrapper | null = null
let router: Router
let api: { [K in keyof QuizApi]: ReturnType<typeof vi.fn> }

async function render(props: Record<string, unknown> = {}): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/practice/BM/quiz')
  wrapper = mount(QuizRunner, {
    props: {
      start: { mode: 'random', subjectCode: 'BM', count: 2 },
      headerTitle: (s: StartSessionResponse) => s.subject?.name ?? '',
      backUrl: '/practice/BM',
      report: { source: 'latihan' },
      api: api as unknown as QuizApi,
      ...props,
    },
    global: { plugins: [router], stubs: { teleport: true } },
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  window.scrollTo = vi.fn()
  vi.spyOn(window, 'alert').mockImplementation(native.alertNative)
  api = { start: vi.fn(), check: vi.fn(), submit: vi.fn() }
  api.start.mockResolvedValue(session())
  native.alertNative.mockReset()
  outcome.setRouteOutcome.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('QuizRunner start', () => {
  it('shows the loading state, then the header card with the title, progress and timer', async () => {
    let release!: (s: StartSessionResponse) => void
    api.start.mockReturnValue(new Promise<StartSessionResponse>((r) => (release = r)))
    const w = await render({ labels: REVISION_LABELS })
    expect(t(w, 'quiz-loading').text()).toContain('Memuat Soalan Ulang Kaji...')
    expect(t(w, 'quiz-loading').text()).toContain('Menyediakan soalan yang pernah dijawab salah')
    release(session())
    await flushPromises()
    expect(t(w, 'quiz-title').text()).toBe('Bahasa Melayu')
    expect(t(w, 'quiz-progress-text').text()).toBe('Soalan 1 daripada 2')
    expect(t(w, 'quiz-timer').text()).toBe('00:00')
    expect(t(w, 'quiz-header').get('[role=progressbar]').attributes('aria-valuenow')).toBe('50')
    expect(w.emitted('loaded')?.[0]?.[0]).toMatchObject({ sessionId: 's1', questionCount: 2 })
  })

  it('uses the Q1 loading copy by default (PROPOSED COPY)', async () => {
    api.start.mockReturnValue(new Promise(() => undefined))
    const w = await render()
    expect(t(w, 'quiz-loading').text()).toContain('Memuat Soalan...')
    expect(t(w, 'quiz-loading').text()).toContain('Menyediakan soalan latihan')
  })

  it('skips #4 for a ready session', async () => {
    const w = await render({ start: null, session: session() })
    expect(api.start).not.toHaveBeenCalled()
    expect(t(w, 'quiz-title').text()).toBe('Bahasa Melayu')
  })

  it('renders question text as text, never as markup', async () => {
    const w = await render()
    expect(t(w, 'question-text').text()).toBe('Apakah <b>ibu kota</b> Malaysia?')
    expect(t(w, 'question-text').find('b').exists()).toBe(false)
  })
})

describe('QuizRunner start errors', () => {
  it('goes to /pricing on 402 without a message', async () => {
    api.start.mockRejectedValue(
      new ApiError({ status: 402, code: 'TRIAL_EXHAUSTED', message: 'x' }),
    )
    await render()
    expect(router.currentRoute.value.fullPath).toBe('/pricing')
    expect(native.alertNative).not.toHaveBeenCalled()
    expect(wrapper?.emitted('start-error')?.[0]?.[0]).toMatchObject({ status: 402 })
  })

  it('goes to the locked URL on 409 CHAPTER_LOCKED', async () => {
    api.start.mockRejectedValue(new ApiError({ status: 409, code: 'CHAPTER_LOCKED', message: 'x' }))
    await render({ lockedUrl: '/practice/chapter/MATH?level=1' })
    expect(router.currentRoute.value.fullPath).toBe('/practice/chapter/MATH?level=1')
    expect(native.alertNative).not.toHaveBeenCalled()
  })

  it('shows the global 404 page for an unknown code', async () => {
    api.start.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await render()
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })

  it('alerts the server message and goes back to the list for any other error', async () => {
    api.start.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Soalan tidak mencukupi.' }),
    )
    await render()
    expect(native.alertNative).toHaveBeenCalledWith('Soalan tidak mencukupi.')
    expect(router.currentRoute.value.fullPath).toBe('/practice/BM')
  })

  it('alerts the S7 English fallback when the server sends no message', async () => {
    api.start.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: '' }))
    await render({ labels: REVISION_LABELS, backUrl: '/practice/revision' })
    expect(native.alertNative).toHaveBeenCalledWith('Failed to load revision quiz')
    expect(router.currentRoute.value.fullPath).toBe('/practice/revision')
  })
})

describe('QuizRunner question', () => {
  it('shows the DSKP / extra pill and the contributor link; no revision chips by default', async () => {
    const w = await render()
    expect(w.find('[data-testid=pill-dskp]').exists()).toBe(true)
    expect(w.find('[data-testid=chip-revision]').exists()).toBe(false)
    expect(w.find('[data-testid=pill-wrong-times]').exists()).toBe(false)
    const link = t(w, 'question-contributor').get('a')
    expect(link.text()).toBe('Cikgu Contoh')
    expect(link.attributes('href')).toBe('https://contoh.my/guru/1')
    expect(link.attributes('target')).toBe('_blank')
    expect(t(w, 'question-contributor').text()).toContain('Soalan oleh:')
  })

  it('shows the revision chips and the "Salah {n}x" pill with revisionChips (S7)', async () => {
    const w = await render({ revisionChips: true })
    expect(t(w, 'chip-revision').text()).toContain(
      'Mode Ulang Kaji — soalan ini pernah dijawab salah',
    )
    expect(t(w, 'chip-revision-meta').text()).toContain('2 daripada 46 soalan salah')
    expect(t(w, 'pill-wrong-times').text()).toContain('Salah 3x')
  })

  it('picks an option, shows "Semak Jawapan" only then, and styles the checked answer', async () => {
    api.check.mockResolvedValue({
      isCorrect: false,
      correctOptionId: 1,
      feedback: 'Cuba lagi',
      explanation: 'Kuala Lumpur ialah ibu negara.',
    })
    const w = await render()
    expect(w.find('[data-testid=btn-check]').exists()).toBe(false)
    await t(w, 'option-A').trigger('click')
    expect(t(w, 'option-A').attributes('data-state')).toBe('selected')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    expect(api.check).toHaveBeenCalledWith('s1', { questionId: 10, selectedOptionId: 0 })
    expect(t(w, 'option-A').attributes('data-state')).toBe('wrong')
    expect(t(w, 'option-B').attributes('data-state')).toBe('correct')
    expect(t(w, 'option-A').attributes('aria-disabled')).toBe('true')
    expect(t(w, 'feedback-title').text()).toBe('Salah')
    expect(t(w, 'feedback-text').text()).toBe('Cuba lagi')
    expect(t(w, 'feedback-explanation').text()).toContain('Penjelasan:')
    expect(t(w, 'btn-next').text()).toContain('Soalan Seterusnya')
  })

  it('T14 B-09: a server feedback that repeats the title is not shown twice', async () => {
    api.check.mockResolvedValue({ isCorrect: false, correctOptionId: 1, feedback: 'Salah', explanation: null })
    const w = await render()
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    expect(t(w, 'feedback-title').text()).toBe('Salah')
    expect(w.find('[data-testid=feedback-text]').exists()).toBe(false)
  })

  it('shows the S7 feedback titles with the S7 labels', async () => {
    api.check.mockResolvedValue({
      isCorrect: true,
      correctOptionId: 0,
      feedback: '',
      explanation: null,
    })
    const w = await render({ labels: REVISION_LABELS })
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    expect(t(w, 'feedback-title').text()).toBe('Betul! Kali ini berjaya!')
  })

  it('shows "Masih belum tepat" for a JSON error response and nothing for a network failure', async () => {
    api.check.mockRejectedValueOnce(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }),
    )
    const w = await render({ labels: REVISION_LABELS })
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=quiz-feedback]').exists()).toBe(false)
    expect(w.find('[data-testid=btn-check]').exists()).toBe(true)

    api.check.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x', body: { message: 'x' } }),
    )
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    expect(t(w, 'feedback-title').text()).toBe('Masih belum tepat')
    expect(t(w, 'option-B').attributes('data-state')).toBe('dimmed')
    expect(t(w, 'option-A').attributes('data-state')).toBe('wrong')
  })

  it('opens the M04 report modal for the question with the S7 tints', async () => {
    api.check.mockResolvedValue({
      isCorrect: true,
      correctOptionId: 0,
      feedback: '',
      explanation: null,
    })
    const w = await render({ report: { source: 'revision' } })
    expect(w.find('[data-testid=btn-report]').exists()).toBe(false)
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    await t(w, 'btn-report').trigger('click')
    const stub = t(w, 'report-stub')
    expect(stub.attributes('data-question')).toBe('10')
    expect(stub.attributes('data-source')).toBe('revision')
    expect(stub.attributes('data-session')).toBe('s1')
    expect(stub.attributes('data-variant')).toBe('mcq')
    expect(JSON.parse(stub.attributes('data-tints') ?? '{}')).toMatchObject({
      missing_options: 'yellow',
      duplicate: 'blue',
    })
  })

  it('keeps the Arabic-script font on Jawi (rtl) text and its options, not on Latin text', async () => {
    api.check.mockResolvedValue({ isCorrect: true, correctOptionId: 0, feedback: '', explanation: null })
    const w = await render()
    expect(t(w, 'question-text').classes()).not.toContain('font-jawi')
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    await t(w, 'btn-next').trigger('click')
    await flushPromises()
    expect(t(w, 'question-text').attributes('dir')).toBe('rtl')
    expect(t(w, 'question-text').classes()).toContain('font-jawi')
    expect(t(w, 'option-A').classes()).toContain('font-jawi')
  })
})

describe('QuizRunner results', () => {
  async function finish(w: VueWrapper, pickA = true) {
    api.check.mockResolvedValue({
      isCorrect: pickA,
      correctOptionId: pickA ? 0 : 1,
      feedback: '',
      explanation: pickA ? null : 'Sebab',
    })
    for (let i = 0; i < 2; i++) {
      await t(w, 'option-A').trigger('click')
      await t(w, 'btn-check').trigger('click')
      await flushPromises()
      await t(w, 'btn-next').trigger('click')
      await flushPromises()
    }
  }

  it('labels the last button "Lihat Keputusan" and submits once, showing the Q1 results', async () => {
    api.submit.mockResolvedValue({
      results: {
        score: 2,
        total: 2,
        gamification: { coinsEarned: 2, streakCount: 4, pointsEarned: 20, totalBalance: 372 },
      },
    })
    const w = await render()
    await t(w, 'option-A').trigger('click')
    api.check.mockResolvedValue({
      isCorrect: true,
      correctOptionId: 0,
      feedback: '',
      explanation: null,
    })
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    await t(w, 'btn-next').trigger('click')
    await flushPromises()
    await t(w, 'option-A').trigger('click')
    await t(w, 'btn-check').trigger('click')
    await flushPromises()
    expect(t(w, 'btn-next').text()).toContain('Lihat Keputusan')
    await t(w, 'btn-next').trigger('click')
    await flushPromises()

    expect(api.submit).toHaveBeenCalledTimes(1)
    expect(api.submit.mock.calls[0]?.[1]).toMatchObject({
      answers: [
        { questionId: 10, selectedOptionId: 0 },
        { questionId: 11, selectedOptionId: 0 },
      ],
    })
    expect(t(w, 'result-title').text()).toBe('Keputusan Latihan')
    expect(t(w, 'result-subject').text()).toBe('Bahasa Melayu')
    expect(t(w, 'result-score').text()).toBe('2/2')
    expect(t(w, 'result-percent').text()).toBe('100%')
    expect(t(w, 'result-percent').attributes('data-band')).toBe('high')
    expect(t(w, 'result-message').text()).toBe('Sempurna! Semua jawapan betul!')
    expect(w.find('[data-testid=result-corrected]').exists()).toBe(false)
    expect(t(w, 'reward-coins').text()).toBe('2')
    expect(t(w, 'reward-streak').text()).toBe('4 hari')
    expect(t(w, 'reward-points').text()).toBe('20')
    expect(t(w, 'reward-balance').text()).toBe('372')
    expect(t(w, 'result-retry').text()).toContain('Ulang Lagi')
    expect(t(w, 'result-back').attributes('href')).toBe('/practice/BM')
    expect(w.emitted('completed')?.[0]?.[0]).toMatchObject({ score: 2, total: 2 })
  })

  it('shows no rewards card when the submit fails, and the red band with a corrected line for S7 at 0 %', async () => {
    api.submit.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    const w = await render({ labels: REVISION_LABELS, correctedLine: true })
    await finish(w, false)
    expect(w.find('[data-testid=result-rewards]').exists()).toBe(false)
    expect(t(w, 'result-percent').attributes('data-band')).toBe('low')
    expect(t(w, 'result-message').text()).toBe('Jangan putus asa! Cuba ulang kaji lagi!')
    expect(w.find('[data-testid=result-corrected]').exists()).toBe(false)
    expect(t(w, 'result-bar').get('[role=progressbar]').attributes('aria-valuenow')).toBe('0')
  })

  it('shows the corrected line from 50 % for S7', async () => {
    api.submit.mockResolvedValue({
      results: {
        score: 2,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
      },
    })
    const w = await render({ labels: REVISION_LABELS, correctedLine: true })
    await finish(w, true)
    expect(t(w, 'result-corrected').text()).toContain('2 soalan salah berjaya diperbetulkan!')
    expect(t(w, 'result-title').text()).toBe('Keputusan Ulang Kaji')
  })

  it('lists the review closed, opens it, and reports a question from it', async () => {
    api.submit.mockResolvedValue({
      results: {
        score: 0,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
      },
    })
    const w = await render({ report: { source: 'latihan' } })
    await finish(w, false)
    expect(t(w, 'review-list').attributes('style')).toContain('display: none')
    await t(w, 'review-toggle').trigger('click')
    expect(t(w, 'review-list').attributes('style') ?? '').not.toContain('display: none')
    const items = w.findAll('[data-testid=review-item]')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('Jawapan anda:')
    expect(items[0]?.text()).toContain('A. Johor Bahru')
    expect(items[0]?.text()).toContain('Jawapan betul: B. Kuala Lumpur')
    expect(items[0]?.text()).toContain('Penjelasan:')
    await items[1]?.get('[data-testid=review-report]').trigger('click')
    expect(t(w, 'report-stub').attributes('data-question')).toBe('11')
    expect(t(w, 'report-stub').attributes('data-source')).toBe('latihan')
  })

  it('"Ulang Lagi" starts a new session with the same request', async () => {
    api.submit.mockResolvedValue({
      results: {
        score: 0,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
      },
    })
    const w = await render()
    await finish(w, false)
    api.start.mockClear()
    await t(w, 'result-retry').trigger('click')
    await flushPromises()
    expect(api.start).toHaveBeenCalledWith({ mode: 'random', subjectCode: 'BM', count: 2 })
    expect(t(w, 'quiz-progress-text').text()).toBe('Soalan 1 daripada 2')
  })
})

describe('QuizRunner time limit (fake timers)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('counts down on screen and shows the results and submits at 0', async () => {
    api.start.mockResolvedValue(session({ timeLimitSec: 3, revisionMeta: undefined }))
    api.submit.mockResolvedValue({
      results: {
        score: 0,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 1, pointsEarned: 0, totalBalance: 5 },
      },
    })
    const w = await render()
    await vi.advanceTimersByTimeAsync(0)
    expect(t(w, 'quiz-timer').text()).toBe('00:03')
    await vi.advanceTimersByTimeAsync(1000)
    expect(t(w, 'quiz-timer').text()).toBe('00:02')
    expect(api.submit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.find('[data-testid=quiz-results]').exists()).toBe(true)
    expect(api.submit).toHaveBeenCalledTimes(1)
    expect(api.submit.mock.calls[0]?.[1]).toMatchObject({ answers: [], timeSpent: 3 })
    expect(t(w, 'result-time').text()).toContain('00:03')
  })
})

describe('QuizRunner hideRetry', () => {
  async function toResults(props: Record<string, unknown>) {
    api.submit.mockResolvedValue({
      results: {
        score: 0,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
      },
    })
    api.check.mockResolvedValue({
      isCorrect: false,
      correctOptionId: 1,
      feedback: '',
      explanation: null,
    })
    const w = await render(props)
    for (let i = 0; i < 2; i++) {
      await t(w, 'option-A').trigger('click')
      await t(w, 'btn-check').trigger('click')
      await flushPromises()
      await t(w, 'btn-next').trigger('click')
      await flushPromises()
    }
    return w
  }

  it('shows the retry button by default and hides it with hideRetry', async () => {
    const shown = await toResults({})
    expect(shown.find('[data-testid=result-retry]').exists()).toBe(true)
    shown.unmount()
    const hidden = await toResults({ hideRetry: true })
    expect(hidden.find('[data-testid=result-retry]').exists()).toBe(false)
    expect(hidden.find('[data-testid=result-back]').exists()).toBe(true)
  })
})
