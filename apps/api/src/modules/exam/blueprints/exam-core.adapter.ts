/**
 * The ONE place the blueprint admin imports the exam domain from (bijak-spm BJS-08/09, ADR-0021).
 * Pinned by `test/exam-builder/exam-core-grep.spec.ts`: nothing else in `exam/**` imports `@pp/exam-core`.
 *
 * `validateBlueprint` and `validateForVerification` list every problem at once, `checkEvidence` is the
 * AC-39.7 comparison, `canonicalStructure` is the string the structural hash is taken of (3.5).
 */
export { canonicalStructure, checkEvidence, validateBlueprint, validateForVerification } from '@pp/exam-core'
export type {
  BlueprintProblem,
  BlueprintWarning,
  CompletenessGap,
  EvidenceItem,
  EvidenceLine,
  Profile,
  Quota,
  StandardBlueprint,
  StandardSection,
  UnitRef,
  ValidateOptions,
} from '@pp/exam-core'
