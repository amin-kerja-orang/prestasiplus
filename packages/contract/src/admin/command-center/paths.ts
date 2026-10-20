import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS, registerCommandCenterAdminPaths } from './admin-paths'
import { COMMAND_CENTER_GURU_COMPONENT_SCHEMAS, registerCommandCenterGuruPaths } from './guru-paths'

/** BE-22: every Command Center component (M17 admin/school and M10 teacher). */
export const COMMAND_CENTER_COMPONENT_SCHEMAS = {
  ...COMMAND_CENTER_ADMIN_COMPONENT_SCHEMAS,
  ...COMMAND_CENTER_GURU_COMPONENT_SCHEMAS,
} as const

export function registerCommandCenterPaths(registry: OpenAPIRegistry): void {
  registerCommandCenterAdminPaths(registry)
  registerCommandCenterGuruPaths(registry)
}
