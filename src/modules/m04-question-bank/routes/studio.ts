import type { RouteRecordRaw } from 'vue-router'

/**
 * M04 route fragment: Studio write side (R1-F03b, T13). Admin Pusat only, admin shell. Paths follow
 * docs/architecture/v2-admin-student-pipeline.md 13.8a (`/admin/studio/questions/create`, `.../:id/sunting`); the group page is
 * new. The Studio list `/admin/studio` (F03a, unit 2b) is here too; the menu entry (shells/pentadbiran/menu.ts) is owned by another lane. Static segments come before the `:id` routes.
 */
const adminMeta = { layout: 'admin', v2: true, access: 'auth', roles: ['admin'], module: 'M04' } as const

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/studio',
    name: 'm04.studio.list',
    component: () => import('../pages/StudioListPage.vue'),
    meta: { ...adminMeta, title: 'Studio', header: { title: 'Studio', subtitle: 'Bank soalan kanonikal - cipta, semak, terbit' } },
  },
  {
    path: '/admin/studio/questions/create',
    name: 'm04.studio.create',
    component: () => import('../pages/StudioEditorPage.vue'),
    meta: { ...adminMeta, title: 'Studio — Cipta soalan', header: { title: 'Studio — Cipta soalan', subtitle: 'Cipta soalan kanonikal dari kosong (draf)' } },
  },
  {
    path: '/admin/studio/questions/:id(\\d+)/sunting',
    name: 'm04.studio.edit',
    component: () => import('../pages/StudioEditorPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: { ...adminMeta, title: 'Studio — Sunting soalan', header: { title: 'Studio — Sunting soalan', subtitle: 'Sunting soalan kanonikal' } },
  },
  {
    path: '/admin/studio/groups/:id(\\d+)',
    name: 'm04.studio.group',
    component: () => import('../pages/StudioGroupPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: { ...adminMeta, title: 'Studio — Kumpulan rangsangan', header: { title: 'Studio — Kumpulan rangsangan', subtitle: 'Satu rangsangan, semua soalan yang merujuknya' } },
  },
]

export default routes
