import type { RateLimitSpec } from '../../../../common/throttle'

/**
 * Rate limit of the two report writes (D57 security defaults: 429 on writes). One shared counter per
 * signed-in user, 30 per minute by default, ceiling from `THROTTLE_ADMIN_WRITE_PER_MINUTE` (already in
 * `.env.api.example`; no new variable).
 */
export const REPORT_LIMITS = {
  write: { bucket: 'question-reports.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Pill label of a stored reason per question type (mock `lib/report-reasons.ts`, DV-M04-08). */
const MCQ_LABELS: Record<string, string> = {
  wrong_answer: 'Jawapan tidak tepat',
  confusing_question: 'Soalan mengelirukan',
  wrong_options: 'Set jawapan tidak tepat',
  missing_options: 'Pilihan jawapan tidak lengkap',
  duplicate: 'Soalan berulang / pendua',
  typo: 'Kesalahan ejaan / taip',
  other: 'Lain-lain',
}
const STRUCTURED_LABELS: Record<string, string> = {
  wrong_answer: 'Skema jawapan tidak tepat',
  confusing_question: 'Soalan mengelirukan',
  wrong_options: 'Markah tidak adil',
  typo: 'Kesalahan ejaan / taip',
  other: 'Lain-lain',
}

export function reasonLabel(type: 'mcq' | 'structured', reason: string): string {
  const hit = (type === 'mcq' ? MCQ_LABELS : STRUCTURED_LABELS)[reason]
  if (hit !== undefined) return hit
  if (reason === 'outdated') return 'Soalan sudah tidak relevan'
  if (reason === 'unclear') return 'Soalan mengelirukan'
  return reason
}

/** Category badge from the first reason (BR-M04-15). */
export function reportCategory(reasons: readonly string[]): 'Jawapan Salah' | 'Tak Jelas' | 'Lain-lain' {
  const first = reasons[0]
  if (first === 'wrong_answer' || first === 'wrong_options') return 'Jawapan Salah'
  if (first === 'confusing_question' || first === 'unclear') return 'Tak Jelas'
  return 'Lain-lain'
}

/** BR-M04-12: a structured question becomes inactive at its third open (pending or reviewed) report. */
export const STRUCTURED_DEACTIVATE_AT = 3

/** Notification `type` of a report status change (AC 11). */
export const REPORT_NOTIFICATION_TYPE = 'question_report'

/** Reason stored on the status event when an admin archives a question from its report row (R1-B17). */
export const REPORT_ARCHIVE_REASON = 'Diarkibkan daripada laporan soalan'
