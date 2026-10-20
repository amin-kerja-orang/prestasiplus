/**
 * Fixed values and pure functions of the SPM targets and structured-attempt endpoints (SRS M05 v1.17
 * BR-22, BR-23, BR-26, section 6.13; mock `structured-rules.ts`). No database, no clock.
 */
import { PRACTICE_READS_MESSAGES, PRACTICE_READS_SPM_GRADES } from '@pp/contract'
import type { RateLimitSpec } from '../../../../common/throttle'

/**
 * Write limits, per user. The ceilings are code defaults; the env keys are in `env.schema.ts` and
 * `.env.api.example`.
 */
export const READS_WRITE_LIMITS = {
  targets: { bucket: 'practice-reads.targets', env: 'THROTTLE_SPM_TARGETS_WRITE_PER_MINUTE', default: 30, per: 'user' },
  attempts: { bucket: 'practice-reads.attempts', env: 'THROTTLE_STRUCTURED_ATTEMPT_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Structured list page size (BR-23). */
export const STRUCTURED_PAGE_SIZE = 20
/** Upper bound of one answer text (mock "INFERRED"). */
export const MAX_ANSWER_CHARS = 5000
/** The card preview is the first 200 characters of the stimulus plus "..." (mock "INFERRED"). */
export const PREVIEW_LENGTH = 200
/** Shown when the creator of a set is not a teacher (observed live label). */
export const DEFAULT_AUTHOR = 'Guru Pakar'
/** `markStructured` placeholder (LS-7): full marks when the trimmed answer has at least this many characters. */
export const MARK_MIN_CHARS = 20

/** Valid `kbatLevel` filter values (BR-23). */
export const KBAT_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6]

/**
 * BR-22 / mock `SPM_TARGET_SUBJECT_IDS`: the 20 SPM subjects of S15 in display order, as curriculum
 * subject CODES. The mock ids are not carried over: v2 subject ids are database identities, so the
 * codes are resolved through the curriculum repository.
 */
export const SPM_TARGET_SUBJECT_CODES: readonly string[] = [
  'BA', 'BI', 'BM', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM', 'MATH', 'ADDMATH',
  'PQS', 'PI', 'PM', 'PSV', 'PSI', 'PERNIAGA', 'AKAUN', 'SCI', 'SEJ', 'TI',
]

/** FR-M05-134: the "Subjek" list of the Subjektif SPM variant, in that order (subject codes). */
export const SUBJEKTIF_SUBJECT_CODES: readonly string[] = [
  'BM', 'BI', 'MATH', 'SCI', 'SEJ', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM', 'ADDMATH', 'PERNIAGA', 'AKAUN', 'SK', 'TI',
]

/** FR-M05-134: the Tracking A Bahasa list, BM before BI. */
export const BAHASA_SUBJECT_CODES: readonly string[] = ['BM', 'BI']

/** The two levels a student may see structured sets for (BR-M04-03). */
export const STRUCTURED_LEVEL_CODES: readonly string[] = ['T4', 'T5']

const GRADES: readonly string[] = PRACTICE_READS_SPM_GRADES
export const isSpmGrade = (v: unknown): v is string =>
  typeof v === 'string' && GRADES.includes(v)

/** Canonical decimal id key only: "01" is not subject 1. Returns the key or null. */
export const canonicalId = (key: string): string | null => (/^(0|[1-9]\d{0,18})$/.test(key) ? key : null)

/** §6.13 `markStructured` (LS-7 placeholder): full marks when the answer has at least 20 characters. */
export function markStructured(
  subs: readonly { id: string; marks: number }[],
  answers: ReadonlyMap<string, string>,
): { subQuestionId: string; awarded: number; max: number }[] {
  return subs.map((s) => ({
    subQuestionId: s.id,
    awarded: (answers.get(s.id) ?? '').trim().length >= MARK_MIN_CHARS ? s.marks : 0,
    max: s.marks,
  }))
}

export const MESSAGES = PRACTICE_READS_MESSAGES
