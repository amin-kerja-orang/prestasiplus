/**
 * The ONE place the papers module imports the exam domain from (BE-14 / ADR-0021): `@pp/exam-core`.
 * The root entry carries the server API; `mulberry32`, `shortageLine` and `BlueprintSection` are not
 * re-exported there, so they come from the package subpaths (the same code the frontend shims use).
 * Nothing else in `bijak/papers` imports the domain.
 *
 * Functions used: `composeFromBlueprint` (Jana Kertas composition), `poolUnits` (stimulus groups kept
 * whole), `effectiveMarks` (choose-N marks of a section, so a paper total is derived, never stored)
 * and `shortageLine` (BM shortage line). Pinned by `test/bijak-papers/exam-core-adapter.spec.ts`.
 */
import type { SectionSnapshot } from '@pp/exam-core'

export { composeFromBlueprint, effectiveMarks, poolUnits, type BlueprintOutcome, type PoolUnit } from '@pp/exam-core'
export { mulberry32, shortageLine } from '@pp/exam-core/blueprint'
export type { Blueprint, GroupDef, PoolEntry, SectionSnapshot, Shortage } from '@pp/exam-core'
export type { BlueprintSection } from '@pp/exam-core/types'

/** `all` or `choose n` (the prototype does not export a name for it). */
export type SectionRule = SectionSnapshot['rule']
