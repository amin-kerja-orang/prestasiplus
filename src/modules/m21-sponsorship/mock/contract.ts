/**
 * The contract M21 exposes to other modules (SRS M21 v1.2 §6.7), imported from
 * `@/modules/m21-sponsorship/mock` only (D12).
 *
 * - `sponsorSummary()` for M17 Q-M17-SPONSORS (XR-M21-03); at the default seed
 *   `{total: 6, active: 0, pending: 0, rejected: 0, suspended: 6}`. M17 reads it at request time.
 * - `sponsorForUser(userId)` for the M01 landing / guard (XR-M21-02): the sponsor linked to the user.
 */

import { sponsorsRepo } from './repository/sponsors'
import type { SponsorRow, SponsorStatusCounts } from './repository/types'

export const sponsorship = {
  sponsorSummary(): SponsorStatusCounts {
    return sponsorsRepo.statusCounts()
  },

  sponsorForUser(userId: number): SponsorRow | null {
    return sponsorsRepo.list().find((s) => s.userId === userId) ?? null
  },
}
