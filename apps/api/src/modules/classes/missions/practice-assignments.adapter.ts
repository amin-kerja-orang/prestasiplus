import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { mytDay } from '../../../db/clock'
import { prngStream } from '../../../db/prng'
import { isIdString } from '../../../db/ids'
import type { AssignmentKind, AssignmentResolution, PracticeAssignmentSource } from '../../practice'
import { WalletService } from '../../wallet'
import { QuestionSetAssignments } from '../question-sets'
import { MISSION_REWARD_DESCRIPTION, MISSION_REWARD_SOURCE } from './missions.constants'
import { MissionsRepository, type MissionRecord } from './missions.repository'
import { QuestionPool } from './question-pool'
import { round } from './remedial.rules'

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
    @Inject(WalletService) private readonly wallet: WalletService,
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
    // `harian` (S6-T07) is served like `latih_tubi`: by the mission's subject.
    if (mission.missionType !== 'latih_tubi' && mission.missionType !== 'harian') return []
    const subjectId = mission.subjectId
    const rng = prngStream(`m10:mission:${mission.id}:${userId}`)
    if (mission.chapterId !== null) {
      const inChapter = await this.pool.draw({ subjectId, chapterId: mission.chapterId }, mission.questionCount, rng)
      if (inChapter.length > 0) return inChapter
    }
    return this.pool.draw({ subjectId, spmPool: true }, mission.questionCount, rng)
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
      isTest: input.isTest,
    })
  }

  /**
   * S6-T07, called by practice when a session with a `mission_id` completes, inside the submit transaction and after the reward port ran:
   * settles the once-only target reward of that mission (`settleTargetReward`) and, when it was paid by THIS call, credits it to the wallet
   * in the same transaction with ledger source `mission_target`, key `mission:<missionId>` and the label "Ganjaran misi" (the existing S7
   * `WalletService.credit`; the lock order stays streak, wallet, then the reward lock). Returns the coins credited by this call.
   */
  async payTargetReward(
    input: { userId: string; missionId: string; sessionId: string; isTest: boolean; at: Date },
    tx: TxClient,
  ): Promise<{ paid: number }> {
    const { paid } = await this.settleTargetReward(input, tx)
    if (paid > 0) {
      await this.wallet.credit(
        { userId: input.userId, amount: paid, isTest: input.isTest, source: MISSION_REWARD_SOURCE, sourceId: `mission:${input.missionId}`, description: MISSION_REWARD_DESCRIPTION },
        { tx },
      )
    }
    return { paid }
  }

  /**
   * S6-T07 (FR-GM-20.2, AC-GM-20.2, AC-GUR-2b-7), called inside the practice submit transaction (`tx`) when a session with a
   * `mission_id` completes. Pays the mission's `rewardCoins` ONCE per pupil and mission, when the pupil has reached the target.
   *
   * Count rule: "reaches targetQuestions" = the pupil's answered count is at least `question_count`, where the answered count is
   * the number of `practice_answers` rows (every answer, right or wrong) of the pupil's COMPLETED sessions linked to the mission,
   * summed over all of them; the session being completed is already stored in `tx`, so it counts. Only the Mod Pelajar flag
   * must match (`is_test`). A pupil who is not a stored recipient, and a reward of 0 or null pay nothing.
   * Returns the coins paid by THIS call: 0 when not met, when ineligible, or when already paid (unique `mission_rewards`).
   * Crediting the wallet is the caller's job (S7), in the same transaction.
   */
  async settleTargetReward(
    input: { userId: string; missionId: string; sessionId: string; isTest: boolean; at: Date },
    tx: TxClient,
  ): Promise<{ paid: number }> {
    if (!isRealId(input.missionId) || !isRealId(input.userId)) return { paid: 0 }
    await this.repo.lockTargetReward(tx, input.missionId, input.userId)
    const facts = await this.repo.targetRewardFacts(tx, { missionId: input.missionId, studentId: input.userId, isTest: input.isTest })
    if (!facts || !facts.recipient) return { paid: 0 }
    const coins = facts.rewardCoins ?? 0
    if (coins <= 0 || facts.answered < facts.questionCount) return { paid: 0 }
    const inserted = await this.repo.insertReward(tx, {
      missionId: input.missionId,
      studentId: input.userId,
      coins,
      sessionId: input.sessionId,
      isTest: input.isTest,
      paidAt: input.at,
    })
    return { paid: inserted ? coins : 0 }
  }
}
