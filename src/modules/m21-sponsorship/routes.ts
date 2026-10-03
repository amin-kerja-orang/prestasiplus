import type { RouteRecordRaw } from 'vue-router'

import admin from './routes/admin'
import mohon from './routes/mohon'
import sponsor from './routes/sponsor'

/**
 * M21 routes (F-31b stub, build-plan §S.3 rule 2).
 * M21-T1 created the `routes/<group>.ts` fragments and spreads them here; the admin (M21-T4) and
 * sponsor (M21-T5) fragments are deferred and empty.
 */
const routes: RouteRecordRaw[] = [...mohon, ...admin, ...sponsor]

export default routes
