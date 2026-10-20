/**
 * The ONE place the attempts module imports the marking engine from (BE-14 / ADR-0021).
 *
 * The engine is `@pp/exam-core` (BE-14; the workspace dependency and `ssr.noExternal` are in
 * `apps/api/package.json` and `vite.build.config.ts`). Names the root entry does not re-export
 * (`CurriculumTag`, `QuestionResult`, `SectionResult`, `StimulusDef`) come from the `types` subpath.
 * Nothing else in
 * `bijak/attempts` imports the engine, and the pure marking code (`marking.ts`) sees only the names
 * exported here.
 *
 * `gradePart`, `isBlank` and `numericValue` are WRAPPERS, not re-exports: see `defuseRootIndex`.
 */
import { gradePart as engineGradePart, isBlank as engineIsBlank, numericValue as engineNumericValue, type PartAnswer } from '@pp/exam-core'

/**
 * Student text reaches the engine's LaTeX reader. Its `\sqrt[...]` branch never terminates on an
 * unterminated index (`\sqrt[`) or one that nests another root (`\sqrt[\sqrt[2]]`), which would pin
 * a worker (marking DoS). The engine is not ours to edit, so every student-supplied string is
 * "defused" with a strict allowlist: a `[` survives ONLY inside `\sqrt[<1-3 digits or one ASCII
 * letter>]`; every other `[` is deleted. Whatever the engine does before reading a root (its own
 * clean-up passes, or the join of text, final and steps in grading), every `[` it can meet is then
 * followed at once by a short index and `]`, so `indexOf(']')` is never -1 and the index never holds
 * a `\sqrt`. Well-formed `\sqrt[3]{8}` is untouched. The wrappers below stay when `@pp/exam-core`
 * replaces the engine import.
 */
const ALLOWED_ROOT_INDEX = /\\sqrt *\[(?:\d{1,3}|[A-Za-z])\]|\[/g

export function defuseRootIndex(input: string): string {
  return input.replace(ALLOWED_ROOT_INDEX, (m) => (m.length > 1 ? m : ''))
}

export function defuseAnswer(a: PartAnswer): PartAnswer {
  const d = defuseRootIndex
  return {
    ...a,
    ...(a.choice !== undefined ? { choice: d(a.choice) } : {}),
    ...(a.steps ? { steps: a.steps.map(d) } : {}),
    ...(a.final !== undefined ? { final: d(a.final) } : {}),
    ...(a.unit !== undefined ? { unit: d(a.unit) } : {}),
    ...(a.text !== undefined ? { text: d(a.text) } : {}),
    ...(a.plain ? { plain: { ...a.plain, steps: a.plain.steps.map(d), final: d(a.plain.final) } } : {}),
  }
}

export function gradePart(input: Parameters<typeof engineGradePart>[0]): ReturnType<typeof engineGradePart> {
  return engineGradePart({ ...input, answer: input.answer ? defuseAnswer(input.answer) : input.answer })
}
export function isBlank(a: PartAnswer | undefined): boolean {
  return engineIsBlank(a ? defuseAnswer(a) : a)
}
export function numericValue(raw: string): number | null {
  return engineNumericValue(defuseRootIndex(raw))
}
export { effectiveMarks, leavesOf, type Leaf } from '@pp/exam-core'
export type { LeafKind, McqOption, PartAnswer, PartDef, PartResult, QuestionDef, SchemeDef, SectionSnapshot } from '@pp/exam-core'
export type { CurriculumTag, QuestionResult, SectionResult, StimulusDef } from '@pp/exam-core/types'
