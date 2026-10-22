import type { PkskBahagian } from '@pp/contract'

import type { RateLimitSpec } from '../../common/throttle'

/** Throttles of the PKSK routes (D57): per user, one bucket per kind. Documented in .env.api.example. */
export const PKSK_LIMITS = {
  read: { bucket: 'pksk.read', env: 'THROTTLE_PKSK_READ_PER_MINUTE', default: 300, per: 'user' },
  /** Practice and exam submissions and serving a question set. */
  attempt: { bucket: 'pksk.attempt', env: 'THROTTLE_PKSK_ATTEMPT_PER_MINUTE', default: 30, per: 'user' },
  adminRead: { bucket: 'pksk.admin.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  adminWrite: { bucket: 'pksk.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** Audit actions of this module (G-14: ids only, never a name, e-mail or question text). */
export const PKSK_AUDIT = {
  ACCESS_GRANTED: 'pksk.access.granted',
  ACCESS_REVOKED: 'pksk.access.revoked',
  QUESTIONS_DELETED: 'pksk.questions.deleted',
} as const

/** Bahagian section copy of screen S3 (URS FN-M07-1.3.3). */
export const BAHAGIAN_SECTIONS: Readonly<Record<PkskBahagian, { name: string; subtitle: string }>> = {
  A: { name: 'Kecerdasan Insaniah', subtitle: 'Nilai, akhlak & sahsiah' },
  B: { name: 'Kecerdasan Intelek', subtitle: 'Kognitif & penaakulan' },
  C: { name: 'Artikulasi Penulisan', subtitle: 'Penulisan kreatif' },
}

/** Full-exam composition and weights (BR-M07-13, BR-M07-09). */
export const EXAM_PLAN: readonly { bahagian: PkskBahagian; count: number; weightPct: 20 | 70 | 10 }[] = [
  { bahagian: 'A', count: 30, weightPct: 20 },
  { bahagian: 'B', count: 70, weightPct: 70 },
  { bahagian: 'C', count: 1, weightPct: 10 },
]

/** Practice set size (BR-M07-25). */
export const PRACTICE_SIZE = 10

/** Fixed list size of the admin lists. */
export const PAGE_SIZE = 20

/** Users matched by an access-list search (the users doorway takes a limit; a search matching more is truncated). */
export const SEARCH_USER_LIMIT = 500

/** Message of a question service that is not wired yet (fail closed: no question data is served). */
export const QUESTIONS_UNAVAILABLE = 'Perkhidmatan soalan PKSK belum tersedia.'
