import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

import { isHttpMode } from '@/api/mode'
import type { LayoutMode } from '@/app/router/meta'
import { useSessionStore } from '@/stores'
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
  /**
   * The index route renders the school detail of the viewer's own school instead of the national
   * overview (R1-GUR-10, FR-GUR-10-1). An admin opening it goes to `adminRedirect`.
   */
  ownSchool?: boolean
  adminRedirect?: string
}

// http mode: ids are strings on the wire (never parsed), kept as-is; mock mode keeps numbers
const routeId = (route: RouteLocationNormalized, key: string): number | string => {
  const value = route.params[key]
  return isHttpMode() ? String(value) : Number(value)
}

export function monitoringRoutes({
  name,
  prefix,
  layout,
  roles,
  ownSchool = false,
  adminRedirect = '/admin/monitoring',
}: MountOptions): RouteRecordRaw[] {
  const meta = {
    layout,
    access: 'auth' as const,
    roles,
    module: 'M11' as const,
    v2: true,
  }
  return [
    ownSchool
      ? {
          path: prefix,
          name,
          component: () => import('../pages/MonitoringSchoolPage.vue'),
          props: () => ({ basePath: prefix }),
          // An admin has the national overview under `/admin/monitoring` (R1-ADM-M-03).
          beforeEnter: () => (useSessionStore().user?.role === 'admin' ? adminRedirect : true),
          meta: { ...meta, title: 'Detail Sekolah', header: { title: 'Detail Sekolah' } },
        }
      : {
          path: prefix,
          name,
          component: () => import('../pages/MonitoringPage.vue'),
          props: () => ({ basePath: prefix }),
          meta: {
            ...meta,
            title: 'Monitoring Penglibatan Sekolah - Admin',
            header: {
              title: 'Monitoring Penglibatan',
              subtitle: 'Pantau penglibatan sekolah & pelajar dalam platform',
            },
          },
        },
    {
      path: `${prefix}/sekolah/:schoolId(\\d+)`,
      name: `${name}-sekolah`,
      component: () => import('../pages/MonitoringSchoolPage.vue'),
      props: (route) => ({ basePath: prefix, schoolId: routeId(route, 'schoolId') }),
      meta: { ...meta, title: 'Monitoring', header: { title: 'Detail Sekolah' } },
    },
    {
      path: `${prefix}/sekolah/:schoolId(\\d+)/pelajar/:userId(\\d+)`,
      name: `${name}-pelajar`,
      component: () => import('../pages/MonitoringStudentPage.vue'),
      props: (route) => ({
        basePath: prefix,
        schoolId: routeId(route, 'schoolId'),
        userId: routeId(route, 'userId'),
      }),
      meta: { ...meta, title: 'Detail Pelajar', header: { title: 'Detail Pelajar' } },
    },
    {
      path: `${prefix}/sekolah/:schoolId(\\d+)/guru/:userId(\\d+)`,
      name: `${name}-guru`,
      component: () => import('../pages/MonitoringTeacherPage.vue'),
      props: (route) => ({
        basePath: prefix,
        schoolId: routeId(route, 'schoolId'),
        userId: routeId(route, 'userId'),
      }),
      meta: { ...meta, title: 'Detail Guru', header: { title: 'Detail Guru' } },
    },
  ]
}

const routes: RouteRecordRaw[] = [
  ...monitoringRoutes({
    name: 'guru-monitoring',
    prefix: '/guru/monitoring',
    layout: 'admin',
    roles: ['teacher', 'admin'],
    ownSchool: true,
  }),
  ...monitoringRoutes({
    name: 'admin-sekolah-monitoring',
    prefix: '/admin-sekolah/monitoring',
    layout: 'user',
    roles: ['school_admin'],
  }),
]

export default routes
