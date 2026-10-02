import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: S7 Profil Saya, S8 Kemaskini Profil (M01-T6). Both need a session, any role,
 * and render in the user shell (FR-M01-38, 39). Tab titles and shell headers are exact (§2, §3).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/profile',
    name: 'm01.profile',
    component: () => import('../pages/ProfilePage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Profil Saya - PRESTASIPLUS',
      header: { title: 'Profil Saya', subtitle: 'Statistik & Pencapaian Anda' },
      module: 'M01',
    },
  },
  {
    path: '/profile/edit',
    name: 'm01.profile.edit',
    component: () => import('../pages/ProfileEditPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kemaskini Profil - PRESTASIPLUS',
      header: { title: 'Kemaskini Profil', subtitle: 'Maklumat peribadi & sekolah anda' },
      module: 'M01',
    },
  },
]

export default routes
