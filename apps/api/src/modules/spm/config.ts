/**
 * M06 configuration (SRS M06 v1.4 sections 6.1, 6.5, 6.9, 6.12). Subjects are named by their curriculum CODE:
 * the numeric ids of the mock never appear here (ids are database ids, decimal strings on the wire).
 */
import { SPM_MOCK_SUBJECTS } from '@pp/contract'

import type { RateLimitSpec } from '../../common/throttle'

/** BR-M06-04: size of a Tracking A set and of a Latih Tubi run when a subject has no target. */
export const DEFAULT_SET_SIZE = 40
/** Open question 9: the Tracking year is a module constant (no `settings` table in B1). */
export const TRACKING_YEAR = 2026

/** BR-M06-11: readiness tile order (subjects with a target). */
export const READINESS_ORDER = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM', 'ADDMATH', 'PHY', 'CHEM', 'BIO', 'GEO', 'BA', 'EKON', 'PSI'] as const

/** The 15 Subjektif subjects in the mock id order (FR-M05-134) and the five of them on the Teras tab. */
export const SUBJEKTIF_CODES = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM', 'ADDMATH', 'PERNIAGA', 'AKAUN', 'SK', 'TI'] as const
export const SUBJEKTIF_TERAS_CODES: readonly string[] = ['BM', 'BI', 'MATH', 'SCI', 'SEJ']

/** Bahasa lane subjects (BM before BI, DV-M06-10). */
export const BAHASA_CODES = ['BM', 'BI'] as const

/** S11 option label to curriculum code (SRS 6.5). */
export const MOCK_SUBJECT_CODES: Readonly<Record<(typeof SPM_MOCK_SUBJECTS)[number], string>> = {
  'Bahasa Melayu': 'BM',
  English: 'BI',
  Matematik: 'MATH',
  'Matematik Tambahan': 'ADDMATH',
  Fizik: 'PHY',
  Kimia: 'CHEM',
  Biologi: 'BIO',
  Sains: 'SCI',
  Sejarah: 'SEJ',
  'Pendidikan Islam': 'PI',
}

/** Items of the two papers (BR-M06-22, PROPOSED). */
export const P1_ITEMS = 30
export const P2_ITEMS = 6
export const P2_ITEM_MARKS = 10

/** Education-level grades of Tingkatan 4 and 5 (`education_levels.grade`). */
export const SPM_LEVEL_GRADES = [10, 11] as const

/** Colour the mock sends when a subject is unknown. */
export const FALLBACK_COLOR = '#64748B'

/** BR-M06-24 grade bands (INFERRED), highest first. */
export const GRADE_BANDS: readonly (readonly [number, string])[] = [
  [90, 'A+'],
  [80, 'A'],
  [70, 'B+'],
  [60, 'B'],
  [50, 'C'],
  [45, 'D'],
  [40, 'E'],
]

/** Section 6.12 canned walkthroughs (PROPOSED COPY; D4, no external calls). */
export const CANNED_WALKTHROUGH: Readonly<Record<string, string>> = {
  Matematik:
    'Langkah 1: Kenal pasti apa yang diberi dan apa yang diminta.\nLangkah 2: Pilih rumus yang sesuai (rujuk buku teks Tingkatan 4/5).\nLangkah 3: Gantikan nilai dan selesaikan.\nSkema: 1 markah untuk kaedah, 1 markah untuk jawapan betul.',
  Sejarah:
    'Langkah 1: Kenal pasti kata tugas soalan (nyatakan / huraikan).\nLangkah 2: Tulis isi berserta huraian.\nSkema: 1 markah bagi setiap isi yang tepat.',
  default:
    'Langkah 1: Baca soalan dengan teliti.\nLangkah 2: Kenal pasti konsep utama dalam buku teks.\nLangkah 3: Jawab mengikut format skema pemarkahan.',
}

/** Default simulated delay of the walkthrough in milliseconds (the mock's 1500); `SPM_WALKTHROUGH_DELAY_MS` overrides it. */
export const WALKTHROUGH_DELAY_MS = 1500

/** Seconds a per-subject SPM pool read is reused (`SPM_POOL_CACHE_SECONDS`; 0 turns the cache off). */
export const POOL_CACHE_SECONDS = 60

/** Per-user ceilings (requests per minute) on the two routes that cost a pool draw or a simulated solve. */
export const SPM_LIMITS = {
  mockCreate: { bucket: 'spm.mock-create', env: 'THROTTLE_SPM_MOCK_CREATE_PER_MINUTE', default: 10, per: 'user' },
  walkthrough: { bucket: 'spm.walkthrough', env: 'THROTTLE_SPM_WALKTHROUGH_PER_MINUTE', default: 6, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
