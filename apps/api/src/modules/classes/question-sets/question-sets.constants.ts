import type { RateLimitSpec } from '../../../common/throttle'

/** Throttles of the BE-18 question set, paper, template and DSKP routes (D57): per user, one bucket per kind. */
export const QUESTION_SET_LIMITS = {
  read: { bucket: 'question-sets.read', env: 'THROTTLE_CLASSES_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'question-sets.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** `audit_events.action` names of this module (ids only, never names or text). */
export const QUESTION_SET_AUDIT = {
  DSKP_BIDANG_CREATED: 'classes.dskp_bidang.created',
  DSKP_SK_CREATED: 'classes.dskp_sk.created',
  DSKP_SP_CREATED: 'classes.dskp_sp.created',
  PAPER_SUBMITTED: 'classes.question_paper.submitted',
} as const

/** Message of the default intake while BE-37 has not plugged its port in. */
export const PAPER_INTAKE_UNAVAILABLE = 'Muat naik kertas soalan belum tersedia buat masa ini.'

/**
 * Multipart limits of the paper upload, applied by the parser so an oversized body is cut off early:
 * at most 6 file parts (one over the 5 allowed, so "more than 5" is reported by the validation itself),
 * each at most 20 MB, a few small text fields.
 */
export const PAPER_MULTER_LIMITS = {
  files: 6,
  fileSize: 20 * 1024 * 1024,
  fields: 20,
  fieldSize: 8 * 1024,
  fieldNameSize: 100,
  parts: 40,
  headerPairs: 50,
} as const
