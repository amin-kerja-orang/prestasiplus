import type { RouteRecordRaw } from 'vue-router'

import compStudents from './routes/comp-students'
import imports from './routes/imports'
import jemputIbuBapa from './routes/jemput-ibu-bapa'
import schools from './routes/schools'
import subscriptions from './routes/subscriptions'
import userForm from './routes/user-form'
import users from './routes/users'

/**
 * M02 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M02-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...users,
  ...userForm,
  ...imports,
  ...compStudents,
  ...schools,
  ...subscriptions,
  ...jemputIbuBapa,
]

export default routes
