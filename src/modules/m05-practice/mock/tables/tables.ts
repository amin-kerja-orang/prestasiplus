/**
 * Materialised M05 tables (SRS M05 v1.16 §6.3, §6.4, §6.6, §6.7, §6.9, §6.14.3): small per-user
 * stores next to the two virtual datasets. Keys are natural (`userId:questionId`,
 * `userId:subjectId`, `sessionId:questionId`, subject id) so an upsert is one `get` + `insert` /
 * `update`; structured attempts get opaque string ids.
 *
 * - `practice.revisionQueue` (DATA-M05-03): stored for the seeded, anchor and runtime users; for
 *   generated users the queue is derived from the log (§6.14.3).
 * - `practice.mastery` (DATA-M05-11): stored counters (BR-20); users without rows read their log.
 * - `practice.spmTargets` (DATA-M05-04), `practice.structuredAttempts` (DATA-M05-06, M05-T2).
 * - `practice.checks`: the stored answer checks of in-progress sessions (BR-30: one check per
 *   question; submit recomputes from them).
 * - `practice.subjectUsage` (DATA-M05-07 SubjectUsage, S1 "Digunakan", seed 0; URS OQ-12).
 */

import { defineTable, maxPlusOne, opaque } from '@/mock/define'

import type {
  CheckRow,
  MasteryRow,
  QueueRow,
  SpmTargetRow,
  StructuredAttemptRow,
  SubjectUsageRow,
} from '../datasets/types'

/** Natural string keys: inserts always pass the id. */
const naturalKey = () => opaque('k_', 'practice:natural-keys', 12)

export const queueTable = defineTable<QueueRow>({
  name: 'practice.revisionQueue',
  ids: naturalKey(),
  indexes: ['userId'],
})

export const masteryTable = defineTable<MasteryRow>({
  name: 'practice.mastery',
  ids: naturalKey(),
  indexes: ['userId'],
})

export const spmTargetsTable = defineTable<SpmTargetRow>({
  name: 'practice.spmTargets',
  ids: naturalKey(),
  indexes: ['userId'],
})

export const structuredAttemptsTable = defineTable<StructuredAttemptRow>({
  name: 'practice.structuredAttempts',
  ids: opaque('sa_', 'practice:structured-attempts', 12),
  indexes: ['userId'],
})

export const checksTable = defineTable<CheckRow>({
  name: 'practice.checks',
  ids: naturalKey(),
  indexes: ['sessionId'],
})

export const subjectUsageTable = defineTable<SubjectUsageRow>({
  name: 'practice.subjectUsage',
  ids: maxPlusOne(),
})

export const M05_TABLES = {
  revisionQueue: queueTable,
  mastery: masteryTable,
  spmTargets: spmTargetsTable,
  structuredAttempts: structuredAttemptsTable,
  checks: checksTable,
  subjectUsage: subjectUsageTable,
}
