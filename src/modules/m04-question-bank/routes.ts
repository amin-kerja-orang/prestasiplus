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
import studio from './routes/studio'
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
  ...studio,
  // S2-T09 Sumber Kertas (PRD30 R1-ADM-Q-19): read-only registry of intake papers. Admin Pusat only.
  {
    path: '/admin/source-papers',
    name: 'm04.source-papers.list',
    component: () => import('./pages/SourcePaperListPage.vue'),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Sumber Kertas - Admin Panel',
      header: { title: 'Sumber Kertas', subtitle: 'Registri provenance kertas peperiksaan' },
      module: 'M04',
    },
  },
  {
    path: '/admin/source-papers/:id(\\d+)',
    name: 'm04.source-papers.detail',
    component: () => import('./pages/SourcePaperDetailPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Butiran Sumber Kertas - Admin Panel',
      header: { title: 'Butiran Sumber Kertas', subtitle: 'Provenance + soalan yang diimport (draf)' },
      module: 'M04',
    },
  },
]

export default routes
