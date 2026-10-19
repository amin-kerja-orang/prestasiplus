/**
 * Public surface of the S4-S7 Command Center drill-down (M17-T3a, FR-M17-60). The pages are lazy
 * (`defineAsyncComponent`) so importing them from the module entry does not pull them into the importer's
 * chunk. Every page takes `basePath` (the route prefix of the scope: `/admin/command-center`,
 * `/guru/command-center`, `/admin-sekolah/command-center`) and the numeric route ids as props.
 */
import { defineAsyncComponent } from 'vue'

export { ccPaths } from './cc-paths'
export type { CcPaths } from './cc-paths'

export const CommandCenterSchoolPage = defineAsyncComponent(
  () => import('../../pages/CommandCenterSchoolPage.vue'),
)
export const CommandCenterTeacherPage = defineAsyncComponent(
  () => import('../../pages/CommandCenterTeacherPage.vue'),
)
export const CommandCenterClassPage = defineAsyncComponent(
  () => import('../../pages/CommandCenterClassPage.vue'),
)
export const CommandCenterStudentPage = defineAsyncComponent(
  () => import('../../pages/CommandCenterStudentPage.vue'),
)
