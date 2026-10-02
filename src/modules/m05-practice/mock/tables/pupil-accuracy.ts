/**
 * PupilSubjectAccuracy (DATA-M05-13; SRS M05 v1.17 §6.14.4, FR-M05-148; M18 XR-M18-03 (1)): the
 * stored per-pupil × subject accuracy set behind M18 S5 / S6 ("Ketepatan" cells). It is separate from
 * the answer log, from the practice sessions and from the SubjectMastery level rows, and holds only
 * the anchor rows of M18 §6.11 C (other pupils have no row). Key `userId:subjectId`.
 */

import { defineTable, opaque } from '@/mock/define'

export interface PupilAccuracyRow {
  /** `userId:subjectId`. */
  id: string
  userId: number
  subjectId: number
  correct: number
  answered: number
}

export const pupilAccuracyTable = defineTable<PupilAccuracyRow>({
  name: 'practice.pupilSubjectAccuracy',
  ids: opaque('k_', 'practice:pupil-accuracy-keys', 12),
  indexes: ['userId'],
})
