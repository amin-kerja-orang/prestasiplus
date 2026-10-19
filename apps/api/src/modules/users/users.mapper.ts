import {
  SCHOOL_TYPES,
  type AdminUserDetail,
  type AdminUserListItem,
  type RoleCode,
  type SchoolSummary,
  type StudentSearchItem,
} from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { LANDING_PATHS } from '../auth/session-view'
import { classLevelOfGrade } from './class-level'
import type { StudentRow, UserRecord } from './users.repository'

/** What the mapper needs of a school (a structural subset of `SchoolRow`). */
export interface SchoolLike {
  id: string
  name: string
  code: string | null
  type: string | null
  state: string | null
  district: string | null
  city: string | null
}

/**
 * The contract `SchoolSummary`. `type` and `state` are required on the wire; a migrated school that
 * lacks one cannot be shown as a summary, so `school` is null for it (the `schoolId` stays).
 */
export function toSchoolSummary(s: SchoolLike | null | undefined): SchoolSummary | null {
  if (!s || !s.state || !s.type || !(SCHOOL_TYPES as readonly string[]).includes(s.type)) return null
  return {
    id: s.id,
    name: s.name,
    code: s.code ?? '',
    type: s.type as SchoolSummary['type'],
    state: s.state,
    district: s.district,
    city: s.city,
  }
}

export function toListItem(u: UserRecord, schoolName: string | undefined): AdminUserListItem {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    phone: u.phone,
    roles: u.roles as AdminUserListItem['roles'],
    school: u.schoolId !== null && schoolName !== undefined ? { id: u.schoolId, name: schoolName } : null,
    isActive: u.isActive,
    isSuspended: u.isSuspended,
    createdAt: toMytTimestamp(u.createdAt),
    avatarUrl: null,
  }
}

/** Landing path of the highest role (the account must hold a role set that can hold a session). */
function landingPathOf(roles: readonly RoleCode[]): string | null {
  if (roles.length === 0) return null
  if (roles.length > 1 && (roles.includes('student') || roles.includes('admin'))) return null
  const first = roles[0]
  return first ? LANDING_PATHS[first] : null
}

export function toStudentItem(s: StudentRow, schoolName: string | null | undefined): StudentSearchItem {
  return {
    id: s.id,
    name: s.name,
    classLevel: classLevelOfGrade(s.grade),
    ...(schoolName !== undefined ? { schoolName } : {}),
  }
}

export interface DetailParts {
  user: UserRecord
  school: SchoolLike | null
}

/**
 * `AdminUserDetail`. A school_admin's PPD state/district come from its school (mock BR-09); a
 * ppd_officer's from its district scope row. The subscription is derived by BE-25 (tables do not
 * exist yet), so every account reads `none` / false here. `linkedStudents` is [] until BE-25 adds
 * the parent links.
 */
export function toDetail({ user: u, school }: DetailParts): AdminUserDetail {
  const ppd = u.roles.includes('ppd_officer')
    ? u.ppd
    : u.roles.includes('school_admin') && school?.state
      ? { state: school.state, district: school.district ?? '' }
      : null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    phone: u.phone,
    roles: u.roles as AdminUserDetail['roles'],
    grade: u.grade,
    schoolId: u.schoolId,
    bio: u.bio,
    avatarUrl: null,
    createdAt: toMytTimestamp(u.createdAt),
    updatedAt: toMytTimestamp(u.updatedAt),
    lastLoginAt: u.lastLoginAt ? toMytTimestamp(u.lastLoginAt) : null,
    school: toSchoolSummary(school),
    landingPath: landingPathOf(u.roles),
    icMasked: u.icMasked as AdminUserDetail['icMasked'],
    isActive: u.isActive,
    isSuspended: u.isSuspended,
    subscriptionPackage: 'none',
    hasPkskSubscription: false,
    mustChangePassword: u.mustChangePassword,
    ppdState: ppd?.state ?? null,
    ppdDistrict: ppd?.district ? ppd.district : null,
    linkedStudents: [],
  }
}
