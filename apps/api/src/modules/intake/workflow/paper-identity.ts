import type { TxClient } from '../../../db/client'

/**
 * Paper identity helpers shared by extraction (the `source_papers` row) and accept (the provenance of a question). S1-T03.
 */

/** `source_papers.exam_type` / `question_versions.exam_type` of a batch paper type; null when the type says nothing (general, other, dskp, ...). */
export function examTypeOfPaperType(paperType: string): 'sebenar' | 'percubaan' | 'latihan' | null {
  switch (paperType) {
    case 'exam':
    case 'peperiksaan':
      return 'sebenar'
    case 'trial':
      return 'percubaan'
    case 'exercise_book':
    case 'buku_latihan':
      return 'latihan'
    default:
      return null
  }
}

/** The wire level of an `education_levels.code` as an intake tag level and form of origin; null for a code the tag cannot hold (a Darjah). */
export function intakeLevelOf(code: string): { level: 'T1' | 'T2' | 'T3' | 'T4' | 'T5'; formOrigin: 'T1-T3' | 'T4' | 'T5' } | null {
  switch (code.toUpperCase()) {
    case 'T1':
    case 'T2':
    case 'T3':
      return { level: code.toUpperCase() as 'T1' | 'T2' | 'T3', formOrigin: 'T1-T3' }
    case 'T4':
      return { level: 'T4', formOrigin: 'T4' }
    case 'T5':
      return { level: 'T5', formOrigin: 'T5' }
    default:
      return null
  }
}

export const DEFAULT_SECTION_LABEL = 'Bahagian A'

/** The intake tag level and form of origin of a batch's declared level (`intake_batches.education_level_id`); null when the batch declared none. */
export async function batchTagLevel(db: Pick<TxClient, 'educationLevel'>, educationLevelId: bigint | null): Promise<ReturnType<typeof intakeLevelOf>> {
  if (educationLevelId === null) return null
  const row = await db.educationLevel.findUnique({ where: { id: educationLevelId }, select: { code: true } })
  return row ? intakeLevelOf(row.code) : null
}
