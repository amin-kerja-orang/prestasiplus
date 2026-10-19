/**
 * M15 endpoints for any logged-in user (SRS M15 v1.4 §7 #9–#16). UI tasks read this file and do not
 * change it. Errors reach the caller as `ApiError`: `401`, `404 NOT_FOUND`, `409` with a module code
 * (`INSUFFICIENT_TOKENS`, `DRAW_CLOSED`, `TICKET_LIMIT`, `INSUFFICIENT_BALANCE`, `CONFLICT`; see
 * `M15ConflictCode`), 5xx. Balances for S5 / S6 / S7 headers come from #10 / #12 or M14 #17.
 * #18 (student shop) is not built (user decision OQ-M15-01): S5 shows the empty state.
 */

import { api } from '@/api'
import type { ListResult } from '@/api/envelope'

import type {
  ApproveResult,
  CabutanView,
  CancelResult,
  DigitalItemsMeta,
  DigitalItemsQuery,
  DigitalRedemptionItem,
  DigitalShopItem,
  MysteryBoxOpened,
  MysteryBoxesView,
  ParentApprovalsView,
  RedeemResult,
  TicketBought,
} from './types'

type Options = { signal?: AbortSignal }
const withSignal = (o: Options) => (o.signal ? { signal: o.signal } : {})

/**
 * #19 `GET /api/hadiah-digital/items` (`?cat=`; S10): `data` is always `[]`; `meta.activeCat` says which
 * chip is active (`null` = none). Balances and the tier rate come from M14 #17.
 */
export function fetchDigitalItems(
  query: DigitalItemsQuery = {},
): Promise<ListResult<DigitalShopItem, DigitalItemsMeta>> {
  return api.list<DigitalShopItem, DigitalItemsMeta>('/api/hadiah-digital/items', {
    query: { cat: query.cat ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #20 `GET /api/hadiah-digital/redemptions` (S11): `data` is always `[]`. */
export function fetchDigitalRedemptions(
  options: Options = {},
): Promise<ListResult<DigitalRedemptionItem>> {
  return api.list<DigitalRedemptionItem>('/api/hadiah-digital/redemptions', withSignal(options))
}

/** #9 `POST /api/hadiah/redemptions` (201; 404; 409 `OUT_OF_STOCK` | `MONTHLY_CAP` | `INSUFFICIENT_TOKENS`). Not used by a screen. */
export function redeemHadiah(rewardId: number): Promise<RedeemResult> {
  return api.post<RedeemResult>('/api/hadiah/redemptions', { body: { rewardId } })
}

/** #10 `GET /api/gamification/mystery-boxes` (S6). */
export function fetchMysteryBoxes(options: Options = {}): Promise<MysteryBoxesView> {
  return api.get<MysteryBoxesView>('/api/gamification/mystery-boxes', withSignal(options))
}

/** #11 `POST /api/gamification/mystery-boxes/:id/open` (404 box; 409 `INSUFFICIENT_TOKENS`). */
export function openMysteryBox(boxId: number): Promise<MysteryBoxOpened> {
  return api.post<MysteryBoxOpened>(`/api/gamification/mystery-boxes/${String(boxId)}/open`)
}

/** #12 `GET /api/cabutan` (S7). */
export function fetchCabutan(options: Options = {}): Promise<CabutanView> {
  return api.get<CabutanView>('/api/cabutan', withSignal(options))
}

/** #13 `POST /api/cabutan/:drawId/tickets` (201; 409 `DRAW_CLOSED` | `TICKET_LIMIT` | `INSUFFICIENT_BALANCE`). */
export function buyCabutanTicket(drawId: number): Promise<TicketBought> {
  return api.post<TicketBought>(`/api/cabutan/${String(drawId)}/tickets`)
}

/** #14 `GET /api/parent/hadiah-approvals` (S8; scoped to the viewer's linked children). */
export function fetchParentApprovals(options: Options = {}): Promise<ParentApprovalsView> {
  return api.get<ParentApprovalsView>('/api/parent/hadiah-approvals', withSignal(options))
}

/** #15 `POST /api/parent/hadiah-approvals/:id/approve` (404 not a child's; 409 not pending consent). */
export function approveParentRequest(id: number): Promise<ApproveResult> {
  return api.post<ApproveResult>(`/api/parent/hadiah-approvals/${String(id)}/approve`)
}

/** #16 `POST /api/parent/hadiah-approvals/:id/reject` (404; 409). */
export function rejectParentRequest(id: number): Promise<CancelResult> {
  return api.post<CancelResult>(`/api/parent/hadiah-approvals/${String(id)}/reject`)
}
