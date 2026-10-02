import type { RouteRecordRaw } from 'vue-router'

import auth from './routes/auth'
import logout from './routes/logout'
import notifikasi from './routes/notifikasi'
import parentInvite from './routes/parent-invite'
import password from './routes/password'
import profile from './routes/profile'
import tetapan from './routes/tetapan'

/**
 * M01 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M01-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...auth,
  ...password,
  ...logout,
  ...profile,
  ...tetapan,
  ...notifikasi,
  ...parentInvite,
]

export default routes
