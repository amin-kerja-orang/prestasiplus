import { Inject, Injectable } from '@nestjs/common'
import type { GamificationChallengeClaimResult } from '@pp/contract'
import { GAMIFICATION_CLAIM_ERRORS, GAMIFICATION_MESSAGES as MSG } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { WalletService } from '../wallet'
import { idempotencyConflict } from '../wallet/errors'
import { lifetimeTierOf } from '../wallet/rules'
import { CLAIM_NOTICES, MOD_PELAJAR_REFUSAL } from './gamification.constants'
import { GamificationRepository, type ClaimRecord } from './gamification.repository'
import { GamificationService, type Viewer } from './gamification.service'

const stored = (c: ClaimRecord): GamificationChallengeClaimResult => ({ claimed: true, rewardSyiling: c.rewardSyiling, rewardXp: c.rewardXp })

/**
 * API-GAME-11 (S7-T04, rulings 12, 20 and 21 on #500): the pupil claims the reward of a finished Cabaran Harian once per
 * Malaysia day. Completing a challenge pays nothing (`GamificationService.completeChallenge`); this is the only place the
 * reward is credited. One transaction; the order of the checks is the ruling's order.
 */
@Injectable()
export class ChallengeClaimsService {
  constructor(
    private readonly repo: GamificationRepository,
    @Inject(GamificationService) private readonly gamification: GamificationService,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async claim(viewer: Viewer, challengeId: bigint, clientUuid: string | null): Promise<GamificationChallengeClaimResult> {
    // 1. Mod Pelajar never earns real rewards.
    if (viewer.isTest) throw ApiError.of('FORBIDDEN', { message: MOD_PELAJAR_REFUSAL })
    const userId = viewer.userId
    const id = String(challengeId)
    const uuid = clientUuid === null ? null : clientUuid.toLowerCase()
    return this.prisma.transaction(async (tx) => {
      const now = this.clock.now()
      const day = mytDay(now)
      // 2. No such challenge, or not active.
      const challenge = await this.repo.challenge(tx, challengeId)
      if (!challenge || !challenge.isActive) throw ApiError.of('NOT_FOUND', { message: MSG.challengeNotFound })
      // 3. A claim of the day exists: the same key replays it, anything else is "already claimed".
      const existing = await this.repo.claimOf(tx, userId, id, day)
      if (existing) return this.again(existing, uuid)
      // 4. The key already sits on another claim of this user.
      if (uuid !== null && (await this.repo.claimUuidUsed(tx, userId, uuid))) {
        // Same-key race: the first press may have committed between step 3 and this check (each statement takes its own
        // READ COMMITTED snapshot). Re-read the claim of the day: if it is there, the key sits on THIS claim, so replay it.
        const winner = await this.repo.claimOf(tx, userId, id, day)
        if (winner) return this.again(winner, uuid)
        throw idempotencyConflict()
      }
      // 5. Progress below the target (a completion row of the day counts as done).
      const done = (await this.repo.completedOn(tx, userId, day)).has(id)
      if (!done && (await this.gamification.challengeProgressOn(tx, userId, day, challenge)) < challenge.targetValue) {
        throw new ApiError({ code: 'CHALLENGE_NOT_DONE', ...GAMIFICATION_CLAIM_ERRORS.CHALLENGE_NOT_DONE })
      }
      // 6. Claim: the stored amounts are what is actually credited (no syiling when coins are off for the pupil).
      const syiling = challenge.rewardSyiling > 0 && (await this.gamification.coinsEnabled(userId, { tx })) ? challenge.rewardSyiling : 0
      const xp = challenge.rewardXp
      const inserted = await this.repo.insertClaim(tx, { userId, challengeId: id, day, rewardSyiling: syiling, rewardXp: xp, clientUuid: uuid, at: now })
      if (!inserted) {
        // Two presses at once: the other one committed first. Apply step 3 (or 4) to what it wrote.
        const winner = await this.repo.claimOf(tx, userId, id, day)
        if (winner) return this.again(winner, uuid)
        throw idempotencyConflict()
      }
      const notices: string[] = []
      if (syiling > 0) {
        const tiers = await this.repo.tiers(tx)
        const before = lifetimeTierOf(tiers, await this.repo.lockWallet(tx, userId))
        const out = await this.wallet.credit(
          { userId, amount: syiling, source: 'challenge', sourceId: `challenge:${id}:${day}`, description: `Cabaran selesai: ${challenge.title}`, isTest: false },
          { tx: tx as TxClient },
        )
        const after = tiers.find((t) => t.tierName === out.tierKey)
        if (after && before && after.id !== before.id) notices.push(CLAIM_NOTICES.tierUp(after.labelMs))
      }
      if (xp > 0) await this.wallet.addXp({ userId, amount: xp, isTest: false }, { tx: tx as TxClient })
      return { claimed: true, rewardSyiling: syiling, rewardXp: xp, ...(notices.length > 0 ? { notices } : {}) }
    })
  }

  private again(row: ClaimRecord, uuid: string | null): GamificationChallengeClaimResult {
    if (uuid !== null && row.clientUuid === uuid) return stored(row)
    throw new ApiError({ code: 'CHALLENGE_CLAIMED', ...GAMIFICATION_CLAIM_ERRORS.CHALLENGE_CLAIMED })
  }
}
