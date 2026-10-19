import type { RouteRecordRaw } from 'vue-router'

import tiket from './routes/tiket'

/** M22 routes (build-plan §S.3 rule 2): spreads the `routes/<group>.ts` fragments. */
const routes: RouteRecordRaw[] = [...tiket]

export default routes
