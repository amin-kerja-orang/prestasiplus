/**
 * The only stored M11 entity: DATA-M11-01 MonitoringFlag (SRS M11 v1.10 §6.2). One row per flagged
 * T4/T5 pupil, keyed by the pupil's user id. The live detection rule is unobservable (Q-M11-4), so
 * the prototype stores the flags (52 `review` + 35 `excluded`, `../seeds/seed.ts`).
 */

import { defineTable, floor, ID_RANGES } from '@/mock/define'

import type { FlagLevel } from '../../api/types'

export interface MonitoringFlagRow {
  /** = `userId` (one flag per pupil). */
  id: number
  userId: number
  level: FlagLevel
  /** ISO 8601 (+08:00). */
  flaggedAt: string
}

export const monitoringFlagsTable = defineTable<MonitoringFlagRow>({
  name: 'm11.monitoringFlags',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
  indexes: ['level'],
})

export const M11_TABLES = { monitoringFlags: monitoringFlagsTable }
