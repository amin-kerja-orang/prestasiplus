/**
 * M14 teacher endpoints (SRS M14 v1.8 §7 #12–#17; screens S19–S22). Role `teacher` or `admin`
 * (guest `401`, other roles `403 FORBIDDEN`). Every function resolves to the response `data`.
 */

import { api } from '@/api'

import type {
  TeacherCashCreated,
  TeacherCashRequest,
  TeacherCashView,
  TeacherDashboard,
  TeacherLeaderboard,
  TeacherRedemption,
  TeacherShop,
} from './types'

interface Options {
  signal?: AbortSignal
}

const withSignal = (o: Options) => (o.signal ? { signal: o.signal } : {})

/** #12 `GET /api/guru/gamification` (S19). */
export function fetchTeacherDashboard(options: Options = {}): Promise<TeacherDashboard> {
  return api.get<TeacherDashboard>('/api/guru/gamification', withSignal(options))
}

/** #13 `GET /api/guru/gamification/cash` (S20). */
export function fetchTeacherCash(options: Options = {}): Promise<TeacherCashView> {
  return api.get<TeacherCashView>('/api/guru/gamification/cash', withSignal(options))
}

/**
 * #14 `POST /api/guru/gamification/cash` (S20): 201 with the new PENDING request; `422` (amount
 * outside [min, available], missing bank field), `403 CASH_DISABLED`.
 */
export function requestTeacherCash(request: TeacherCashRequest): Promise<TeacherCashCreated> {
  return api.post<TeacherCashCreated>('/api/guru/gamification/cash', { body: request })
}

/** #15 `GET /api/guru/gamification/shop` (S21). */
export function fetchTeacherShop(options: Options = {}): Promise<TeacherShop> {
  return api.get<TeacherShop>('/api/guru/gamification/shop', withSignal(options))
}

/**
 * #16 `POST /api/guru/gamification/shop/:rewardId/redeem` (S21, PROPOSED): 201 with the PENDING
 * redemption; `404`, `409 OUT_OF_STOCK | LIMIT_REACHED | INSUFFICIENT_BALANCE`.
 */
export function redeemTeacherReward(rewardId: number): Promise<TeacherRedemption> {
  return api.post<TeacherRedemption>(`/api/guru/gamification/shop/${String(rewardId)}/redeem`)
}

/** #17 `GET /api/guru/gamification/leaderboard` (S22): an unknown `tab` is `sekolah`. */
export function fetchTeacherLeaderboard(
  tab = 'sekolah',
  options: Options = {},
): Promise<TeacherLeaderboard> {
  return api.get<TeacherLeaderboard>('/api/guru/gamification/leaderboard', {
    query: { tab },
    ...withSignal(options),
  })
}
