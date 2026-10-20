import { CONTENT_FLASH, VIDEO_CATEGORY_LABELS, VIDEO_PAGE_SIZE } from '@pp/contract'

import type { RateLimitSpec } from '../../../common/throttle'

export { CONTENT_FLASH, VIDEO_CATEGORY_LABELS, VIDEO_PAGE_SIZE }

/** Audit actions of the videos. `details` carry ids and flags only. */
export const VIDEO_AUDIT = {
  CREATED: 'content.video.created',
  UPDATED: 'content.video.updated',
  DELETED: 'content.video.deleted',
} as const

/** Related cards on a video page (BR-M09-20). */
export const VIDEO_RELATED_LIMIT = 6

/** Longest search term used (longer input is cut, never rejected). */
export const SEARCH_MAX = 200

/** Chip label of the stored platform spelling (BR-M09-17). */
export const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  Youtube: 'YouTube',
  Vimeo: 'Vimeo',
  Dailymotion: 'Dailymotion',
  TikTok: 'TikTok',
  Facebook: 'Facebook',
  Other: 'Lain-lain',
}

/** Role label shown next to an uploader (`uploader.roleLabel`). */
export const ROLE_LABELS: Readonly<Record<string, string>> = {
  admin: 'Admin',
  teacher: 'Guru',
  school_admin: 'Pengetua',
  student: 'Pelajar',
  parent: 'Ibu Bapa',
  ppd_officer: 'Pegawai PPD',
  sponsor: 'Penaja',
}

export const UNKNOWN_UPLOADER = 'Pengguna'

/**
 * Limiter specs (common/throttle). The library is public, so its reads are counted per client address
 * (the search ceiling, which is the higher public one); the rest per signed-in user. Existing env keys are reused.
 */
export const VIDEO_LIMITS = {
  publicRead: { bucket: 'content.videos.read', env: 'THROTTLE_PUBLIC_SEARCH_PER_MINUTE', default: 300, per: 'ip' },
  read: { bucket: 'content.videos.context', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'content.videos.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const
