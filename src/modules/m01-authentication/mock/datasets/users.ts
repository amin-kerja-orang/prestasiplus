/**
 * The `users` virtual dataset (owner M01, with the M02 admin extensions; D11/D12, overview §6.6,
 * §6.7; M02 SRS v1.18 §6.15 B–D, X-9).
 *
 * - Generated ids 1–6,000 (INFERRED ceiling above the live 5,159); runtime users get ids from
 *   9,000,001 (`floor`, M02 X-9 / M01 BR-24).
 * - Facets `role`, `isActive`, `isComplimentary`, `schoolId`, `grade`, `hasLoggedIn`, `pool`: every
 *   count of M02 S1, M11, M17 and M18 is a sum of cells.
 * - Cheap fields `name`, `email` (the S1 admin search and the login lookup; both `searchFields`),
 *   `createdAt` (newest first, `order`), `lastLoginAt`, `lastActiveAt` (v1.23), `classLevel`.
 *
 * Bump the M01 plugin `version` whenever this spec, `derive` or a cheap field changes (§6.9).
 */

import { ID_RANGES, floor } from '@/mock/define'
import { defineVirtualDataset } from '@/mock/dataset'

import { compiledActivity } from './users-activity'
import { USER_ANCHOR_ROWS } from './users-anchors'
import {
  classLevelOf,
  deriveUserFields,
  generatedLastLoginAt,
  generatedUserCreatedAt,
  generatedUserEmail,
  generatedUserName,
} from './users-derive'
import { usersDistribution, USERS_TOTAL } from './users-spec'
import type { UserCheapKey, UserFacetKey, UserRow } from './users-types'

export const USER_FACETS: readonly UserFacetKey[] = [
  'role',
  'isActive',
  'isComplimentary',
  'schoolId',
  'grade',
  'hasLoggedIn',
  'pool',
]

export const usersDataset = defineVirtualDataset<UserRow, UserFacetKey, UserCheapKey>({
  name: 'users',
  owner: 'M01',
  total: USERS_TOTAL,
  idRange: { min: ID_RANGES.usersGenerated.min, max: ID_RANGES.usersGenerated.max },
  runtimeIds: floor({ start: ID_RANGES.usersRuntimeFloor }),
  facets: USER_FACETS,
  distribution: usersDistribution,
  derive: (id, facets) => deriveUserFields(id, facets),
  fields: {
    name: (key, f) => generatedUserName(key, f.role),
    email: (key, f) => generatedUserEmail(key, f.role),
    createdAt: (key) => generatedUserCreatedAt(key),
    lastLoginAt: (key, f) => generatedLastLoginAt(key, f),
    // The seeded M18 activity date where compiled (M01 finalise), else = lastLoginAt (v1.23).
    lastActiveAt: (key, f) => {
      const seeded = compiledActivity(key)
      return seeded.has ? seeded.value : generatedLastLoginAt(key, f)
    },
    classLevel: (_key, f) => classLevelOf(f.grade),
  },
  searchFields: ['name', 'email'],
  anchors: USER_ANCHOR_ROWS,
  order: { field: 'createdAt', generated: generatedUserCreatedAt },
})
