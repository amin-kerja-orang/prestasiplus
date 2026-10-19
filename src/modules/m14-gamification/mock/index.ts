/**
 * M14 mock plugin (F-26b: the shared gamification store; SRS M14 v1.7 §6, §7.1; overview §6.7,
 * D11/D12). Owner of the `wallets` and `coinLedger` virtual datasets and every M14 table.
 *
 * PUBLIC exports (the only M14 mock code other modules may import, `@/modules/m14-gamification/mock`):
 * the repositories of §7.1 under their canonical names — `wallet` (summary, credit shim, token and
 * syiling movements), `gamification` (`onSessionCompleted`, `onLogin`, `onGameResult`,
 * `canEarnSyiling`), `streak` (`get`, `forUsers`), `challenges` (`today`), `achievements`
 * (`forUser`), `learnerBadges` (`forUser`, `catalogue`), `referrals` (`onRegistered`), `draws`,
 * `teacherGamification` (`onQuestionContributed`), `teacherWallet` (`summary`), `settings` (`get`)
 * — plus the owner-side repositories the M14 handlers use (`coinLedger`, `tiers`, `teacherCash`,
 * `teacherRewards`, `rewardControl`), and the error class `M14Error`.
 *
 * Routes (M14-T1, `handlers/`): §7 #2–#43 (#1 stays the core handler). Test hooks (§6.14,
 * `hooks/`): `setWallet`, `getWallet`, `ledger`, `createDraw`, `setStreak`, `setTeacherWallet`,
 * `gamificationSession`, `gameResult`, `m14LoadFixture`. The screens belong to M14-T2…T5; the API
 * client is `../api`.
 *
 * Bump `version` whenever the seed, a spec, `derive` or a cheap field changes (overview §6.9,
 * §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { ledgerDataset } from './datasets/ledger'
import { m14Routes } from './handlers'
import { m14Hooks } from './hooks'
import { walletsDataset } from './datasets/wallets'
import {
  achievementsRepo,
  challengesRepo,
  coinLedgerRepo,
  drawsRepo,
  gamificationRepo,
  learnerBadgesRepo,
  referralsRepo,
  rewardControlRepo,
  settingsRepo,
  streakRepo,
  teacherCashRepo,
  teacherGamificationRepo,
  teacherRewardsRepo,
  teacherWalletRepo,
  tiersRepo,
  walletRepo,
} from './repository'
import { finaliseGamification, seedGamification } from './seeds/seed'
import { M14_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M14',
  dependsOn: ['core', 'M01', 'M02'],
  version: 2,
  tables: M14_TABLES,
  datasets: { wallets: walletsDataset, coinLedger: ledgerDataset },
  repositories: {
    wallet: walletRepo,
    coinLedger: coinLedgerRepo,
    gamification: gamificationRepo,
    streak: streakRepo,
    challenges: challengesRepo,
    achievements: achievementsRepo,
    tiers: tiersRepo,
    learnerBadges: learnerBadgesRepo,
    referrals: referralsRepo,
    draws: drawsRepo,
    settings: settingsRepo,
    rewardControl: rewardControlRepo,
    teacherGamification: teacherGamificationRepo,
    teacherWallet: teacherWalletRepo,
    teacherCash: teacherCashRepo,
    teacherRewards: teacherRewardsRepo,
  },
  seed: seedGamification,
  finalise: finaliseGamification,
  routes: m14Routes,
  hooks: m14Hooks,
})

export default plugin

export const {
  wallet,
  coinLedger,
  gamification,
  streak,
  challenges,
  achievements,
  tiers,
  learnerBadges,
  referrals,
  draws,
  settings,
  rewardControl,
  teacherGamification,
  teacherWallet,
  teacherCash,
  teacherRewards,
} = plugin.repositories

export { M14Error, type M14ErrorCode, type WalletSummary } from './repository/ops'
export type { SessionCompletedInput } from './repository/engine'
export type * from './repository/types'
export type {
  AchievementItem,
  ChallengeToday,
  SessionCompletedResult,
  StreakView,
  TeacherSummary,
} from './repository'
