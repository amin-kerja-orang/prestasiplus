import type { RateLimitSpec } from '../../../common/throttle'

/** Throttles of the BE-18 question set, paper, template and DSKP routes (D57): per user, one bucket per kind. */
export const QUESTION_SET_LIMITS = {
  read: { bucket: 'question-sets.read', env: 'THROTTLE_CLASSES_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'question-sets.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 30, per: 'user' },
  /**
   * The paper upload buffers up to 100 MB per request in memory, so it has its own tighter bucket. It shares the
   * existing env key (no new key in the env schema): unset means 5 a minute, a set value overrides it (tests).
   */
  paper: { bucket: 'question-papers.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 5, per: 'user' },
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

/**
 * A body larger than this cannot be a valid upload (5 files of 20 MB plus multipart framing and text fields),
 * so it is refused from the `Content-Length` header before a byte is read.
 */
export const PAPER_MAX_BODY_BYTES = 5 * 20 * 1024 * 1024 + 1024 * 1024

/** Uploads being read or processed at once: one per user, a few for the whole process (each can hold ~100 MB). */
export const PAPER_MAX_IN_FLIGHT_PER_USER = 1
export const PAPER_MAX_IN_FLIGHT_GLOBAL = 4
/** `Retry-After` seconds sent when an upload slot is not free. */
export const PAPER_SLOT_RETRY_SECONDS = 5

/** Sessions looked up at the same time when the student list counts attempts. */
export const ATTEMPT_LOOKUP_CONCURRENCY = 8
