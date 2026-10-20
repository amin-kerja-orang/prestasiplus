import { AUDIO_MAX_BYTES } from '@pp/contract'

import type { RateLimitSpec } from '../../../common/throttle'

/** Audit actions of the audio KBAT module. `details` carry ids, counts and scores only. */
export const AUDIO_AUDIT = {
  SET_CREATED: 'content.audio_set.created',
  ATTEMPT_SUBMITTED: 'content.audio_attempt.submitted',
} as const

/**
 * Limiter specs (common/throttle), all per signed-in user. The section audio gets a high ceiling because a
 * player sends several range requests per play. A create can carry 80 MB, so it is limited per hour.
 */
export const AUDIO_LIMITS = {
  read: { bucket: 'audio-kbat.read', env: 'THROTTLE_AUDIO_KBAT_READ_PER_MINUTE', default: 120, per: 'user' },
  file: { bucket: 'audio-kbat.file', env: 'THROTTLE_AUDIO_KBAT_FILE_PER_MINUTE', default: 60, per: 'user' },
  attempt: { bucket: 'audio-kbat.attempt', env: 'THROTTLE_AUDIO_KBAT_ATTEMPT_PER_MINUTE', default: 30, per: 'user' },
  adminWrite: { bucket: 'audio-kbat.admin-write', env: 'THROTTLE_AUDIO_KBAT_ADMIN_WRITE_PER_HOUR', default: 20, per: 'user', windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** The `files` public id (BE-04 token) that a section stores as `audioFileId`: 22 base64url characters. */
export const PUBLIC_FILE_ID = /^[A-Za-z0-9_-]{22}$/

/** Extensions the section audio may have, and the type the bytes must really be (decided by the files module). */
export const AUDIO_MIME_OF_EXTENSION = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
} as const
export type AudioExtension = keyof typeof AUDIO_MIME_OF_EXTENSION

export const MAX_TRANSCRIPT_CHARS = 20_000

export const AUDIO_QUESTION_TEXT_MAX = 2000
export const AUDIO_OPTION_MAX = 500
export const AUDIO_EXPLANATION_MAX = 2000

/**
 * Multipart limits of the create: 4 audio files, about 330 text parts (4 x 3 + 30 x 10 + 6 set fields), each text
 * part at most 32 KiB. The file ceiling is one byte above the rule so the service, not multer, refuses a file of
 * exactly 20 MB + 1 with the per-file message; anything bigger is cut off while reading.
 */
export const AUDIO_MULTER_LIMITS = {
  files: 4,
  fields: 400,
  parts: 410,
  fieldSize: 32 * 1024,
  headerPairs: 100,
  fileSize: AUDIO_MAX_BYTES + 1,
} as const

/** The template download is a placeholder text file (OQ-M09-03), as the mock. */
export const TEMPLATE_PLACEHOLDER = 'Template Audio KBAT (contoh sahaja)\n'
