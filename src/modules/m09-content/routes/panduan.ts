import type { RouteRecordRaw } from 'vue-router'

/**
 * M09 route fragment: S26 and S27 (M09-T5). Both are standalone pages (no shell) with the exact tab
 * title "Panduan Pengguna — PRESTASIPLUS". `/panduan` is public (hash anchors `#pelajar`, `#guru`,
 * `#ibubapa`, `#admin`, `#ppd`); `/pusat-tuisyen/panduan` needs a session (a guest goes to `/login`).
 */
const TITLE = 'Panduan Pengguna — PRESTASIPLUS'

const routes: RouteRecordRaw[] = [
  {
    path: '/panduan',
    name: 'm09.panduan',
    component: () => import('../pages/PanduanPage.vue'),
    meta: { layout: 'bare', access: 'public', title: TITLE, module: 'M09' },
  },
  {
    path: '/pusat-tuisyen/panduan',
    name: 'm09.panduan.tuisyen',
    component: () => import('../pages/PanduanPage.vue'),
    meta: { layout: 'bare', access: 'auth', title: TITLE, module: 'M09' },
  },
]

export default routes
