import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: L45 S2 `/ibu-bapa/terima/:token` (FR-L45-19..30; XR-L45-05). Public bare
 * (standalone) page. It matches ANY token string, with no hex-only constraint (OBSERVED: `0000`,
 * `zzzz` and 64 zeros all show "Pautan Tidak Sah"). Titles use an em dash (FR-L45-33); the page sets
 * the invalid title once it knows the token is unknown.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/ibu-bapa/terima/:token',
    name: 'm01.parent-invite',
    component: () => import('../pages/ParentInviteAcceptPage.vue'),
    props: (route) => ({ token: String(route.params.token) }),
    meta: {
      layout: 'bare',
      access: 'public',
      title: 'Jemputan Ibu Bapa — PRESTASIPLUS',
      module: 'M01',
    },
  },
]

export default routes
