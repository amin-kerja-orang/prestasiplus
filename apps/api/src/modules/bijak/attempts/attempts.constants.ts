import { BIJAK_ATTEMPTS_LIMITS, BIJAK_ATTEMPTS_MESSAGES } from '@pp/contract'

import type { RateLimitSpec } from '../../../common/throttle'

export { BIJAK_ATTEMPTS_MESSAGES }

/** Constants of the mock server, shared with the contract (one source). */
export const GRACE_SECONDS = BIJAK_ATTEMPTS_LIMITS.graceSeconds
export const LATE_SYNC_WINDOW_MS = BIJAK_ATTEMPTS_LIMITS.lateSyncWindowMs
export const FRESH_SECONDS = BIJAK_ATTEMPTS_LIMITS.freshSeconds
export const MAX_CHECKS_PER_QUESTION = BIJAK_ATTEMPTS_LIMITS.maxChecksPerQuestion
export const MAX_PHOTO_BYTES = BIJAK_ATTEMPTS_LIMITS.maxPhotoBytes
export const MAX_PHOTOS_PER_PART = BIJAK_ATTEMPTS_LIMITS.maxPhotosPerPart

/** The history list is unbounded in the mock; the API returns the newest 500 (implementation cap). */
export const HISTORY_LIMIT = 500

/** The sweeper looks at this many expired attempts per run. */
export const SWEEP_BATCH = 200

/**
 * Limiter specs (common/throttle), per signed-in user, counted per process. Ceilings come from env,
 * else the default. D57a: every write route is limited; the "Semak" check has its own, lower bucket
 * (NFR-05); autosave has a high one because the page saves every few seconds.
 */
export const ATTEMPT_RATE = {
  save: { bucket: 'bijak.attempts.save', env: 'THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE', default: 240, per: 'user' },
  lifecycle: { bucket: 'bijak.attempts.lifecycle', env: 'THROTTLE_BIJAK_ATTEMPT_WRITE_PER_MINUTE', default: 30, per: 'user' },
  check: { bucket: 'bijak.attempts.check', env: 'THROTTLE_BIJAK_CHECK_PER_MINUTE', default: 60, per: 'user' },
  photo: { bucket: 'bijak.attempts.photo', env: 'THROTTLE_BIJAK_PHOTO_PER_MINUTE', default: 20, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/**
 * Server-side payload caps on top of the contract schemas (the contract has no maximums; the global
 * JSON parser also refuses bodies over 100 kb). They bound the work of marking (math parsing of
 * every answer) and the size of stored rows.
 */
export const PAYLOAD_LIMITS = {
  changes: 300,
  carriedAnswers: 300,
  steps: 50,
  stepChars: 2000,
  finalChars: 1000,
  unitChars: 50,
  textChars: 8000,
  plainChars: 2000,
  photoNameChars: 256,
  flags: 300,
  picksSections: 50,
  picksPerSection: 300,
  position: 100_000,
  /** `attempt_answers.rev` is an int4. */
  rev: 2_000_000_000,
} as const

export const PAYLOAD_MESSAGES = {
  tooMany: 'Terlalu banyak perubahan dihantar.',
  tooLong: 'Jawapan terlalu panjang.',
  revRange: 'Semakan tidak sah.',
  partPhotos: 'Bahagian ini tidak menerima gambar.',
} as const
