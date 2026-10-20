/**
 * The ONE place the attempts module imports the marking engine from (BE-14 / ADR-0021).
 *
 * Today the engine lives in the prototype folder `src/modules/m28-bijak-spm/domain` (outside
 * `apps/api`; the vite SSR build bundles relative imports, `ssr.noExternal` is only needed for
 * packages). When BE-14 merges, `@pp/exam-core` replaces it: the main session changes ONLY the
 * import specifiers below to `@pp/exam-core` (and adds the workspace dependency plus
 * `ssr.noExternal: ['@pp/exam-core']` to `apps/api/vite.build.config.ts`). Nothing else in
 * `bijak/attempts` imports the engine, and the pure marking code (`marking.ts`) sees only the names
 * exported here.
 *
 * `gradePart`, `isBlank` and `numericValue` are WRAPPERS, not re-exports: see `defuseRootIndex`.
 */
import { gradePart as engineGradePart, isBlank as engineIsBlank } from '../../../../../../src/modules/m28-bijak-spm/domain/grading'
import { numericValue as engineNumericValue } from '../../../../../../src/modules/m28-bijak-spm/domain/math-expr'
import type { PartAnswer } from '../../../../../../src/modules/m28-bijak-spm/domain/types'

/**
 * Student text reaches the engine's LaTeX reader. Its `\sqrt[...]` branch never terminates on an
 * unterminated index (`\sqrt[`) or one that nests another root (`\sqrt[\sqrt[2]]`), which would pin
 * a worker (marking DoS). The engine is not ours to edit, so every student-supplied string is
 * "defused" first: a `[` that follows `\sqrt` is dropped unless a `]` closes it with no `\sqrt`,
 * `{` or `}` in between (a brace could split the index from its `\sqrt` inside a group). Well-formed
 * input is untouched. The wrappers below stay when `@pp/exam-core` replaces the engine import.
 */

/** The engine's own first pass (it runs before the root is read), so a root hidden behind it is seen. */
function normalise(input: string): string {
  let s = input
  for (let n = 0; n < 8; n++) {
    const before = s
    s = s.replace(/\$/g, '').replace(/\\left|\\right/g, '').replace(/\\[,;:! ]/g, ' ')
    s = s.replace(/\\(?:text|mathrm)\s*\{([^}]*)\}/g, ' $1 ')
    if (s === before) break
  }
  return s
}

/** One pass; the caller repeats it, because dropping a bracket can make a later `[` follow a `\sqrt`. */
function dropOnce(s: string): string {
  const drop: number[] = []
  for (const m of s.matchAll(/\\sqrt\s*\[/g)) {
    const open = m.index + m[0].length - 1
    const close = s.indexOf(']', open + 1)
    if (close < 0 || /\\sqrt|[{}]/.test(s.slice(open + 1, close))) drop.push(open)
  }
  if (!drop.length) return s
  let out = ''
  let from = 0
  for (const at of drop) {
    out += s.slice(from, at)
    from = at + 1
  }
  return out + s.slice(from)
}

function dropUnsafeRootBrackets(s: string): string {
  for (let prev = ''; prev !== s; ) {
    prev = s
    s = dropOnce(s)
  }
  return s
}

export function defuseRootIndex(input: string): string {
  const safe = dropUnsafeRootBrackets(normalise(input))
  // Unchanged after the engine's first pass: nothing risky; keep the student's text exactly as sent.
  return safe === normalise(input) ? dropUnsafeRootBrackets(input) : safe
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
export { effectiveMarks, leavesOf, type Leaf } from '../../../../../../src/modules/m28-bijak-spm/domain/paper-model'
export type {
  CurriculumTag,
  LeafKind,
  McqOption,
  PartAnswer,
  PartDef,
  PartResult,
  QuestionDef,
  QuestionResult,
  SchemeDef,
  SectionResult,
  SectionSnapshot,
  StimulusDef,
} from '../../../../../../src/modules/m28-bijak-spm/domain/types'
