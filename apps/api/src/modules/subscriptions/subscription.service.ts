import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../common/errors/api-error'
import { AccountFlagsRepository } from './account-flags.repository'
import { mytDay } from './dates'
import { TRIAL_LIMIT } from './subscriptions.constants'
import { SubscriptionsRepository } from './subscriptions.repository'

/** Mock M05 BR-07 trial status. */
export interface TrialStatus {
  /** True while the user is NOT subscribed: the trial limit applies. */
  active: boolean
  used: number
  limit: number
  remaining: number
}

/**
 * Subscription access for the other cards (BE-12 and others). The single place that answers
 * "is this user subscribed" and "what is the trial".
 *
 * `isSubscribed(userId, at)` is TRUE when, on the Malaysian day of `at`:
 *  1. the user is a complimentary student whose package has not ended (`comp_students.package_expires_on`,
 *     that day included; the mock stores the same as an expiry of 23:59:59 on that date), or
 *  2. the user belongs to a school that has an `active` subscription covering that day
 *     (`starts_on <= day <= ends_on`).
 * Anything else, and an unknown user, is false. The mock's rule was "the user's own subscription expiry
 * is set and after `at`"; v2 has no such user column. Q6 (v2-data-migration) is OPEN: payments (paid,
 * unexpired) and PKSK access are not part of this derivation yet because their tables do not exist.
 * They join here, and only here, when Q6 is answered.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(AccountFlagsRepository) private readonly facts: AccountFlagsRepository,
    @Inject(SubscriptionsRepository) private readonly subscriptions: SubscriptionsRepository,
  ) {}

  async isSubscribed(userId: string, at: Date): Promise<boolean> {
    const facts = await this.facts.accessFacts(userId)
    return facts !== null && (await this.subscribedBy(facts, at))
  }

  /** `{ active, used, limit: TRIAL_LIMIT (50), remaining }` with `active = !subscribed`. An unknown user has used 0. */
  async trial(userId: string, at: Date): Promise<TrialStatus> {
    const facts = await this.facts.accessFacts(userId)
    const used = facts?.trialQuestionsUsed ?? 0
    const subscribed = facts !== null && (await this.subscribedBy(facts, at))
    return { active: !subscribed, used, limit: TRIAL_LIMIT, remaining: Math.max(0, TRIAL_LIMIT - used) }
  }

  /**
   * Adds exactly 1 to the user's trial counter in ONE atomic statement (two parallel calls add 2) and
   * returns the new value. The caller decides whether to count (the mock counts an answer checked
   * while not subscribed). An unknown user is 404.
   */
  async incrementTrialUsed(userId: string): Promise<number> {
    const used = await this.facts.incrementTrial(userId)
    if (used === null) throw ApiError.of('NOT_FOUND')
    return used
  }

  private async subscribedBy(facts: { schoolId: string | null; compExpiresOn: string | null }, at: Date): Promise<boolean> {
    const day = mytDay(at)
    if (facts.compExpiresOn !== null && day <= facts.compExpiresOn) return true
    return facts.schoolId !== null && (await this.subscriptions.hasLiveSubscription(facts.schoolId, day))
  }
}
