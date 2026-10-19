/**
 * M15 admin endpoints (SRS M15 v1.4 §7 #1–#8; all admin-only: guest 401, other roles 403).
 *
 * | # | Route |
 * |---|---|
 * | 1 | `GET /api/admin/hadiah` (`?cat=&page=`) |
 * | 2 | `GET /api/admin/hadiah/:id` |
 * | 3 | `POST /api/admin/hadiah` |
 * | 4 | `PUT /api/admin/hadiah/:id` |
 * | 5 | `POST /api/admin/hadiah/bulk` |
 * | 6 | `GET /api/admin/hadiah/redemptions` (`?status=&page=`) |
 * | 7 | `POST /api/admin/hadiah/redemptions/:id/deliver` |
 * | 8 | `POST /api/admin/hadiah/redemptions/:id/cancel` |
 */

import {
  created,
  conflict,
  int,
  notFound,
  ok,
  pageParams,
  paginate,
  queryString,
  requireRole,
  route,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import {
  HADIAH_CATEGORIES,
  HADIAH_CATEGORY_LABELS,
  REDEMPTION_STATUSES,
  type CancelResult,
  type DeliverResult,
  type HadiahBulkResult,
  type HadiahCategory,
  type HadiahListItem,
  type HadiahListMeta,
  type RedemptionListItem,
  type RedemptionListMeta,
  type RedemptionStatus,
} from '../../api/types'
import { hadiahRepo } from '../repository/hadiah'
import { M15Error } from '../repository/types'
import { parseBulk, parseHadiahInput, parseVoucherCode } from './input'

const adminOnly = requireRole('admin')
const PAGE_SIZE = 50

/** An M15 refusal → its §7 error response. */
export function refusal(e: M15Error): MockResponse {
  if (e.code === 'NOT_FOUND') return notFound(e.message)
  return conflict(e.message, e.code)
}

const idOf = (req: MockRequest): number => Number(req.params.id)

// --- #1 --------------------------------------------------------------------------------------------

function listRewards(req: MockRequest): MockResponse {
  const cat = queryString(req.query, 'cat')
  const rows = hadiahRepo.list(cat)
  const counts = hadiahRepo.redemptionCounts()
  const items: HadiahListItem[] = rows.map((r) => ({
    id: r.id,
    category: r.category,
    categoryLabel: HADIAH_CATEGORY_LABELS[r.category].table,
    vendor: r.vendor,
    title: r.title,
    iconEmoji: r.iconEmoji,
    denominationRm: r.denominationRm,
    tokenCost: r.tokenCost,
    stockQuantity: r.stockQuantity,
    redemptionCount: counts.get(r.id) ?? 0,
    isActive: r.isActive,
  }))
  // FR-M15-14: no `cat` or `cat=all` -> 'all'; a known key -> itself; anything else -> null (no rows).
  const activeCat: HadiahListMeta['activeCat'] =
    cat === undefined || cat === 'all'
      ? 'all'
      : HADIAH_CATEGORIES.includes(cat as HadiahCategory)
        ? (cat as HadiahCategory)
        : null
  const extra: HadiahListMeta = { activeCat, cards: hadiahRepo.cards() }
  return paginate(items, pageParams(req.query, { pageSize: PAGE_SIZE }), { ...extra })
}

// --- #2 – #4 ---------------------------------------------------------------------------------------

function getReward(req: MockRequest): MockResponse {
  const row = hadiahRepo.get(idOf(req))
  return row ? ok(row) : notFound()
}

function createReward(req: MockRequest): MockResponse {
  const parsed = parseHadiahInput(req.body)
  if (!parsed.ok) return validationError(parsed.fields)
  return created(hadiahRepo.create(parsed.value))
}

function updateReward(req: MockRequest): MockResponse {
  const id = idOf(req)
  if (!hadiahRepo.get(id)) return notFound()
  const parsed = parseHadiahInput(req.body)
  if (!parsed.ok) return validationError(parsed.fields)
  const row = hadiahRepo.update(id, parsed.value)
  return row ? ok(row) : notFound()
}

// --- #5 --------------------------------------------------------------------------------------------

function bulk(req: MockRequest): MockResponse {
  const parsed = parseBulk(req.body)
  if (!parsed.ok) return validationError(parsed.fields)
  const { affected, keptIds } = hadiahRepo.bulk(parsed.change, parsed.ids)
  const data: HadiahBulkResult =
    parsed.change.action === 'delete' ? { affected, keptIds } : { affected }
  return ok(data)
}

// --- #6 --------------------------------------------------------------------------------------------

function listRedemptions(req: MockRequest): MockResponse {
  const raw = queryString(req.query, 'status')
  // BR-M15-15: absent -> pending_admin; a key -> that status; `all`; anything else -> empty, no pill.
  const status = raw === undefined ? 'pending_admin' : raw
  const rows = hadiahRepo.queue(status)
  const items: RedemptionListItem[] = rows.map((r) => {
    const u = users.get(r.userId)
    return {
      id: r.id,
      user: { id: r.userId, name: u?.name ?? '', email: u?.email ?? '' },
      rewardId: r.rewardId,
      rewardTitle: r.rewardTitle,
      rewardVendor: r.rewardVendor,
      denominationRm: r.denominationRm,
      tokenCost: r.tokenCost,
      status: r.status,
      createdAt: r.createdAt,
    }
  })
  const activeStatus: RedemptionListMeta['activeStatus'] =
    status === 'all'
      ? 'all'
      : REDEMPTION_STATUSES.includes(status as RedemptionStatus)
        ? (status as RedemptionStatus)
        : null
  const extra: RedemptionListMeta = { activeStatus }
  return paginate(items, pageParams(req.query, { pageSize: PAGE_SIZE }), { ...extra })
}

// --- #7, #8 ----------------------------------------------------------------------------------------

function deliver(req: MockRequest): MockResponse {
  const id = idOf(req)
  if (!hadiahRepo.getRedemption(id)) return notFound()
  const parsed = parseVoucherCode(req.body)
  if (!parsed.ok) return validationError(parsed.fields)
  try {
    const row = hadiahRepo.deliver(id, parsed.code)
    const data: DeliverResult = {
      id: row.id,
      status: 'delivered',
      deliveredAt: row.deliveredAt as string,
      expiresAt: row.expiresAt as string,
    }
    return ok(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

function cancel(req: MockRequest): MockResponse {
  try {
    const { row, refundedTokens } = hadiahRepo.cancelByAdmin(idOf(req))
    const data: CancelResult = { id: row.id, status: 'cancelled', refundedTokens }
    return ok(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

const idParam = { id: int() }

export const adminRoutes: RouteDef[] = [
  route('GET', '/api/admin/hadiah', [adminOnly], listRewards),
  // Static paths first: `bulk` and `redemptions` are not ids (and `int()` accepts digits only).
  route('POST', '/api/admin/hadiah/bulk', [adminOnly], bulk),
  route('GET', '/api/admin/hadiah/redemptions', [adminOnly], listRedemptions),
  route('POST', '/api/admin/hadiah/redemptions/:id/deliver', [adminOnly], deliver, {
    params: idParam,
  }),
  route('POST', '/api/admin/hadiah/redemptions/:id/cancel', [adminOnly], cancel, {
    params: idParam,
  }),
  route('GET', '/api/admin/hadiah/:id', [adminOnly], getReward, { params: idParam }),
  route('POST', '/api/admin/hadiah', [adminOnly], createReward),
  route('PUT', '/api/admin/hadiah/:id', [adminOnly], updateReward, { params: idParam }),
]
