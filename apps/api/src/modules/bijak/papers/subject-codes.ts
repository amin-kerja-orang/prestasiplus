/**
 * Bijak subject codes versus the curriculum codes (M03). The Bijak contract, the prototype data and
 * the frontend use MAT, SN and SEJ; the curriculum seed (BE-08) stores MATH, SCI and SEJ. Papers and
 * blueprints reference the curriculum `subjects` row; the API speaks the Bijak code. Any other
 * curriculum code is used unchanged (the dictionary is open, exam schema D9).
 *
 * Stored Bijak data holds the BIJAK code: `exam_attempts.subject` (BE-16) and
 * `practice_attempt_aggregates.subject_code` (BE-12) are MAT / SN / SEJ, not MATH / SCI. A report that
 * filters by a curriculum subject (BE-19, BE-21) must convert first: `bijakCodeOf('MATH') === 'MAT'`, and
 * `curriculumCodeOf('MAT') === 'MATH'` to go back to the `subjects` row (#45 M6). Both are exported from
 * `bijak/papers/index.ts`.
 */
const CURRICULUM_TO_BIJAK: Readonly<Record<string, string>> = { MATH: 'MAT', SCI: 'SN' }
const BIJAK_TO_CURRICULUM: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CURRICULUM_TO_BIJAK).map(([curriculum, bijak]) => [bijak, curriculum]),
)

export const bijakCodeOf = (curriculumCode: string): string => CURRICULUM_TO_BIJAK[curriculumCode] ?? curriculumCode

export const curriculumCodeOf = (bijakCode: string): string => BIJAK_TO_CURRICULUM[bijakCode] ?? bijakCode
