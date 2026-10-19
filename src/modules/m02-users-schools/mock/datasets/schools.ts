/**
 * The `schools` virtual dataset (owner M02; D11, overview §6.6; SRS v1.18 §6.15 A).
 *
 * - Generated ids 1–10,300 (live ids observed 1 … 10,220; INFERRED ceiling), reserved anchor range
 *   900001–900099 for the fictitious fixture schools, runtime ids `floor` from 10,301 (the allocator
 *   skips the reserved range, overview §6.5).
 * - Facets `state`, `district`, `type`, `isActive` (every S9 / search filter).
 * - Cheap fields `name`, `code`, `createdAt` (search, sort); `name` and `code` are the list-screen
 *   search fields (`searchFields`), so `GET /api/schools/search` and S9 search stay within the
 *   50 ms budget (build-plan F-23, overview §6.6 v1.5).
 *
 * Bump the M02 plugin `version` whenever this spec, `derive` or a cheap field changes (§6.9).
 */

import { ID_RANGES, floor } from '@/mock/define'
import { defineVirtualDataset } from '@/mock/dataset'

import type { School, SchoolCheapKey, SchoolFacetKey } from '../repository/types'
import { SCHOOL_ANCHOR_ROWS } from './schools-anchors'
import {
  generatedSchoolCode,
  generatedSchoolCreatedAt,
  generatedSchoolName,
} from './schools-derive'
import { schoolsDistribution, SCHOOLS_TOTAL } from './schools-spec'

export const SCHOOL_FACETS: readonly SchoolFacetKey[] = ['state', 'district', 'type', 'isActive']

export const SCHOOLS_ID_RANGE = { min: 1, max: 10_300 } as const

export const schoolsDataset = defineVirtualDataset<School, SchoolFacetKey, SchoolCheapKey>({
  name: 'schools',
  owner: 'M02',
  total: SCHOOLS_TOTAL,
  idRange: SCHOOLS_ID_RANGE,
  reservedAnchorRanges: [[ID_RANGES.schoolsReserved.min, ID_RANGES.schoolsReserved.max]],
  runtimeIds: floor({ start: ID_RANGES.schoolsRuntimeFloor }),
  facets: SCHOOL_FACETS,
  distribution: schoolsDistribution,
  derive: (id) => ({ city: null, updatedAt: generatedSchoolCreatedAt(id) }),
  fields: {
    name: (key, f) => generatedSchoolName(key, f.type),
    code: (key, f) => generatedSchoolCode(key, f),
    createdAt: (key) => generatedSchoolCreatedAt(key),
  },
  searchFields: ['name', 'code'],
  anchors: SCHOOL_ANCHOR_ROWS,
})
