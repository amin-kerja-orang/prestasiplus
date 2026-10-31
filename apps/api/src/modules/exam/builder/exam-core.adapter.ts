/**
 * The ONE place the paper builder imports the exam domain from (BE-39 / BE-14 / ADR-0021).
 *
 * The domain lives in the `@pp/exam-core` workspace package (BE-14), bundled by the vite SSR build
 * (`ssr.noExternal`), the same way `bijak/papers` and `bijak/attempts` import it.
 * Nothing else in `exam/**` imports the domain (pinned by `test/exam-builder/exam-core-grep.spec.ts`).
 *
 * Functions used: `effectiveMarks` (choose-N marks of a section: the only marks-budget rule, so the
 * builder never has its own) and `leavesOf` (leaf parts of a structured question).
 */
export { effectiveMarks, leavesOf } from '@pp/exam-core/paper-model'
export type { SchemeDef } from '@pp/exam-core/types'

/**
 * R1-B09a: the standard domain for the admin generate (`composeStandardPaper`), "Pratonton kolam"
 * (`previewStandard`), the publish check (`verifyComposition`, tier 'structural' for curated papers),
 * the frozen report and the shortage line.
 */
export {
  buildStandardReport,
  composeStandardPaper,
  describeQuestion,
  eligibilityOf,
  previewStandard,
  shortageLine,
  SOLVER_VERSION,
  verifyComposition,
} from '@pp/exam-core'
export type {
  ComposeOutcome,
  ComposedSection,
  QuestionFacts,
  StandardBlueprint,
  StandardSection,
  StandardShortage,
  Violation,
} from '@pp/exam-core'
