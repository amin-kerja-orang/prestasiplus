/** Row types of the M12-owned stores (SRS M12 v1.6 §6.2-§6.4). */

import type { AlertType, Mood } from '../api/types'

/** DATA-M12-01 FeedbackResponse. */
export interface FeedbackRow {
  id: number
  userId: number
  /** User.role at response time. */
  role: string
  /**
   * User.schoolId at response time (`null` without a school). An additive field beyond DATA-M12-01, added for
   * the school filter of Q-M12-T1 (XR-M17-21, M17 SRS v1.13); like `role` it is a snapshot of the respondent.
   */
  schoolId: number | null
  /** `YYYY-MM` (Asia/Kuala_Lumpur); unique with `userId` (BR-M12-32). */
  month: string
  nps: number
  satisfaction: number
  createdAt: string
}

/** DATA-M12-02 KirkpatrickIntervention. */
export interface InterventionRowStored {
  id: number
  studentId: number
  alertType: AlertType
  actionDate: string
  alertDescription: string
  actionTaken: string
  beforeAccuracy: number | null
  afterAccuracy: number | null
  beforeMood: Mood | null
  afterMood: Mood | null
  createdBy: number
  createdAt: string
  updatedAt: string
}

/** DATA-M12-03 SchoolEngagementScore (`id` = the school id). */
export interface SchoolScoreRow {
  id: number
  score: number
  subjectCount: number
  observed: boolean
}

/**
 * DATA-M12-04 AlesaPrediction. `scope` is `'platform'` or the school id; `rank` is the observed `predRank`
 * (row number of the same student in the prediction table of the scope); the student is resolved at read time
 * from `rank` and `schoolId` (see `repository/alesa.ts`). `ketepatan` is not stored.
 */
export interface AlesaStoredRow {
  id: number
  scope: 'platform' | number
  /** Position in the stored list (observed order: grade best first, then user id). */
  seq: number
  rank: number
  schoolId: number
  grade: string
  confidence: 'rendah' | 'sederhana' | 'tinggi'
  cadanganBand: 'A' | 'B' | 'C' | 'D/E'
  observed: boolean
}

/** DATA-M12-05 StudentConsistency (`id` = the user id). */
export interface ConsistencyRow {
  id: number
  konsistensi: number
  observed: boolean
}
