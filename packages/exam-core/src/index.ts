/**
 * @pp/exam-core public API (BE-14, ADR-0021). Pure TypeScript: no Vue, no DOM, no Node-only API,
 * no import from `src/**`. The server and the Bijak SPM UI mark with exactly this code.
 *
 * Anything else (math-expr helpers, ecfExpected, formatClock, ...) is reachable only through the
 * subpaths `@pp/exam-core/{grading,math-expr,blueprint,paper-model,choose-n,types}`, which exist for the
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

/* ---------------------------------------------------------------- Bijak SPM exam standard (bijak-spm) */
export {
  ANSWER_MODES,
  KBAT_LEVELS,
  T1_T3_KEY,
  canonicalStructure,
  offeredMarks,
  perQuestionMarks,
  unitKeyOf,
  unitRefOf,
} from './standard-model'
export type {
  Profile,
  ProfileKind,
  KbatLevel,
  Quota,
  QuotaBasis,
  QuotaLine,
  SectionRule,
  SlotGroup,
  StandardBlueprint,
  StandardSection,
  UnitKey,
  UnitRef,
} from './standard-model'
export {
  INELIGIBLE_REASONS,
  SECTION_REASONS,
  describeQuestion,
  eligibilityOf,
  excludedReport,
  quotaUnitKeys,
} from './eligibility'
export type {
  DescribedQuestion,
  Eligibility,
  EligibilitySection,
  ExcludedReport,
  FormOrigin,
  IneligibleReason,
  LeafFact,
  QuestionFacts,
  SectionReason,
  UnitFact,
} from './eligibility'
export { BLUEPRINT_PROBLEM_CODES, COMPLETENESS_CODES, validateBlueprint, validateForVerification } from './validate'
export type {
  BlueprintProblem,
  BlueprintProblemCode,
  BlueprintWarning,
  CompletenessGap,
  ValidateOptions,
  ValidateResult,
  VerificationGate,
  VerificationGateOptions,
} from './validate'
export { checkEvidence } from './evidence'
export type { EvidenceCheck, EvidenceItem, EvidenceKind, EvidenceLine, EvidenceStatus, EvidenceValues } from './evidence'
export { SHORTAGE_KINDS, shortageLine, unitLabel } from './shortage'
export type { ShortageKind, StandardShortage, UnitLabelRef } from './shortage'
export { composeStandardPaper, previewStandard } from './compose'
export type { AttemptKind, ComposeOptions, ComposeOutcome, StandardPreview } from './compose'
export { precheckPool, precheckSection } from './precheck'
export type { SectionPrecheck, Short } from './precheck'
export { orderOk } from './arrange'
export type { OrderUnit } from './arrange'
export { buildSectionPool, makePoolContext } from './pool'
export type { Item, PoolContext, PoolOptions, SectionPool } from './pool'
export { DEFAULT_BUDGET, SOLVER_VERSION } from './solver'
export type { Budget } from './solver'
export { VIOLATION_CODES, buildStandardReport, measureSection, verifyComposition } from './verify'
export type {
  ComposedSection,
  FactsInput,
  SectionMeasure,
  StandardReport,
  VerifyOptions,
  Violation,
  ViolationCode,
  ViolationTier,
} from './verify'
