import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { PKSK_ADMIN_COMPONENT_SCHEMAS, registerPkskAdminPaths } from './admin-paths'
import { PKSK_SHARED_COMPONENT_SCHEMAS } from './shared'
import { PKSK_STUDENT_COMPONENT_SCHEMAS, registerPkskStudentPaths } from './student-paths'

/** BE-42: every PKSK component (shared, student and admin). */
export const PKSK_COMPONENT_SCHEMAS = {
  ...PKSK_SHARED_COMPONENT_SCHEMAS,
  ...PKSK_STUDENT_COMPONENT_SCHEMAS,
  ...PKSK_ADMIN_COMPONENT_SCHEMAS,
} as const

export function registerPkskPaths(registry: OpenAPIRegistry): void {
  registerPkskStudentPaths(registry)
  registerPkskAdminPaths(registry)
}
