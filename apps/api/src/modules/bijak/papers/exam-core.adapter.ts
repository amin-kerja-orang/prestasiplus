/**
 * The ONE place the papers module imports the exam domain from (BE-14 / ADR-0021).
 *
 * The domain is the `@pp/exam-core` workspace package (BE-14, #43; bundled by the vite SSR build through
 * `ssr.noExternal: ['@pp/exam-core']`). It is imported by package name, never by a relative path into the
 * repo-root `src/`, so the API Docker image (which copies only `packages` and `apps/api`) can build it
 * (#45 C4). Nothing else in `bijak/papers` imports the domain.
 *
 * Functions used: `composeStandardPaper` (Jana Kertas, D75: exact or refuse, stimulus groups kept whole), `effectiveMarks`
 * (choose-N marks of a section, so a paper total is derived, never stored), `describeQuestion` (marks of a question from
 * its leaf facts) and `shortageLine` (BM shortage line). `composeFromBlueprint` / `poolUnits` (the legacy composition) are
 * kept exported and pinned by `test/bijak-papers/exam-core-adapter.spec.ts`; the generator no longer uses them.
 */
import type { SectionSnapshot } from '@pp/exam-core/types'

export {
  composeFromBlueprint,
  mulberry32,
  poolUnits,
  shortageLine,
  type BlueprintOutcome,
  type PoolUnit,
} from '@pp/exam-core/blueprint'
export { effectiveMarks } from '@pp/exam-core/paper-model'
export type {
  Blueprint,
  BlueprintSection,
  GroupDef,
  PoolEntry,
  SectionSnapshot,
  Shortage,
} from '@pp/exam-core/types'

/** `all` or `choose n` (the prototype does not export a name for it). */
export type SectionRule = SectionSnapshot['rule']

// BJS-07: the standard-eligibility domain (architecture 4.2), imported by package root.
export { composeStandardPaper, describeQuestion, eligibilityOf, excludedReport } from '@pp/exam-core'
export type {
  DescribedQuestion,
  EligibilitySection,
  FormOrigin,
  ExcludedReport,
  IneligibleReason,
  LeafFact,
  QuestionFacts,
  UnitFact,
} from '@pp/exam-core'
