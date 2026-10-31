/**
 * S9 / S10 / S11 static lookups (SRS FR-M02-77, FR-M02-80, BR-21, §6 DATA-M02-04).
 * The mock owns its own copy of the state list (UI code never imports `mock/`).
 */

import type { SchoolType } from '../api/schools-admin'

/** The 16 states and territories, full names, in the live select order (S9 filter, S10/S11 form). */
export const SCHOOL_STATE_OPTIONS: readonly string[] = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
]

/** S10/S11 "Jenis" options (BR-21), in the live order. */
export const SCHOOL_TYPE_OPTIONS: readonly SchoolType[] = ['SMK', 'MRSM', 'SBP']

/** Route names of the three screens (used by links and tests). */
export const SCHOOL_ROUTES = {
  list: 'm02.schools.list',
  create: 'm02.schools.create',
  edit: 'm02.schools.edit',
} as const

export const SCHOOLS_LIST_PATH = '/admin/schools'
