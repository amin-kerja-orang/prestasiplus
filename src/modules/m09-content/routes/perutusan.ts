import type { RouteRecordRaw } from 'vue-router'

/**
 * M09 route fragment: S22 `/perutusan`, S24 `/perutusan/tulis`, S25 `/perutusan/saya` and S23
 * `/perutusan/:id` (card S5-T09; R1-AS-2). Readers: teacher, school admin and Admin Pusat (the pupil
 * gets no Perutusan in R1); writers: school admin and Admin Pusat. Order matters: `tulis` and `saya`
 * are declared before the numeric-only `:id` route. Names are the canonical-map keys.
 */
const READERS = ['teacher', 'school_admin', 'admin'] as ['teacher', 'school_admin', 'admin']
const WRITERS = ['school_admin', 'admin'] as ['school_admin', 'admin']

const meta = (
  roles: typeof READERS | typeof WRITERS,
  header: { title: string; subtitle?: string },
) => ({
  layout: 'user' as const,
  access: 'auth' as const,
  roles,
  title: header.title,
  header,
  module: 'M09' as const,
  v2: true as const,
})

const routes: RouteRecordRaw[] = [
  {
    path: '/perutusan',
    name: 'perutusan-list',
    component: () => import('../pages/PerutusanListPage.vue'),
    meta: meta(READERS, {
      title: 'Perutusan Rasmi',
      subtitle: 'Maklumat & berita dari pihak pengurusan',
    }),
  },
  {
    path: '/perutusan/tulis',
    name: 'perutusan-compose',
    component: () => import('../pages/PerutusanComposePage.vue'),
    meta: meta(WRITERS, { title: 'Tulis Perutusan' }),
  },
  {
    path: '/perutusan/saya',
    name: 'perutusan-mine',
    component: () => import('../pages/PerutusanMinePage.vue'),
    meta: meta(WRITERS, { title: 'Perutusan Saya' }),
  },
  {
    path: '/perutusan/:id(\\d+)',
    name: 'perutusan-detail',
    component: () => import('../pages/PerutusanDetailPage.vue'),
    props: (route) => ({ id: Number(route.params.id) }),
    meta: meta(READERS, { title: 'Perutusan' }),
  },
]

export default routes
