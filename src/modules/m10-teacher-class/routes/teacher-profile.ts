import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment, S5-T05 part C (R1-GUR-A1; cross-sector S6): "Edit Profil Guru" `/guru/profil/edit` (the teacher
 * only: the API is teacher-only) and the read-only teacher card `/guru/profil/:id` (a teacher, an admin or a school
 * admin: V2 shares it "dengan guru-guru lain"). The static `edit` segment is listed first so it never matches `:id`.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/profil/edit',
    name: 'guru-profil-edit',
    component: () => import('../pages/TeacherProfileEditPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      title: 'Edit Profil Guru — PRESTASIPLUS',
      header: { title: 'Edit Profil Guru' },
      module: 'M10',
      v2: true,
    },
  },
  {
    path: '/guru/profil/:id',
    name: 'guru-profil',
    component: () => import('../pages/TeacherProfilePage.vue'),
    meta: {
      layout: 'role',
      access: 'auth',
      roles: ['teacher', 'admin', 'school_admin'],
      title: 'Profil Guru — PRESTASIPLUS',
      header: { title: 'Profil Guru' },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
