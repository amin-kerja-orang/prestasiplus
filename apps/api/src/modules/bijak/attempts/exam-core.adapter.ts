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
 */
export { gradePart, isBlank } from '../../../../../../src/modules/m28-bijak-spm/domain/grading'
export { numericValue } from '../../../../../../src/modules/m28-bijak-spm/domain/math-expr'
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
