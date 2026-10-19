/**
 * Helpers of the M07 student handlers (SRS M07 v1.7 §7 #1-#6, #21-#23): the caller, the level gate
 * (BR-M07-19 404 first, then BR-M07-07 403) and answer scoring (BR-M07-12, SEC-M07-07).
 */

import { API_ERROR_CODES } from '@/api/errors'
import {
  fail,
  forbidden,
  notFound,
  requireRole,
  type MockContext,
  type MockRequest,
} from '@/mock/define'
import type { MockResponse } from '@/mock/define'
import type { Question } from '@/modules/m04-question-bank/mock'

import { pkskAccessRepo } from '../repository/stores'
import { isLevel } from '../repository/rules'
import type { PkskLevel } from '../repository/types'

export function userIdOf(req: MockRequest): number {
  if (!req.session) throw new Error('requireAuth() must run first')
  return req.session.userId
}

export type LevelGate = { ok: true; level: PkskLevel } | { ok: false; response: MockResponse }

/** Unknown level -> 404 (checked first, FR-M07-19); no access -> 403 (SEC-M07-04). */
export function gateLevel(req: MockRequest, ctx: MockContext): LevelGate {
  const raw = String(req.params.level)
  if (!isLevel(raw)) return { ok: false, response: notFound() }
  if (!pkskAccessRepo.levelAccess(userIdOf(req), ctx.clock.now())[raw]) {
    return { ok: false, response: forbidden() }
  }
  return { ok: true, level: raw }
}

/** Every admin endpoint of M07 (§7 #7-#18, FR-M07-59): guest 401, other roles 403. */
export const adminOnly = requireRole('admin')

/** A whole number from a JSON number or a numeric string; `undefined` otherwise. */
export function asInt(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return undefined
}

export const obj = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}

export interface AnswerInput {
  questionId: number
  optionIndex: number | null
  text: string | null
}

export const ANSWERS_MESSAGE = 'Jawapan tidak sah.'

/**
 * Parses `{answers: [{questionId, optionIndex?, text?}]}` (§7 #21, #23). Returns the answers or a 422
 * (UNVERIFIED COPY: the copy is the M05 mock message).
 */
export function parseAnswers(body: unknown): AnswerInput[] | MockResponse {
  const raw = obj(body).answers
  const bad = () =>
    fail(422, API_ERROR_CODES.VALIDATION_ERROR, ANSWERS_MESSAGE, { answers: ANSWERS_MESSAGE })
  if (!Array.isArray(raw) || raw.length === 0) return bad()
  const out: AnswerInput[] = []
  const seen = new Set<number>()
  for (const item of raw as unknown[]) {
    const a = obj(item)
    const id = a.questionId
    if (typeof id !== 'number' || !Number.isInteger(id) || seen.has(id)) return bad()
    seen.add(id)
    const idx = a.optionIndex
    if (idx !== undefined && idx !== null && (typeof idx !== 'number' || !Number.isInteger(idx))) {
      return bad()
    }
    const text = a.text
    if (text !== undefined && text !== null && typeof text !== 'string') return bad()
    out.push({
      questionId: id,
      optionIndex: typeof idx === 'number' ? idx : null,
      text: typeof text === 'string' ? text : null,
    })
  }
  return out
}

/** Minimum length (trimmed) of an essay the simulated marker (D4) accepts: Perlu pengesahan. */
export const ESSAY_MIN_CHARS = 50

/**
 * Server-side scoring (BR-M07-26): A/B the chosen option must be flagged; C the simulated marker
 * accepts an essay of at least `ESSAY_MIN_CHARS` characters.
 */
export function isCorrect(q: Question, a: AnswerInput): boolean {
  const options = q.pkskOptions ?? []
  if (q.questionType === 'essay' || options.length === 0) {
    return (a.text ?? '').trim().length >= ESSAY_MIN_CHARS
  }
  if (a.optionIndex === null) return false
  return options[a.optionIndex]?.isCorrect === true
}

/** The student-facing shape of a served question: no `isCorrect` (SEC-M07-07). */
export function servedQuestion(q: Question) {
  return {
    id: q.id,
    questionText: q.questionText,
    options: (q.pkskOptions ?? []).map((o) => ({ text: o.text })),
  }
}
