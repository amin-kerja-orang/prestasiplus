import type { RouteRecordRaw } from 'vue-router'

/**
 * M27 route fragment: S4 `/amaran/sekolah` "Amaran Awal — Sekolah" (SRS M27 Part B v1.8 FR-M27-74, 44; the M27
 * alias of M18 S22: the school comes from the session, the route takes no id). User shell, role `school_admin`
 * only, in-place 403 for other roles, `/login` for a guest. The header sub-line (school name, plus the level
 * suffix) is set by the page. M18's own routes are unchanged.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/amaran/sekolah',
    name: 'm27.amaran-sekolah',
    component: () => import('../pages/AmaranSekolahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['school_admin'],
      onForbidden: '403',
      title: 'Amaran Awal — Sekolah | PRESTASIPLUS',
      header: { title: 'Amaran Awal — Sekolah' },
      module: 'M27',
    },
  },
]

export default routes
