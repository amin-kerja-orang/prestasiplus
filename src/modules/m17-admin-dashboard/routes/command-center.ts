import type { RouteRecordRaw } from 'vue-router'

import { isHttpMode } from '@/api/mode'
import type { ForbiddenOutcome } from '@/app/router/meta'
import type { Role } from '@/stores/session-types'

/**
 * M17 route fragment: S2 `/admin/command-center`, S3 `/admin/command-center/daily-activity` (M17-T3b)
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
  /** Render inside the staff shell (the Guru mount); otherwise the page draws its own staff frame (`bare`). */
  shell?: boolean
}

// http mode: ids are digit strings (BE-22, matched by `\d+`), kept as-is; mock mode keeps numbers
const id = (value: unknown): number | string => (isHttpMode() ? String(value) : Number(value))

/**
 * The four routes (standalone `bare` pages that draw their own staff frame, or in the staff shell with `shell`) S4-S7 under `prefix`: `school/:schoolId`, `school/:schoolId/teacher/:userId`,
 * `classroom/:classroomId`, `student/:userId`. Ids are digits only, so a non-numeric id falls to the global 404
 * (E2E-M17-07). The page tab title is set from the data ("{name} - Command Center").
 */
export function commandCenterDrillRoutes(
  options: CommandCenterDrillRouteOptions,
): RouteRecordRaw[] {
  const { namePrefix, roles } = options
  const prefix = options.prefix.replace(/\/+$/, '')
  const meta = {
    layout: options.shell ? ('user' as const) : ('bare' as const),
    v2: true,
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

/**
 * The standalone boards S2 and S3 of one scope (M17-T3b): the admin at `/admin/command-center` and the Admin Sekolah
 * alias at `/admin-sekolah/command-center` (SRS §2 S2-AS, S3-AS). The tab title is the route title (FR-M17-03):
 * "PRESTASIPLUS COMMAND CENTER", "AKTIVITI PLATFORM — PRESTASIPLUS", and "AKTIVITI SEKOLAH — PRESTASIPLUS" for the
 * alias. The alias answers any other role with the in-place 403 page (FR-M17-102); the admin keeps the default
 * redirect to the role's landing page.
 */
function boardRoutes(alias: boolean): RouteRecordRaw[] {
  const prefix = alias ? '/admin-sekolah/command-center' : '/admin/command-center'
  const name = alias ? 'm17.ccsa' : 'm17.cc'
  const meta = {
    // Admin Pusat: `bare` (the Portal Pentadbiran frames it by path); Admin Sekolah: the staff shell (DV-M17-54)
    layout: alias ? ('user' as const) : ('bare' as const),
    v2: true,
    access: 'auth' as const,
    roles: [alias ? 'school_admin' : 'admin'] as readonly Role[],
    ...(alias ? { onForbidden: '403' as const } : {}),
    module: 'M17' as const,
  }
  return [
    {
      path: prefix,
      name: `${name}.board`,
      component: () => import('../pages/CommandCenterBoardPage.vue'),
      props: () => ({ alias }),
      meta: { ...meta, title: 'PRESTASIPLUS COMMAND CENTER' },
    },
    {
      path: `${prefix}/daily-activity`,
      name: `${name}.daily`,
      component: () => import('../pages/CommandCenterDailyPage.vue'),
      props: () => ({ alias }),
      meta: {
        ...meta,
        title: alias ? 'AKTIVITI SEKOLAH — PRESTASIPLUS' : 'AKTIVITI PLATFORM — PRESTASIPLUS',
      },
    },
  ]
}

/** S2, S3 and S4-S7 of the admin, then the same for the Admin Sekolah alias (school scope from the session). */
const routes: RouteRecordRaw[] = [
  ...boardRoutes(false),
  ...commandCenterDrillRoutes({
    prefix: '/admin/command-center',
    namePrefix: 'm17.cc',
    roles: ['admin'],
  }),
  ...boardRoutes(true),
  ...commandCenterDrillRoutes({
    prefix: '/admin-sekolah/command-center',
    namePrefix: 'm17.ccsa',
    roles: ['school_admin'],
    onForbidden: '403',
    shell: true,
  }),
]

export default routes
