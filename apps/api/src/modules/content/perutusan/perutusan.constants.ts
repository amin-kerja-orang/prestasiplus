import {
  CONTENT_FLASH,
  PERUTUSAN_COMMENT_MAX,
  PERUTUSAN_MAX_DOCUMENT_BYTES,
  PERUTUSAN_MAX_IMAGE_BYTES,
  PERUTUSAN_MAX_PINNED,
  PERUTUSAN_NATIONAL_SCOPE_LABEL,
  PERUTUSAN_SCHOOL_SCOPE_LABEL,
  PERUTUSAN_STATUS_LABELS,
  type PerutusanReactionType,
  type PerutusanStatus,
} from '@pp/contract'

import type { RateLimitSpec } from '../../../common/throttle'

export {
  CONTENT_FLASH,
  PERUTUSAN_COMMENT_MAX,
  PERUTUSAN_MAX_DOCUMENT_BYTES,
  PERUTUSAN_MAX_IMAGE_BYTES,
  PERUTUSAN_MAX_PINNED,
  PERUTUSAN_NATIONAL_SCOPE_LABEL,
  PERUTUSAN_SCHOOL_SCOPE_LABEL,
  PERUTUSAN_STATUS_LABELS,
}

/** Audit actions of the perutusan. `details` carry ids, counts and flags only, never the text. */
export const PERUTUSAN_AUDIT = {
  CREATED: 'content.perutusan.created',
  COMMENTED: 'content.perutusan.commented',
  REACTED: 'content.perutusan.reacted',
} as const

export const STATUS_FLASH: Readonly<Record<PerutusanStatus, string>> = {
  published: CONTENT_FLASH.perutusan.published,
  scheduled: CONTENT_FLASH.perutusan.scheduled,
  draft: CONTENT_FLASH.perutusan.draft,
}

export const REACTION_ORDER: readonly PerutusanReactionType[] = ['like', 'love', 'thanks']
export const REACTION_EMOJI: Readonly<Record<PerutusanReactionType, string>> = { like: '👍', love: '❤️', thanks: '🙏' }

export const EXCERPT_LENGTH = 250

/** Role label of a post author (BR-M09-29). */
export const AUTHOR_ROLE_LABELS: Readonly<Record<string, string>> = { school_admin: 'Pengetua', admin: 'Admin' }
export const UNKNOWN_AUTHOR = 'Pengguna'

/** The feed is unpaged (contract); this bounds one answer. Pinned and newest posts come first, so the cut drops the oldest. */
export const FEED_LIMIT = 500

/** Attachments per post and bytes of one multipart text field (the body). Not in the mock; they bound memory per request. */
export const MAX_IMAGES = 6
export const MAX_DOCUMENTS = 3
export const BODY_FIELD_BYTES = 512 * 1024
export const YOUTUBE_URL_MAX = 2048

/** `files.purpose` of the stored attachments (the BE-04 purpose list is open at the database; see the deviations log). */
export const FILE_PURPOSE_OF = { image: 'perutusan_image', document: 'perutusan_document' } as const

export const FILE_REFUSED_FALLBACK = 'Fail'

/** Limiter specs (common/throttle); existing env keys are reused. Reads and writes per signed-in user, the public page per client address. */
export const PERUTUSAN_LIMITS = {
  read: { bucket: 'content.perutusan.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'content.perutusan.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
  react: { bucket: 'content.perutusan.react', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
  publicRead: { bucket: 'content.perutusan.public', env: 'THROTTLE_PUBLIC_PER_MINUTE', default: 60, per: 'ip' },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 20_000 } as const
