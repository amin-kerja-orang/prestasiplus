import type { RouteRecordRaw } from 'vue-router'

import admin from './routes/admin'
import marketplace from './routes/marketplace'
import product from './routes/product'

/**
 * M20 routes (F-31b stub, build-plan §S.3 rule 2).
 * M20-T1 created the `routes/<group>.ts` fragments and spreads them here; `routes/admin.ts` (S7-T08) holds the admin
 * products and sellers screens; the seller fragment (M20-T6, deferred) is added later.
 */
const routes: RouteRecordRaw[] = [...marketplace, ...product, ...admin]

export default routes
