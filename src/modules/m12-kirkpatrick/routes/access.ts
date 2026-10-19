import type { Role } from '@/stores/session-types'

import type { KirkpatrickMount } from './mount'

/**
 * Roles of the S4-S8 routes (M12-T3/T4): exactly the roles of the mount. On `/admin/kirkpatrick` and on `/guru/kirkpatrick`
 * any role the route does not allow (the school administrator included: its only Kirkpatrick entry is the S1 alias) is
 * redirected to its landing page, as for M10 and M11 (build lead decision).
 */
export function rolesOf(mount: KirkpatrickMount): readonly Role[] {
  return mount.roles
}
