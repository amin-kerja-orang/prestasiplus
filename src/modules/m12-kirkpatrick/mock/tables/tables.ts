/**
 * Materialised M12 tables (SRS M12 v1.6 §6.2-§6.4, §6.6). Feedback ids are seeded 1-336 and runtime ids start at
 * 1,001; interventions start at 1 (the live list is empty); the score tables use the school / user id as id.
 */

import { defineTable, floor, maxPlusOne } from '@/mock/define'

import type {
  AlesaStoredRow,
  ConsistencyRow,
  FeedbackRow,
  InterventionRowStored,
  SchoolScoreRow,
} from '../types'

export const feedbackTable = defineTable<FeedbackRow>({
  name: 'kirkpatrick.feedback',
  ids: floor({ start: 1001 }),
  indexes: ['userId', 'role', 'month', 'schoolId'],
})

export const interventionsTable = defineTable<InterventionRowStored>({
  name: 'kirkpatrick.interventions',
  ids: maxPlusOne(),
  indexes: ['studentId'],
})

export const schoolScoresTable = defineTable<SchoolScoreRow>({
  name: 'kirkpatrick.schoolScores',
  ids: maxPlusOne(),
})

export const alesaTable = defineTable<AlesaStoredRow>({
  name: 'kirkpatrick.alesaPredictions',
  ids: maxPlusOne(),
  indexes: ['scope'],
})

export const consistencyTable = defineTable<ConsistencyRow>({
  name: 'kirkpatrick.studentConsistency',
  ids: maxPlusOne(),
})

/** Every M12 table, for the plugin's `tables`. */
export const M12_TABLES = {
  feedback: feedbackTable,
  interventions: interventionsTable,
  schoolScores: schoolScoresTable,
  alesaPredictions: alesaTable,
  studentConsistency: consistencyTable,
} as const
