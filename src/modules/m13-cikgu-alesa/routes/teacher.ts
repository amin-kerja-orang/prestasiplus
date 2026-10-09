import type { RouteMeta, RouteRecordRaw } from 'vue-router'

/**
 * M13 route fragment: the teacher-only paths S2 to S6 and the proposed views V1 / V2 (SRS M13 v1.1
 * §2, FR-M13-06, 07, 47, 48). Guard: teacher and admin; any other role goes to its landing page, a
 * guest to `/login`. Headers and tab titles are the live ones (URS FN-M13-1.1.5, 1.1.6). The id of
 * V1 / V2 is numeric only (`\d+`): `/cikgu/rph/abc` matches nothing and is the catch-all 404 (S7);
 * an unknown or foreign numeric id is raised by the page (404 outcome). `/cikgu/rph/baharu` is
 * declared before the id route and cannot be confused with it (digits only).
 */
const roles: RouteMeta['roles'] = ['teacher', 'admin']

function meta(title: string, header: string): RouteMeta {
  return {
    layout: 'user',
    access: 'auth',
    roles,
    title,
    header: { title: header, subtitle: 'Selamat datang kembali' },
    module: 'M13',
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/cikgu/rph',
    name: 'cikgu-rph',
    component: () => import('../pages/RphListPage.vue'),
    meta: meta('RPH — Cikgu Alesa', 'Rancangan Pengajaran Harian (RPH)'),
  },
  {
    path: '/cikgu/rph/baharu',
    name: 'cikgu-rph-baharu',
    component: () => import('../pages/RphFormPage.vue'),
    meta: meta('Jana RPH Baharu', 'Jana RPH dengan Cikgu Alesa'),
  },
  {
    path: '/cikgu/rph/:id(\\d+)',
    name: 'cikgu-rph-view',
    component: () => import('../pages/RphViewPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: meta('RPH — Cikgu Alesa', 'Rancangan Pengajaran Harian (RPH)'),
  },
  {
    path: '/cikgu/essay',
    name: 'cikgu-essay',
    component: () => import('../pages/EssayListPage.vue'),
    meta: meta('Marking Karangan', 'Marking Karangan AI'),
  },
  {
    path: '/cikgu/essay/baharu',
    name: 'cikgu-essay-baharu',
    component: () => import('../pages/EssayFormPage.vue'),
    meta: meta('Mark Karangan Baharu', 'Mark Karangan Baharu'),
  },
  {
    path: '/cikgu/essay/:id(\\d+)',
    name: 'cikgu-essay-view',
    component: () => import('../pages/EssayViewPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: meta('Marking Karangan', 'Marking Karangan AI'),
  },
  {
    path: '/cikgu/pbd',
    name: 'cikgu-pbd',
    component: () => import('../pages/PbdQueuePage.vue'),
    meta: meta('PBD Auto-Tag Queue', 'PBD Auto-Tag — Antrian Semakan'),
  },
]

export default routes
