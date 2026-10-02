import type { RouteRecordRaw } from 'vue-router'

import diagrams from './routes/diagrams'
import imports from './routes/imports'
import masterNotes from './routes/master-notes'
import myReports from './routes/my-reports'
import quality from './routes/quality'
import questionsForm from './routes/questions-form'
import questionsList from './routes/questions-list'
import reports from './routes/reports'
import structured from './routes/structured'
import submissions from './routes/submissions'

/**
 * M04 routes (build-plan §S.3 rule 2): only spreads the `routes/<group>.ts` fragments. Each UI task
 * writes its own fragment; M04-T1 created them empty.
 */
const routes: RouteRecordRaw[] = [
  ...questionsList,
  ...questionsForm,
  ...imports,
  ...quality,
  ...reports,
  ...myReports,
  ...structured,
  ...submissions,
  ...diagrams,
  ...masterNotes,
]

export default routes
