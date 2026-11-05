import type { LayoutMode } from '@/app/router/meta'
import type { Role } from '@/stores/session-types'

/**
 * The mounts of the Kirkpatrick screens (shells.md v1.2; SRS M12 FR-M12-08, 13; S6-T02): the admin panel
 * (admin shell), the `/guru` twin (user shell, teacher and admin) and the school-administrator mount
 * `/admin-sekolah/kirkpatrick` (user shell, all seven screens, the pupil detail and the PDF, data forced to the
 * viewer's school). Shared by the `routes/<group>.ts` fragments.
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
  layout: 'user',
  roles: ['teacher', 'admin'],
}

/** All seven screens plus the pupil detail and the PDF; the API forces the viewer's own school (FR-AS-11-1). */
export const SCHOOL_ADMIN_MOUNT: KirkpatrickMount = {
  name: 'admin-sekolah-kirkpatrick',
  prefix: '/admin-sekolah/kirkpatrick',
  layout: 'user',
  roles: ['school_admin'],
}

/** The admin and teacher mounts. */
export const STAFF_MOUNTS: readonly KirkpatrickMount[] = [ADMIN_MOUNT, GURU_MOUNT]

/** Every mount that carries every screen (S1-S8 and the PDF): the staff mounts and the school administrator's. */
export const ALL_MOUNTS: readonly KirkpatrickMount[] = [...STAFF_MOUNTS, SCHOOL_ADMIN_MOUNT]
