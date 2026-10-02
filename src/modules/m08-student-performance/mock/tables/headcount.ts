/**
 * Materialised headcount stores (SRS M08 v1.12 §6.4; M08-T1b): HeadcountConfig and HeadcountEntry.
 * Seeded ids are explicit (live ids where observed: 209–213, 617); runtime ids start at 9,000,001.
 */

import { defineTable, floor, ID_RANGES } from '@/mock/define'

import type { HeadcountConfigRow, HeadcountEntryRow } from '../repository/headcount-types'

export const headcountConfigsTable = defineTable<HeadcountConfigRow>({
  name: 'm08.headcountConfigs',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
  indexes: ['teacherId', 'classroomId', 'subjectId'],
})

export const headcountEntriesTable = defineTable<HeadcountEntryRow>({
  name: 'm08.headcountEntries',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
  indexes: ['configId', 'studentId'],
})

export const HEADCOUNT_TABLES = {
  headcountConfigs: headcountConfigsTable,
  headcountEntries: headcountEntriesTable,
}
