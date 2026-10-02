import type { RouteRecordRaw } from 'vue-router'

import { IMPORT_HISTORY_PATH, IMPORT_PATH, IMPORT_ROUTES } from '../lib/import-quality'

/**
 * M04 route fragment: S5 import, S5h import history (M04-T5; build-plan §S.3 rule 2). Admin only
 * (`/admin/*`, admin shell). Tab titles are exact (SRS §2); S5 keeps its live shell header and subtitle,
 * S5h has a title only (FR-M04-107, DV-M04-02).
 */
const routes: RouteRecordRaw[] = [
  {
    path: IMPORT_PATH,
    name: IMPORT_ROUTES.import,
    component: () => import('../pages/QuestionImportPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Import Soalan',
      header: {
        title: 'Import Soalan Secara Pukal',
        subtitle: 'Muat naik fail CSV untuk menambah soalan secara pukal',
      },
      module: 'M04',
    },
  },
  {
    path: IMPORT_HISTORY_PATH,
    name: IMPORT_ROUTES.history,
    component: () => import('../pages/ImportHistoryPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Sejarah Import',
      header: { title: 'Sejarah Import' },
      module: 'M04',
    },
  },
]

export default routes
