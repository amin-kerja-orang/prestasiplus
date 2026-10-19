/**
 * M14 student endpoints (SRS M14 v1.8 §7 #2–#11; screens S11–S18). Any logged-in user (guest `401`).
 * Every function resolves to the response `data`; failures are `ApiError`s (§7 "Errors").
 * #1 `GET /api/me/gamification-summary` (the shell chips) is read by the user shell itself.
 */

import { api } from '@/api'

import type {
  Achievements,
  ChallengeProgress,
  ChallengesMeta,
  ConvertResult,
  ConvertView,
  GamificationDashboard,
  GamificationWallet,
  LedgerEntry,
  Leaderboard,
  Referral,
  ShareCards,
  TransactionsMeta,
} from './types'

interface Options {
  signal?: AbortSignal
}

const withSignal = (o: Options) => (o.signal ? { signal: o.signal } : {})

/** #2 `GET /api/gamification/wallet`: the wallet summary (defaults for a user without a wallet). */
export function fetchGamificationWallet(options: Options = {}): Promise<GamificationWallet> {
  return api.get<GamificationWallet>('/api/gamification/wallet', withSignal(options))
}

/** #3 `GET /api/gamification/dashboard` (S11). */
export function fetchGamificationDashboard(options: Options = {}): Promise<GamificationDashboard> {
  return api.get<GamificationDashboard>('/api/gamification/dashboard', withSignal(options))
}

/**
 * #4 `GET /api/gamification/transactions` (S17): every row of the viewer's ledger, newest first,
 * without a pager. An unknown `type` answers no rows (the empty state).
 */
export function fetchGamificationTransactions(
  query: { type?: string | null } = {},
  options: Options = {},
): Promise<{ data: LedgerEntry[]; meta: TransactionsMeta }> {
  return api.get<{ data: LedgerEntry[]; meta: TransactionsMeta }>(
    '/api/gamification/transactions',
    {
      query: { type: query.type || null },
      ...withSignal(options),
    },
  )
}

/** #5 `GET /api/gamification/convert` (S12). */
export function fetchConvertView(options: Options = {}): Promise<ConvertView> {
  return api.get<ConvertView>('/api/gamification/convert', withSignal(options))
}

/**
 * #6 `POST /api/gamification/convert` (S12): `422 VALIDATION_ERROR` ("Jumlah syiling tidak sah.")
 * when the amount is not an integer in [rate, currentSyiling]; nothing changes then.
 */
export function convertSyiling(syilingAmount: number): Promise<ConvertResult> {
  return api.post<ConvertResult>('/api/gamification/convert', { body: { syilingAmount } })
}

/** #7 `GET /api/gamification/challenges` (S13): the active challenges with today's progress. */
export function fetchGamificationChallenges(
  options: Options = {},
): Promise<{ data: ChallengeProgress[]; meta: ChallengesMeta }> {
  return api.get<{ data: ChallengeProgress[]; meta: ChallengesMeta }>(
    '/api/gamification/challenges',
    withSignal(options),
  )
}

/** #8 `GET /api/gamification/leaderboard` (S14): podium (ranks 1–3) and rows (4–50); any query is ignored. */
export function fetchGamificationLeaderboard(options: Options = {}): Promise<Leaderboard> {
  return api.get<Leaderboard>('/api/gamification/leaderboard', withSignal(options))
}

/** #9 `GET /api/gamification/achievements` (S15): an unknown `rarity` answers `items: []`. */
export function fetchGamificationAchievements(
  query: { rarity?: string | null } = {},
  options: Options = {},
): Promise<Achievements> {
  return api.get<Achievements>('/api/gamification/achievements', {
    query: { rarity: query.rarity || null },
    ...withSignal(options),
  })
}

/** #10 `GET /api/gamification/share-cards` (S18). */
export function fetchShareCards(options: Options = {}): Promise<ShareCards> {
  return api.get<ShareCards>('/api/gamification/share-cards', withSignal(options))
}

/** #11 `GET /api/gamification/referral` (S16): the code is created on the first read. */
export function fetchReferral(options: Options = {}): Promise<Referral> {
  return api.get<Referral>('/api/gamification/referral', withSignal(options))
}
