import type { RouteRecordRaw } from 'vue-router'

import { shellHomePath } from '@/app/prototype-scope'
import type { Role } from '@/stores/session-types'
import { useSessionStore } from '@/stores/session'

/**
 * `/analisa-item` (the sidebar "Analisa Item"; FR-M08-09, OD-R4): admin and teacher → S10, school admin →
 * S9 (the dead-link fix of DV-M08-02, INFERRED), every other role, pelajar included → the role's own home
 * (`shellHomePath`: `/dashboard`, or the student home in http mode; DV-M08-40) without a message (INFERRED,
 * provisional); a guest goes to `/login` as on every M08 route (FR-M08-05).
 */
export function analisaItemTarget(role: string | null): string {
  if (role === null) return '/login'
  if (role === 'admin' || role === 'teacher') return '/analisa-item/kelas'
  if (role === 'school_admin') return '/analisa-item/sekolah'
  return shellHomePath(role as Role)
}

/**
 * Every role except `admin` for the id-less S9 `/analisa-item/sekolah` (SW5-15, DV-M08-50): that route is
 * the viewer's OWN school, and Admin Pusat has none (`GET /api/item-analysis/school` answers 404). The
 * admin reaches a school through `/analisa-item/sekolah/{id}`, which stays open. The other roles keep the
 * API as the judge (own school, else 403).
 */
const ANALISA_SEKOLAH_OWN_ROLES: Role[] = [
  'student',
  'teacher',
  'parent',
  'sponsor',
  'school_admin',
  'ppd_officer',
  'jpn_officer',
]

/**
 * M08 route fragment "analisa-item" (M08-T5; build-plan §S.3 rule 2): the redirect, S9 (own school or
 * `{id}`), S10 and S11. S10 / S11 are admin and teacher only: every other role gets the 403 page
 * in place (FR-M08-08, §9). S9 `{id}` is open to every role and the API decides (scope, else 403); the
 * id-less S9 refuses the admin with the same in-place 403 page (SW5-15, DV-M08-50).
 */
const routes: RouteRecordRaw[] = [
  { path: '/analisa-item', redirect: () => analisaItemTarget(useSessionStore().role) },
  {
    path: '/analisa-item/sekolah',
    name: 'm08.analisa-item.sekolah',
    component: () => import('../pages/AnalisaItemSekolahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ANALISA_SEKOLAH_OWN_ROLES,
      onForbidden: '403',
      title: 'Analisa Item Sekolah | PRESTASIPLUS',
      header: { title: 'Analisa Item — Sekolah' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/analisa-item/sekolah/:id([0-9]+)',
    name: 'm08.analisa-item.sekolah.id',
    component: () => import('../pages/AnalisaItemSekolahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Analisa Item Sekolah | PRESTASIPLUS',
      header: { title: 'Analisa Item — Sekolah' },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/analisa-item/kelas',
    name: 'm08.analisa-item.kelas',
    component: () => import('../pages/AnalisaItemKelasPilihPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['admin', 'teacher'],
      onForbidden: '403',
      title: 'Analisa Item — Papan Guru | PRESTASIPLUS',
      header: {
        title: 'Analisa Item',
        subtitle: 'Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas',
      },
      module: 'M08',
      v2: true,
    },
  },
  {
    path: '/analisa-item/kelas/:id([0-9]+)',
    name: 'm08.analisa-item.kelas.detail',
    component: () => import('../pages/AnalisaItemKelasPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      roles: ['admin', 'teacher'],
      onForbidden: '403',
      title: 'Analisa Item — Papan Guru | PRESTASIPLUS',
      header: {
        title: 'Analisa Item',
        subtitle: 'Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas',
      },
      module: 'M08',
      v2: true,
    },
  },
]

export default routes
