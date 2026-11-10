import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { ADMIN_CENTRAL_COMPONENT_SCHEMAS, COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS, registerAdminCentralPaths, registerCommandCenterAdminPaths } from './admin-paths'
import { COMMAND_CENTER_GURU_COMPONENT_SCHEMAS, registerCommandCenterGuruPaths } from './guru-paths'

/** BE-22: every Command Center component (M17 admin/school and M10 teacher), plus the S6-T11 Admin Pusat central screens. */
export const COMMAND_CENTER_COMPONENT_SCHEMAS = {
  ...COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS,
  ...COMMAND_CENTER_GURU_COMPONENT_SCHEMAS,
  ...ADMIN_CENTRAL_COMPONENT_SCHEMAS,
} as const

export function registerCommandCenterPaths(registry: OpenAPIRegistry): void {
  registerCommandCenterAdminPaths(registry)
  registerCommandCenterGuruPaths(registry)
  registerAdminCentralPaths(registry)
}
