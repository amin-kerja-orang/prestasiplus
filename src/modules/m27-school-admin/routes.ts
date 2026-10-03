import type { RouteRecordRaw } from 'vue-router'

import dashboard from './routes/dashboard'

/**
 * M27 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each screen's
 * task writes its own fragment and adds one spread line here.
 */
const routes: RouteRecordRaw[] = [...dashboard]

export default routes
