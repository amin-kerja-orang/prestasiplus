/**
 * M14 admin endpoints (SRS M14 v1.8 §7 #18–#43; screens S1–S10). Role `admin` (guest `401`, other
 * roles `403 FORBIDDEN`). Every function resolves to the response `data` (lists: `{data, meta}`).
 * Refusals are `ApiError`s: `422 VALIDATION_ERROR` with `fields`, `404 NOT_FOUND`.
 */

import { api, type ListResult } from '@/api'

import type {
  AdminCashList,
  AdminCashRow,
  AdminCashUpdate,
  AdminOverview,
  AdminStudentRow,
  AdminStudentsQuery,
  AdminTeacherGamification,
  AdminTransactionRow,
  AdminTransactionsQuery,
  AwardRequest,
  AwardResult,
  CashStatusFilter,
  DailyChallenge,
  DailyChallengeInput,
  Draw,
  DrawCreate,
  EconomySettings,
  GamificationSetting,
  RedemptionStatusFilter,
  RewardControl,
  SettingValue,
  SyilingReward,
  TeacherBadge,
  TeacherBadgeUpdate,
  TeacherRedemption,
  TeacherReward,
  TeacherRewardCreate,
  Tier,
  TierCreate,
  TierUpdate,
  RedemptionStatus,
} from './types'

interface Options {
  signal?: AbortSignal
}

const withSignal = (o: Options) => (o.signal ? { signal: o.signal } : {})
const A = '/api/admin/gamification'

/** #18 `GET /api/admin/gamification/overview` (S1). */
export function fetchAdminOverview(options: Options = {}): Promise<AdminOverview> {
  return api.get<AdminOverview>(`${A}/overview`, withSignal(options))
}

// --- tiers (S2) ---------------------------------------------------------------------------------

/** #19 `GET …/tiers`. */
export function fetchAdminTiers(options: Options = {}): Promise<Tier[]> {
  return api.get<Tier[]>(`${A}/tiers`, withSignal(options))
}

/** #20 `PUT …/tiers/:id` (422 with `fields`; 404). */
export function updateAdminTier(id: number, body: TierUpdate): Promise<Tier> {
  return api.put<Tier>(`${A}/tiers/${String(id)}`, { body })
}

/** #21 `POST …/tiers/:id/toggle`. */
export function toggleAdminTier(id: number): Promise<{ isActive: boolean }> {
  return api.post<{ isActive: boolean }>(`${A}/tiers/${String(id)}/toggle`)
}

/** #22 `POST …/tiers` (201; 422 incl. a duplicate `tierName`: "Nama tier sudah wujud."). */
export function createAdminTier(body: TierCreate): Promise<Tier> {
  return api.post<Tier>(`${A}/tiers`, { body })
}

// --- challenges (S3) ----------------------------------------------------------------------------

/** #23 `GET …/challenges`: every challenge by (`sortOrder`, `id`), active or not. */
export function fetchAdminChallenges(options: Options = {}): Promise<DailyChallenge[]> {
  return api.get<DailyChallenge[]>(`${A}/challenges`, withSignal(options))
}

/** #24 `PUT …/challenges/:id`. */
export function updateAdminChallenge(
  id: number,
  body: DailyChallengeInput,
): Promise<DailyChallenge> {
  return api.put<DailyChallenge>(`${A}/challenges/${String(id)}`, { body })
}

/** #25 `POST …/challenges/:id/toggle`. */
export function toggleAdminChallenge(id: number): Promise<{ isActive: boolean }> {
  return api.post<{ isActive: boolean }>(`${A}/challenges/${String(id)}/toggle`)
}

/** #26 `DELETE …/challenges/:id`. */
export function deleteAdminChallenge(id: number): Promise<{ deleted: number }> {
  return api.delete<{ deleted: number }>(`${A}/challenges/${String(id)}`)
}

/** #27 `POST …/challenges` (201). */
export function createAdminChallenge(body: DailyChallengeInput): Promise<DailyChallenge> {
  return api.post<DailyChallenge>(`${A}/challenges`, { body })
}

// --- students and ledger (S4, S5) ---------------------------------------------------------------

/** #28 `GET …/students` (S4): 20 a page; `sort` orders descending by its field. */
export function fetchAdminStudents(
  query: AdminStudentsQuery = {},
): Promise<ListResult<AdminStudentRow>> {
  return api.list<AdminStudentRow>(`${A}/students`, {
    query: {
      search: query.search || null,
      tier: query.tier || null,
      sort: query.sort ?? null,
      page: query.page ?? null,
    },
    ...withSignal(query),
  })
}

/** #29 `POST …/award` (S4): 422 (range, reason), 404 `NOT_FOUND` for an unknown user. */
export function awardSyiling(body: AwardRequest): Promise<AwardResult> {
  return api.post<AwardResult>(`${A}/award`, { body })
}

/** #30 `GET …/transactions` (S5): 25 a page, newest first, dates inclusive. */
export function fetchAdminTransactions(
  query: AdminTransactionsQuery = {},
): Promise<ListResult<AdminTransactionRow>> {
  return api.list<AdminTransactionRow>(`${A}/transactions`, {
    query: {
      type: query.type || null,
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      page: query.page ?? null,
    },
    ...withSignal(query),
  })
}

// --- teacher gamification (S6, S7, S8) ----------------------------------------------------------

/** #31 `GET …/guru` (S6). */
export function fetchAdminTeacherGamification(
  options: Options = {},
): Promise<AdminTeacherGamification> {
  return api.get<AdminTeacherGamification>(`${A}/guru`, withSignal(options))
}

/** #32 `PUT …/guru/badges/:id` (an earned badge is never revoked by a threshold change). */
export function updateTeacherBadge(id: number, body: TeacherBadgeUpdate): Promise<TeacherBadge> {
  return api.put<TeacherBadge>(`${A}/guru/badges/${String(id)}`, { body })
}

/** #33 `POST …/guru/rewards` (S6, multipart; the image is only referenced by the mock). */
export function createTeacherReward(input: TeacherRewardCreate): Promise<TeacherReward> {
  const form = new FormData()
  form.set('name', input.name)
  form.set('category', input.category)
  form.set('costCoins', String(input.costCoins))
  for (const key of ['stock', 'maxPerUser', 'maxPerMonth'] as const) {
    const value = input[key]
    if (value !== undefined && value !== null) form.set(key, String(value))
  }
  if (input.description) form.set('description', input.description)
  if (input.image) form.set('image', input.image)
  form.set('isActive', input.isActive === false ? '0' : '1')
  return api.multipart<TeacherReward>(`${A}/guru/rewards`, form)
}

/** #34 `GET …/guru/redemptions` (S7): `status` default PENDING; `all` lists every redemption. */
export function fetchTeacherRedemptions(
  status: RedemptionStatusFilter = 'PENDING',
  options: Options = {},
): Promise<TeacherRedemption[]> {
  return api.get<TeacherRedemption[]>(`${A}/guru/redemptions`, {
    query: { status },
    ...withSignal(options),
  })
}

/** #35 `PATCH …/guru/redemptions/:id` (S7, PROPOSED). */
export function updateTeacherRedemption(
  id: number,
  status: RedemptionStatus,
): Promise<TeacherRedemption> {
  return api.patch<TeacherRedemption>(`${A}/guru/redemptions/${String(id)}`, { body: { status } })
}

/** #36 `GET …/guru/cash` (S8): masked bank fields; `status` default PENDING. */
export function fetchTeacherCashRequests(
  status: CashStatusFilter = 'PENDING',
  options: Options = {},
): Promise<AdminCashList> {
  return api.get<AdminCashList>(`${A}/guru/cash`, { query: { status }, ...withSignal(options) })
}

/** #37 `PATCH …/guru/cash/:id` (S8): any status; entering PAID debits once, leaving PAID credits back. */
export function updateTeacherCashRequest(id: number, body: AdminCashUpdate): Promise<AdminCashRow> {
  return api.patch<AdminCashRow>(`${A}/guru/cash/${String(id)}`, { body })
}

// --- settings (S9) and reward control (S10) -----------------------------------------------------

/** #38 `GET …/settings`: the 10 rows in the S9 order. */
export function fetchGamificationSettings(options: Options = {}): Promise<GamificationSetting[]> {
  return api.get<GamificationSetting[]>(`${A}/settings`, withSignal(options))
}

/** #39 `PUT …/settings`: only the posted keys change (422: unknown key, value below 0). */
export function saveGamificationSettings(settings: SettingValue[]): Promise<GamificationSetting[]> {
  return api.put<GamificationSetting[]>(`${A}/settings`, { body: { settings } })
}

/** #40 `GET /api/admin/reward-control` (S10). */
export function fetchRewardControl(options: Options = {}): Promise<RewardControl> {
  return api.get<RewardControl>('/api/admin/reward-control', withSignal(options))
}

/** #41 `PUT /api/admin/reward-control/settings`: any subset of the five shared keys. */
export function saveRewardControlSettings(
  body: Partial<EconomySettings>,
): Promise<EconomySettings> {
  return api.put<EconomySettings>('/api/admin/reward-control/settings', { body })
}

/** #42 `PUT /api/admin/reward-control/rewards/:id/cost`. */
export function saveRewardCost(id: number, costValueSen: number): Promise<SyilingReward> {
  return api.put<SyilingReward>(`/api/admin/reward-control/rewards/${String(id)}/cost`, {
    body: { costValueSen },
  })
}

/** #43 `POST /api/admin/reward-control/draws` (201; 422 "Format JSON kolam hadiah tidak sah." under `prizePool`). */
export function createAdminDraw(body: DrawCreate): Promise<Draw> {
  return api.post<Draw>('/api/admin/reward-control/draws', { body })
}
