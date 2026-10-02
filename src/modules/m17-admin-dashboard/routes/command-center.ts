import type { RouteRecordRaw } from 'vue-router'

import type { ForbiddenOutcome } from '@/app/router/meta'
import type { Role } from '@/stores/session-types'

/**
 * M17 route fragment: S2 `/admin/command-center`, S3 `/admin/command-center/daily-activity` (M17-T3, later)
 * and the S4-S7 drill-down (M17-T3a). Teachers reach S4-S7 through the M10 mount (M10-T4, FR-M17-60) and the
 * Admin Sekolah through the alias (SRS §3.2); both call `commandCenterDrillRoutes` with their own prefix.
 */

export interface CommandCenterDrillRouteOptions {
  /** The S2 route of the scope, e.g. `/admin/command-center`; the drill routes sit below it. */
  prefix: string
  /** Unique route-name prefix, e.g. `m17.cc`. */
  namePrefix: string
  /** Roles the scope admits (the guard sends others to `onForbidden`). */
  roles: readonly Role[]
  onForbidden?: ForbiddenOutcome
}

const id = (value: unknown) => Number(value)

/**
 * The four standalone (`bare`) routes S4-S7 under `prefix`: `school/:schoolId`, `school/:schoolId/teacher/:userId`,
 * `classroom/:classroomId`, `student/:userId`. Ids are digits only, so a non-numeric id falls to the global 404
 * (E2E-M17-07). The page tab title is set from the data ("{name} - Command Center").
 */
export function commandCenterDrillRoutes(
  options: CommandCenterDrillRouteOptions,
): RouteRecordRaw[] {
  const { namePrefix, roles } = options
  const prefix = options.prefix.replace(/\/+$/, '')
  const meta = {
    layout: 'bare' as const,
    access: 'auth' as const,
    roles,
    ...(options.onForbidden ? { onForbidden: options.onForbidden } : {}),
    module: 'M17' as const,
  }
  return [
    {
      path: `${prefix}/school/:schoolId(\\d+)`,
      name: `${namePrefix}.school`,
      component: () => import('../pages/CommandCenterSchoolPage.vue'),
      props: (route) => ({ schoolId: id(route.params.schoolId), basePath: prefix }),
      meta,
    },
    {
      path: `${prefix}/school/:schoolId(\\d+)/teacher/:userId(\\d+)`,
      name: `${namePrefix}.teacher`,
      component: () => import('../pages/CommandCenterTeacherPage.vue'),
      props: (route) => ({
        schoolId: id(route.params.schoolId),
        userId: id(route.params.userId),
        basePath: prefix,
      }),
      meta,
    },
    {
      path: `${prefix}/classroom/:classroomId(\\d+)`,
      name: `${namePrefix}.classroom`,
      component: () => import('../pages/CommandCenterClassPage.vue'),
      props: (route) => ({ classroomId: id(route.params.classroomId), basePath: prefix }),
      meta,
    },
    {
      path: `${prefix}/student/:userId(\\d+)`,
      name: `${namePrefix}.student`,
      component: () => import('../pages/CommandCenterStudentPage.vue'),
      props: (route) => ({ userId: id(route.params.userId), basePath: prefix }),
      meta,
    },
  ]
}

/** Admin routes of S4-S7 (`/admin/command-center/...`); S2 and S3 are added by M17-T3. */
const routes: RouteRecordRaw[] = [
  ...commandCenterDrillRoutes({
    prefix: '/admin/command-center',
    namePrefix: 'm17.cc',
    roles: ['admin'],
  }),
]

export default routes
