/**
 * The `questionSets` repository (owner **M10**; SRS M10 v1.15 §6.6 DATA-M10-05, BR-M10-18; F-30).
 * M05 reads it through the seam `questionSets.visibleFor(userId)`: a student sees the sets of the
 * classes they are actively enrolled in whose status is `published`, or `scheduled` with
 * `scheduledAt` ≤ now; a `draft` is never visible. Attempts used are M05 Q-SESS-LINK.
 *
 * `role` (BR-M10-18): inside a `groupTag` the earliest-created set is TOV, the others AR.
 */

import { clock } from '@/lib/time'
import { defineRepository } from '@/mock/repository'

import { questionSetsTable } from '../tables/tables'
import { classroomsRepo } from './classrooms'
import type { ClassroomKind, QuestionSetRow } from './types'

export type SetRole = 'TOV' | 'AR'

export interface QuestionSetInput {
  teacherId: number
  classroomKind: ClassroomKind
  classroomId: number
  subjectId: number | null
  title: string
  description?: string | null
  groupTag?: string | null
  timeLimitMinutes?: number | null
  maxAttempts?: number
  status: QuestionSetRow['status']
  scheduledAt?: string | null
  questionIds?: readonly number[]
}

let nowFn: () => number = () => clock.now()

export const questionSetsRepo = defineRepository({
  owner: 'M10',
  name: 'questionSets',
  store: questionSetsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: the clock the visibility rule reads (every boot). */
    beginSeed(now: () => number): void {
      nowFn = now
    },

    /** Seed phase (finalise): the designed sets of §6.11. */
    seed(rows: readonly QuestionSetRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r, questionIds: [...r.questionIds] })
      })
    },

    get(id: number): QuestionSetRow | undefined {
      return store.get(id)
    },

    forTeacher(teacherId: number): QuestionSetRow[] {
      return store
        .query({ where: { teacherId } })
        .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    },

    forClass(kind: ClassroomKind, classId: number): QuestionSetRow[] {
      return store
        .query({ where: { classroomId: classId }, match: (s) => s.classroomKind === kind })
        .rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
    },

    /** M05 seam: the sets a student may start (BR-M10-18), oldest first. */
    visibleFor(userId: number, at?: number): QuestionSetRow[] {
      const now = at ?? nowFn()
      const classes = new Set(
        classroomsRepo
          .enrolmentsOf(userId)
          .flatMap((e) => (e.status === 'active' ? [e.classKey] : [])),
      )
      return store
        .query({
          match: (s) =>
            classes.has(`${s.classroomKind}:${String(s.classroomId)}`) &&
            (s.status === 'published' ||
              (s.status === 'scheduled' &&
                s.scheduledAt !== null &&
                Date.parse(s.scheduledAt) <= now)),
        })
        .rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
    },

    /** BR-M10-18: TOV = the earliest-created set of its group tag, AR = the others; null without a tag. */
    roleOf(id: number): SetRole | null {
      const s = store.get(id)
      if (!s || s.groupTag === null) return null
      const group = store
        .query({ match: (x) => x.groupTag === s.groupTag && x.teacherId === s.teacherId })
        .rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
      return group[0]?.id === s.id ? 'TOV' : 'AR'
    },

    /** Runtime creation (M10 S13). */
    create(input: QuestionSetInput, now: string): QuestionSetRow {
      return transaction(() =>
        store.insert({
          teacherId: input.teacherId,
          classroomKind: input.classroomKind,
          classroomId: input.classroomId,
          subjectId: input.subjectId,
          title: input.title,
          description: input.description ?? null,
          groupTag: input.groupTag ?? null,
          timeLimitMinutes: input.timeLimitMinutes ?? null,
          maxAttempts: input.maxAttempts ?? 0,
          status: input.status,
          scheduledAt: input.scheduledAt ?? null,
          questionIds: [...(input.questionIds ?? [])],
          createdAt: now,
        }),
      )
    },
  }),
})

export type QuestionSetsRepository = typeof questionSetsRepo
