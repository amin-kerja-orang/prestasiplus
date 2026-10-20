/**
 * The ONE place the paper builder imports the exam domain from (BE-39 / BE-14 / ADR-0021).
 *
 * Today the domain lives in the prototype folder `src/modules/m28-bijak-spm/domain` (outside
 * `apps/api`; the vite SSR build bundles relative imports, the same way `bijak/papers` does).
 * TODO BE-14: when it merges, the main session changes ONLY the specifiers below to `@pp/exam-core`
 * (the workspace dependency and `ssr.noExternal` are shared with `bijak/papers/exam-core.adapter.ts`).
 * Nothing else in `exam/**` imports the domain (pinned by `test/exam-builder/exam-core-grep.spec.ts`).
 *
 * Functions used: `effectiveMarks` (choose-N marks of a section: the only marks-budget rule, so the
 * builder never has its own) and `leavesOf` (leaf parts of a structured question).
 */
export { effectiveMarks, leavesOf } from '../../../../../../src/modules/m28-bijak-spm/domain/paper-model'
export type { SchemeDef } from '../../../../../../src/modules/m28-bijak-spm/domain/types'
