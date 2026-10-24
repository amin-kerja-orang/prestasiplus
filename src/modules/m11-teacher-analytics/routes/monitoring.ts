import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

import type { LayoutMode } from '@/app/router/meta'
import type { Role } from '@/stores/session-types'

/**
 * M11 route fragment "monitoring" (S2-S5, M11-T3; build-plan §S.3 rule 2).
 *
 * - `/guru/monitoring` and its drill-downs: admin shell (FR-M11-04; the teacher gets the admin chrome
 *   with the teacher menu, shells.md v1.2 §2.6), roles teacher and admin; any other role goes to its
 *   landing page (M10 §7 **T** guard).
 * - `/admin-sekolah/monitoring` and its drill-downs: the school-admin alias in the user shell
 *   (shells.md v1.2); the handlers force the viewer's own school (another school’s ids, and unknown ids, answer 404, which
 *   renders the standalone 404 page in place).
 *
 * The page components take the route prefix as `basePath`; `monitoringRoutes()` builds the four
 * routes for one prefix so M17 can mount `/admin/monitoring` on the same components.
 */

interface MountOptions {
  /** Route name prefix, e.g. `guru-monitoring`. */
  name: string
  /** Mount prefix, e.g. `/guru/monitoring`. */
  prefix: string
  layout: LayoutMode
  roles: readonly Role[]
}

const num = (route: RouteLocationNormalized, key: string) => Number(route.params[key])

export function monitoringRoutes({ name, prefix, layout, roles }: MountOptions): RouteRecordRaw[] {
  const meta = {
    layout,
    access: 'auth' as const,
    roles,
    module: 'M11' as const,
    v2: true,
  }
  return [
    {
      path: prefix,
      name,
      component: () => import('../pages/MonitoringPage.vue'),
      props: () => ({ basePath: prefix }),
      meta: {
        ...meta,
        title: 'Pemantauan Penglibatan Sekolah - Admin',
        header: {
          title: 'Pemantauan Penglibatan',
          subtitle: 'Pantau penglibatan sekolah & pelajar T4/T5 dalam platform',
        },
      },
    },
    {
      path: `${prefix}/sekolah/:schoolId(\\d+)`,
      name: `${name}-sekolah`,
      component: () => import('../pages/MonitoringSchoolPage.vue'),
      props: (route) => ({ basePath: prefix, schoolId: num(route, 'schoolId') }),
      meta: { ...meta, title: 'Pemantauan', header: { title: 'Butiran Sekolah' } },
    },
    {
      path: `${prefix}/sekolah/:schoolId(\\d+)/pelajar/:userId(\\d+)`,
      name: `${name}-pelajar`,
      component: () => import('../pages/MonitoringStudentPage.vue'),
      props: (route) => ({
        basePath: prefix,
        schoolId: num(route, 'schoolId'),
        userId: num(route, 'userId'),
      }),
      meta: { ...meta, title: 'Butiran Pelajar', header: { title: 'Butiran Pelajar' } },
    },
    {
      path: `${prefix}/sekolah/:schoolId(\\d+)/guru/:userId(\\d+)`,
      name: `${name}-guru`,
      component: () => import('../pages/MonitoringTeacherPage.vue'),
      props: (route) => ({
        basePath: prefix,
        schoolId: num(route, 'schoolId'),
        userId: num(route, 'userId'),
      }),
      meta: { ...meta, title: 'Butiran Guru', header: { title: 'Butiran Guru' } },
    },
  ]
}

const routes: RouteRecordRaw[] = [
  ...monitoringRoutes({
    name: 'guru-monitoring',
    prefix: '/guru/monitoring',
    layout: 'admin',
    roles: ['teacher', 'admin'],
  }),
  ...monitoringRoutes({
    name: 'admin-sekolah-monitoring',
    prefix: '/admin-sekolah/monitoring',
    layout: 'user',
    roles: ['school_admin'],
  }),
]

export default routes
