/**
 * Bijak subject codes versus the curriculum codes (M03). The Bijak contract, the prototype data and
 * the frontend use MAT, SN and SEJ; the curriculum seed (BE-08) stores MATH, SCI and SEJ. Papers and
 * blueprints reference the curriculum `subjects` row; the API speaks the Bijak code. Any other
 * curriculum code is used unchanged (the dictionary is open, exam schema D9).
 */
const CURRICULUM_TO_BIJAK: Readonly<Record<string, string>> = { MATH: 'MAT', SCI: 'SN' }
const BIJAK_TO_CURRICULUM: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CURRICULUM_TO_BIJAK).map(([curriculum, bijak]) => [bijak, curriculum]),
)

export const bijakCodeOf = (curriculumCode: string): string => CURRICULUM_TO_BIJAK[curriculumCode] ?? curriculumCode

export const curriculumCodeOf = (bijakCode: string): string => BIJAK_TO_CURRICULUM[bijakCode] ?? bijakCode
