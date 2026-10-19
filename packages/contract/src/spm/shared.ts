import { z } from '../zod'

/**
 * Internal helpers and shared enums of the SPM hub contract (BE-41, M06 "SPM classic").
 *
 * The frontend mock (`src/modules/m06-spm`) is the wire spec. Ids that the mock keeps as numbers are
 * `Id` strings on the wire (UD-1); subject `code`s (the curriculum codes `BM`, `MATH`, ...) stay
 * plain strings. This folder never imports another domain folder, so subject ids, practice stats
 * and question ids are described locally with the same field names the owners use.
 */

/** Messages the M06 routes raise (exact BM copy; generic codes are in `ErrorCode`). */
export const SPM_MESSAGES = {
  subjectInvalid: 'Sila pilih subjek.',
  paperInvalid: 'Paper mesti 1 atau 2.',
  answersInvalid: 'Jawapan tidak sah.',
  mockAlreadySubmitted: 'Mock ini sudah dihantar.',
  mockNotSubmitted: 'Mock belum dihantar.',
  walkthroughImageInvalid: 'Gambar tidak sah.',
  walkthroughEmpty: 'Sila masukkan soalan atau muat naik gambar soalan.',
  /** Default Laravel-style copy of the mock for an unknown code or a mock that is not the caller's. */
  notFound: 'Not Found.',
} as const

/** Module-specific error code of `GET /spm-mocks/{id}/result` on an `in_progress` mock (HTTP 409). */
export const SPM_ERROR_CODES = ['NOT_SUBMITTED'] as const
export const SpmErrorCodeSchema = z.enum(SPM_ERROR_CODES).meta({
  id: 'SpmErrorCode',
  description: 'Module error code carried by a 409 next to the generic CONFLICT.',
})
export type SpmErrorCode = z.infer<typeof SpmErrorCodeSchema>

/** Target families of a subject (BR-M06-04); the label is `SPM`, `Custom` or `Latihan`. */
export const SPM_TARGET_TYPES = ['spm', 'custom', 'latihan'] as const
export const SpmTargetTypeSchema = z.enum(SPM_TARGET_TYPES).meta({ id: 'SpmTargetType' })
export type SpmTargetType = z.infer<typeof SpmTargetTypeSchema>

/** Label used inside a Latih Tubi target option: `"<target> (Target <label>)"`. */
export const SPM_TARGET_TYPE_LABEL: Readonly<Record<SpmTargetType, string>> = {
  spm: 'SPM',
  custom: 'Custom',
  latihan: 'Latihan',
}

/** Computed set status (BR-M06-08): never stored. Startable = not `belum_cukup`. */
export const SPM_SET_STATUSES = ['bersih', 'bank_besar', 'belum_cukup'] as const
export const SpmSetStatusSchema = z.enum(SPM_SET_STATUSES).meta({ id: 'SpmSetStatus' })
export type SpmSetStatus = z.infer<typeof SpmSetStatusSchema>

/** Subject group on S3 and S8. */
export const SPM_SUBJECT_GROUPS = ['teras', 'elektif'] as const
export const SpmSubjectGroupSchema = z.enum(SPM_SUBJECT_GROUPS).meta({ id: 'SpmSubjectGroup' })
export type SpmSubjectGroup = z.infer<typeof SpmSubjectGroupSchema>

/** The `count` options of Latih Tubi for a subject without a target (`COUNT_OPTIONS`). */
export const SPM_COUNT_OPTIONS = [5, 10, 20, 30, 40, 50, 60] as const
/** `defaultCount` of a subject without a target. */
export const SPM_DEFAULT_COUNT = 10

/** Difficulty keys of `difficultyStats` (key `"1"` may be 0). */
export const SPM_DIFFICULTY_KEYS = ['1', '2', '3', '4', '5'] as const

/** Mock exam enums. */
export const SPM_MOCK_STATUSES = ['in_progress', 'submitted'] as const
export const SpmMockStatusSchema = z.enum(SPM_MOCK_STATUSES).meta({ id: 'SpmMockStatus' })
export type SpmMockStatus = z.infer<typeof SpmMockStatusSchema>

/** Grade bands (INFERRED, mock): >= 90 A+, 80 A, 70 B+, 60 B, 50 C, 45 D, 40 E, else G. */
export const SPM_MOCK_GRADES = ['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'G'] as const
export const SpmMockGradeSchema = z.enum(SPM_MOCK_GRADES).meta({ id: 'SpmMockGrade' })
export type SpmMockGrade = z.infer<typeof SpmMockGradeSchema>

/** Result hero colour: `bad` for G, `mid` for C, D, E, otherwise `good`. */
export const SPM_HERO_CLASSES = ['good', 'mid', 'bad'] as const
export const SpmHeroClassSchema = z.enum(SPM_HERO_CLASSES).meta({ id: 'SpmHeroClass' })
export type SpmHeroClass = z.infer<typeof SpmHeroClassSchema>

/** Paper number of a mock exam (`1` objective, `2` structured). */
export const SpmMockPaperNumberSchema = z
  .union([z.literal(1), z.literal(2)])
  .meta({ id: 'SpmMockPaperNumber', description: '1 = objective (30 items), 2 = structured (6 items of 10 marks).' })
export type SpmMockPaperNumber = z.infer<typeof SpmMockPaperNumberSchema>

/** The ten subjects of "Jana Mock SPM" (S11); the response `subject` stays free text. */
export const SPM_MOCK_SUBJECTS = [
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
] as const
export const SpmMockSubjectSchema = z.enum(SPM_MOCK_SUBJECTS).meta({ id: 'SpmMockSubject' })
export type SpmMockSubject = z.infer<typeof SpmMockSubjectSchema>

/** The fifteen subjects of the simulated walkthrough (S13): the ten above plus five more. */
export const SPM_WALKTHROUGH_SUBJECTS = [
  ...SPM_MOCK_SUBJECTS,
  'Pendidikan Moral',
  'Geografi',
  'Ekonomi',
  'Perdagangan',
  'Prinsip Akaun',
] as const
export const SpmWalkthroughSubjectSchema = z.enum(SPM_WALKTHROUGH_SUBJECTS).meta({ id: 'SpmWalkthroughSubject' })
export type SpmWalkthroughSubject = z.infer<typeof SpmWalkthroughSubjectSchema>
