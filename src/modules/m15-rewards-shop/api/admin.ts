/**
 * M15 admin endpoints (SRS M15 v1.4 §7 #1–#8; admin session only). UI tasks read this file and do not
 * change it. Errors reach the caller as `ApiError`: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`,
 * `409 CONFLICT` (#7/#8: the redemption is no longer `pending_admin`), `422 VALIDATION_ERROR` with
 * `fields` (keys are the camelCase request names), 5xx.
 */

import { api } from '@/api'
import type { ListResult } from '@/api/envelope'

import type {
  CancelResult,
  DeliverResult,
  HadiahBulkRequest,
  HadiahBulkResult,
  HadiahInput,
  HadiahListItem,
  HadiahListMeta,
  HadiahListQuery,
  HadiahReward,
  RedemptionListItem,
  RedemptionListMeta,
  RedemptionListQuery,
} from './types'

const REWARDS = '/api/admin/hadiah'

/** #1 `GET /api/admin/hadiah` (`?cat=&page=`, 50 a page; meta carries `activeCat` and the four cards). */
export function fetchHadiahList(
  query: HadiahListQuery = {},
): Promise<ListResult<HadiahListItem, HadiahListMeta>> {
  return api.list<HadiahListItem, HadiahListMeta>(REWARDS, {
    query: { cat: query.cat ?? null, page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #2 `GET /api/admin/hadiah/:id` (404 `NOT_FOUND`). */
export function fetchHadiah(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<HadiahReward> {
  return api.get<HadiahReward>(
    `${REWARDS}/${String(id)}`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** #3 `POST /api/admin/hadiah` (201; 422 with `fields`). */
export function createHadiah(input: HadiahInput): Promise<HadiahReward> {
  return api.post<HadiahReward>(REWARDS, { body: input })
}

/** #4 `PUT /api/admin/hadiah/:id` (404; 422 with `fields`). */
export function updateHadiah(id: number, input: HadiahInput): Promise<HadiahReward> {
  return api.put<HadiahReward>(`${REWARDS}/${String(id)}`, { body: input })
}

/** #5 `POST /api/admin/hadiah/bulk` (422 for an unknown action, empty `ids` or a value out of range). */
export function bulkHadiah(request: HadiahBulkRequest): Promise<HadiahBulkResult> {
  return api.post<HadiahBulkResult>(`${REWARDS}/bulk`, { body: request })
}

/** #6 `GET /api/admin/hadiah/redemptions` (`?status=&page=`; no status = `pending_admin`). */
export function fetchRedemptions(
  query: RedemptionListQuery = {},
): Promise<ListResult<RedemptionListItem, RedemptionListMeta>> {
  return api.list<RedemptionListItem, RedemptionListMeta>(`${REWARDS}/redemptions`, {
    query: { status: query.status ?? null, page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #7 `POST /api/admin/hadiah/redemptions/:id/deliver` (404; 409 not `pending_admin`; 422 blank/long code). */
export function deliverRedemption(id: number, code: string): Promise<DeliverResult> {
  return api.post<DeliverResult>(`${REWARDS}/redemptions/${String(id)}/deliver`, {
    body: { code },
  })
}

/** #8 `POST /api/admin/hadiah/redemptions/:id/cancel` (404; 409 not `pending_admin`). */
export function cancelRedemption(id: number): Promise<CancelResult> {
  return api.post<CancelResult>(`${REWARDS}/redemptions/${String(id)}/cancel`)
}
