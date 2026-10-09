/**
 * The M18-owned repositories (D12): `amaranInterventions` (DATA-M18-01) and `correctionSubjects`
 * (DATA-M18-04, the live `correction:backfill` output). Reads only here; the intervention writes
 * (§7 #26-#28) belong to a later task.
 */

import { defineRepository } from '@/mock/repository'

import { amaranInterventionsTable, correctionSubjectsTable } from '../tables/tables'
import type { AmaranInterventionRow, CorrectionSubjectRow } from './types'

export const amaranInterventionsRepo = defineRepository({
  owner: 'M18',
  name: 'amaranInterventions',
  store: amaranInterventionsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: the observed rows (ids kept). */
    seed(rows: readonly AmaranInterventionRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
    get: (id: number): AmaranInterventionRow | undefined => store.get(id),
    /** Rows of a school, newest `interventionDate` first (ties by id descending). */
    forSchool(schoolId: number): AmaranInterventionRow[] {
      return store
        .query({ where: { schoolId } })
        .rows.sort((a, b) => b.interventionDate.localeCompare(a.interventionDate) || b.id - a.id)
    },
    forStudent(studentId: number): AmaranInterventionRow[] {
      return store.query({ where: { studentId } }).rows.sort((a, b) => b.id - a.id)
    },
  }),
})

export const correctionSubjectsRepo = defineRepository({
  owner: 'M18',
  name: 'correctionSubjects',
  store: correctionSubjectsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: the observed rows (insertion order = "order as stored"). */
    seed(rows: readonly CorrectionSubjectRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },
    /** The rows of a school in stored order. */
    forSchool(schoolId: number): CorrectionSubjectRow[] {
      return store.query({ where: { schoolId } }).rows.sort((a, b) => a.position - b.position)
    },
  }),
})
