/**
 * School admin (BE-21): M27 reports and staff / pupil management plus the four M18 Amaran Awal
 * routes (UD-4). Barrel of the contract; the internal helpers of `common.ts` (`count`, `nonBlank`)
 * are deliberately not re-exported.
 */
export {
  SCHOOL_ADMIN_FLASH,
  SCHOOL_ADMIN_MESSAGES,
  SCHOOL_ADMIN_PAGE_SIZE,
  SCHOOL_ADMIN_ROLE_LABEL,
  SchoolAdminSchoolInfoSchema,
  SchoolAdminSchoolRefSchema,
} from './common'
export type { SchoolAdminSchoolInfo, SchoolAdminSchoolRef } from './common'
export * from './reports'
export * from './users'
export * from './teachers'
export * from './pupils'
export * from './amaran'
export * from './pending-teachers'
