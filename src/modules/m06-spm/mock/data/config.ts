/**
 * M06 configuration and fixture data (SRS M06 v1.4 §6.1, §6.9, §6.10, §6.12). Subject ids are the M03
 * integer ids; names, icons and colours are read from M03 at request time, never re-declared.
 */

export type TargetType = 'spm' | 'custom' | 'latihan'

export interface SpmSubjectConfig {
  code: string
  subjectId: number
  /** S3 section. */
  group: 'teras' | 'elektif'
  /** Position on S3 inside the group (BR-M06-06). */
  displayOrder: number
  /** Position on S2; null = not listed (BA). */
  databankOrder: number | null
  targetType: TargetType | null
  targetSize: number | null
}

const S3_TERAS = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM']
const S3_ELEKTIF = [
  'GEO',
  'BIO',
  'CHEM',
  'PHY',
  'PERNIAGA',
  'AKAUN',
  'EKON',
  'ADDMATH',
  'PSV',
  'BA',
  'TI',
  'PSI',
]
const S2_ORDER = [
  'BM',
  'BI',
  'MATH',
  'SCI',
  'SEJ',
  'BIO',
  'EKON',
  'PHY',
  'GEO',
  'CHEM',
  'ADDMATH',
  'PI',
  'PM',
  'PSV',
  'PSI',
  'PERNIAGA',
  'AKAUN',
  'TI',
]

export const SUBJECT_ID: Readonly<Record<string, number>> = {
  BM: 1,
  BI: 2,
  MATH: 3,
  SCI: 4,
  SEJ: 5,
  PI: 6,
  PM: 7,
  ADDMATH: 8,
  PHY: 9,
  CHEM: 10,
  BIO: 11,
  GEO: 12,
  PSV: 13,
  SK: 17,
  BA: 18,
  AKAUN: 21,
  EKON: 22,
  PERNIAGA: 23,
  TI: 25,
  PSI: 27,
}

/** BR-M06-04 targets (type, size). */
const TARGETS: Readonly<Record<string, readonly [TargetType, number]>> = {
  BM: ['custom', 34],
  BI: ['custom', 36],
  MATH: ['spm', 40],
  SCI: ['spm', 40],
  SEJ: ['spm', 40],
  GEO: ['spm', 40],
  BIO: ['spm', 40],
  CHEM: ['spm', 40],
  PHY: ['spm', 40],
  PI: ['latihan', 40],
  PM: ['latihan', 40],
  EKON: ['latihan', 40],
  BA: ['latihan', 40],
  PSI: ['latihan', 40],
  ADDMATH: ['latihan', 20],
}

export const SPM_SUBJECTS: readonly SpmSubjectConfig[] = [
  ...S3_TERAS.map((code, i) => ({ code, group: 'teras' as const, displayOrder: i })),
  ...S3_ELEKTIF.map((code, i) => ({ code, group: 'elektif' as const, displayOrder: i })),
].map((s) => {
  const t = TARGETS[s.code]
  const order = S2_ORDER.indexOf(s.code)
  return {
    code: s.code,
    subjectId: SUBJECT_ID[s.code] as number,
    group: s.group,
    displayOrder: s.displayOrder,
    databankOrder: order < 0 ? null : order,
    targetType: t?.[0] ?? null,
    targetSize: t?.[1] ?? null,
  }
})

/** BR-M06-11: readiness tile order (subjects with a target). */
export const READINESS_ORDER = [
  'BM',
  'BI',
  'MATH',
  'SCI',
  'SEJ',
  'PI',
  'PM',
  'ADDMATH',
  'PHY',
  'CHEM',
  'BIO',
  'GEO',
  'BA',
  'EKON',
  'PSI',
]

/** The 15 Subjektif subjects (S8, M05 FR-M05-134 ids) and their S8 tab group (M03 `isCore`). */
export const SUBJEKTIF_SUBJECT_IDS: readonly number[] = [
  1, 2, 3, 4, 5, 11, 22, 9, 12, 10, 8, 23, 21, 17, 25,
]
export const SUBJEKTIF_TERAS_IDS: readonly number[] = [1, 2, 3, 4, 5]

/** Bahasa lane subjects (BM before BI, DV-M06-10). */
export const BAHASA_SUBJECT_IDS: readonly number[] = [1, 2]

export const TARGET_TYPE_LABEL: Readonly<Record<TargetType, string>> = {
  spm: 'SPM',
  custom: 'Custom',
  latihan: 'Latihan',
}

export const DEFAULT_SET_SIZE = 40
export const TRACKING_YEAR = 2026
export const COUNT_OPTIONS = [5, 10, 20, 30, 40, 50, 60] as const

/**
 * SPM pool allocation (SRS §6.10): per subject code, T4 and T5 counts by difficulty 1-4 (5 = 0).
 * These are the cells M06 contributes to the M04 dataset (PROPOSED level/difficulty split, DV-M06-01);
 * the per-subject totals are the observed S2/S3 counts (Σ 21,033).
 */
export const POOL_ALLOCATION: Readonly<
  Record<string, readonly [readonly number[], readonly number[]]>
> = {
  BM: [
    [3, 101, 80, 21],
    [10, 94, 162, 43],
  ],
  BI: [
    [0, 134, 166, 62],
    [228, 313, 127, 84],
  ],
  MATH: [
    [199, 309, 410, 58],
    [306, 205, 167, 27],
  ],
  SCI: [
    [20, 801, 246, 105],
    [27, 498, 293, 86],
  ],
  SEJ: [
    [385, 184, 122, 86],
    [1, 319, 371, 71],
  ],
  PI: [
    [0, 79, 109, 51],
    [0, 71, 103, 70],
  ],
  PM: [
    [0, 429, 224, 59],
    [0, 402, 205, 34],
  ],
  GEO: [
    [0, 52, 121, 77],
    [217, 353, 327, 81],
  ],
  BIO: [
    [5, 616, 318, 139],
    [0, 531, 211, 179],
  ],
  CHEM: [
    [0, 442, 123, 42],
    [20, 263, 102, 17],
  ],
  PHY: [
    [0, 182, 213, 66],
    [68, 268, 332, 132],
  ],
  PERNIAGA: [
    [0, 218, 24, 7],
    [162, 306, 196, 21],
  ],
  AKAUN: [
    [0, 393, 70, 40],
    [286, 659, 255, 67],
  ],
  EKON: [
    [70, 301, 376, 149],
    [164, 341, 367, 218],
  ],
  ADDMATH: [
    [0, 132, 128, 14],
    [0, 107, 106, 14],
  ],
  PSV: [
    [0, 87, 135, 51],
    [0, 78, 119, 75],
  ],
  BA: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  TI: [
    [39, 64, 106, 66],
    [79, 14, 98, 64],
  ],
  PSI: [
    [0, 86, 197, 152],
    [0, 18, 19, 38],
  ],
}

/** Tracking A 2026 sets (SRS §6.10): code → `[setNo, readyCount, bankSource?]`. */
export const TRACKING_SETS: Readonly<Record<string, readonly (readonly number[])[]>> = {
  BM: [[1, 9]],
  MATH: [
    [43, 34],
    [44, 31],
    [45, 34],
    [46, 32],
    [47, 35],
    [48, 30],
    [49, 35],
    [50, 34],
    [51, 31],
    [52, 33],
    [53, 33],
  ],
  SCI: [
    [25, 22],
    [26, 3],
    [27, 1],
    [28, 1],
    [30, 3],
    [31, 1],
    [32, 2],
    [33, 1],
    [34, 1],
  ],
  SEJ: [[37, 31]],
  PHY: [
    [1, 4],
    [4, 1],
    [7, 2],
    [9, 1],
  ],
  CHEM: [
    [1, 4],
    [2, 1],
    [3, 3],
    [5, 5],
    [6, 3],
    [8, 4],
    [9, 2],
  ],
  BIO: [
    [2, 1],
    [5, 1],
    [10, 1],
  ],
  GEO: [
    [1, 40, 67],
    [2, 31],
    [3, 34],
    [4, 30],
    [5, 30],
    [6, 31],
    [7, 30],
    [8, 32],
    [9, 20],
    [10, 31],
  ],
  EKON: [
    [1, 23],
    [2, 17],
    [3, 12],
    [4, 14],
    [5, 19],
    [6, 23],
    [7, 19],
    [8, 18],
  ],
  PSI: [
    [3, 31],
    [4, 40],
    [5, 33],
    [6, 33],
    [7, 38],
    [8, 30],
  ],
  AKAUN: Array.from({ length: 16 }, (_, i) => [i + 1, 40]),
}

// --- mock exams ------------------------------------------------------------------------------

/** S11 option values (= labels) and their M03 subject ids (SRS §6.5). */
export const MOCK_SUBJECTS: Readonly<Record<string, number>> = {
  'Bahasa Melayu': 1,
  English: 2,
  Matematik: 3,
  'Matematik Tambahan': 8,
  Fizik: 9,
  Kimia: 10,
  Biologi: 11,
  Sains: 4,
  Sejarah: 5,
  'Pendidikan Islam': 6,
}

/** S13 option values (URS FN-M06-7.1.2). */
export const WALKTHROUGH_SUBJECTS: readonly string[] = [
  'Bahasa Melayu',
  'English',
  'Matematik',
  'Matematik Tambahan',
  'Fizik',
  'Kimia',
  'Biologi',
  'Sains',
  'Sejarah',
  'Pendidikan Islam',
  'Pendidikan Moral',
  'Geografi',
  'Ekonomi',
  'Perdagangan',
  'Prinsip Akaun',
]

export const P1_ITEMS = 30
export const P2_ITEMS = 6
export const P2_ITEM_MARKS = 10

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

/** §6.12 canned walkthroughs (PROPOSED COPY; D4, no external calls). */
export const CANNED_WALKTHROUGH: Readonly<Record<string, string>> = {
  Matematik:
    'Langkah 1: Kenal pasti apa yang diberi dan apa yang diminta.\nLangkah 2: Pilih rumus yang sesuai (rujuk buku teks Tingkatan 4/5).\nLangkah 3: Gantikan nilai dan selesaikan.\nSkema: 1 markah untuk kaedah, 1 markah untuk jawapan betul.',
  Sejarah:
    'Langkah 1: Kenal pasti kata tugas soalan (nyatakan / huraikan).\nLangkah 2: Tulis isi berserta huraian.\nSkema: 1 markah bagi setiap isi yang tepat.',
  default:
    'Langkah 1: Baca soalan dengan teliti.\nLangkah 2: Kenal pasti konsep utama dalam buku teks.\nLangkah 3: Jawab mengikut format skema pemarkahan.',
}

export const WALKTHROUGH_LATENCY_MS = 1500

// --- Duta (provisional, owner M24; fictitious people only) -------------------------------------

export interface DutaCard {
  slug: string
  name: string
  initials: string
  tier: 'bintang' | 'inspirasi' | 'tetamu'
  tagline: string
  subject: string
  state: string
  rating: number
  active: boolean
}

export const DUTA_SEED: readonly DutaCard[] = [
  {
    slug: 'cikgu-demo-matematik',
    name: 'Cikgu Demo Matematik',
    initials: 'CM',
    tier: 'bintang',
    tagline: 'Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.',
    subject: 'Matematik',
    state: 'Johor',
    rating: 4.92,
    active: true,
  },
  {
    slug: 'cikgu-demo-bahasa',
    name: 'Cikgu Demo Bahasa',
    initials: 'CB',
    tier: 'bintang',
    tagline: 'Pakar Bahasa Melayu SPM · 15 tahun mengajar Kertas 2.',
    subject: 'Bahasa Melayu',
    state: 'Johor',
    rating: 4.88,
    active: true,
  },
  {
    slug: 'cikgu-demo-sains',
    name: 'Cikgu Demo Sains',
    initials: 'CS',
    tier: 'bintang',
    tagline: 'Pakar Sains SPM · Jurulatih eksperimen sekolah.',
    subject: 'Sains',
    state: 'Selangor',
    rating: 4.8,
    active: true,
  },
  {
    slug: 'cikgu-demo-inspirasi',
    name: 'Cikgu Demo Inspirasi',
    initials: 'CI',
    tier: 'inspirasi',
    tagline: 'Penggerak komuniti pembelajaran.',
    subject: 'Sejarah',
    state: 'Perak',
    rating: 4.5,
    active: true,
  },
  {
    slug: 'cikgu-demo-tetamu',
    name: 'Cikgu Demo Tetamu',
    initials: 'CT',
    tier: 'tetamu',
    tagline: 'Tetamu jemputan.',
    subject: 'Biologi',
    state: 'Sabah',
    rating: 4.2,
    active: true,
  },
]
