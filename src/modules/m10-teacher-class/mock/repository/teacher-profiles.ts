/**
 * The `teacherProfiles` repository (owner **M10**; SRS M10 v1.16 §6.4 DATA-M10-03, BR-M10-30;
 * added by M10-T1 because F-30 did not model the profile). One row per teacher or admin who has a
 * profile; a user without a row has none (no school, empty fields). The profile school, not the user
 * school, drives S6 "Pelajar Sekolah" (observed: the admin has a user school but S6 says "Sekolah
 * belum ditetapkan").
 *
 * The profile edit (#71/#72, S32) belongs to a later task and reuses `forUser` / `save`.
 */

import { defineTable, floor, ID_RANGES } from '@/mock/define'
import { defineRepository } from '@/mock/repository'

/** DATA-M10-03. `id` is the public id of `/guru/{id}` (admin 3 and teacher 5's profile 4, observed). */
export interface TeacherProfileRow {
  id: number
  userId: number
  schoolId: number | null
  bio: string | null
  subject: string | null
  qualification: string | null
  experienceYears: number
}

export const teacherProfilesTable = defineTable<TeacherProfileRow>({
  name: 'm10.teacherProfiles',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
  indexes: ['userId'],
})

export type TeacherProfilePatch = Partial<Omit<TeacherProfileRow, 'id' | 'userId'>>

export const teacherProfilesRepo = defineRepository({
  owner: 'M10',
  name: 'teacherProfiles',
  store: teacherProfilesTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase: the designed profiles of §6.11. */
    seed(rows: readonly TeacherProfileRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r })
      })
    },

    forUser(userId: number): TeacherProfileRow | undefined {
      return store.query({ where: { userId } }).rows[0]
    },

    /** The profile school of a teacher (`null` = "Sekolah belum ditetapkan"). */
    schoolOf(userId: number): number | null {
      return store.query({ where: { userId } }).rows[0]?.schoolId ?? null
    },

    /** Creates the profile on first save (runtime id from 9,000,001) or updates it. */
    save(userId: number, patch: TeacherProfilePatch): TeacherProfileRow {
      return transaction(() => {
        const current = store.query({ where: { userId } }).rows[0]
        if (current) return store.update(current.id, patch)
        return store.insert({
          userId,
          schoolId: null,
          bio: null,
          subject: null,
          qualification: null,
          experienceYears: 0,
          ...patch,
        })
      })
    },
  }),
})

export type TeacherProfilesRepository = typeof teacherProfilesRepo
