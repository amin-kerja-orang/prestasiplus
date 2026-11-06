import type { PartAnswer } from '../domain/types'

/**
 * Mock twins of the API's "Semak" comparison (`marking.ts` `sameAnswersAsCheck`, `exam-core.adapter` `defuseRootIndex`),
 * so the mock counts a check, and shows a stored check, exactly when the API does (FR-MUR-13-6, rule D12).
 */
export const CHECK_BLANK = 'Jawab dahulu sebelum menyemak.'

const ALLOWED_ROOT_INDEX = /\\sqrt *\[(?:\d{1,3}|[A-Za-z])\]|\[/g
const defuse = (s: string): string => s.replace(ALLOWED_ROOT_INDEX, (m) => (m.length > 1 ? m : ''))

/** The typed answer alone: `revealed` is not the pupil's, `plain` is derived, key order does not matter. */
export function answerText(a: PartAnswer | undefined): string {
  const typed: Record<string, unknown> = { ...(a ?? {}) }
  delete typed.revealed
  delete typed.plain
  for (const k of ['choice', 'final', 'unit', 'text']) if (typeof typed[k] === 'string') typed[k] = defuse(typed[k])
  if (Array.isArray(typed.steps)) typed.steps = (typed.steps as string[]).map(defuse)
  return JSON.stringify(
    Object.entries(typed)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => x.localeCompare(y)),
  )
}

export function sameAnswers(a: PartAnswer | undefined, b: PartAnswer | undefined): boolean {
  return answerText(a) === answerText(b)
}
