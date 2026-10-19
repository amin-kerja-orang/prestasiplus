import type { RouteRecordRaw } from 'vue-router'

import { JEMPUT_PATH } from '../lib/jemput'

/**
 * M02 route fragment: L45 S1 Jemput Ibu Bapa (FR-L45-01..04). Student only, user shell: a guest goes
 * to `/login`, any other role sees the global 403 page in place (`onForbidden: '403'`). Tab title and
 * shell header are PROPOSED copy (SRS §2).
 */
const routes: RouteRecordRaw[] = [
  {
    path: JEMPUT_PATH,
    name: 'm02.jemput-ibu-bapa',
    component: () => import('../pages/JemputIbuBapaPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      roles: ['student'],
      onForbidden: '403',
      title: 'Jemput Ibu Bapa - PRESTASIPLUS',
      header: {
        title: 'Jemput Ibu Bapa',
        subtitle: 'Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda',
      },
      module: 'M02',
      v2: true,
    },
  },
]

export default routes
