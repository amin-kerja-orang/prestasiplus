/**
 * M06 stores (SRS M06 v1.4 §6): DATA-M06-03 TrackingASet and DATA-M06-05 MockExam (items embedded).
 * Everything else M06 shows is computed from the owners' stores (M03, M04, M05).
 */

import { defineTable, maxPlusOne, opaque } from '@/mock/define'

import type { MockGrade, MockItem, MockStatus } from '../../api/types'

export interface TrackingSetRow {
  /** `"{subjectId}:{year}:{setNo}"`. */
  id: string
  subjectId: number
  year: number
  setNo: number
  /** M04 SPM-pool question ids in priority order. */
  questionIds: number[]
  /** Observed DSKP numerator (= the total as live). */
  dskpTagged: number
}

export interface MockExamRow {
  id: number
  userId: number
  subject: string
  subjectId: number
  paperNumber: 1 | 2
  status: MockStatus
  createdAt: string
  submittedAt: string | null
  score: number | null
  maxScore: number
  percent: number | null
  grade: MockGrade | null
  items: MockItem[]
}

export const trackingSetsTable = defineTable<TrackingSetRow>({
  name: 'm06.trackingSets',
  ids: opaque('m06ts_', 'm06:tracking-sets', 12),
  indexes: ['subjectId'],
})

export const mockExamsTable = defineTable<MockExamRow>({
  name: 'm06.mockExams',
  ids: maxPlusOne(),
  indexes: ['userId'],
})
