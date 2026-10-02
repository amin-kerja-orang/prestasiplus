/**
 * SRS M14 v1.8 §7 #12–#17: the teacher endpoints of S19–S22 (role `teacher` or `admin`, **T**; every
 * figure is the viewer's own, BR-M14-01).
 *
 * | # | Route | Screen |
 * |---|---|---|
 * | 12 | `GET /api/guru/gamification` | S19 |
 * | 13, 14 | `GET`, `POST /api/guru/gamification/cash` | S20 |
 * | 15 | `GET /api/guru/gamification/shop` | S21 |
 * | 16 | `POST /api/guru/gamification/shop/:rewardId/redeem` | S21 (PROPOSED) |
 * | 17 | `GET /api/guru/gamification/leaderboard` | S22 |
 *
 * Bank details are validated here, stored by the repository and returned masked (NFR-M14-04).
 */

import { created, int, ok, queryString, route, type RouteDef } from '@/mock/define'

import { CASH_BANKS } from '../data/catalogue'
import { teacherCashRepo, teacherRewardsRepo, teacherWalletRepo } from '../repository'
import type { TeacherRedemption } from '../repository/types'
import { guarded, nameOf, teacherOnly, viewerId } from './common'
import { bodyOf, readFields } from './input'

const BANKS: readonly string[] = CASH_BANKS.slice(1)

/** A redemption row with the teacher and reward names the S7 row shows (PROPOSED layout). */
export function redemptionViews(rows: readonly TeacherRedemption[]) {
  const rewards = new Map(teacherRewardsRepo.list().map((r) => [r.id, r.name]))
  return rows.map((r) => ({
    ...r,
    userName: nameOf(r.userId),
    rewardName: rewards.get(r.rewardId) ?? '',
  }))
}

export const teacherRoutes: RouteDef[] = [
  // #12 (S19)
  route('GET', '/api/guru/gamification', [teacherOnly], (req) => {
    const s = teacherWalletRepo.summary(viewerId(req))
    return ok({
      balance: s.balance,
      totalEarned: s.totalEarned,
      questionsCount: s.questionsCount,
      coinsPerQuestion: s.coinsPerQuestion,
      badges: s.badges.map((b) => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        threshold: b.threshold,
        bonusCoins: b.bonusCoins,
        isActive: b.isActive,
        earned: b.earned,
      })),
      badgesEarned: s.badgesEarned,
      badgesActive: s.badgesActive,
      nextBadge: s.nextBadge,
      catalogue: teacherRewardsRepo.list({ activeOnly: true }),
      transactions: s.transactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        createdAt: t.createdAt,
      })),
    })
  }),

  // #13 (S20)
  route('GET', '/api/guru/gamification/cash', [teacherOnly], (req) => {
    const v = teacherCashRepo.view(viewerId(req))
    return ok({
      ...v,
      history: v.history.map((h) => ({
        id: h.id,
        coins: h.coins,
        cash: h.cash,
        bankName: h.bankName,
        status: h.status,
        createdAt: h.createdAt,
      })),
    })
  }),

  // #14 (S20): BR-M14-26; `CASH_DISABLED` 403, the amount range 422.
  route('POST', '/api/guru/gamification/cash', [teacherOnly], (req) => {
    const parsed = readFields(bodyOf(req), {
      coinsAmount: { kind: 'int', min: 1 },
      bankName: { kind: 'enum', values: BANKS },
      bankAccount: { kind: 'text', max: 40 },
      accountHolder: { kind: 'text', max: 120 },
    })
    if (!parsed.ok) return parsed.response
    const r = guarded(() => teacherCashRepo.request(viewerId(req), parsed.value), 'coinsAmount')
    return created({
      id: r.id,
      coins: r.coins,
      cash: r.cash,
      bankName: r.bankName,
      bankAccountMasked: r.bankAccountMasked,
      status: 'PENDING',
      createdAt: r.createdAt,
    })
  }),

  // #15 (S21)
  route('GET', '/api/guru/gamification/shop', [teacherOnly], (req) => {
    const userId = viewerId(req)
    return ok({
      balance: teacherWalletRepo.get(userId)?.balance ?? 0,
      available: teacherCashRepo.view(userId).available,
      rewards: teacherRewardsRepo.list({ activeOnly: true }),
    })
  }),

  // #16 (S21, PROPOSED): BR-M14-27.
  route(
    'POST',
    '/api/guru/gamification/shop/:rewardId/redeem',
    [teacherOnly],
    (req) => {
      const rewardId = Number(req.params.rewardId)
      const row = guarded(() => teacherRewardsRepo.redeem(viewerId(req), rewardId))
      return created(redemptionViews([row])[0])
    },
    { params: { rewardId: int() } },
  ),

  // #17 (S22): an unknown `tab` is `sekolah` (FR-M14-08).
  route('GET', '/api/guru/gamification/leaderboard', [teacherOnly], (req) => {
    const tab = queryString(req.query, 'tab') === 'global' ? 'global' : 'sekolah'
    const lb = teacherWalletRepo.leaderboard(tab, viewerId(req))
    return ok({
      tab: lb.tab,
      rows: lb.rows.map((r) => ({
        rank: r.rank,
        userId: r.userId,
        name: r.name,
        ...(lb.tab === 'global' ? { schoolName: r.schoolName } : {}),
        questions: r.questions,
        syiling: r.syiling,
      })),
    })
  }),
]
