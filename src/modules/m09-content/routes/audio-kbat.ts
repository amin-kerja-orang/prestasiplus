import type { RouteRecordRaw } from 'vue-router'

import { AUDIO_KBAT_ROUTES } from '../lib/audio-kbat'

/**
 * M09 route fragment: S21 `/audio-kbat` and the provisional player `/audio-kbat/:id` (M09-T4a;
 * route INFERRED, SRS L-3). User shell for every logged-in role (FR-M09-123); a guest is sent to
 * `/login` by the guard (FR-M09-124). Header = route title, no subtitle (DV-M09-08, DV-SH-03).
 */
const meta = {
  layout: 'user' as const,
  access: 'auth' as const,
  title: 'Audio KBAT',
  header: { title: 'Audio KBAT' },
  module: 'M09' as const,
}

const routes: RouteRecordRaw[] = [
  {
    path: '/audio-kbat',
    name: AUDIO_KBAT_ROUTES.list,
    component: () => import('../pages/AudioKbatListPage.vue'),
    meta,
  },
  {
    path: '/audio-kbat/:id(\\d+)',
    name: AUDIO_KBAT_ROUTES.player,
    component: () => import('../pages/AudioKbatPlayerPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta,
  },
]

export default routes
