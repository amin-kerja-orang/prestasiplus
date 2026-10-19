/**
 * M14 seed (SRS M14 v1.7 §6.11), written through the M14 repositories (overview §3 rule 3a):
 *
 * - `seedGamification(ctx)` (seed phase): catalogues (tiers, challenges, achievements, teacher
 *   badges, settings, syiling-priced rewards, learner badges), the admin mirror (§6.11.2), the
 *   designed replay of accounts 2 and 4 (§6.11.3: streaks, completions, unlocks; their wallets and
 *   ledger rows are dataset anchors), referral codes of 1–11, teacher wallets 1, 5, 4201–4208 and
 *   the cash requests (§6.11.5).
 * - `finaliseGamification()` (after every dataset has compiled): primes the datasets, then the rows
 *   that need the users store — the three designed teacher wallets of §6.11.5 v1.7 (fixture
 *   teacher 5316 → 42,600; the two highest-id generated active zero-question teachers → 9 / 8)
 *   and the M18 / M17 streak anchors (§6.11.7) — and runs the build check (§6.10 named queries,
 *   NFR-M14-01).
 */

import type { SeedContext } from '@/mock/define'
import { checkNamedQueries } from '@/mock/dataset'
import { users } from '@/modules/m01-authentication/mock'

import {
  SEED_ACHIEVEMENTS,
  SEED_CHALLENGES,
  SEED_LEARNER_BADGES,
  SEED_LEARNER_HOLDINGS,
  SEED_SETTINGS,
  SEED_SYILING_REWARDS,
  SEED_TEACHER_BADGES,
  SEED_TIERS,
} from '../data/catalogue'
import {
  ADMIN_COMPLETIONS,
  ADMIN_STREAK,
  ADMIN_TEACHER_LEDGER,
  DESIGNED_EXTRA_TEACHER_BALANCES,
  FIXTURE_TEACHER_WALLET,
  SEED_CASH_REQUESTS,
  SEED_TEACHER_WALLETS,
  TEACHER_WALLET_CREATED,
} from '../data/designed'
import { isOtherModuleAnchor } from '../data/wallet-anchors'
import { primeM14Datasets } from '../datasets'
import { LEDGER_ANCHORS } from '../datasets/ledger'
import { resetPrimes } from '../datasets/prime'
import {
  achievementsRepo,
  challengesRepo,
  gamificationRepo,
  learnerBadgesRepo,
  referralsRepo,
  rewardControlRepo,
  settingsRepo,
  streakRepo,
  teacherCashRepo,
  teacherGamificationRepo,
  teacherWalletRepo,
  tiersRepo,
} from '../repository'
import { bindM14Clock } from '../repository/reads'
import type { CashWithdrawal } from '../repository/types'
import { ledgerQueries, walletQueries } from '../repository/wallet'
import { DESIGNED_REPLAY } from './replay'
import {
  STREAK_ANCHOR_SCHOOLS,
  STREAK_ANCHOR_LAST_ACTIVITY,
  STREAK_PUPIL_2022,
} from './streak-anchors'

export function seedGamification(ctx: SeedContext): void {
  bindM14Clock(ctx.clock)
  resetPrimes()

  tiersRepo.seed(SEED_TIERS)
  challengesRepo.seed(SEED_CHALLENGES)
  achievementsRepo.seedCatalogue(SEED_ACHIEVEMENTS)
  teacherGamificationRepo.seedBadges(SEED_TEACHER_BADGES)
  settingsRepo.seed(SEED_SETTINGS)
  rewardControlRepo.seed(SEED_SYILING_REWARDS)
  learnerBadgesRepo.seed(SEED_LEARNER_BADGES, SEED_LEARNER_HOLDINGS)

  // §6.11.2 admin mirror (wallet and ledger rows are dataset anchors).
  streakRepo.set(1, ADMIN_STREAK)
  for (const [at, challengeId] of ADMIN_COMPLETIONS)
    gamificationRepo.seedCompletion(1, challengeId, at)

  // §6.11.3 designed accounts 2 and 4 (wallet and ledger rows are dataset anchors).
  for (const r of DESIGNED_REPLAY) {
    // `totalDays` 0: SRS v1.3 XL3-15 seeds the counter only for 2710's pupils ("all others 0"),
    // although the runtime rule would count 3 streak days for 2 and 4.
    streakRepo.set(r.userId, { ...r.streak, totalDays: 0 })
    for (const c of r.completions)
      gamificationRepo.seedCompletion(r.userId, c.challengeId, c.completedAt)
    for (const u of r.unlocks) achievementsRepo.seedUnlock(r.userId, u.achievementId, u.unlockedAt)
    for (const c of r.sessions) gamificationRepo.seedSessionCredit({ userId: r.userId, ...c })
  }

  // BR-M14-18: codes of the canonical accounts (admin "4JURJTT").
  referralsRepo.seedCodes(Array.from({ length: 11 }, (_, i) => i + 1))

  // §6.11.5 teacher wallets (4201–4208 and 5 without ledger rows; badge awards INFERRED).
  for (const [userId, questionsCount, balance] of SEED_TEACHER_WALLETS) {
    const admin = userId === 1
    teacherWalletRepo.seedWallet(
      {
        id: userId,
        userId,
        balance,
        totalEarned: balance,
        questionsCount,
        createdAt: TEACHER_WALLET_CREATED,
      },
      admin
        ? {
            awardBadgesAt: '2026-03-21T23:02:00+08:00',
            ledger: ADMIN_TEACHER_LEDGER.map(([createdAt, description, amount]) => ({
              createdAt,
              description,
              amount,
            })),
          }
        : { awardBadgesAt: TEACHER_WALLET_CREATED },
    )
  }
  teacherCashRepo.seed(SEED_CASH_REQUESTS.map((r): CashWithdrawal => ({ ...r })))
}

const pad4 = (n: number) => String(n).padStart(4, '0')
const FIXTURE_SCHOOLS = { min: 900_001, max: 900_099 }
const isFixtureSchool = (id: number | null) =>
  id !== null && id >= FIXTURE_SCHOOLS.min && id <= FIXTURE_SCHOOLS.max

/**
 * §6.11.5 (v1.7): fixture teacher 5316, read from the M01 users repository — it must be an active
 * teacher outside the fixture schools, or the seed stops with a clear message.
 */
function fixtureTeacherId(): number {
  const { userId } = FIXTURE_TEACHER_WALLET
  const u = users.get(userId)
  if (!u || u.role !== 'teacher' || !u.isActive || isFixtureSchool(u.schoolId)) {
    throw new Error(
      `M14 seed: user ${String(userId)} must be an active M02 fixture teacher outside the fixture schools (SRS M14 v1.7 §6.11.5, M02 v1.24); got ${u ? `${u.role}, active ${String(u.isActive)}, school ${String(u.schoolId)}` : 'no user'}`,
    )
  }
  return userId
}

/**
 * §6.11.5 (v1.6): the two highest-id **generated** active teachers outside the fixture schools
 * with `questionsCount` 0 (generated = not an anchor, M01 e-mail pattern `guru{0000}@demo.test`).
 */
function designedTeacherIds(): number[] {
  return users
    .query('U-ROLE-ACTIVE', { sort: [{ field: 'id', dir: 'desc' }] }, 'teacher', true)
    .rows.filter(
      (u) =>
        !isOtherModuleAnchor(u.id) &&
        u.email === `guru${pad4(u.id)}@demo.test` &&
        !isFixtureSchool(u.schoolId) &&
        (teacherWalletRepo.get(u.id)?.questionsCount ?? 0) === 0,
    )
    .slice(0, DESIGNED_EXTRA_TEACHER_BALANCES.length)
    .map((u) => u.id)
}

/** Students of a school, ascending id. */
function pupilsOf(schoolId: number): number[] {
  return users
    .query('U-SCHOOL', { sort: 'id' }, schoolId)
    .rows.filter((u) => u.role === 'student')
    .map((u) => u.id)
}

function seedZeroQuestionWallet(userId: number, balance: number): void {
  teacherWalletRepo.seedWallet({
    id: userId,
    userId,
    balance,
    totalEarned: balance,
    questionsCount: 0,
    createdAt: TEACHER_WALLET_CREATED,
  })
}

export function finaliseGamification(): void {
  primeM14Datasets()

  // §6.11.5 (v1.7): 5316 → 42,600; two generated teachers → 9 / 8 (no ledger rows).
  seedZeroQuestionWallet(fixtureTeacherId(), FIXTURE_TEACHER_WALLET.balance)
  const extra = designedTeacherIds()
  if (extra.length !== DESIGNED_EXTRA_TEACHER_BALANCES.length) {
    throw new Error(
      `M14 seed: ${String(extra.length)} generated active zero-question teachers found, ${String(DESIGNED_EXTRA_TEACHER_BALANCES.length)} needed (§6.11.5)`,
    )
  }
  extra.forEach((userId, i) => {
    seedZeroQuestionWallet(userId, DESIGNED_EXTRA_TEACHER_BALANCES[i] as number)
  })

  // §6.11.7 streak anchors (pupils = the school's students in id order; INFERRED selection).
  for (const { schoolId, rows } of STREAK_ANCHOR_SCHOOLS) {
    const pupils = pupilsOf(schoolId)
    if (pupils.length < rows.length) {
      throw new Error(
        `M14 seed: school ${String(schoolId)} has ${String(pupils.length)} pupils, ${String(rows.length)} streak rows needed`,
      )
    }
    rows.forEach(([current, best, totalDays], i) => {
      streakRepo.set(pupils[i] as number, {
        current,
        best,
        lastActivityDate: STREAK_ANCHOR_LAST_ACTIVITY,
        totalDays,
      })
    })
  }
  streakRepo.set(STREAK_PUPIL_2022.userId, STREAK_PUPIL_2022.streak)

  const issues = [...checkNamedQueries(walletQueries), ...checkNamedQueries(ledgerQueries)]
  if (issues.length > 0) {
    throw new Error(`M14 build check failed:\n${issues.map((i) => `- ${i.message}`).join('\n')}`)
  }
  const late = LEDGER_ANCHORS.filter((r) => r.createdAt > '2026-09-25T15:40:00+08:00')
  if (late.length > 0)
    throw new Error(`M14 build check: ${String(late.length)} seeded ledger rows after the clock`)
}
