import { Inject, Injectable, Logger } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../db/clock'
import type { TxClient } from '../../../db/client'
import { PrismaService } from '../../../db/prisma.service'
import { GamificationService } from '../../gamification'
import { practiceRewardSource, type PracticeRewardPort, type PracticeRewardResult, type PracticeSessionCompleted } from '../../practice/ports'
import { StreakService, WalletService } from '../../wallet'
import type { BijakRewardInput, BijakRewardPort } from '../attempts/ports'
import { ACHIEVEMENT_PRACTICE_MODES } from './practice-facts'

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
 * BE-16 `BijakRewardPort` -> BE-11. BE-16 calls it once per closed EXAM attempt (never a latihan, F3; never an
 * abandoned attempt) after the commit. Everything it writes is one transaction, in the BE-11 lock order (streak, then
 * wallet):
 * - the streak ("kombo") is touched on the day the attempt closed (idempotent per day), like a practice session;
 * - the syiling are credited with `sourceId = attemptId`, so a repeated call is a replay that writes nothing (BE-11 idempotency);
 * - the XP (`points`, 10 per mark, 2 syiling and 10 XP per mark as V2 `PracticeRecorder`, `docs/discovery/BIJAK-SPM-cloud.md` 4.5) is added to the wallet only when that credit was NEW (`addXp` has no ledger key of its own),
 *   so a replay never pays the XP twice.
 *
 * Evidence against AC-R1-10.1 (`docs/requirements/v3-bijak-spm-scope.md`): the V2 notes (`docs/discovery/BIJAK-SPM-cloud.md` 4.5) document the
 * aggregate `practice_sessions` row and the rates (2 syiling and 10 XP per mark), but do NOT document the kombo (streak) step of V2
 * `PracticeRecorder` line by line. The streak touch here is therefore parity with the V3 practice reward port (`WalletPracticeReward`: a
 * completed session touches the streak) and with the M14 rule that kombo is the daily streak; confirm against the V2 code when it is available.
 * AC-R1-10.2 (lead decision): Cuba Lagi is a new attempt and earns again, as V2 does (one award per ATTEMPT, key = attemptId).
 *
 * AC-20.3 (`docs/requirements/v2-bijak-spm.md`): "Given Mod Pelajar, then no rewards are credited". An `isTest` attempt
 * therefore writes NO ledger row, moves no balance, no XP and no streak (#45 M2). The coins are floored (half marks give a
 * fraction) and a result of 0 or less credits nothing (the wallet refuses it), but the streak still counts a closed exam.
 */
@Injectable()
export class WalletBijakReward implements BijakRewardPort {
  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(StreakService) private readonly streaks: StreakService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async award(input: BijakRewardInput): Promise<void> {
    if (input.isTest) return // AC-20.3: Mod Pelajar earns no rewards
    const amount = wholeCount(input.coins)
    const xp = wholeCount(input.points)
    await this.prisma.transaction(async (tx) => {
      // The day the attempt closed. Never later than the server clock (a swept attempt carries the time it was closed, but a skewed
      // or corrupt value must not make the streak refuse with "at is in the future"): then the day of now counts.
      const closed = input.submittedAt instanceof Date && !Number.isNaN(input.submittedAt.getTime()) && input.submittedAt.getTime() <= this.clock.now().getTime() ? input.submittedAt : undefined
      await this.streaks.touch(input.userId, { ...(closed ? { at: closed } : {}), tx })
      if (!(amount >= 1)) return // a zero score earns nothing; the wallet refuses a non-positive credit
      const credited = await this.wallet.credit(
        {
          userId: input.userId,
          amount,
          isTest: input.isTest,
          source: BIJAK_REWARD_SOURCE,
          sourceId: input.attemptId,
          description: input.description,
        },
        { tx },
      )
      if (!credited.replayed && xp > 0) await this.wallet.addXp({ userId: input.userId, amount: xp, isTest: input.isTest }, { tx })
    })
  }
}

/**
 * BE-12 `PracticeRewardPort` -> BE-11, inside the submit transaction (a throw rolls the submit back), in the
 * BE-11 lock order (streak, then wallet), as BE-12's `ports.ts` documents:
 * streak touch, an idempotent credit of the session coins (`sourceId = sessionId`), then the stored session
 * result. The ledger `source` follows the mode (`practiceRewardSource(mode)`, M14 BR-M14-03: `quiz_spm` for
 * the SPM modes, `quiz_pksk` for pksk, else `quiz_practice`).
 *
 * Challenges: `GamificationService.settleChallenges` (BR-M14-12/13, order: session credit, streak, challenges), then
 * the achievements (`evaluateAchievements`, BR-M14-16, practice modes only).
 *
 * Mod Pelajar: the practice card (BE-12 AC 8) only says the writes are stamped `is_test`; it has no
 * "no rewards" rule like Bijak AC-20.3, so the credit is written and stamped. The streak is not moved:
 * `StreakService` has no `is_test` flag, so the admin's streak row would be real data (open question in the PR).
 */
@Injectable()
export class WalletPracticeReward implements PracticeRewardPort {
  private readonly logger = new Logger(WalletPracticeReward.name)

  constructor(
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(StreakService) private readonly streaks: StreakService,
    @Inject(GamificationService) private readonly gamification: GamificationService,
  ) {}

  async onSessionCompleted(input: PracticeSessionCompleted, tx: TxClient): Promise<PracticeRewardResult> {
    const streak = input.isTest ? await this.streaks.get(input.userId, { tx }) : await this.streaks.touch(input.userId, { at: input.completedAt, tx })
    const coins = wholeCount(input.sessionCoins)
    const totalBalance =
      coins >= 1
        ? (
            await this.wallet.credit(
              { userId: input.userId, amount: coins, isTest: input.isTest, source: practiceRewardSource(input.mode), sourceId: input.sessionId, description: PRACTICE_REWARD_DESCRIPTION },
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
    // BR-M14-13 (FIX-3 D-07): after the streak and the session credit, every active challenge whose target is now met
    // is claimed once per Malaysia day (completion row + `daily_challenge` ledger row; Mod Pelajar rows are is_test).
    // The submit response keeps the session credit only (the contract block has no challenge field).
    // A challenge reward is a bonus too: it runs in a savepoint and its failure only skips the challenge progress and rewards
    // of this call, never the submit (the session, the answers and the session credit stay committed).
    await this.inSavepoint('challenges_settle', 'challenge settlement', input, tx, () =>
      this.gamification.settleChallenges(input.userId, { tx, isTest: input.isTest, at: input.completedAt }),
    )
    // BR-M14-16 / FR-M14-51: after the challenges, a PRACTICE-mode session (`random`, `chapter`, `revision`) evaluates the
    // achievement criteria; each unlock is once per user and pays its syiling + XP once (ledger `achievement`, key `achievement:<id>`).
    // An achievement is a bonus: it runs in a savepoint and its failure only skips the unlock, never the submit.
    if ((ACHIEVEMENT_PRACTICE_MODES as readonly string[]).includes(input.mode)) await this.inSavepoint('achievements_eval', 'achievement evaluation', input, tx, () => this.gamification.evaluateAchievements(input.userId, { tx, isTest: input.isTest, at: input.completedAt }))
    return { coinsEarned: result.coinsEarned, streakCount: result.streakCount, totalBalance: result.totalBalance }
  }

  /**
   * Runs a bonus step of the submit inside a SAVEPOINT of the submit transaction. If it throws (a rule or a database error), the
   * work it did is rolled back to the savepoint, the error name is logged (no user data) and the submit carries on with the
   * session, the answers and the credit committed. `savepoint` is one of the two fixed names below, never client input.
   */
  private async inSavepoint(savepoint: 'achievements_eval' | 'challenges_settle', label: string, input: PracticeSessionCompleted, tx: TxClient, step: () => Promise<unknown>): Promise<void> {
    await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)
    try {
      await step()
    } catch (err) {
      this.logger.warn(`${label} skipped for session ${input.sessionId}: ${err instanceof Error ? err.name : 'unknown error'}`)
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    }
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`)
  }
}
