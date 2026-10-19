/**
 * M02-T1 seeds (SRS v1.28 §6.14): the parent↔student links, the S16 package rows and the fixture config.
 *
 * | Table | Rows |
 * |---|---|
 * | `users.parentLinks` | 1: parent 6 → student 2; 2: parent 6 → student 4 (canonical accounts, OBSERVED design of §6.14); parent 5401 has none |
 * | `users.schoolAdminPackages` | 1: school admin 5601, T4 (package 1), quota 150 (§6.14 "5601 has T4 assigned (quota 150)"); school admin 8 and every other admin have none |
 *
 * The link and package dates are designed (the SRS gives none): the canonical accounts' creation time
 * and 2026-05-12 10:00 MYT. Bump the M02 plugin `version` when they change.
 */

import type { SeedContext } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { seedAdminConfig } from '../handlers/admin-config'
import { parentLinksRepo, type ParentLinkRow } from '../handlers/parent-links-store'
import {
  PACKAGE_QUOTA_MAX,
  PACKAGE_QUOTA_MIN,
  schoolAdminPackagesRepo,
  type SchoolAdminPackageRow,
} from '../handlers/school-admin-packages-store'

const CANONICAL_CREATED_AT = '2026-02-06T09:00:00+08:00'

export const SEED_PARENT_LINKS: readonly ParentLinkRow[] = Object.freeze([
  { id: 1, parentId: 6, studentId: 2, createdAt: CANONICAL_CREATED_AT },
  { id: 2, parentId: 6, studentId: 4, createdAt: CANONICAL_CREATED_AT },
])

export const SEED_SCHOOL_ADMIN_PACKAGES: readonly SchoolAdminPackageRow[] = Object.freeze([
  {
    id: 1,
    userId: 5601,
    formLevel: 't4',
    packageId: 1,
    studentQuota: 150,
    assignedAt: '2026-05-12T10:00:00+08:00',
  },
])

/** Seed phase. */
export function seedUsersAdmin(ctx: SeedContext): void {
  parentLinksRepo.seedRows(SEED_PARENT_LINKS)
  schoolAdminPackagesRepo.seedRows(SEED_SCHOOL_ADMIN_PACKAGES)
  seedAdminConfig(ctx.config)
}

/** Finalise phase: the seeded rows point at users of the right role (returns the problems found). */
export function checkUsersAdmin(): string[] {
  const issues: string[] = []
  for (const link of parentLinksRepo.all()) {
    if (users.get(link.parentId)?.role !== 'parent')
      issues.push(`parent link ${String(link.id)}: user ${String(link.parentId)} is not a parent`)
    if (users.get(link.studentId)?.role !== 'student')
      issues.push(`parent link ${String(link.id)}: user ${String(link.studentId)} is not a student`)
  }
  for (const row of SEED_SCHOOL_ADMIN_PACKAGES) {
    if (users.get(row.userId)?.role !== 'school_admin')
      issues.push(
        `school admin package ${String(row.id)}: user ${String(row.userId)} is not a school admin`,
      )
    if (row.studentQuota < PACKAGE_QUOTA_MIN || row.studentQuota > PACKAGE_QUOTA_MAX)
      issues.push(`school admin package ${String(row.id)}: quota out of range`)
  }
  return issues
}
