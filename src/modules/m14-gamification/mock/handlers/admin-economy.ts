/**
 * SRS M14 v1.8 §7 #18–#30: the admin endpoints of S1–S5 (role `admin`, **AD**, BR-M14-01).
 *
 * | # | Route | Screen |
 * |---|---|---|
 * | 18 | `GET /api/admin/gamification/overview` | S1 |
 * | 19–22 | tiers: list, `PUT :id`, `POST :id/toggle`, `POST` | S2 |
 * | 23–27 | challenges: list, `PUT :id`, `POST :id/toggle`, `DELETE :id`, `POST` | S3 |
 * | 28, 29 | `GET …/students`, `POST …/award` | S4 |
 * | 30 | `GET …/transactions` | S5 |
 *
 * Every body is validated here before the repository writes (V-M14-02…04, V-M14-06); a refusal of
 * the repository rolls the request back (BR-M14-30).
 */

import {
  created,
  int,
  ok,
  pageParams,
  paged,
  queryString,
  route,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { AWARD_MAX } from '../data/catalogue'
import {
  challengesRepo,
  coinLedgerRepo,
  gamificationRepo,
  tiersRepo,
  walletRepo,
  type WalletSort,
} from '../repository'
import type { ChallengeInput, TierInput } from '../repository'
import type { DailyChallenge, LedgerType, Tier } from '../repository/types'
import { adminOnly, guarded, nameOf } from './common'
import { bodyOf, readFields, type FieldSpec } from './input'

const LEDGER_TYPES: readonly string[] = ['earn', 'spend', 'convert', 'bonus', 'refund']
const SORTS: readonly string[] = [
  'total_syiling_earned',
  'current_syiling',
  'token_balance',
  'level',
]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const DEFAULT_TIER_COLOR = '#3b82f6'

const idParam = { params: { id: int() } }

/** DATA-M14-04 without the internal `metric` (BR-M14-12). */
export function challengeView(c: DailyChallenge) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    icon: c.icon,
    challengeType: c.challengeType,
    targetValue: c.targetValue,
    rewardSyiling: c.rewardSyiling,
    rewardXp: c.rewardXp,
    difficulty: c.difficulty,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  }
}

// --- tiers -------------------------------------------------------------------------------------

const reward: FieldSpec = { kind: 'int', min: 0 }
const TIER_FIELDS = {
  labelMs: { kind: 'text', max: 60 },
  icon: { kind: 'text', max: 16 },
  color: { kind: 'text', max: 7, pattern: COLOR_RE, optional: true },
  minSyiling: { kind: 'int', min: 0 },
  conversionRate: { kind: 'int', min: 1 },
  sortOrder: { kind: 'int', min: 0 },
  quizRewardL1: reward,
  quizRewardL2: reward,
  quizRewardL3: reward,
  quizRewardL4: reward,
  quizRewardL5: reward,
  pkskRewardCorrect: reward,
  boardGameRewardCorrect: reward,
  boardGameRewardWin: reward,
} as const satisfies Record<string, FieldSpec>

/** `perks`: a JSON array (the hidden field of S2), a list of strings, or one text (S2 add form). */
function perksOf(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  const clean = (list: unknown[]) =>
    list
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim())
      .filter(Boolean)
  if (Array.isArray(raw)) return clean(raw)
  if (typeof raw !== 'string') return undefined
  const text = raw.trim()
  if (text === '') return []
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) return clean(parsed)
    } catch {
      /* a plain text that starts with "[" */
    }
  }
  return [text]
}

// --- challenges --------------------------------------------------------------------------------

const CHALLENGE_FIELDS = {
  title: { kind: 'text', max: 120 },
  description: { kind: 'text', max: 255 },
  icon: { kind: 'text', max: 16 },
  challengeType: {
    kind: 'enum',
    values: ['quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent'],
  },
  targetValue: { kind: 'int', min: 1 },
  rewardSyiling: { kind: 'int', min: 0 },
  rewardXp: { kind: 'int', min: 0 },
  difficulty: { kind: 'enum', values: ['easy', 'medium', 'hard'] },
  sortOrder: { kind: 'int', min: 0 },
} as const satisfies Record<string, FieldSpec>

export const adminEconomyRoutes: RouteDef[] = [
  // #18 (S1)
  route('GET', '/api/admin/gamification/overview', [adminOnly], () => {
    const total = walletRepo.count('Q-WALLETS')
    const tiers = [...tiersRepo.list()].sort((a, b) => a.tierName.localeCompare(b.tierName))
    return ok({
      cards: {
        activeStudents: total,
        syilingGenerated: walletRepo.syilingGenerated(),
        tokensConverted: coinLedgerRepo.tokensConverted(),
        conversions: coinLedgerRepo.count('Q-CONVERSIONS'),
        activeChallenges: challengesRepo.count('Q-CHALLENGES-ACTIVE'),
        completedToday: gamificationRepo.dailyFinishers(),
      },
      tierDistribution: tiers.map((t) => {
        const count = walletRepo.count('Q-TIER', t.tierName)
        return {
          key: t.tierName,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
          widthPct: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
          color: t.color,
        }
      }),
      top10: walletRepo.leaderboard(10).map((w, i) => ({
        rank: i + 1,
        name: nameOf(w.userId),
        tierKey: w.tierKey,
        level: w.level,
        totalSyilingEarned: w.totalSyilingEarned,
      })),
      recent: coinLedgerRepo.recent(10).map((r) => ({
        name: nameOf(r.userId),
        type: r.type,
        amount: r.amount,
        source: r.source,
        createdAt: r.createdAt,
      })),
    })
  }),

  // #19 (S2)
  route('GET', '/api/admin/gamification/tiers', [adminOnly], () => ok(tiersRepo.list())),

  // #20 (S2): V-M14-02; `perks` is re-posted unchanged by the form.
  route(
    'PUT',
    '/api/admin/gamification/tiers/:id',
    [adminOnly],
    (req) => {
      const body = bodyOf(req)
      const parsed = readFields(body, TIER_FIELDS)
      if (!parsed.ok) return parsed.response
      const { color, ...rest } = parsed.value
      const perks = perksOf(body.perks)
      const patch: Partial<TierInput> = {
        ...rest,
        ...(color !== undefined ? { color } : {}),
        ...(perks !== undefined ? { perks } : {}),
      }
      return ok(guarded(() => tiersRepo.update(Number(req.params.id), patch)))
    },
    idParam,
  ),

  // #21 (S2): BR-M14-08, a deactivated tier keeps its holders.
  route(
    'POST',
    '/api/admin/gamification/tiers/:id/toggle',
    [adminOnly],
    (req) => ok(guarded(() => tiersRepo.toggle(Number(req.params.id)))),
    idParam,
  ),

  // #22 (S2): V-M14-03, `tierName` unique.
  route('POST', '/api/admin/gamification/tiers', [adminOnly], (req) => {
    const body = bodyOf(req)
    const parsed = readFields(body, {
      tierName: { kind: 'text', max: 40, pattern: /^[A-Za-z0-9_-]+$/ },
      ...TIER_FIELDS,
    })
    if (!parsed.ok) return parsed.response
    const { tierName, color, ...rest } = parsed.value
    const input: TierInput & { tierName: string } = {
      ...rest,
      tierName: tierName.toLowerCase(),
      color: color ?? DEFAULT_TIER_COLOR,
      perks: perksOf(body.perks) ?? [],
    }
    const tier: Tier = guarded(() => tiersRepo.create(input), 'tierName')
    return created(tier)
  }),

  // #23 (S3): every challenge, active or not.
  route('GET', '/api/admin/gamification/challenges', [adminOnly], () =>
    ok(challengesRepo.list().map(challengeView)),
  ),

  // #24 (S3): V-M14-04, every field required.
  route(
    'PUT',
    '/api/admin/gamification/challenges/:id',
    [adminOnly],
    (req) => {
      const parsed = readFields(bodyOf(req), CHALLENGE_FIELDS)
      if (!parsed.ok) return parsed.response
      const input = parsed.value as ChallengeInput
      return ok(challengeView(guarded(() => challengesRepo.update(Number(req.params.id), input))))
    },
    idParam,
  ),

  // #25 (S3)
  route(
    'POST',
    '/api/admin/gamification/challenges/:id/toggle',
    [adminOnly],
    (req) => ok(guarded(() => challengesRepo.toggle(Number(req.params.id)))),
    idParam,
  ),

  // #26 (S3)
  route(
    'DELETE',
    '/api/admin/gamification/challenges/:id',
    [adminOnly],
    (req) => ok(guarded(() => challengesRepo.remove(Number(req.params.id)))),
    idParam,
  ),

  // #27 (S3)
  route('POST', '/api/admin/gamification/challenges', [adminOnly], (req) => {
    const parsed = readFields(bodyOf(req), CHALLENGE_FIELDS)
    if (!parsed.ok) return parsed.response
    const input = parsed.value as ChallengeInput
    return created(challengeView(guarded(() => challengesRepo.create(input))))
  }),

  // #28 (S4): filters kept by the caller in the URL; 20 a page; DV-M14-14 sorts.
  route('GET', '/api/admin/gamification/students', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: 20 })
    const sort = queryString(req.query, 'sort') ?? ''
    const tier = queryString(req.query, 'tier') ?? ''
    const search = queryString(req.query, 'search') ?? ''
    const result = walletRepo.adminList({
      search,
      tier,
      ...(SORTS.includes(sort) ? { sort: sort as WalletSort } : {}),
      page: page.page,
      pageSize: page.pageSize,
    })
    const tiers = new Map(tiersRepo.list().map((t) => [t.tierName, t]))
    return paged(
      {
        total: result.total,
        rows: result.rows.map((w) => ({
          userId: w.userId,
          name: nameOf(w.userId),
          email: users.get(w.userId)?.email ?? '',
          tierKey: w.tierKey,
          tierColor: tiers.get(w.tierKey)?.color ?? '',
          level: w.level,
          currentSyiling: w.currentSyiling,
          tokenBalance: w.tokenBalance,
          totalSyilingEarned: w.totalSyilingEarned,
          xp: w.xp,
        })),
      },
      page,
    )
  }),

  // #29 (S4): BR-M14-20, atomic; an unknown user is 404.
  route('POST', '/api/admin/gamification/award', [adminOnly], (req) => {
    const parsed = readFields(bodyOf(req), {
      userId: { kind: 'int', min: 1 },
      amount: { kind: 'int', min: 1, max: AWARD_MAX },
      reason: { kind: 'text', max: 255 },
    })
    if (!parsed.ok) return parsed.response
    const { userId, amount, reason } = parsed.value
    return ok(guarded(() => walletRepo.award(userId, amount, reason)))
  }),

  // #30 (S5): 25 a page, newest first; dates inclusive; a malformed date is ignored.
  route('GET', '/api/admin/gamification/transactions', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: 25 })
    const type = queryString(req.query, 'type') ?? ''
    const from = queryString(req.query, 'dateFrom') ?? ''
    const to = queryString(req.query, 'dateTo') ?? ''
    const known = type === '' || LEDGER_TYPES.includes(type)
    const result = known
      ? coinLedgerRepo.adminList({
          type: type as LedgerType | '',
          ...(DATE_RE.test(from) ? { dateFrom: from } : {}),
          ...(DATE_RE.test(to) ? { dateTo: to } : {}),
          page: page.page,
          pageSize: page.pageSize,
        })
      : { rows: [], total: 0 }
    return paged(
      {
        total: result.total,
        rows: result.rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          name: nameOf(r.userId),
          type: r.type,
          amount: r.amount,
          balanceAfter: r.balanceAfter,
          source: r.source,
          description: r.description,
          createdAt: r.createdAt,
        })),
      },
      page,
    )
  }),
]
