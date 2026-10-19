/**
 * Materialised M07 tables (SRS M07 v1.7 §6). Runtime ids continue after the highest seeded id
 * (`maxPlusOne`): access rows from 4, exam attempts from 3. Practice sessions are not stored here
 * (M05 owns them, BR-M07-26).
 */

import { defineTable, maxPlusOne } from '@/mock/define'

import type {
  PkskAccessRow,
  PkskDomain,
  PkskExamAttemptRow,
  PkskMasteryRow,
  PkskPackage,
  PkskPracticeLoadRow,
} from '../repository/types'

export const domainsTable = defineTable<PkskDomain>({
  name: 'm07.domains',
  ids: maxPlusOne(),
  indexes: ['code', 'bahagian'],
})

export const accessTable = defineTable<PkskAccessRow>({
  name: 'm07.access',
  ids: maxPlusOne(),
  indexes: ['userId'],
})

export const attemptsTable = defineTable<PkskExamAttemptRow>({
  name: 'm07.examAttempts',
  ids: maxPlusOne(),
  indexes: ['userId'],
})

export const masteryTable = defineTable<PkskMasteryRow>({
  name: 'm07.mastery',
  ids: maxPlusOne(),
  indexes: ['userId'],
})

export const practiceLoadsTable = defineTable<PkskPracticeLoadRow>({
  name: 'm07.practiceLoads',
  ids: maxPlusOne(),
  indexes: ['userId'],
})

/** PROVISIONAL: the true owner is M19 (packages); M07 hosts it with the SRS fixture (§6.3). */
export const packagesTable = defineTable<PkskPackage>({
  name: 'm19.pkskPackages',
  ids: maxPlusOne(),
})

export const M07_TABLES = {
  domains: domainsTable,
  access: accessTable,
  examAttempts: attemptsTable,
  mastery: masteryTable,
  practiceLoads: practiceLoadsTable,
}

export const M07_PROVISIONAL_TABLES = { pkskPackages: packagesTable }
