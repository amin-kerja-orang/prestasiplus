import type { RouteRecordRaw } from 'vue-router'

import marketplace from './routes/marketplace'
import product from './routes/product'

/**
 * M20 routes (F-31b stub, build-plan §S.3 rule 2).
 * M20-T1 created the `routes/<group>.ts` fragments and spreads them here; the admin and seller
 * fragments (M20-T5, M20-T6, deferred) are added later.
 */
const routes: RouteRecordRaw[] = [...marketplace, ...product]

export default routes
