/**
 * US-33 attempt aggregate (AC-33.4, AC-18.3): the input shape of `PracticeAggregateService.recordGraded`.
 *
 * MIRRORS BE-16: `BijakAttemptAggregateInput` in `apps/api/src/modules/bijak/attempts/ports.ts` on branch
 * `be/BE-16-bijak-attempts` (not merged when BE-12 was built). It is declared here, not imported, so the two
 * cards merge in any order. Keep the required fields identical; the Delivery Lead wires
 * `bijakAttemptPorts.provideAggregate(practiceAggregateService)` after both merge.
 *
 * The OPTIONAL fields below are an additive extension (structural typing keeps BE-16's call valid): AC-33.4
 * asks for duration and start type, which BE-16's port does not pass yet. Until it does they are stored as null.
 */
export interface BijakAttemptAggregateInput {
  attemptId: string
  userId: string
  isTest: boolean
  /** Decimal-string paper id; null for a migrated attempt. */
  paperId: string | null
  subject: string
  kertas: number
  mode: 'exam' | 'latihan'
  status: 'submitted' | 'auto_submitted'
  score: number
  max: number
  provisional: boolean
  /** True when a late sync re-graded an attempt that was already counted (replace, do not add). */
  regraded: boolean
  questions: { questionId: string; marks: number; awarded: number; attempted: boolean; counted: boolean }[]
  /** Extension (AC-33.4 "start type"): `exam_attempts.paper_kind`. */
  paperKind?: 'pilihan' | 'jana' | null
  /** Extension (AC-33.4 "duration"): `exam_attempts.started_at`. */
  startedAt?: Date | null
  /** Extension (AC-33.4 "duration"): `exam_attempts.submitted_at`. */
  submittedAt?: Date | null
}

/** The port BE-16 calls (mirror of `BijakAttemptAggregatePort`). */
export interface BijakAttemptAggregatePort {
  recordGraded(input: BijakAttemptAggregateInput): Promise<void>
}
