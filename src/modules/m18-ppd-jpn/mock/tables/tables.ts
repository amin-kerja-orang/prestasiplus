/**
 * M18-owned stores (SRS M18 v1.8 §6.2, §6.5): AmaranIntervention (DATA-M18-01) and the correction
 * aggregate's subject rows (DATA-M18-04). Runtime ids of interventions start at 1,000 (§6.2).
 */

import { defineTable, floor, opaque } from '@/mock/define'

import type { AmaranInterventionRow, CorrectionSubjectRow } from '../repository/types'

export const amaranInterventionsTable = defineTable<AmaranInterventionRow>({
  name: 'm18.amaranInterventions',
  ids: floor({ start: 1_000 }),
  indexes: ['studentId', 'schoolId', 'teacherId'],
})

export const correctionSubjectsTable = defineTable<CorrectionSubjectRow>({
  name: 'm18.correctionSubjects',
  // The id is the natural key `"{schoolId}:{subjectId}"`, always given on insert.
  ids: opaque('k_', 'm18:natural-keys', 12),
  indexes: ['schoolId'],
})

export const M18_TABLES = {
  amaranInterventions: amaranInterventionsTable,
  correctionSubjects: correctionSubjectsTable,
}
