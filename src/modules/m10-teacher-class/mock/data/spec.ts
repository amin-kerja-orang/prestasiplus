/**
 * Observed and designed figures of the M10 class and enrolment stores (SRS M10 v1.15 §6.2.1) and
 * the anchor classes. Totals are the M08 / M11 / M17 / M18 observations; nothing here is tuned to
 * make totals agree. Where the SRS leaves a choice open, the choice is marked INFERRED.
 */

import type { ClassroomKind, EducationLevelSlug } from '../repository/types'

// --- Totals (M10 §6.2.1 A; M08 S1–S3, S10) ------------------------------------------------------

/**
 * Classrooms (kind `classroom`): M08 S1 "750 kelas", S10 750 cards, S11 750 chips and M18 S24 list
 * classrooms only; the 2 school classes (sc-419, sc-806) show on S3 only (XR-F30-01, M10 v1.16).
 */
export const CLASSROOMS_TOTAL = 750
export const SCHOOL_CLASSES_TOTAL = 2
/** Every class record: classrooms + school classes. */
export const CLASSES_TOTAL = CLASSROOMS_TOTAL + SCHOOL_CLASSES_TOTAL
export const CLASSES_T4 = 13
export const CLASSES_T5 = 645
/** Other-level classrooms of the first build (ids and owners are frozen: they never move). */
export const CLASSES_OTHER_BASE = 92
/** Two further other-level classrooms appended after the build (INFERRED, M10 v1.16). */
export const CLASSES_EXTRA = 2
export const CLASSES_OTHER = CLASSES_OTHER_BASE + CLASSES_EXTRA
export const CLASS_OWNERS_TOTAL = 310
/** Live class ids run 4 … 1156 (max observed 1156). */
export const CLASS_ID_MAX = 1156
export const CLASS_SUBJECTS_DISTINCT = 27
export const ACADEMIC_YEAR = 2026

/** M08 T4 card: distinct students in T4 classes; Σ of the class rows (overlapping). */
export const T4_DISTINCT = 149
export const T4_MEMBERSHIPS = 356
/** M08 T5 card: distinct students in T5 classes. */
export const T5_DISTINCT = 3_911

/** Runtime-created classes start here (users policy, M10 §6.2.1 "Runtime ids"). */
export const CLASS_RUNTIME_FLOOR = 9_000_001

// --- Owners of designed classes ---------------------------------------------------------------

export const TEACHER_GURU = 5
export const TEACHER_FIXTURE_5302 = 5302
export const TEACHER_1919 = 1919
export const TEACHER_4402 = 4402
/** "Guru Demo KL-01" of school 8880 (M04 SQ-7 (a); M18 XR-M18-08). */
export const TEACHER_KL01 = 4503
export const SCHOOL_8880 = 8880
export const SCHOOL_8082 = 8082
export const SCHOOL_8080 = 8080
export const SCHOOL_8102 = 8102
export const SCHOOL_DEMO = 900_001

// --- Subjects -----------------------------------------------------------------------------------

/**
 * The 26 subjects of the T5 classes (M08 discovery Appendix A.4 "S3 Subjek column groups (T5)", i.e.
 * the S3 T5 header "26 subjek"; M03 ids): Bahasa Arab 18, Bahasa Cina 19, Bahasa Inggeris 2, Bahasa
 * Melayu 1, Biologi 11, Ekonomi 22, Fizik 9, Geografi 12, Jawi 26, Kimia 10, Matematik 3, Matematik
 * Tambahan 8, Pembuatan Pakaian Wanita 29, Pendidikan Islam 6, PJK 15, Pendidikan Moral 7, PSV 13,
 * Pendidikan Syariah Islamiah 27, Perniagaan 23, Prinsip Perakaunan 21, Sains 4, Sains Komputer 17,
 * Sains Rumah Tangga 28, Sains Sukan 31, Sejarah 5, Tasawwur Islam 25. (A.4 also lists "Tiada
 * Subjek" and "Kelas Sekolah", which are not subjects.) Subject 28 sits on classes 1155 / 1156 only.
 */
export const T5_SUBJECTS_A4: readonly number[] = [
  18, 19, 2, 1, 11, 22, 9, 12, 26, 10, 3, 8, 29, 6, 15, 7, 13, 27, 23, 21, 4, 17, 28, 31, 5, 25,
]

/**
 * The 27 subjects that classes may carry (M08 S1 "Subjek" 27) = the 26 of A.4 plus Pendidikan Muzik
 * (14), carried by Darjah classes only (INFERRED: the one subject outside T5).
 */
export const CLASS_SUBJECT_POOL: readonly number[] = [...T5_SUBJECTS_A4, 14]

/** The pool of the first build (before XR-F30-02): only used to keep existing picks stable. */
export const LEGACY_SUBJECT_POOL: readonly number[] = [
  18, 2, 1, 11, 22, 9, 12, 10, 3, 8, 24, 6, 7, 13, 27, 23, 21, 4, 5, 25, 28, 16, 17, 15, 20, 26, 14,
]

/** Subjects of M03 levels 1–6 only (Darjah): Pendidikan Muzik (14) and Jawi (26). */
export const DARJAH_ONLY_SUBJECTS: readonly number[] = [14, 26]
/** Subjects linked to Tingkatan 4–5 only (M03 subject–level links). */
export const UPPER_ONLY_SUBJECTS: readonly number[] = [8, 9, 10, 11, 21, 22, 23, 24, 25, 27]
/** Subject 28 has no M03 level link: it appears only on the observed classes 1155 and 1156. */
export const UNLINKED_SUBJECT = 28
/** Subjects without an M03 level link (28 SRT, 29 PPW, 31 Sains Sukan): T5 only, never other levels. */
export const NO_LEVEL_LINK_SUBJECTS: readonly number[] = [28, 29, 31]

// --- Level slugs (BR-M10-03) ------------------------------------------------------------------

export const LEVEL_SLUGS: readonly EducationLevelSlug[] = [
  'tahun-1',
  'tahun-2',
  'tahun-3',
  'tahun-4',
  'tahun-5',
  'tahun-6',
  'tingkatan-1',
  'tingkatan-2',
  'tingkatan-3',
  'tingkatan-4',
  'tingkatan-5',
]

export function levelIdOf(slug: EducationLevelSlug): number {
  return LEVEL_SLUGS.indexOf(slug) + 1
}

export function classKey(kind: ClassroomKind, id: number): string {
  return `${kind}:${String(id)}`
}

export function enrolmentKey(kind: ClassroomKind, classId: number, studentId: number): string {
  return `${kind}:${String(classId)}:${String(studentId)}`
}

// --- Anchor classes ---------------------------------------------------------------------------

export interface AnchorClass {
  kind: ClassroomKind
  id: number
  name: string
  subjectId: number | null
  educationLevel: EducationLevelSlug
  /** Observed join code; generated for the rest. */
  joinCode?: string
  /** Fixed school (designed / observed); otherwise the owner's school. */
  schoolId?: number | null
  /** Fixed owner; otherwise picked in the build. */
  teacherId?: number | null
  /** ISO createdAt for the designed classes (2026-01-06). */
  createdAt?: string
}

const DESIGNED_AT = '2026-01-06T09:00:00+08:00'

/** The 24 anchors inside the live id range (+ the 2 school classes and 5 designed ones below). */
export const ANCHORS: readonly AnchorClass[] = [
  // T4 (the 13 observed rows of M08 S3).
  {
    kind: 'classroom',
    id: 4,
    name: '4 Bestari - BM',
    subjectId: 1,
    educationLevel: 'tingkatan-4',
    joinCode: 'KCC904',
  },
  {
    kind: 'classroom',
    id: 5,
    name: '4 Cemerlang - BM',
    subjectId: 1,
    educationLevel: 'tingkatan-4',
  },
  {
    kind: 'classroom',
    id: 6,
    name: '4 Dedikasi - BM',
    subjectId: 1,
    educationLevel: 'tingkatan-4',
  },
  {
    kind: 'classroom',
    id: 8,
    name: '4 Bestari - SEJ',
    subjectId: 5,
    educationLevel: 'tingkatan-4',
  },
  {
    kind: 'classroom',
    id: 9,
    name: '4 Cemerlang - SEJ',
    subjectId: 5,
    educationLevel: 'tingkatan-4',
  },
  {
    kind: 'classroom',
    id: 10,
    name: '4 Dedikasi - SEJ',
    subjectId: 5,
    educationLevel: 'tingkatan-4',
  },
  { kind: 'classroom', id: 25, name: '5 BEST', subjectId: 9, educationLevel: 'tingkatan-4' },
  {
    kind: 'classroom',
    id: 90,
    name: 'MUMTAZ - Biologi',
    subjectId: 11,
    educationLevel: 'tingkatan-4',
  },
  { kind: 'classroom', id: 115, name: '4 IBNU SINA', subjectId: 3, educationLevel: 'tingkatan-4' },
  { kind: 'classroom', id: 419, name: '4 Bestari', subjectId: null, educationLevel: 'tingkatan-4' },
  {
    kind: 'classroom',
    id: 516,
    name: '4 Simulasi',
    subjectId: null,
    educationLevel: 'tingkatan-4',
    joinCode: 'DEMO-4S',
    schoolId: SCHOOL_8880,
    teacherId: TEACHER_KL01,
  },
  // T5 (INFERRED level for 1154–1156, M08 §6.3).
  {
    kind: 'classroom',
    id: 228,
    name: 'ALFA - Bahasa Inggeris',
    subjectId: 2,
    educationLevel: 'tingkatan-5',
    joinCode: 'UDL749',
    schoolId: SCHOOL_8082,
  },
  {
    kind: 'classroom',
    id: 366,
    name: '5 SAINS TULEN',
    subjectId: 4,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 367,
    name: '5 KAA',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 368,
    name: '5 PRINSIP AKAUN',
    subjectId: 21,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 369,
    name: '5 RGD',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 370,
    name: '5 PERNIAGAAN',
    subjectId: 23,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 371,
    name: '5 PSV 1',
    subjectId: 13,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 372,
    name: '5 PSV 2',
    subjectId: 13,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8080,
    teacherId: TEACHER_1919,
  },
  {
    kind: 'classroom',
    id: 517,
    name: '5 Simulasi',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8880,
    teacherId: TEACHER_KL01,
  },
  {
    kind: 'classroom',
    id: 813,
    name: '5 CYBER',
    subjectId: 17,
    educationLevel: 'tingkatan-5',
    schoolId: SCHOOL_8082,
    teacherId: TEACHER_4402,
  },
  {
    kind: 'classroom',
    id: 1154,
    name: 'Chaos Academy',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    joinCode: 'PVZ601',
  },
  {
    kind: 'classroom',
    id: 1155,
    name: 'sains rumah tangga',
    subjectId: 28,
    educationLevel: 'tingkatan-5',
    joinCode: '0VV295',
  },
  {
    kind: 'classroom',
    id: 1156,
    name: '5 CYBER',
    subjectId: 28,
    educationLevel: 'tingkatan-5',
    joinCode: 'JOV330',
  },
]

/** The 2 observed school classes (M08 S3, link id `sc-{n}`): T4, no teacher, no subject. */
export const SCHOOL_CLASSES: readonly AnchorClass[] = [
  {
    kind: 'school_class',
    id: 419,
    name: 'T4 4 Bestari',
    subjectId: null,
    educationLevel: 'tingkatan-4',
    teacherId: null,
    schoolId: null,
  },
  {
    kind: 'school_class',
    id: 806,
    name: 'T4 4 Khawarizmi',
    subjectId: null,
    educationLevel: 'tingkatan-4',
    teacherId: null,
    schoolId: null,
  },
]

/** The 5 designed T5 classes outside the live range (M08 v1.3; M10 v1.5 XL2-45). */
export const DESIGNED: readonly AnchorClass[] = [
  {
    kind: 'classroom',
    id: 2001,
    name: '5 MARIKH - Kimia',
    subjectId: 10,
    educationLevel: 'tingkatan-5',
    joinCode: 'DMO101',
    schoolId: SCHOOL_DEMO,
    teacherId: TEACHER_GURU,
    createdAt: DESIGNED_AT,
  },
  {
    kind: 'classroom',
    id: 2002,
    name: '5 MARIKH - Sejarah',
    subjectId: 5,
    educationLevel: 'tingkatan-5',
    joinCode: 'DMO102',
    schoolId: SCHOOL_DEMO,
    teacherId: TEACHER_GURU,
    createdAt: DESIGNED_AT,
  },
  {
    kind: 'classroom',
    id: 2011,
    name: '5 BESTARI',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    joinCode: 'DMO201',
    schoolId: SCHOOL_8102,
    teacherId: TEACHER_FIXTURE_5302,
    createdAt: DESIGNED_AT,
  },
  {
    kind: 'classroom',
    id: 2012,
    name: '5 CEMERLANG',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    joinCode: 'DMO202',
    schoolId: SCHOOL_8102,
    teacherId: TEACHER_FIXTURE_5302,
    createdAt: DESIGNED_AT,
  },
  {
    kind: 'classroom',
    id: 2013,
    name: '5 GEMILANG',
    subjectId: null,
    educationLevel: 'tingkatan-5',
    joinCode: 'DMO203',
    schoolId: SCHOOL_8102,
    teacherId: TEACHER_FIXTURE_5302,
    createdAt: DESIGNED_AT,
  },
]

/** Ids of the anchors inside the live range. */
export const ANCHOR_IDS_IN_RANGE: ReadonlySet<number> = new Set(ANCHORS.map((a) => a.id))

// --- Observed class sizes (M10 §6.2.1 A anchors) ---------------------------------------------

/** Class → member count for the anchors whose size is observed. */
export const OBSERVED_SIZES: Readonly<Record<string, number>> = {
  'classroom:4': 58,
  'classroom:5': 53,
  'classroom:6': 54,
  'classroom:8': 58,
  'classroom:9': 53,
  'classroom:10': 54,
  'classroom:25': 0,
  'classroom:90': 0,
  'classroom:115': 0,
  'classroom:419': 5,
  'classroom:516': 15,
  'classroom:228': 93,
  'classroom:366': 19,
  'classroom:367': 15,
  'classroom:368': 33,
  'classroom:369': 20,
  'classroom:370': 30,
  'classroom:371': 25,
  'classroom:372': 22,
  'classroom:517': 15,
  'classroom:813': 44,
  'classroom:1154': 0,
  'classroom:1155': 0,
  'classroom:1156': 1,
  'classroom:2001': 8,
  'classroom:2002': 8,
  'school_class:419': 5,
  'school_class:806': 1,
}

// --- Designed pupil ids ----------------------------------------------------------------------

/** Members 3001–3008 of classes 2001 and 2002 (M08 v1.3). */
export const DEMO_PUPILS: readonly number[] = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008]
/** The 15 pupils of class 516 (M08 v1.2, M02 v1.13: 8880 grade-10 pupils). */
export const PUPILS_516: readonly number[] = Array.from({ length: 15 }, (_, i) => 3201 + i)
/** The single member of class 1156 (M10 v1.15, M02 v1.26). */
export const PUPIL_1156 = 4627
/** Class 370 members: 2021, 2022 and 2024–2051 (M17 §6.7 C, M02 users anchors). */
export const PUPILS_370: readonly number[] = [
  2021,
  2022,
  ...Array.from({ length: 28 }, (_, i) => 2024 + i),
]
/** The M17 "today" pupil, in class 813 only (M10 §6.2.1 "{n} GURU"). */
export const PUPIL_2016 = 2016
/** The 90 complimentary pupils (M02 §6.14): 2011 ← 5901–5930, 2012 ← 5931–5960 + 5901, 2013 ← 5961–5990 + 5901. */
export const COMPLIMENTARY_IDS: readonly number[] = Array.from({ length: 90 }, (_, i) => 5901 + i)
/** The 30 M19 payers at 8102: grade 11, "no class" (M02 XR-M19-02). */
export const M19_PAYER_IDS: readonly number[] = [
  3301, 3302, 3303, 3304, 3305, 3306, 3307, 3308, 3309, 3310, 3311, 3312, 3313, 3314, 3315, 3316,
  3317, 3318, 3319, 3320, 3321, 3322, 3323, 3324, 3614, 4373, 5450, 5451, 5475, 5600,
]

// --- User anchors (not "generated" rows) ---------------------------------------------------

/**
 * Id blocks of the users dataset that other modules claim as anchors (M02 SRS v1.26 §6.14, §6.15 D;
 * the users store header). A user in a block is never picked as a generated pupil or owner: an
 * anchor may lack an explicit e-mail, so the e-mail pattern alone cannot tell it from a generated row.
 */
export const RESERVED_USER_BLOCKS: readonly (readonly [number, number])[] = [
  [1, 11],
  [1919, 1919],
  [2001, 2060],
  [3001, 3008],
  [3101, 3109],
  [3151, 3152],
  [3201, 3215],
  [3301, 3324],
  [3614, 3614],
  [4001, 4108],
  [4201, 4208],
  [4301, 4358],
  [4373, 4373],
  [4401, 4402],
  [4418, 4418],
  [4501, 4504],
  [4627, 4627],
  [4644, 4644],
  [4664, 4664],
  [5001, 5990],
]

export function isReservedUser(id: number): boolean {
  return RESERVED_USER_BLOCKS.some(([a, b]) => id >= a && id <= b)
}

// --- Sizes of the anchors chosen in the build -------------------------------------------------

/** 8082: Σ distinct pupils in the classes of its 14 owners (M17 §6.7 C). */
export const SCHOOL_8082_COVERED = 515
export const SCHOOL_8082_OWNERS = 14
/** 8080's classes 366–369, 371, 372 (class 370 is fixed). */
export const SIZES_8080: readonly (readonly [number, number])[] = [
  [366, 19],
  [367, 15],
  [368, 33],
  [369, 20],
  [371, 25],
  [372, 22],
]

// --- T4 trio (BM twins 4/5/6 = SEJ twins 8/9/10) and the small classes -------------------------

export const TRIO_TARGETS: readonly (readonly [number, number])[] = [
  [4, 58],
  [5, 53],
  [6, 54],
]
export const TRIO_SEJ: Readonly<Record<number, number>> = { 4: 8, 5: 9, 6: 10 }
export const SMALL_419 = 5
export const SMALL_SC419 = 5
export const SMALL_SC806 = 1

// --- The 8 M18 schools' class memberships (table A.1, R2-05) --------------------------------

export interface SchoolSets {
  school: number
  /** Pupils in a T4-class / T5-class / both (table A.1). */
  n4: number
  n5: number
  both: number
  /** T4 memberships per trio class (4, 5, 6) when the S29 counts are known; else spread. */
  trio?: readonly [number, number, number]
  /** T5 twin memberships per twin class ("Bestari", "Cemerlang", "Dedikasi") when known. */
  twins?: readonly [number, number, number]
}

export const M18_SCHOOL_SETS: readonly SchoolSets[] = [
  // 8765: "4 Bestari" 9, "4 Cemerlang" 8, "4 Dedikasi" 4, "5 Bestari" 3, "5 Cemerlang" 4 (M18 S29).
  { school: 8765, n4: 14, n5: 7, both: 4, trio: [9, 8, 4], twins: [3, 4, 0] },
  { school: 8772, n4: 3, n5: 6, both: 1 },
  { school: 8767, n4: 5, n5: 3, both: 0 },
  // 7780: "4 Bestari" 1, "4 Cemerlang" 3, "4 Dedikasi" 5, "5 Bestari" 2, "5 Cemerlang" 3.
  { school: 7780, n4: 5, n5: 3, both: 0, trio: [1, 3, 5], twins: [2, 3, 0] },
  { school: 3160, n4: 9, n5: 3, both: 3 },
  { school: 2700, n4: 10, n5: 5, both: 5 },
  { school: 2710, n4: 2, n5: 1, both: 1 },
  { school: 1, n4: 8, n5: 4, both: 3 },
]

/** The k = 36 re-homed pupils in the 8 schools' classes (7780 5, 1 9, 3160 9, 2700 10, 2710 2, 8772 1). */
export const REHOMED_IN_CLASS: Readonly<Record<number, number>> = {
  8772: 1,
  7780: 5,
  3160: 9,
  2700: 10,
  2710: 2,
  1: 9,
}

/** Names of the six generated T5 twins (M18 S29: "4 / 5 Bestari / Cemerlang / Dedikasi - BM / SEJ"). */
export const TWIN_NAMES: readonly string[] = ['Bestari', 'Cemerlang', 'Dedikasi']
