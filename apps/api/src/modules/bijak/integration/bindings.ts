import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { PRACTICE_REWARD_SOURCE, type PracticeRewardPort, type PracticeRewardResult, type PracticeSessionCompleted } from '../../practice/ports'
import { StreakService, WalletService } from '../../wallet'
import type { BijakRewardInput, BijakRewardPort } from '../attempts/ports'

/**
 * Ledger `source` of a Bijak SPM paper reward: the SPM quiz code the M14 ledger already uses for SPM
 * practice (`quiz_spm`, see the mock `m14-gamification` rules). Together with `sourceId = attemptId` it is
 * the idempotency key of the credit.
 */
export const BIJAK_REWARD_SOURCE = 'quiz_spm'

/** Static BM ledger text of a practice session credit (BE-12 `ports.ts`; PDPA: no name, no identifier). */
export const PRACTICE_REWARD_DESCRIPTION = 'Latihan: jawapan betul'

/** A non-negative whole number of coins or points; anything not finite counts as 0 (never NaN into the wallet). */
export const wholeCount = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

/**
 * BE-16 `BijakRewardPort` -> BE-11 `WalletService.credit`. BE-16 calls it once per closed EXAM attempt
 * (never a latihan, F3) after the commit; `sourceId = attemptId` makes a repeated call a replay that
 * writes nothing (BE-11 idempotency). `isTest` is passed through unchanged (Mod Pelajar rows are flagged).
 */
@Injectable()
export class WalletBijakReward implements BijakRewardPort {
  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  async award(input: BijakRewardInput): Promise<void> {
    const amount = wholeCount(input.coins)
    if (!(amount >= 1)) return // a zero score earns nothing; the wallet refuses a non-positive credit
    await this.wallet.credit({
      userId: input.userId,
      amount,
      isTest: input.isTest,
      source: BIJAK_REWARD_SOURCE,
      sourceId: input.attemptId,
      description: input.description,
    })
  }
}

/**
 * BE-12 `PracticeRewardPort` -> BE-11, inside the submit transaction (a throw rolls the submit back), in the
 * BE-11 lock order (streak, then wallet), as BE-12's `ports.ts` documents:
 * streak touch, an idempotent credit of the session coins (`quiz_practice`, `sourceId = sessionId`), then the
 * stored session result. A Mod Pelajar (test) session does not move the streak: `StreakService` has no
 * `is_test` flag, so the admin's streak row would be real data (open question in the PR).
 */
@Injectable()
export class WalletPracticeReward implements PracticeRewardPort {
  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(StreakService) private readonly streaks: StreakService,
  ) {}

  async onSessionCompleted(input: PracticeSessionCompleted, tx: TxClient): Promise<PracticeRewardResult> {
    const streak = input.isTest ? await this.streaks.get(input.userId, { tx }) : await this.streaks.touch(input.userId, { at: input.completedAt, tx })
    const coins = wholeCount(input.sessionCoins)
    const totalBalance =
      coins >= 1
        ? (
            await this.wallet.credit(
              { userId: input.userId, amount: coins, isTest: input.isTest, source: PRACTICE_REWARD_SOURCE, sourceId: input.sessionId, description: PRACTICE_REWARD_DESCRIPTION },
              { tx },
            )
          ).currentSyiling
        : (await this.wallet.summary(input.userId, { tx })).currentSyiling
    const { result } = await this.wallet.recordSessionCredit(
      {
        sessionId: input.sessionId,
        userId: input.userId,
        coinsEarned: coins,
        pointsEarned: wholeCount(input.pointsEarned),
        streakCount: streak.current,
        totalBalance,
        completedAt: input.completedAt,
        isTest: input.isTest,
      },
      { tx },
    )
    return { coinsEarned: result.coinsEarned, streakCount: result.streakCount, totalBalance: result.totalBalance }
  }
}
