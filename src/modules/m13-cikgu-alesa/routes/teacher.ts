import type { RouteRecordRaw } from 'vue-router'

/**
 * M13 route fragment: the teacher-only paths S2 to S6 (SRS M13 v1.1 §2, FR-M13-06, 07). M13-T2
 * registers them with the guard (teacher and admin; any other role goes to its landing page, guest
 * to `/login`) and **no page body** (an empty component): M13-T3 (S2, S3) and M13-T4 (S4, S5, S6)
 * replace the component of their own entries and add V1 / V2. Headers and tab titles are the live
 * ones (URS FN-M13-1.1.5, 1.1.6).
 */
const roles = ['teacher', 'admin'] as const
const component = () => import('../components/NoBody.vue')

function teacherRoute(
  path: string,
  name: string,
  title: string,
  header: string,
): RouteRecordRaw {
  return {
    path,
    name,
    component,
    meta: {
      layout: 'user',
      access: 'auth',
      roles,
      title,
      header: { title: header, subtitle: 'Selamat datang kembali' },
      module: 'M13',
    },
  }
}

const routes: RouteRecordRaw[] = [
  teacherRoute(
    '/cikgu/rph',
    'cikgu-rph',
    'RPH — Cikgu Alesa',
    'Rancangan Pengajaran Harian (RPH)',
  ),
  teacherRoute(
    '/cikgu/rph/baharu',
    'cikgu-rph-baharu',
    'Jana RPH Baharu',
    'Jana RPH dengan Cikgu Alesa',
  ),
  teacherRoute('/cikgu/essay', 'cikgu-essay', 'Marking Karangan', 'Marking Karangan AI'),
  teacherRoute(
    '/cikgu/essay/baharu',
    'cikgu-essay-baharu',
    'Mark Karangan Baharu',
    'Mark Karangan Baharu',
  ),
  teacherRoute(
    '/cikgu/pbd',
    'cikgu-pbd',
    'PBD Auto-Tag Queue',
    'PBD Auto-Tag — Antrian Semakan',
  ),
]

export default routes
