/**
 * M15 endpoints for any logged-in user (SRS M15 v1.4 §7 #9–#16; guest 401).
 *
 * | # | Route |
 * |---|---|
 * | 9 | `POST /api/hadiah/redemptions` (used by the hook `m15Redeem`; S5 builds no shop) |
 * | 10 | `GET /api/gamification/mystery-boxes` |
 * | 11 | `POST /api/gamification/mystery-boxes/:id/open` |
 * | 12 | `GET /api/cabutan` |
 * | 13 | `POST /api/cabutan/:drawId/tickets` |
 * | 14 | `GET /api/parent/hadiah-approvals` (scoped to the viewer's linked children) |
 * | 15 | `POST /api/parent/hadiah-approvals/:id/approve` |
 * | 16 | `POST /api/parent/hadiah-approvals/:id/reject` |
 *
 * #17 (wallet read) is M14's `GET /api/gamification/wallet`.
 */

import { formatDateKey } from '@/lib/time'
import {
  created,
  int,
  ok,
  unpaged,
  requireAuth,
  route,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { parentLinks } from '@/modules/m02-users-schools/mock'
import { users } from '@/modules/m01-authentication/mock'

import {
  HADIAH_CATEGORIES,
  type ApproveResult,
  type CabutanView,
  type CancelResult,
  type DigitalItemsMeta,
  type DigitalRedemptionItem,
  type DigitalShopItem,
  type HadiahCategory,
  type MysteryBoxOpened,
  type MysteryBoxesView,
  type OpenDrawView,
  type ParentApprovalItem,
  type ParentApprovalsView,
  type RedeemResult,
  type TicketBought,
} from '../../api/types'
import { nowMs } from '../repository/clock'
import { hadiahRepo } from '../repository/hadiah'
import { balanceOf, buyTicket, listOpenDraws, ticketsOwned } from '../repository/m14-seam'
import { mysteryBoxRepo } from '../repository/mystery-box'
import { M15Error, type HadiahRedemption } from '../repository/types'
import { refusal } from './admin'

const signedIn = requireAuth()

const sessionUserId = (req: MockRequest): number => {
  if (!req.session) throw new Error('M15: no session (guard missing)')
  return req.session.userId
}

const idOf = (req: MockRequest): number => Number(req.params.id)

// --- #9 --------------------------------------------------------------------------------------------

function redeem(req: MockRequest): MockResponse {
  const raw =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as { rewardId?: unknown }).rewardId
      : undefined
  const rewardId =
    typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN
  if (!Number.isSafeInteger(rewardId) || rewardId < 1) {
    return validationError({ rewardId: 'The reward id field is required.' })
  }
  try {
    const { redemption, tokenBalance } = hadiahRepo.redeem(sessionUserId(req), rewardId)
    const data: RedeemResult = { id: redemption.id, status: redemption.status, tokenBalance }
    return created(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

// --- #10, #11 --------------------------------------------------------------------------------------

function listBoxes(req: MockRequest): MockResponse {
  const userId = sessionUserId(req)
  const boxes = mysteryBoxRepo.boxes()
  const data: MysteryBoxesView = {
    tokenBalance: balanceOf(userId).tokenBalance,
    boxes: boxes.map((b) => ({ ...b })),
    history: mysteryBoxRepo.openingsOf(userId, 10).map((o) => ({
      id: o.id,
      boxId: o.boxId,
      boxName: mysteryBoxRepo.box(o.boxId)?.name ?? '',
      coins: o.coins,
      xp: o.xp,
      createdAt: o.createdAt,
    })),
  }
  return ok(data)
}

function openBox(req: MockRequest): MockResponse {
  try {
    const r = mysteryBoxRepo.open(sessionUserId(req), idOf(req))
    const data: MysteryBoxOpened = {
      openingId: r.opening.id,
      boxId: r.box.id,
      boxName: r.box.name,
      icon: r.box.icon,
      coins: r.opening.coins,
      xp: r.opening.xp,
      tokenBalance: r.tokenBalance,
      syilingBalance: r.syilingBalance,
    }
    return ok(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

// --- #12, #13 --------------------------------------------------------------------------------------

function listCabutan(req: MockRequest): MockResponse {
  const userId = sessionUserId(req)
  // BR-M15-19: status `open` and `closesAt` >= today (Asia/Kuala_Lumpur); close date then id.
  const open = listOpenDraws(formatDateKey(nowMs())).sort((a, b) => {
    if (a.closesAt === b.closesAt) return a.id - b.id
    if (a.closesAt === null) return 1
    if (b.closesAt === null) return -1
    return a.closesAt < b.closesAt ? -1 : 1
  })
  const draws: OpenDrawView[] = open.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    ticketCostSyiling: d.ticketCostSyiling,
    maxTicketsPerStudent: d.maxTicketsPerStudent,
    ticketsOwned: ticketsOwned(d.id, userId),
    closesAt: d.closesAt,
    prizePool: d.prizePool.map((p) => ({ label: p.label, valueSen: p.valueSen, qty: p.qty })),
  }))
  const data: CabutanView = { syilingBalance: balanceOf(userId).syilingBalance, draws }
  return ok(data)
}

function buyCabutanTicket(req: MockRequest): MockResponse {
  const userId = sessionUserId(req)
  const drawId = Number(req.params.drawId)
  try {
    const syilingBalance = buyTicket(drawId, userId)
    const data: TicketBought = {
      drawId,
      ticketsOwned: ticketsOwned(drawId, userId),
      syilingBalance,
    }
    return created(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

// --- #14 – #16 (parent consent, BR-M15-20) -----------------------------------------------------------

function childrenOf(req: MockRequest): number[] {
  return parentLinks.studentIdsOf(sessionUserId(req))
}

function parentItem(r: HadiahRedemption): ParentApprovalItem {
  return {
    id: r.id,
    child: { id: r.userId, name: users.get(r.userId)?.name ?? '' },
    rewardTitle: r.rewardTitle,
    rewardIcon: r.rewardIcon,
    tokenCost: r.tokenCost,
    status: r.status,
    createdAt: r.createdAt,
  }
}

function listApprovals(req: MockRequest): MockResponse {
  const children = childrenOf(req)
  const data: ParentApprovalsView = {
    pending: hadiahRepo.pendingForChildren(children).map(parentItem),
    history: hadiahRepo.historyForChildren(children).map(parentItem),
  }
  return ok(data)
}

function approve(req: MockRequest): MockResponse {
  try {
    const row = hadiahRepo.parentApprove(sessionUserId(req), childrenOf(req), idOf(req))
    const data: ApproveResult = { id: row.id, status: 'pending_admin' }
    return ok(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

function reject(req: MockRequest): MockResponse {
  try {
    const { row, refundedTokens } = hadiahRepo.parentReject(
      sessionUserId(req),
      childrenOf(req),
      idOf(req),
    )
    const data: CancelResult = { id: row.id, status: 'cancelled', refundedTokens }
    return ok(data)
  } catch (e) {
    if (e instanceof M15Error) return refusal(e)
    throw e
  }
}

// --- #19, #20 (L43 Kedai Hadiah Digital, BR-M15-26…28): reads that are empty for every account ------

/** BR-M15-27: absent or `all` -> 'all'; a known key -> itself; unknown or repeated -> null. */
function digitalItems(req: MockRequest): MockResponse {
  const raw = req.query.cat
  const activeCat: DigitalItemsMeta['activeCat'] =
    raw === undefined
      ? 'all'
      : typeof raw !== 'string'
        ? null
        : raw === 'all' || HADIAH_CATEGORIES.includes(raw as HadiahCategory)
          ? (raw as DigitalItemsMeta['activeCat'])
          : null
  // BR-M15-26, Q-M15-DIGITAL-ITEMS: the empty set; the HadiahReward store is never read.
  const items: DigitalShopItem[] = []
  return unpaged(items, { activeCat })
}

/** BR-M15-28, Q-M15-DIGITAL-REDEMPTIONS: the empty set; the HadiahRedemption store is never read. */
function digitalRedemptions(): MockResponse {
  const items: DigitalRedemptionItem[] = []
  return unpaged(items)
}

const idParam = { id: int() }

export const userRoutes: RouteDef[] = [
  route('GET', '/api/hadiah-digital/items', [signedIn], digitalItems),
  route('GET', '/api/hadiah-digital/redemptions', [signedIn], digitalRedemptions),
  route('POST', '/api/hadiah/redemptions', [signedIn], redeem),
  route('GET', '/api/gamification/mystery-boxes', [signedIn], listBoxes),
  route('POST', '/api/gamification/mystery-boxes/:id/open', [signedIn], openBox, {
    params: idParam,
  }),
  route('GET', '/api/cabutan', [signedIn], listCabutan),
  route('POST', '/api/cabutan/:drawId/tickets', [signedIn], buyCabutanTicket, {
    params: { drawId: int() },
  }),
  route('GET', '/api/parent/hadiah-approvals', [signedIn], listApprovals),
  route('POST', '/api/parent/hadiah-approvals/:id/approve', [signedIn], approve, {
    params: idParam,
  }),
  route('POST', '/api/parent/hadiah-approvals/:id/reject', [signedIn], reject, { params: idParam }),
]
