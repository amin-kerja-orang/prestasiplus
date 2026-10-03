/**
 * M21 mock plugin (SRS M21 v1.2 §6, §7; task M21-T1, student slice; overview §6.7, D11/D12). Owner of
 * the `sponsors` (taken over from M17's provisional host, `provisional: false`), `anakAngkat` and
 * `fosterApplications` stores (small materialised tables, §6.10). Users are read through M01 only.
 *
 * PUBLIC exports (`@/modules/m21-sponsorship/mock`): the repositories `sponsors`, `anakAngkat`,
 * `fosterApplications` and the contract `sponsorship` (`sponsorSummary()` for M17 Q-M17-SPONSORS,
 * `sponsorForUser(userId)` for the M01 landing, §6.7).
 *
 * Routes: #15 `POST /api/mohon-keluarga-angkat` (`handlers/foster-application.ts`). Admin #1-#14
 * (M21-T3), #16 and #17-#19 (M21-T5) are deferred. Hooks: `hooks.ts` (§6.13). Seed: the six observed
 * sponsors; the anak-angkat record and the three applications wait for the M02 anchors (M21-T3).
 *
 * Bump `version` whenever the seed or a cheap field changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { fosterApplicationRoutes } from './handlers/foster-application'
import { m21Hooks } from './hooks'
import { anakAngkatRepo } from './repository/anak-angkat'
import { fosterApplicationsRepo } from './repository/foster-applications'
import { sponsorsRepo } from './repository/sponsors'
import { checkSeed, seedSponsorship } from './seeds/seed'
import { M21_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M21',
  dependsOn: ['core', 'M01'],
  version: 1,
  tables: M21_TABLES,
  repositories: {
    sponsors: sponsorsRepo,
    anakAngkat: anakAngkatRepo,
    fosterApplications: fosterApplicationsRepo,
  },
  seed: seedSponsorship,
  finalise: checkSeed,
  routes: [...fosterApplicationRoutes],
  hooks: m21Hooks,
})

export default plugin

export const { sponsors, anakAngkat, fosterApplications } = plugin.repositories

export { sponsorship } from './contract'

export type {
  AnakAngkatRow,
  FosterApplicationRow,
  SponsorRow,
  SponsorStatus,
  SponsorStatusCounts,
} from './repository/types'
