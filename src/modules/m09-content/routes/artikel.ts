import type { RouteRecordRaw } from 'vue-router'

import { PUBLIC_SECTIONS } from '@/shells/public/public-sections'

/**
 * M09 route fragment: S15 `/artikel` and S16 `/artikel/:slug` (M09-T2; SRS §2, FR-M09-22,
 * FR-M09-29, FR-M09-39). Public: a guest gets the public layout (tab "Artikel — PRESTASIPLUS" via
 * `guestTitle`), a logged-in user (any role, including the admin) the user shell with the generic
 * tab title. S16 sets its own shell header (title / "Artikel") from the loaded article; an
 * unknown or unpublished slug renders the in-place 404.
 */
const TAB_TITLE = 'PRESTASIPLUS - Platform Latih Tubi Nasional'

const routes: RouteRecordRaw[] = [
  {
    path: '/artikel',
    name: 'artikel-list',
    component: () => import('../pages/ArtikelListPage.vue'),
    meta: {
      layout: 'public-or-user',
      access: 'public',
      title: TAB_TITLE,
      guestTitle: PUBLIC_SECTIONS.artikel.guestTitle,
      header: {
        title: 'Artikel',
        subtitle: 'Tips belajar, berita pendidikan, motivasi dan panduan',
      },
      module: 'M09',
    },
  },
  {
    path: '/artikel/:slug',
    name: 'artikel-detail',
    component: () => import('../pages/ArtikelDetailPage.vue'),
    props: (route) => ({ slug: String(route.params.slug) }),
    meta: {
      layout: 'public-or-user',
      access: 'public',
      title: TAB_TITLE,
      guestTitle: PUBLIC_SECTIONS.artikel.guestTitle,
      header: { title: 'Artikel' },
      module: 'M09',
    },
  },
]

export default routes
