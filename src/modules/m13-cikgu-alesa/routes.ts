import type { RouteRecordRaw } from 'vue-router'

import chat from './routes/chat'
import teacher from './routes/teacher'

/**
 * M13 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. S1 is
 * `routes/chat.ts` (M13-T2); S2–S6, V1 and V2 are `routes/teacher.ts` with the role guard (M13-T3, M13-T4).
 *
 * S7 / S8 (404, SRS §2, DV-M13-10): every other `/cikgu/*` path, foreign or unknown ids,
 * `/cikgu-alesa` and the GET of the post-only paths `/cikgu/send`, `/cikgu/pbd/rollup`,
 * `/cikgu/pbd/bulk-approve` match no route here and resolve to the core catch-all 404 page (M01 S10).
 * No M13 route may use a wildcard or declare those paths (checked in `__tests__/routes.test.ts`).
 */
const routes: RouteRecordRaw[] = [...chat, ...teacher]

export default routes
