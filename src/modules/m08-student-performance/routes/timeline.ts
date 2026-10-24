import type { RouteRecordRaw } from 'vue-router'

/**
 * M08 route fragment "timeline" (M08-T3): S16 `/timeline` "Garis Masa Saya" and S17 `/timeline/create` "Post
 * Baru" in the user shell (every logged-in role, SRS §9), and S18 `/pelajar/{id}` the public profile as a
 * `bare` page open to a guest (its own top bar, no shell). `/timeline/{id}` has no route on purpose: it falls
 * to the catch-all 404 page (DV-24; live answers 405). The S18 path is digits only, so `/pelajar/abc` is the
 * 404 page too; its tab title is set from the loaded name ("{nama} — Pelajar PRESTASIPLUS").
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/timeline',
    name: 'm08.timeline',
    component: () => import('../pages/TimelinePage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Garis Masa Saya - PRESTASIPLUS',
      header: { title: 'Garis Masa Saya', subtitle: 'Kongsi pencapaian & cerita anda' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/timeline/create',
    name: 'm08.timeline.create',
    component: () => import('../pages/TimelineCreatePage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Tambah Hantaran - Garis Masa',
      header: { title: 'Tambah Hantaran', subtitle: 'Kongsi pencapaian atau cerita baru' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/pelajar/:id(\\d+)',
    name: 'm08.pelajar.public',
    component: () => import('../pages/PublicProfilePage.vue'),
    meta: { layout: 'bare', access: 'public', title: 'Pelajar PRESTASIPLUS', module: 'M08', v2: true },
  },
]

export default routes
