import type { RouteRecordRaw } from 'vue-router'

import { BULK_IMPORT_PATH, IMPORT_ROUTES, STUDENT_IMPORT_PATH } from '../lib/import-options'

/**
 * M02 route fragment: S4 bulk user import, S5 DELIMa student import (M02-T6; FR-M02-51…64). Admin only
 * (`/admin/*`, admin shell). Tab titles and shell headers are exact (SRS §2).
 */
const routes: RouteRecordRaw[] = [
  {
    path: BULK_IMPORT_PATH,
    name: IMPORT_ROUTES.bulk,
    component: () => import('../pages/BulkImportPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Import Pengguna',
      header: {
        title: 'Import Pengguna',
        subtitle:
          'Import pengguna pukal',
      },
      module: 'M02',
      v2: true,
    },
  },
  {
    path: STUDENT_IMPORT_PATH,
    name: IMPORT_ROUTES.students,
    component: () => import('../pages/StudentImportPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: 'Import Pelajar',
      header: {
        title: 'Import Pelajar',
        subtitle: 'Import pelajar',
      },
      module: 'M02',
      v2: true,
    },
  },
]

export default routes
