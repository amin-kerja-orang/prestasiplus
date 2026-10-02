/**
 * The `missions` repository (owner **M10**; SRS M10 v1.15 §6.5 DATA-M10-04, BR-M10-17, BR-M10-35;
 * F-30). M05 reads it through the seams: `missions.forStudent(userId, date)` (the student's
 * missions of a day, M05 #21) and `missions.questionIdsFor(missionId, userId)` (the mission's
 * question ids, **eligible M04 ids only**, XL2-36).
 *
 * Pool by type (BR-M10-35): `latih_tubi` "Semua Bab" → Q-SPM-POOL(subject); with a chapter →
 * eligible MCQ of the subject in that chapter, and when that set is empty → Q-SPM-POOL(subject)
 * (PROPOSED fallback); `tracking_a` → the subject's Tracking A set (M06, not built: `[]`, TODO
 * XR-M10→M06); `youtube` → the viewer's Soalan & Rujukan MCQs (ReferenceSet, M10-T1: none seeded,
 * `[]`). The draw is deterministic per (mission, student).
 */

import { mulberry32 } from '@/mock/determinism/prng'
import { defineRepository } from '@/mock/repository'
import { questions } from '@/modules/m04-question-bank/mock'

import { h32 } from '../build/util'
import { missionsTable } from '../tables/tables'
import type { MissionRow, MissionType } from './types'

export interface MissionInput {
  teacherId: number
  title: string
  missionType: MissionType
  missionDate: string
  subjectId: number
  chapterId?: number | null
  questionCount: number
  resourceTitle?: string | null
  resourceUrl?: string | null
  resourceNote?: string | null
  recipientIds: readonly number[]
}

export const missionsRepo = defineRepository({
  owner: 'M10',
  name: 'missions',
  store: missionsTable,
  methods: ({ store, transaction }) => ({
    /** Seed phase (finalise): the designed missions of §6.11. */
    seed(rows: readonly MissionRow[]): void {
      transaction(() => {
        for (const r of rows) store.insert({ ...r, recipientIds: [...r.recipientIds] })
      })
    },

    get(id: number): MissionRow | undefined {
      return store.get(id)
    },

    /** The teacher's own missions, newest first. */
    forTeacher(teacherId: number): MissionRow[] {
      return store
        .query({ where: { teacherId } })
        .rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    },

    /** M05 #21: the missions of `date` (`YYYY-MM-DD`, MYT) whose recipients include the student. */
    forStudent(userId: number, date: string): MissionRow[] {
      return store
        .query({ where: { missionDate: date }, match: (m) => m.recipientIds.includes(userId) })
        .rows.sort((a, b) => a.id - b.id)
    },

    /** BR-M10-35: eligible M04 question ids of the mission for the student (`[]` = empty pool). */
    questionIdsFor(missionId: number, userId: number): number[] {
      const mission = store.get(missionId)
      if (!mission || !mission.recipientIds.includes(userId)) return []
      const seed = h32(`m10:mission:${String(missionId)}:${String(userId)}`)
      const count = mission.questionCount
      if (mission.missionType === 'latih_tubi') {
        if (mission.chapterId !== null) {
          const chapter = questions
            .practiceQuery({
              subjectId: mission.subjectId,
              curriculumChapterId: mission.chapterId,
              limit: count,
              seed,
            })
            .map((q) => q.id)
          if (chapter.length > 0) return chapter
        }
        return questions
          .spmPool({ subjectId: mission.subjectId })
          .sample(count, mulberry32(seed))
          .map((q) => q.id)
      }
      // TODO(XR-M10→M06): tracking_a draws the subject's Tracking A set questions from M06.
      // `youtube` uses the teacher's approved Soalan & Rujukan MCQs (M10-T1 ReferenceSet).
      return []
    },

    /** Runtime creation (M10 S12); recipients are the BR-M10-04 students at launch. */
    create(input: MissionInput, now: string): MissionRow {
      return transaction(() =>
        store.insert({
          teacherId: input.teacherId,
          title: input.title,
          missionType: input.missionType,
          missionSource: 'bank_soalan',
          missionDate: input.missionDate,
          subjectId: input.subjectId,
          chapterId: input.chapterId ?? null,
          questionCount: input.questionCount,
          coinsPerCorrect: 3,
          resourceTitle: input.resourceTitle ?? null,
          resourceUrl: input.resourceUrl ?? null,
          resourceNote: input.resourceNote ?? null,
          recipientIds: [...input.recipientIds],
          createdAt: now,
        }),
      )
    },
  }),
})

export type MissionsRepository = typeof missionsRepo
