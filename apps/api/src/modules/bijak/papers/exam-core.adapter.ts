/**
 * The ONE place the papers module imports the exam domain from (BE-14 / ADR-0021).
 *
 * Today the domain lives in the prototype folder `src/modules/m28-bijak-spm/domain` (outside
 * `apps/api`; the vite SSR build bundles relative imports, the same way `bijak/attempts` does).
 * When BE-14 merges, `@pp/exam-core` replaces it: the main session changes ONLY the import
 * specifiers below to `@pp/exam-core` (and adds the workspace dependency plus
 * `ssr.noExternal: ['@pp/exam-core']` to `apps/api/vite.build.config.ts`). Nothing else in
 * `bijak/papers` imports the domain.
 *
 * Functions used: `composeFromBlueprint` (Jana Kertas composition), `poolUnits` (stimulus groups kept
 * whole), `effectiveMarks` (choose-N marks of a section, so a paper total is derived, never stored)
 * and `shortageLine` (BM shortage line). Pinned by `test/bijak-papers/exam-core-adapter.spec.ts`.
 */
import type { SectionSnapshot } from '../../../../../../src/modules/m28-bijak-spm/domain/types'

export {
  composeFromBlueprint,
  mulberry32,
  poolUnits,
  shortageLine,
  type BlueprintOutcome,
  type PoolUnit,
} from '../../../../../../src/modules/m28-bijak-spm/domain/blueprint'
export { effectiveMarks } from '../../../../../../src/modules/m28-bijak-spm/domain/paper-model'
export type {
  Blueprint,
  BlueprintSection,
  GroupDef,
  PoolEntry,
  SectionSnapshot,
  Shortage,
} from '../../../../../../src/modules/m28-bijak-spm/domain/types'

/** `all` or `choose n` (the prototype does not export a name for it). */
export type SectionRule = SectionSnapshot['rule']
