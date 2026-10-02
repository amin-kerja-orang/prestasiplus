import type { RouteRecordRaw } from 'vue-router'

/**
 * M13 routes (build-plan §S.3 rule 2). The screens (S1 `/cikgu`, S2–S6, V1, V2) are added by
 * M13-T2…T4 as `routes/<group>.ts` fragments spread here.
 *
 * S7 / S8 (404, SRS §2, DV-M13-10): every other `/cikgu/*` path, foreign or unknown ids,
 * `/cikgu-alesa` and the GET of the post-only paths `/cikgu/send`, `/cikgu/pbd/rollup`,
 * `/cikgu/pbd/bulk-approve` match no route here and resolve to the core catch-all 404 page (M01 S10).
 * No M13 route may use a wildcard or declare those paths (checked in `__tests__/routes.test.ts`).
 */
const routes: RouteRecordRaw[] = []

export default routes
