/**
 * Pure helpers of the quiz component (SRS M05 v1.19 FR-M05-51…56, FR-M05-75…85, BR-30).
 * No DOM and no Vue: unit-tested on their own.
 */

import { API_ERROR_CODES, ApiError } from '@/api'
import type { QuizOptionState } from '@/ds'

import type { StimulusData } from '../../../../components/question-display'

import type { QuizStimulus, StartSessionResponse } from '../../api/types'
import type { QuizAnswerRecord, QuizLabels } from './quiz-types'

/** `MM:SS` of a number of seconds (live `formatTime`). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** `round(score ÷ total × 100)` (FR-M05-82); 0 for an empty quiz. */
export function scorePercent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0
}

export type ScoreBand = 'high' | 'mid' | 'low'

/** Colour band of the results: green ≥ 80, yellow 50–79, red < 50. */
export function scoreBand(percent: number): ScoreBand {
  if (percent >= 80) return 'high'
  if (percent >= 50) return 'mid'
  return 'low'
}

/** The results message (live `getRevisionMessage`): 100, ≥ 80, ≥ 50, else. */
export function resultMessage(percent: number, messages: QuizLabels['messages']): string {
  if (percent === 100) return messages.perfect
  if (percent >= 80) return messages.high
  if (percent >= 50) return messages.mid
  return messages.low
}

/** "{label}. {text}" of an option, or '' when it is not among them. */
export function optionLabel(
  options: readonly { id: number; label: string; text: string }[],
  id: number | null,
): string {
  if (id === null) return ''
  const o = options.find((x) => x.id === id)
  return o ? `${o.label}. ${o.text}` : ''
}

/** Builds the review item of a checked answer (FR-M05-79). */
export function buildAnswerRecord(
  question: StartSessionResponse['questions'][number],
  selectedOptionId: number,
  result: { isCorrect: boolean; correctOptionId: number | null; explanation: string | null },
): QuizAnswerRecord {
  return {
    questionId: question.id,
    questionText: question.questionText,
    selectedOptionId,
    selectedLabel: optionLabel(question.options, selectedOptionId),
    correctLabel: optionLabel(question.options, result.correctOptionId),
    isCorrect: result.isCorrect,
    explanation: result.explanation,
  }
}

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim'

/** The state of one option button (FR-M05-78). */
export function optionState(
  optionId: number,
  selectedId: number | null,
  checked: { correctOptionId: number | null; isCorrect: boolean } | null,
): OptionState {
  if (checked === null) return selectedId === optionId ? 'selected' : 'idle'
  if (checked.correctOptionId === optionId) return 'correct'
  if (selectedId === optionId && !checked.isCorrect) return 'wrong'
  return 'dim'
}

/** The design-system option state of an `OptionState` (the composite names the dim state `dimmed`). */
export function dsOptionState(state: OptionState): QuizOptionState {
  return state === 'dim' ? 'dimmed' : state
}

/** Trailing run of correct answers (the combo chip of the quiz header). */
export function comboOf(answers: readonly { isCorrect: boolean }[]): number {
  let n = 0
  for (let i = answers.length - 1; i >= 0 && answers[i]?.isCorrect; i--) n += 1
  return n
}

/** A `profileUrl` is a link only for http(s) or an internal path (no `javascript:` etc.). */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) || /^\/(?![/\\])/.test(url) ? url : null
}

/**
 * The "Rujukan" link of a personal question (FR-GUR-44a-9): an absolute http(s) address only. Unlike `safeHref`
 * an internal path is refused, and so are whitespace, control characters and credentials (`user:pass@`).
 * Keep in sync with `isHttpUrl` in packages/contract/src/classes/teacher-tools/schema.ts.
 */
export function isHttpUrl(url: string | null | undefined): url is string {
  if (!url || !/^https?:\/\/\S+$/i.test(url) || /[\x00-\x1f\x7f]/.test(url)) return false
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '' && u.username === '' && u.password === ''
  } catch {
    return false
  }
}

export type StartErrorPlan =
  | { kind: 'pricing' }
  | { kind: 'not-found' }
  | { kind: 'alert'; message: string }

/**
 * What the host does when #4 fails (FR-M05-48, 51, 66, 75): 402 `TRIAL_EXHAUSTED` → `/pricing`,
 * 404 → the global 404 page,
 * anything else → `alert(message)` and back to the list.
 */
export function planStartError(err: unknown, labels: QuizLabels): StartErrorPlan {
  if (err instanceof ApiError) {
    if (err.status === 402 || err.code === 'TRIAL_EXHAUSTED') return { kind: 'pricing' }
    if (err.status === 404) return { kind: 'not-found' }
    if (err.code === API_ERROR_CODES.NETWORK_ERROR || err.status === 0) {
      return { kind: 'alert', message: err.message || labels.networkErrorFallback }
    }
    return { kind: 'alert', message: err.message || labels.startErrorFallback }
  }
  const message = err instanceof Error ? err.message : ''
  return { kind: 'alert', message: message || labels.networkErrorFallback }
}

/** `true` when a failed check call still carries a JSON body (live marks the answer checked, FR-M05-79). */
export function hasJsonBody(err: unknown): boolean {
  return (
    err instanceof ApiError && err.status > 0 && typeof err.body === 'object' && err.body !== null
  )
}

/** `true` when a failed check call is the free-trial limit (402 / `TRIAL_EXHAUSTED`): the answer is not checked. */
export function isTrialExhausted(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 402 || err.code === 'TRIAL_EXHAUSTED')
}

/** `/api/files/<imageId>`: where a served picture is loaded from. */
export const fileSrc = (imageId: string): string => `/api/files/${imageId}`

/** A served stimulus in the shape of the shared question display (S8-T02 `StimulusGroup`). */
export function toStimulusData(s: QuizStimulus): StimulusData {
  return {
    id: s.id,
    kind: s.kind,
    ...(s.label ? { label: s.label } : {}),
    ...(s.text ? { text: s.text } : {}),
    ...(s.source ? { source: s.source } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    ...(s.alt ? { alt: s.alt } : {}),
    ...(s.imageId ? { src: fileSrc(s.imageId) } : {}),
    ...(s.table ? { table: { head: s.table.head, rows: s.table.rows } } : {}),
  }
}
