import type { Role } from '@/stores/session-types'

import type { KirkpatrickMount } from './mount'

/**
 * Roles of the S2-S8 routes: exactly the roles of the mount (`/admin-sekolah/kirkpatrick` allows only the school
 * administrator). Any role a route does not allow is redirected to its landing page, as for M10 and M11 (build
 * lead decision).
 */
export function rolesOf(mount: KirkpatrickMount): readonly Role[] {
  return mount.roles
}
