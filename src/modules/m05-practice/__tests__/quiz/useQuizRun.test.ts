import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { StartSessionResponse } from '../../api/types'
import type { QuizApi } from '../../components/quiz/quiz-types'
import { useQuizRun } from '../../components/quiz/useQuizRun'

function session(n = 3, extra: Partial<StartSessionResponse> = {}): StartSessionResponse {
  return {
    sessionId: 's1',
    mode: 'random',
    subject: { code: 'MATH', name: 'Matematik', color: '#EF4444' },
    questions: Array.from({ length: n }, (_, i) => ({
      id: 100 + i,
      questionText: `Soalan ${String(i + 1)}`,
      textDirection: 'ltr' as const,
      scriptType: 'rumi' as const,
      wrongTimes: 0,
      hasDskp: i % 2 === 0,
      contributor: null,
      options: [
        { id: 0, label: 'A', text: 'a' },
        { id: 1, label: 'B', text: 'b' },
      ],
    })),
    ...extra,
  }
}

let scope: EffectScope
let api: { [K in keyof QuizApi]: ReturnType<typeof vi.fn> }

function makeRun(
  s: StartSessionResponse | null = session(),
  hooks: Partial<Parameters<typeof useQuizRun>[0]> = {},
) {
  let run!: ReturnType<typeof useQuizRun>
  scope.run(() => {
    run = useQuizRun({
      api: api as unknown as QuizApi,
      startBody: () => ({ mode: 'random', subjectCode: 'MATH', count: 3 }),
      readySession: () => null,
      ...hooks,
    })
  })
  api.start.mockResolvedValue(s)
  return run
}

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
  api = { start: vi.fn(), check: vi.fn(), submit: vi.fn() }
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

describe('useQuizRun', () => {
  it('starts the session, shows the quiz and counts the timer up from 0', async () => {
    const loaded = vi.fn()
    const run = makeRun(session(), { loaded })
    expect(run.phase.value).toBe('loading')
    await run.begin()
    expect(api.start).toHaveBeenCalledWith({ mode: 'random', subjectCode: 'MATH', count: 3 })
    expect(run.phase.value).toBe('quiz')
    expect(loaded).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', questionCount: 3 }),
    )
    expect(run.clock.value).toBe(0)
    vi.advanceTimersByTime(3000)
    expect(run.clock.value).toBe(3)
  })

  it('uses a ready session without calling #4', async () => {
    const run = makeRun(null, { readySession: () => session(2) })
    await run.begin()
    expect(api.start).not.toHaveBeenCalled()
    expect(run.total.value).toBe(2)
  })

  it('reports a failed start and stays loading', async () => {
    const startError = vi.fn()
    const run = makeRun(null, { startError })
    api.start.mockRejectedValue(
      new ApiError({ status: 402, code: 'TRIAL_EXHAUSTED', message: 'x' }),
    )
    await run.begin()
    expect(startError).toHaveBeenCalledTimes(1)
    expect(run.phase.value).toBe('loading')
  })

  it('checks an answer once and keeps it for the review', async () => {
    const run = makeRun()
    await run.begin()
    run.select(1)
    api.check.mockResolvedValue({
      isCorrect: true,
      correctOptionId: 1,
      feedback: 'Bagus',
      explanation: 'Sebab',
    })
    await run.check()
    expect(api.check).toHaveBeenCalledWith('s1', { questionId: 100, selectedOptionId: 1 })
    expect(run.result.value).toMatchObject({ isCorrect: true, correctOptionId: 1 })
    expect(run.score.value).toBe(1)
    expect(run.answers.value).toHaveLength(1)
    expect(run.answers.value[0]).toMatchObject({ selectedLabel: 'B. b', correctLabel: 'B. b' })
    // No second check and no re-pick after checking.
    await run.check()
    run.select(0)
    expect(api.check).toHaveBeenCalledTimes(1)
    expect(run.selected.value).toBe(1)
  })

  it('does nothing without a picked option', async () => {
    const run = makeRun()
    await run.begin()
    await run.check()
    expect(api.check).not.toHaveBeenCalled()
  })

  it('marks the question checked and wrong on a JSON error response (FR-M05-79)', async () => {
    const run = makeRun()
    await run.begin()
    run.select(0)
    api.check.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Jawapan tidak sah.',
        body: {},
      }),
    )
    await run.check()
    expect(run.result.value).toEqual({
      isCorrect: false,
      correctOptionId: null,
      feedback: '',
      explanation: null,
    })
    expect(run.answers.value[0]?.correctLabel).toBe('')
    expect(run.score.value).toBe(0)
  })

  it('changes nothing on a network failure (FR-M05-79)', async () => {
    const run = makeRun()
    await run.begin()
    run.select(0)
    api.check.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }))
    await run.check()
    expect(run.result.value).toBeNull()
    expect(run.answers.value).toHaveLength(0)
    expect(run.selected.value).toBe(0)
  })

  it('goes to the next question, then submits the checked answers once on the last', async () => {
    const completed = vi.fn()
    const showedResults = vi.fn()
    const run = makeRun(session(2), { completed, showedResults })
    await run.begin()
    api.check.mockResolvedValue({
      isCorrect: true,
      correctOptionId: 0,
      feedback: '',
      explanation: null,
    })
    api.submit.mockResolvedValue({
      results: {
        score: 2,
        total: 2,
        gamification: { coinsEarned: 2, streakCount: 3, pointsEarned: 20, totalBalance: 372 },
      },
    })
    run.select(0)
    await run.check()
    run.next()
    expect(run.index.value).toBe(1)
    expect(run.result.value).toBeNull()
    expect(run.isLast.value).toBe(true)
    vi.advanceTimersByTime(5000)
    run.select(0)
    await run.check()
    run.next()
    await vi.waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1))
    expect(run.phase.value).toBe('results')
    expect(showedResults).toHaveBeenCalled()
    expect(api.submit).toHaveBeenCalledWith('s1', {
      answers: [
        { questionId: 100, selectedOptionId: 0 },
        { questionId: 101, selectedOptionId: 0 },
      ],
      timeSpent: 5,
    })
    await vi.waitFor(() => expect(run.gamification.value?.totalBalance).toBe(372))
    expect(completed).toHaveBeenCalledWith({
      score: 2,
      total: 2,
      gamification: { coinsEarned: 2, streakCount: 3, pointsEarned: 20, totalBalance: 372 },
    })
    // The timer stopped with the results.
    vi.advanceTimersByTime(4000)
    expect(run.elapsed.value).toBe(5)
    // "Lihat Keputusan" cannot submit twice.
    await run.finish()
    expect(api.submit).toHaveBeenCalledTimes(1)
  })

  it('shows the results without rewards when the submit fails (FR-M05-84)', async () => {
    const run = makeRun(session(1))
    await run.begin()
    api.check.mockResolvedValue({
      isCorrect: false,
      correctOptionId: 0,
      feedback: '',
      explanation: null,
    })
    api.submit.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    run.select(1)
    await run.check()
    run.next()
    await vi.waitFor(() => expect(api.submit).toHaveBeenCalled())
    await vi.waitFor(() => expect(run.submitting.value).toBe(false))
    expect(run.phase.value).toBe('results')
    expect(run.gamification.value).toBeNull()
    expect(run.percent.value).toBe(0)
  })

  it('counts down with a time limit and submits at 0 (Q6)', async () => {
    const run = makeRun(session(2, { timeLimitSec: 3 }))
    await run.begin()
    api.submit.mockResolvedValue({
      results: {
        score: 0,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
      },
    })
    expect(run.clock.value).toBe(3)
    vi.advanceTimersByTime(2000)
    expect(run.clock.value).toBe(1)
    expect(run.phase.value).toBe('quiz')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1))
    expect(run.phase.value).toBe('results')
    expect(run.clock.value).toBe(0)
  })

  it('ignores a slow start of an older run after a restart', async () => {
    const run = makeRun()
    let release!: (s: StartSessionResponse) => void
    api.start.mockReturnValueOnce(new Promise<StartSessionResponse>((r) => (release = r)))
    const first = run.begin()
    api.start.mockResolvedValue(session(5))
    await run.begin()
    expect(run.total.value).toBe(5)
    release(session(2))
    await first
    expect(run.total.value).toBe(5)
  })
})

describe('useQuizRun check racing the end of the run', () => {
  it('drops a check that resolves after the time limit finished the run', async () => {
    const run = makeRun(session(2, { timeLimitSec: 2 }))
    await run.begin()
    api.submit.mockResolvedValue({
      results: {
        score: 0,
        total: 2,
        gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 },
      },
    })
    let release!: (v: unknown) => void
    api.check.mockReturnValue(new Promise((r) => (release = r)))
    run.select(0)
    const pending = run.check()
    vi.advanceTimersByTime(2000)
    await vi.waitFor(() => expect(run.phase.value).toBe('results'))
    release({ isCorrect: true, correctOptionId: 0, feedback: '', explanation: null })
    await pending
    expect(run.answers.value).toHaveLength(0)
    expect(run.score.value).toBe(0)
    // And no check starts once the results are showing.
    api.check.mockClear()
    run.select(0)
    await run.check()
    expect(api.check).not.toHaveBeenCalled()
  })
})
