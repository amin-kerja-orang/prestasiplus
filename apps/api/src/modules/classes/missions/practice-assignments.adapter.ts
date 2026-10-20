import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { mytDay } from '../../../db/clock'
import { prngStream } from '../../../db/prng'
import { isIdString } from '../../../db/ids'
import type { AssignmentKind, AssignmentResolution, PracticeAssignmentSource } from '../../practice'
import { QuestionSetAssignments } from '../question-sets'
import { MissionsRepository, type MissionRecord } from './missions.repository'
import { QuestionPool } from './question-pool'
import { round, shuffled } from './remedial.rules'

const isRealId = (s: string): boolean => isIdString(s) && s !== '0'

/**
 * BE-18 half of BE-12's `PracticeAssignmentSource`: mission and remedial resolution (the question_set
 * kind is delegated to `QuestionSetAssignments`). Rules are the mock M05 seams:
 * - mission: visible only to a stored recipient (mission_items) and only on its Malaysia day (mock
 *   `missions.forStudent(userId, today)`); unknown or not a recipient is `not_found`. Questions: `latih_tubi`
 *   draws `questionCount` eligible `mcq` questions, from the mission chapter when it has any, else from the
 *   subject's SPM pool (BR-M10-35); `tracking_a` and `youtube` have no question source yet (the mock's
 *   TODO), so the list is empty. The draw is deterministic per (mission, student).
 * - remedial: only the test's own student; unknown or cancelled is `not_found`; completed answers
 *   `completed: true`; the question ids are the stored items in `position` order.
 */
@Injectable()
export class PracticeAssignmentsAdapter implements PracticeAssignmentSource {
  constructor(
    @Inject(MissionsRepository) private readonly repo: MissionsRepository,
    @Inject(QuestionPool) private readonly pool: QuestionPool,
    @Inject(QuestionSetAssignments) private readonly sets: QuestionSetAssignments,
  ) {}

  async resolve(kind: AssignmentKind, input: { userId: string; id: string; at: Date }): Promise<AssignmentResolution> {
    if (kind === 'question_set') return this.sets.resolve(input)
    if (!isRealId(input.id)) return { status: 'not_found' }
    return kind === 'mission' ? this.mission(input) : this.remedial(input)
  }

  private async mission(input: { userId: string; id: string; at: Date }): Promise<AssignmentResolution> {
    const mission = await this.repo.missionOfRecipient(input.id, input.userId)
    if (!mission || mission.missionDate !== mytDay(input.at)) return { status: 'not_found' }
    return {
      status: 'ok',
      subjectId: mission.subjectId,
      questionIds: await this.missionQuestionIds(mission, input.userId),
      coinsPerCorrect: mission.coinsPerCorrect,
    }
  }

  /** BR-M10-35: eligible question ids of the mission for the student (empty = no pool). */
  private async missionQuestionIds(mission: MissionRecord, userId: string): Promise<string[]> {
    if (mission.missionType !== 'latih_tubi') return []
    const rng = prngStream(`m10:mission:${mission.id}:${userId}`)
    if (mission.chapterId !== null) {
      const chapterId = mission.chapterId
      const inChapter = await this.pool.ids({ subjectId: mission.subjectId }, (r) => r.version.chapterId === chapterId)
      if (inChapter.length > 0) return shuffled(inChapter, rng).slice(0, mission.questionCount)
    }
    const spm = await this.pool.ids({ subjectId: mission.subjectId }, (r) => r.spmPool)
    return shuffled(spm, rng).slice(0, mission.questionCount)
  }

  private async remedial(input: { userId: string; id: string }): Promise<AssignmentResolution> {
    const test = await this.repo.remedial(input.id)
    if (!test || test.studentId !== input.userId || test.status === 'cancelled') return { status: 'not_found' }
    const items = await this.repo.remedialItems(test.id)
    return {
      status: 'ok',
      subjectId: test.subjectId,
      questionIds: items.map((i) => i.questionId),
      ...(test.status === 'completed' ? { completed: true } : {}),
    }
  }

  async remedialCompleted(
    input: { remedialTestId: string; userId: string; afterAccuracy: number; completedAt: Date; isTest: boolean },
    tx: TxClient,
  ): Promise<void> {
    if (!isRealId(input.remedialTestId)) return
    await this.repo.completeRemedial(tx, {
      remedialTestId: input.remedialTestId,
      userId: input.userId,
      afterAccuracy: round(input.afterAccuracy, 1),
      completedAt: input.completedAt,
    })
  }
}
