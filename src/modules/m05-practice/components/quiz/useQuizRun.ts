/**
 * The state machine of one quiz run (SRS M05 v1.19 §7.1, FR-M05-75…85; the S7 script `revisionQuizApp`):
 * `loading` → `quiz` → `results`. It starts the session (#4) unless the host passes a ready one, checks
 * answers one by one (#5), and on the last "Lihat Keputusan" submits the checked answers once (#6).
 *
 * Rules kept from the live script (SOURCE-DERIVED):
 * - the timer counts up from the moment the quiz shows, +1 per second, and stops on the results;
 * - a check response of any JSON shape (an error body too) marks the question checked; a network
 *   failure changes nothing (FR-M05-79);
 * - only checked answers are kept and submitted; the score shown is the client's own count;
 * - a failed submit leaves the results without the rewards card.
 * With `timeLimitSec` (Q6, PROPOSED) the timer counts down and the run finishes at 0.
 */

import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import type { StartSessionRequest, StartSessionResponse } from '../../api/types'
import { buildAnswerRecord, hasJsonBody, scorePercent } from './quiz-lib'
import type {
  QuizAnswerRecord,
  QuizApi,
  QuizCheckResult,
  QuizCompletedEvent,
  QuizPhase,
} from './quiz-types'

export interface QuizRunHooks {
  api: QuizApi
  /** Request body of #4, or `null` when the host passes a ready session. */
  startBody: () => StartSessionRequest | null
  /** A session the host already started (`null` = start with `startBody`). */
  readySession: () => StartSessionResponse | null
  loaded?: (e: { sessionId: string; questionCount: number; session: StartSessionResponse }) => void
  startError?: (err: unknown) => void
  checked?: (e: { questionId: number; isCorrect: boolean }) => void
  completed?: (e: QuizCompletedEvent) => void
  /** Called when the run switches to the results (the component scrolls to the top). */
  showedResults?: () => void
}

export function useQuizRun(hooks: QuizRunHooks) {
  const phase = ref<QuizPhase>('loading')
  const session = shallowRef<StartSessionResponse | null>(null)
  const index = ref(0)
  const selected = ref<number | null>(null)
  const result = shallowRef<QuizCheckResult | null>(null)
  const score = ref(0)
  const answers = ref<QuizAnswerRecord[]>([])
  const elapsed = ref(0)
  const gamification = shallowRef<QuizCompletedEvent['gamification']>(null)
  const submitting = ref(false)
  const checking = ref(false)
  /** Syiling / mata the per-question animation already showed (bonus = server total − these). */
  const coinsCollected = ref(0)
  const pointsCollected = ref(0)

  let timerId: ReturnType<typeof setInterval> | null = null
  /** Bumped on every (re)start; an older start or submit result is ignored. */
  let runSeq = 0

  const questions = computed(() => session.value?.questions ?? [])
  const current = computed(() => questions.value[index.value] ?? null)
  const total = computed(() => questions.value.length)
  const timeLimit = computed(() => session.value?.timeLimitSec ?? null)
  /** The seconds the clock shows: up, or down to 0 when the session has a time limit. */
  const clock = computed(() =>
    timeLimit.value ? Math.max(0, timeLimit.value - elapsed.value) : elapsed.value,
  )
  const percent = computed(() => scorePercent(score.value, total.value))
  const isLast = computed(() => index.value === total.value - 1)

  function stopTimer(): void {
    if (timerId !== null) clearInterval(timerId)
    timerId = null
  }

  function startTimer(): void {
    stopTimer()
    timerId = setInterval(() => {
      elapsed.value += 1
      const limit = timeLimit.value
      if (limit && elapsed.value >= limit && phase.value === 'quiz') void finish()
    }, 1000)
  }

  function reset(): void {
    stopTimer()
    phase.value = 'loading'
    session.value = null
    index.value = 0
    selected.value = null
    result.value = null
    score.value = 0
    answers.value = []
    elapsed.value = 0
    gamification.value = null
    submitting.value = false
    checking.value = false
    coinsCollected.value = 0
    pointsCollected.value = 0
  }

  function enter(s: StartSessionResponse): void {
    session.value = s
    phase.value = 'quiz'
    hooks.loaded?.({ sessionId: s.sessionId, questionCount: s.questions.length, session: s })
    startTimer()
  }

  /** Starts (or restarts) the run: #4 on mount, again for "Ulang Lagi". */
  async function begin(): Promise<void> {
    reset()
    const mine = ++runSeq
    const ready = hooks.readySession()
    if (ready) {
      enter(ready)
      return
    }
    const body = hooks.startBody()
    if (!body) return
    try {
      const s = await hooks.api.start(body)
      if (mine !== runSeq) return
      enter(s)
    } catch (err) {
      if (mine !== runSeq) return
      hooks.startError?.(err)
    }
  }

  function select(optionId: number): void {
    if (result.value === null) selected.value = optionId
  }

  async function check(): Promise<void> {
    const s = session.value
    const q = current.value
    const pick = selected.value
    if (phase.value !== 'quiz') return
    if (!s || !q || pick === null || result.value !== null || checking.value) return
    checking.value = true
    const mine = runSeq
    let res: QuizCheckResult
    try {
      const r = await hooks.api.check(s.sessionId, { questionId: q.id, selectedOptionId: pick })
      res = {
        isCorrect: r.isCorrect === true,
        correctOptionId: typeof r.correctOptionId === 'number' ? r.correctOptionId : null,
        feedback: r.feedback ?? '',
        explanation: r.explanation ?? null,
      }
    } catch (err) {
      checking.value = false
      // A JSON error body marks the question checked as "not correct"; a network failure changes nothing.
      if (!hasJsonBody(err)) return
      res = { isCorrect: false, correctOptionId: null, feedback: '', explanation: null }
    }
    checking.value = false
    // The run may have finished (time limit) or restarted while #5 was in flight.
    if (mine !== runSeq || phase.value !== 'quiz' || current.value?.id !== q.id) return
    result.value = res
    if (res.isCorrect) {
      score.value += 1
      coinsCollected.value += 1
      pointsCollected.value += 10
    }
    answers.value = [...answers.value, buildAnswerRecord(q, pick, res)]
    hooks.checked?.({ questionId: q.id, isCorrect: res.isCorrect })
  }

  function next(): void {
    if (result.value === null) return
    if (!isLast.value) {
      index.value += 1
      selected.value = null
      result.value = null
    } else {
      void finish()
    }
  }

  async function submit(): Promise<void> {
    const s = session.value
    if (!s || submitting.value) return
    submitting.value = true
    const mine = runSeq
    try {
      const r = await hooks.api.submit(s.sessionId, {
        answers: answers.value.map((a) => ({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
        })),
        timeSpent: elapsed.value,
      })
      if (mine !== runSeq) return
      gamification.value = r.results?.gamification ?? null
      hooks.completed?.({
        score: r.results?.score ?? score.value,
        total: r.results?.total ?? total.value,
        gamification: gamification.value,
      })
    } catch {
      // A failed submit shows no rewards card (FR-M05-84).
    } finally {
      if (mine === runSeq) submitting.value = false
    }
  }

  /** "Lihat Keputusan": show the results, stop the timer, scroll to the top, submit once. */
  async function finish(): Promise<void> {
    if (phase.value === 'results') return
    phase.value = 'results'
    stopTimer()
    hooks.showedResults?.()
    await submit()
  }

  onScopeDispose(() => {
    runSeq += 1
    stopTimer()
  })

  return {
    phase,
    session,
    index,
    selected,
    result,
    score,
    answers,
    elapsed,
    clock,
    gamification,
    submitting,
    coinsCollected,
    pointsCollected,
    questions,
    current,
    total,
    timeLimit,
    percent,
    isLast,
    begin,
    select,
    check,
    next,
    finish,
  }
}
