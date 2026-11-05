import type { RateLimitSpec } from '../../../../common/throttle'

/**
 * Rate limit of the import writes (admin and Guru): per signed-in user, own counter, ceiling from the
 * existing `THROTTLE_ADMIN_WRITE_PER_MINUTE` (no new variable). Reads are not limited.
 */
export const IMPORT_LIMITS = {
  write: { bucket: 'questions.import.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/**
 * Limits of the optional image ZIP (30 Q-11 row 11-02, S1-T05 part 3). `maxBytes` is the upload size; the other three are read from the
 * central directory BEFORE anything is inflated and enforced again WHILE inflating (a header can lie about its sizes).
 */
export const IMPORT_ZIP = {
  /** ZIP file: 20 MB (Q-11 11-02). */
  maxBytes: 20 * 1024 * 1024,
  /** Entries (files and folders) in the central directory. */
  maxEntries: 100,
  /** Sum of the uncompressed sizes of all entries: 40 MB. */
  maxTotalBytes: 40 * 1024 * 1024,
  /** One image: 2 MB (the `question_image` rule of the files module). */
  maxEntryBytes: 2 * 1024 * 1024,
} as const
