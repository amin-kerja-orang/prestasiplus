import type { RouteRecordRaw } from 'vue-router'

import { IMPORT_ROUTES, QUALITY_PATH } from '../lib/import-quality'

/**
 * M04 route fragment: S6 question quality (M04-T5; build-plan §S.3 rule 2). Admin only, admin shell;
 * the tab title and the shell header with its subtitle are the live ones (SRS §2, FR-M04-107).
 */
const routes: RouteRecordRaw[] = [
  {
    path: QUALITY_PATH,
    name: IMPORT_ROUTES.quality,
    component: () => import('../pages/QuestionQualityPage.vue'),
    meta: {
      layout: 'admin',
      v2: true,
      access: 'auth',
      roles: ['admin'],
      title: 'Kualiti Soalan - Admin',
      header: {
        title: 'Papan Pemuka Kualiti Soalan',
        subtitle: 'Analisa kualiti keseluruhan bank soalan',
      },
      module: 'M04',
    },
  },
]

export default routes
