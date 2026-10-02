/**
 * API shapes of the M02 admin user endpoints (SRS §6.1): `AdminUserListItem`, `AdminUserDetail` and the
 * `StudentSearchItem` of the student search. Explicit field lists (an allow-list), so a field added to
 * the users store later is never leaked by accident. Only the detail returns the IC (DV-M02-16).
 */

import { landingPathFor } from '@/mock/auth/landing'
import { isSessionUser, users, type UserRow } from '@/modules/m01-authentication/mock'

import type { AdminUserDetail, AdminUserListItem, StudentSearchItem } from '../../api/users'
import { schoolsRepo } from '../repository/schools'
import { parentLinksRepo } from './parent-links-store'

function schoolName(id: number | null): string | null {
  return id === null ? null : (schoolsRepo.get(id)?.name ?? null)
}

export function toListItem(row: UserRow): AdminUserListItem {
  const name = schoolName(row.schoolId)
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    school: row.schoolId !== null && name !== null ? { id: row.schoolId, name } : null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    avatarUrl: row.avatarUrl,
  }
}

export function toStudentItem(row: UserRow): StudentSearchItem {
  return {
    id: row.id,
    name: row.name,
    classLevel: row.classLevel,
    schoolName: schoolName(row.schoolId),
  }
}

/** The children linked to a parent, in link order (links to a user that no longer exists are skipped). */
export function linkedStudents(parentId: number): StudentSearchItem[] {
  return parentLinksRepo.studentIdsOf(parentId).flatMap((id) => {
    const row = users.get(id)
    return row ? [toStudentItem(row)] : []
  })
}

export function toDetail(row: UserRow): AdminUserDetail {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    grade: row.grade,
    schoolId: row.schoolId,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
    school: row.schoolId === null ? null : schoolsRepo.summary(row.schoolId),
    landingPath: isSessionUser(row) ? landingPathFor(row.role) : null,
    icNumber: users.adminIcNumber(row.id),
    isActive: row.isActive,
    subscriptionPackage: row.subscriptionPackage,
    hasPkskSubscription: row.hasPkskSubscription,
    ppdState: row.ppdState,
    ppdDistrict: row.ppdDistrict,
    linkedStudents: row.role === 'parent' ? linkedStudents(row.id) : [],
  }
}
