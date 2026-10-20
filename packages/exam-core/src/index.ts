/**
 * @pp/exam-core public API (BE-14, ADR-0021). Pure TypeScript: no Vue, no DOM, no Node-only API,
 * no import from `src/**`. The server and the Bijak SPM UI mark with exactly this code.
 *
 * Anything else (math-expr helpers, ecfExpected, formatClock, ...) is reachable only through the
 * subpaths `@pp/exam-core/{grading,math-expr,blueprint,paper-model,types}`, which exist for the
 * frontend re-export shims in `src/modules/m28-bijak-spm/domain/`. New server code uses this entry.
 */
export { gradePart, isBlank } from './grading'
export type { GradeContext, GradeInput } from './grading'
export { numericValue } from './math-expr'
export { effectiveMarks, leavesOf } from './paper-model'
export type { Leaf } from './paper-model'
export { composeFromBlueprint, poolUnits } from './blueprint'
export type { BlueprintOutcome, PoolUnit } from './blueprint'
export type {
  Blueprint,
  GroupDef,
  LeafKind,
  McqOption,
  PartAnswer,
  PartDef,
  PartResult,
  PartStatus,
  PointDef,
  PoolEntry,
  QuestionDef,
  SchemeDef,
  SectionSnapshot,
  Shortage,
} from './types'
