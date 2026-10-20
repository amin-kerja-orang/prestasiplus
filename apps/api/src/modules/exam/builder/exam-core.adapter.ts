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
