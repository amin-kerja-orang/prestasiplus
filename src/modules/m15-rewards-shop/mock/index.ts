/**
 * M15 mock plugin (SRS M15 v1.4 §6, §7; task M15-T1; overview §6.7, D11/D12). Owner of the hadiah
 * rewards, the redemptions, the mystery boxes and the mystery-box openings (small materialised
 * tables, §6.8). It reads and writes the wallet, the ledger and the draws only through M14's
 * repository (`./repository/m14-seam.ts`), and the parent links through M02.
 *
 * PUBLIC exports (`@/modules/m15-rewards-shop/mock`): the `hadiah` and `mysteryBox` repositories;
 * `mysteryBox.openingsCount(userId)` is the consumer contract of M14 (BR-M14-16, XR-M15-12).
 *
 * Routes: #1–#8 admin (`handlers/admin.ts`), #9–#16 any logged-in user (`handlers/user.ts`); #17 is
 * M14's wallet read; #18 is not built (user decision, OQ-M15-01). Hooks: `hooks.ts` (§6.9).
 *
 * Bump `version` whenever the seed or a cheap field changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { adminRoutes } from './handlers/admin'
import { userRoutes } from './handlers/user'
import { m15Hooks } from './hooks'
import { hadiahRepo } from './repository/hadiah'
import { mysteryBoxRepo } from './repository/mystery-box'
import { M15_TABLES } from './repository/tables'
import { checkSeed, seedRewards } from './seeds/seed'

const plugin = defineMockModule({
  id: 'M15',
  dependsOn: ['core', 'M01', 'M02', 'M14'],
  version: 1,
  tables: M15_TABLES,
  repositories: { hadiah: hadiahRepo, mysteryBox: mysteryBoxRepo },
  seed: seedRewards,
  finalise: checkSeed,
  routes: [...adminRoutes, ...userRoutes],
  hooks: m15Hooks,
})

export default plugin

export const { hadiah, mysteryBox } = plugin.repositories

export { M15Error, type M15ErrorCode } from './repository/types'
export type {
  HadiahFields,
  HadiahRedemption,
  MysteryBox,
  MysteryBoxOpening,
} from './repository/types'
