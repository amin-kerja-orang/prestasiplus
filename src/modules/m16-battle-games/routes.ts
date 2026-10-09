import type { RouteRecordRaw } from 'vue-router'

import battle from './routes/battle'
import hub from './routes/hub'
import lobbies from './routes/lobbies'
import permainanExtra from './routes/permainan-extra'
import sekolahBersaing from './routes/sekolah-bersaing'
import solo from './routes/solo'
import tournament from './routes/tournament'

/**
 * M16 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment.
 */
const routes: RouteRecordRaw[] = [
  ...battle,
  ...hub,
  ...lobbies,
  ...solo,
  ...permainanExtra,
  ...tournament,
  ...sekolahBersaing,
]

export default routes
