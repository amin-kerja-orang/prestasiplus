import type { RateLimitSpec } from '../../common/throttle'

/** Throttles of the class routes (D57): per user, one bucket per kind. Ceilings come from the environment (documented in .env.api.example). */
export const CLASS_LIMITS = {
  read: { bucket: 'classes.read', env: 'THROTTLE_CLASSES_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'classes.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 30, per: 'user' },
  // Joining by code is a guessing target (the code is the only secret): its own, tighter bucket.
  join: { bucket: 'classes.join', env: 'THROTTLE_CLASS_JOIN_PER_MINUTE', default: 10, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Join code alphabet: upper-case letters and digits without the look-alikes I, L, O, 0 and 1. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
/** BR-M10-02 (mock): a 6-character code. The card allows 6 to 8; 6 keeps the codes short for the pupils to type. */
export const JOIN_CODE_LENGTH = 6
/** Attempts to find a free code before giving up (a collision is a 1 in 10^9 event). */
export const JOIN_CODE_ATTEMPTS = 8

/** BR-M10-23 / FN-M10-7.1.3: the eight contribution tiers (names and icons as the mock). */
export const CONTRIBUTION_TIERS = [
  { name: 'Penyumbang Baru', threshold: 10, icon: 'fa-seedling' },
  { name: 'Penyumbang Aktif', threshold: 100, icon: 'fa-fire' },
  { name: 'Penyumbang Dedikasi', threshold: 500, icon: 'fa-award' },
  { name: 'Penyumbang Cemerlang', threshold: 1000, icon: 'fa-trophy' },
  { name: 'Penyumbang Terbilang', threshold: 2500, icon: 'fa-crown' },
  { name: 'Legenda Soalan', threshold: 5000, icon: 'fa-gem' },
  { name: 'Guru Maestro', threshold: 10000, icon: 'fa-star' },
  { name: 'Legenda Terulung', threshold: 50000, icon: 'fa-crown' },
] as const
/** The contributions breakdown shows the ten biggest subjects and folds the rest into "Lain". */
export const CONTRIBUTION_BREAKDOWN_TOP = 10
export const CONTRIBUTION_BREAKDOWN_REST_LABEL = 'Lain'

/** Roles that may join a class by code (SEC-M10-02): the student, and the admin who has the screen. */
export const JOIN_ROLES = ['student', 'admin'] as const

/** `audit_events.action` names of this module (ids only, never names or text). */
export const CLASS_AUDIT = {
  CLASS_CREATED: 'classes.class.created',
  STUDENT_ADDED: 'classes.student.added',
  STUDENT_REMOVED: 'classes.student.removed',
  JOINED: 'classes.class.joined',
  CHAPTER_CREATED: 'curriculum.chapter.created',
  TOPIC_CREATED: 'curriculum.topic.created',
} as const

