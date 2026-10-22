import { Inject, Injectable } from '@nestjs/common'
import type { PkskAccess, PkskLevel } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { PKSK_SUBSCRIPTION_PORT, type PkskSubscriptionPort } from './ports'
import { PkskAccessRepository } from './pksk-access.repository'
import { isLevel, levelsOfPackage, notExpired } from './rules'

/**
 * The level gate (BR-M07-07, BR-M07-19), exported for other modules. Level L is usable when
 *  - the active role is `admin` (both levels), or
 *  - the user has the PKSK subscription flag (both levels; BE-25 port, absent until it exists), or
 *  - the user has a stored-active grant that has not expired (valid through the end of the expiry day, Malaysia time)
 *    whose package is level L or `ALL` (Kombo).
 * Everything else is closed: a failed lookup throws, it never defaults to open.
 */
@Injectable()
export class PkskAccessService {
  constructor(
    @Inject(PkskAccessRepository) private readonly access: PkskAccessRepository,
    @Inject(PKSK_SUBSCRIPTION_PORT) private readonly subscription: PkskSubscriptionPort,
  ) {}

  async levels(who: { userId: string; role: string }, now: Date): Promise<PkskAccess> {
    if (who.role === 'admin') return { T1: true, T4: true }
    if (await this.subscription.hasPkskSubscription(who.userId, now)) return { T1: true, T4: true }
    const out: PkskAccess = { T1: false, T4: false }
    for (const grant of await this.access.activeOf(who.userId)) {
      if (!notExpired(grant.expiresAt, now)) continue
      for (const level of levelsOfPackage(grant.packageLevel)) out[level] = true
    }
    return out
  }

  /** Unknown level is 404 first, then no access is 403 (FR-M07-19, SEC-M07-04). Returns the validated level. */
  async gate(who: { userId: string; role: string }, rawLevel: string, now: Date): Promise<PkskLevel> {
    if (!isLevel(rawLevel)) throw ApiError.of('NOT_FOUND')
    const levels = await this.levels(who, now)
    if (!levels[rawLevel]) throw ApiError.of('FORBIDDEN')
    return rawLevel
  }
}
