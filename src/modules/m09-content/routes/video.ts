import type { RouteRecordRaw } from 'vue-router'

import { PUBLIC_SECTIONS } from '@/shells/public/public-sections'

import { COPY, VIDEO_PATH, VIDEO_ROUTES, VIDEO_TITLES } from '../lib/video'

/**
 * M09 route fragment: S17 to S20 (M09-T3). Exact tab titles and shell headers (SRS §3, URS §1).
 *
 * - S17 `/video` and S18 `/video/:id` are `public-or-user`: guests get the F-20 public layout, the
 *   logged in the user shell. S18 is guest-visible (build-plan L-7, decided in M09-T3).
 * - S20 `/video/tambah` and S19 `/video/:id/edit` need a session (a guest goes to `/login`). S19's
 *   uploader-or-admin rule is applied by the page and the API (403 → landing).
 * - `/video/tambah` is a static segment and is listed before `:id`; ids are digits only, so any other
 *   segment falls to the global 404.
 */
const routes: RouteRecordRaw[] = [
  {
    path: VIDEO_PATH,
    name: VIDEO_ROUTES.list,
    component: () => import('../pages/VideoListPage.vue'),
    meta: {
      layout: 'public-or-user',
      access: 'public',
      title: VIDEO_TITLES.list,
      guestTitle: PUBLIC_SECTIONS.video.guestTitle,
      header: { title: COPY.listTitle, subtitle: COPY.listSubtitle },
      module: 'M09',
    },
  },
  {
    path: `${VIDEO_PATH}/tambah`,
    name: VIDEO_ROUTES.add,
    component: () => import('../pages/VideoFormPage.vue'),
    props: { mode: 'create' },
    meta: {
      layout: 'user',
      access: 'auth',
      title: VIDEO_TITLES.add,
      header: { title: VIDEO_TITLES.add, subtitle: COPY.addHeaderSubtitle },
      module: 'M09',
    },
  },
  {
    path: `${VIDEO_PATH}/:id(\\d+)`,
    name: VIDEO_ROUTES.detail,
    component: () => import('../pages/VideoDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: {
      layout: 'public-or-user',
      access: 'public',
      title: VIDEO_TITLES.detailFallback,
      header: { title: COPY.detailHeader },
      module: 'M09',
    },
  },
  {
    path: `${VIDEO_PATH}/:id(\\d+)/edit`,
    name: VIDEO_ROUTES.edit,
    component: () => import('../pages/VideoFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: Number(route.params.id) }),
    meta: {
      layout: 'user',
      access: 'auth',
      title: VIDEO_TITLES.editFallback,
      header: { title: COPY.editHeader },
      module: 'M09',
    },
  },
]

export default routes
