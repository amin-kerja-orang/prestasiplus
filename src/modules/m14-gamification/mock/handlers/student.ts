/**
 * SRS M14 v1.8 §7 #2–#11: the student endpoints of S11–S18 (any logged-in user, **S**; every figure
 * is the viewer's own).
 *
 * | # | Route | Screen |
 * |---|---|---|
 * | 2 | `GET /api/gamification/wallet` | wallet summary (XR-M15-01) |
 * | 3 | `GET /api/gamification/dashboard` | S11 |
 * | 4 | `GET /api/gamification/transactions` | S17 |
 * | 5, 6 | `GET`, `POST /api/gamification/convert` | S12 |
 * | 7 | `GET /api/gamification/challenges` | S13 |
 * | 8 | `GET /api/gamification/leaderboard` | S14 |
 * | 9 | `GET /api/gamification/achievements` | S15 |
 * | 10 | `GET /api/gamification/share-cards` | S18 |
 * | 11 | `GET /api/gamification/referral` | S16 |
 *
 * #1 `GET /api/me/gamification-summary` stays the core handler (overview §10).
 */

import { ok, queryString, route, validationError, type RouteDef } from '@/mock/define'

import { masteryLevel, masteryMultiplier, masteryNextTarget, MASTERY_LABELS } from '../data/mastery'
import { REFERRAL_REWARD_REFEREE, REFERRAL_REWARD_REFERRER } from '../data/catalogue'
import {
  achievementsRepo,
  challengesRepo,
  coinLedgerRepo,
  referralsRepo,
  streakRepo,
  tiersRepo,
  walletRepo,
} from '../repository'
import { allAnswers, allSessions, practiceReads, subjectNames } from '../repository/reads'
import { activeTiers, titleOf } from '../repository/rules'
import type { LedgerRow, LedgerType } from '../repository/types'
import {
  anySession,
  guarded,
  initialOf,
  initialsOf,
  MSG,
  nameOf,
  profileUrlOf,
  viewerId,
} from './common'
import { intOf, bodyOf } from './input'

const LEDGER_TYPES: readonly string[] = ['earn', 'spend', 'convert', 'bonus', 'refund']

/** The student-facing ledger row (`LedgerRow` of §7 #4). */
export function ledgerView(r: LedgerRow) {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    balanceAfter: r.balanceAfter,
    source: r.source,
    description: r.description,
    createdAt: r.createdAt,
  }
}

/** #2 body: the wallet summary without the internal `hasWallet` flag. */
function walletBody(userId: number) {
  const s = walletRepo.summary(userId)
  return {
    userId: s.userId,
    currentSyiling: s.currentSyiling,
    totalSyilingEarned: s.totalSyilingEarned,
    tokenBalance: s.tokenBalance,
    xp: s.xp,
    level: s.level,
    xpNeeded: s.xpNeeded,
    levelProgressPct: s.levelProgressPct,
    tier: s.tier,
    nextTier: s.nextTier,
    title: s.title,
    nextTitle: s.nextTitle,
    earnedToday: s.earnedToday,
    earnedThisWeek: s.earnedThisWeek,
    streak: s.streak,
  }
}

const round = (n: number, decimals: number): number => {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/**
 * The subject-mastery rows of the viewer (S11 FN-M14-2.1.8, S18 FN-M14-6.2.4), read from M05
 * (`practice.mastery`, read-only, BR-M14-12 note) in the M03 subject order.
 */
function masteryRows(userId: number) {
  const names = subjectNames()
  return practiceReads()
    .mastery(userId)
    .filter((m) => m.answered > 0)
    .sort(
      (a, b) => names.order(a.subjectId) - names.order(b.subjectId) || a.subjectId - b.subjectId,
    )
    .map((m) => {
      const level = masteryLevel(m.correct)
      const accuracy = (m.correct / m.answered) * 100
      return {
        subjectId: m.subjectId,
        subjectName: names.name(m.subjectId),
        level,
        stage: MASTERY_LABELS[level] as string,
        correct: m.correct,
        answered: m.answered,
        nextTarget: masteryNextTarget(level),
        accuracy: round(accuracy, 2),
        accuracy1: round(accuracy, 1),
        multiplier: masteryMultiplier(level),
      }
    })
}

export const studentRoutes: RouteDef[] = [
  // #2
  route('GET', '/api/gamification/wallet', [anySession], (req) => ok(walletBody(viewerId(req)))),

  // #3 (S11)
  route('GET', '/api/gamification/dashboard', [anySession], (req) => {
    const userId = viewerId(req)
    const wallet = walletBody(userId)
    return ok({
      wallet,
      challenges: challengesRepo.today(userId).items.slice(0, 4),
      recent: coinLedgerRepo.forUser(userId).slice(0, 6).map(ledgerView),
      mastery: masteryRows(userId).map((m) => ({
        subjectId: m.subjectId,
        subjectName: m.subjectName,
        level: m.level,
        stage: m.stage,
        correct: m.correct,
        nextTarget: m.nextTarget,
        accuracy: m.accuracy,
        multiplier: m.multiplier,
      })),
      tiers: activeTiers(tiersRepo.list()).map((t) => ({
        key: t.tierName,
        labelMs: t.labelMs,
        icon: t.icon,
        color: t.color,
        minSyiling: t.minSyiling,
        conversionRate: t.conversionRate,
        isMine: t.tierName === wallet.tier.key,
      })),
    })
  }),

  // #4 (S17): all rows, newest first, no pager; an unknown `type` gives no rows (FR-M14-08).
  route('GET', '/api/gamification/transactions', [anySession], (req) => {
    const userId = viewerId(req)
    const type = queryString(req.query, 'type') ?? ''
    const rows =
      type === '' || LEDGER_TYPES.includes(type)
        ? coinLedgerRepo.forUser(userId, type as LedgerType | '')
        : []
    return ok(rows.map(ledgerView), {
      meta: { currentSyiling: walletRepo.summary(userId).currentSyiling, type },
    })
  }),

  // #5 (S12)
  route('GET', '/api/gamification/convert', [anySession], (req) =>
    ok(walletRepo.convertView(viewerId(req))),
  ),

  // #6 (S12): BR-M14-10/11, one atomic step.
  route('POST', '/api/gamification/convert', [anySession], (req) => {
    const amount = intOf(bodyOf(req).syilingAmount)
    if (amount === undefined) {
      return validationError({ syilingAmount: MSG.amountInvalid }, MSG.amountInvalid)
    }
    return ok(guarded(() => walletRepo.convert(viewerId(req), amount), 'syilingAmount'))
  }),

  // #7 (S13)
  route('GET', '/api/gamification/challenges', [anySession], (req) => {
    const { items, completed, active } = challengesRepo.today(viewerId(req))
    return ok(items, { meta: { completed, active } })
  }),

  // #8 (S14): `period` and every other query are ignored (FR-M14-08, FR-M14-42).
  route('GET', '/api/gamification/leaderboard', [anySession], () => {
    const tiers = tiersRepo.list()
    const ranked = walletRepo.leaderboard(50).map((w, i) => {
      const name = nameOf(w.userId)
      const tier = tiers.find((t) => t.tierName === w.tierKey)
      return { w, rank: i + 1, name, tier }
    })
    return ok({
      podium: ranked.slice(0, 3).map(({ w, rank, name, tier }) => ({
        rank,
        userId: w.userId,
        name,
        initials: initialsOf(name),
        totalSyilingEarned: w.totalSyilingEarned,
        tier: { key: w.tierKey, labelMs: tier?.labelMs ?? w.tierKey, icon: tier?.icon ?? '' },
      })),
      rows: ranked.slice(3).map(({ w, rank, name, tier }) => ({
        rank,
        userId: w.userId,
        name,
        initials: initialsOf(name),
        title: titleOf(w.totalSyilingEarned).name,
        level: w.level,
        totalSyilingEarned: w.totalSyilingEarned,
        tierIcon: tier?.icon ?? '',
      })),
    })
  }),

  // #9 (S15): an unknown `rarity` answers `items: []`.
  route('GET', '/api/gamification/achievements', [anySession], (req) =>
    ok(achievementsRepo.forUser(viewerId(req), queryString(req.query, 'rarity'))),
  ),

  // #10 (S18): M05 all-time figures (admin 119 answers / 46 correct / 4 sessions).
  route('GET', '/api/gamification/share-cards', [anySession], (req) => {
    const userId = viewerId(req)
    const name = nameOf(userId)
    const wallet = walletBody(userId)
    const answers = allAnswers(userId)
    const accuracy = answers.total > 0 ? round((answers.correct / answers.total) * 100, 1) : 0
    const streak = streakRepo.get(userId)
    return ok({
      name,
      initial: initialOf(name),
      profileUrl: profileUrlOf(userId),
      profile: {
        answered: answers.total,
        accuracy,
        sessions: allSessions(userId).length,
        tierKey: wallet.tier.key,
        tierIcon: wallet.tier.icon,
        level: wallet.level,
        currentSyiling: wallet.currentSyiling,
      },
      kombo: { current: streak.current, best: streak.best, multiplier: streak.multiplier },
      mastery: masteryRows(userId).map((m) => ({
        subjectName: m.subjectName,
        level: m.level,
        stage: m.stage,
        accuracy: m.accuracy1,
        correct: m.correct,
      })),
      ranking: { accuracy, correct: answers.correct, answered: answers.total },
    })
  }),

  // #11 (S16): the code is created on the first read (BR-M14-18).
  route('GET', '/api/gamification/referral', [anySession], (req) => {
    const userId = viewerId(req)
    const code = referralsRepo.codeOf(userId)
    const registerUrl = `https://prestasiplus.my/register?ref=${code}`
    const text = `Jom belajar matematik di PRESTASIPLUS! Guna kod ${code} untuk dapat ${String(REFERRAL_REWARD_REFEREE)} syiling PERCUMA! ${registerUrl}`
    return ok({
      code,
      rewardReferrer: REFERRAL_REWARD_REFERRER,
      rewardReferee: REFERRAL_REWARD_REFEREE,
      registerUrl,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
      telegramUrl: `https://t.me/share/url?url=${encodeURIComponent(registerUrl)}&text=${encodeURIComponent(`Jom belajar matematik di PRESTASIPLUS! Guna kod ${code}`)}`,
      stats: referralsRepo.stats(userId),
    })
  }),
]
