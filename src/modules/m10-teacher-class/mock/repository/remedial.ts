/**
 * The `remedialTests` repository (owner **M10**; SRS M10 v1.15 §6.8 DATA-M10-09, BR-M10-12/13;
 * F-30). M05 reads and updates it through the seams:
 * - `forStudent(userId)`: the student's own tests (M05 #20, the student start, BR-32);
 * - `complete(id, {afterAccuracy, completedAt})`: the test becomes `completed` when the M05
 *   session is submitted;
 * - `get(id, viewer)`: the read-only Q4 preview (XL2-48). It returns the test **only** to its own
 *   teacher or to an admin and `null` to any other viewer or for an unknown id. The SRS names
 *   `get(id)` and speaks of "the current viewer"; a repository has no session, so the caller passes
 *   the viewer (SRS gap, reported).
 */

import { users } from '@/modules/m01-authentication/mock'
import { defineRepository } from '@/mock/repository'

import { remedialTestsTable } from '../tables/tables'
import type { RemedialTestRow, Viewer } from './types'

/** The Q4 preview shape (§6.8). */
export interface RemedialPreview {
  id: number
  teacherId: number
  teacherName: string
  studentId: number
  studentName: string
  subjectName: string
  totalQuestions: number
  questionIds: number[]
  status: RemedialTestRow['status']
  beforeAccuracy: number
  afterAccuracy: number | null
  createdAt: string
  completedAt: string | null
}

export interface RemedialInput {
  teacherId: number
  studentId: number
  subjectId: number
  subjectCode: string
  subjectName: string
  questionIds: readonly number[]
  beforeAccuracy: number
}

export const remedialTestsRepo = defineRepository({
  owner: 'M10',
  name: 'remedialTests',
  store: remedialTestsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase (finalise): the designed tests of §6.11. */
    seed(rows: readonly RemedialTestRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r, questionIds: [...r.questionIds] })
      })
    },

    getRow(id: number): RemedialTestRow | undefined {
      return store.get(id)
    },

    /** The student's tests of every status, newest first (M05 filters cancelled ones). */
    forStudent(userId: number): RemedialTestRow[] {
      return store
        .query({ where: { studentId: userId } })
        .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    },

    /** The teacher's tests, newest first (S3 progress reads them). */
    forTeacher(teacherId: number): RemedialTestRow[] {
      return store
        .query({ where: { teacherId } })
        .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    },

    /** The Q4 read-only preview: own teacher or admin, else `null`. */
    get(id: number, viewer: Viewer): RemedialPreview | null {
      const t = store.get(id)
      if (!t) return null
      if (!(viewer.role === 'admin' || viewer.id === t.teacherId)) return null
      return {
        id: t.id,
        teacherId: t.teacherId,
        teacherName: users.get(t.teacherId)?.name ?? '',
        studentId: t.studentId,
        studentName: users.get(t.studentId)?.name ?? '',
        subjectName: t.subjectName,
        totalQuestions: t.totalQuestions,
        questionIds: [...t.questionIds],
        status: t.status,
        beforeAccuracy: t.beforeAccuracy,
        afterAccuracy: t.afterAccuracy,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      }
    },

    /** Called by M05 when the remedial session is submitted (BR-M10-12). */
    complete(id: number, input: { afterAccuracy: number; completedAt: string }): void {
      const t = store.get(id)
      if (!t || t.status !== 'active') return
      transaction(() => {
        store.update(id, {
          status: 'completed',
          afterAccuracy: input.afterAccuracy,
          completedAt: input.completedAt,
        })
      })
    },

    /** S3 "Batal": an active test becomes `cancelled`. */
    cancel(id: number): boolean {
      const t = store.get(id)
      if (!t || t.status !== 'active') return false
      transaction(() => void store.update(id, { status: 'cancelled' }))
      return true
    },

    /** Runtime generation (M10 #…): an `active` test. */
    create(input: RemedialInput, now: string): RemedialTestRow {
      return transaction(() =>
        store.insert({
          teacherId: input.teacherId,
          studentId: input.studentId,
          subjectId: input.subjectId,
          subjectCode: input.subjectCode,
          subjectName: input.subjectName,
          questionIds: [...input.questionIds],
          totalQuestions: input.questionIds.length,
          status: 'active',
          beforeAccuracy: input.beforeAccuracy,
          afterAccuracy: null,
          createdAt: now,
          completedAt: null,
        }),
      )
    },
  }),
})

export type RemedialTestsRepository = typeof remedialTestsRepo
