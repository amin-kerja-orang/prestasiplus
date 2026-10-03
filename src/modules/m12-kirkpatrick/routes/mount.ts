import type { LayoutMode } from '@/app/router/meta'
import type { Role } from '@/stores/session-types'

/**
 * The mounts of the Kirkpatrick screens (shells.md v1.2; SRS M12 FR-M12-08, 13): the admin panel, the
 * `/guru` twin (admin shell, teacher and admin; provisional) and, for S1 only, the school-administrator
 * alias in the user shell. Shared by the `routes/<group>.ts` fragments of M12-T2 and M12-T3/T4.
 */
export interface KirkpatrickMount {
  /** Route name prefix. */
  name: string
  /** Mount prefix, also the `basePath` prop of every page. */
  prefix: string
  layout: LayoutMode
  roles: readonly Role[]
}

export const ADMIN_MOUNT: KirkpatrickMount = {
  name: 'admin-kirkpatrick',
  prefix: '/admin/kirkpatrick',
  layout: 'admin',
  roles: ['admin'],
}

export const GURU_MOUNT: KirkpatrickMount = {
  name: 'guru-kirkpatrick',
  prefix: '/guru/kirkpatrick',
  layout: 'admin',
  roles: ['teacher', 'admin'],
}

/** S1 only: the other endpoints answer 403 for a school administrator (G4 decision F6). */
export const SCHOOL_ADMIN_MOUNT: KirkpatrickMount = {
  name: 'admin-sekolah-kirkpatrick',
  prefix: '/admin-sekolah/kirkpatrick',
  layout: 'user',
  roles: ['school_admin'],
}

/** The mounts that carry every screen (S1-S8). */
export const STAFF_MOUNTS: readonly KirkpatrickMount[] = [ADMIN_MOUNT, GURU_MOUNT]
