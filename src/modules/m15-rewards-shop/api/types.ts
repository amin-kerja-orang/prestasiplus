/**
 * M15 contract types (SRS M15 v1.4 §6.2–§6.5, §7). Shared by the mock handlers and the screens.
 * JSON is camelCase; the page forms keep the live snake_case field names and map them. Dates are
 * ISO 8601 (+08:00).
 */

export const HADIAH_CATEGORIES = [
  'flagship',
  'ewallet',
  'telco',
  'gaming',
  'streaming',
  'food_beverage',
  'ecommerce',
  'education',
  'entertainment',
] as const
export type HadiahCategory = (typeof HADIAH_CATEGORIES)[number]

export const DELIVERY_METHODS = ['manual', 'api', 'instant'] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

export const REDEMPTION_STATUSES = [
  'pending_parent_consent',
  'pending_admin',
  'delivered',
  'cancelled',
] as const
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number]

export type CancelledBy = 'admin' | 'parent'

/** BR-M15-01: category key → label of the filter pill / the form option / the table cell. */
export const HADIAH_CATEGORY_LABELS: Readonly<
  Record<HadiahCategory, { pill: string; option: string; table: string }>
> = {
  flagship: { pill: '🏆 Mahkota', option: '🏆 Mahkota (RM500+)', table: '🏆 Mahkota' },
  ewallet: { pill: '💳 E-Wallet', option: '💳 E-Wallet', table: '💳 E-Wallet' },
  telco: { pill: '📱 Telco', option: '📱 Telco', table: '📱 Telco Topup' },
  gaming: { pill: '🎮 Gaming', option: '🎮 Gaming', table: '🎮 Gaming' },
  streaming: { pill: '🎬 Streaming', option: '🎬 Streaming', table: '🎬 Streaming' },
  food_beverage: { pill: '🍔 F&B', option: '🍔 F&B', table: '🍔 Makanan & Minuman' },
  ecommerce: { pill: '🛒 E-Commerce', option: '🛒 E-Commerce', table: '🛒 E-Commerce' },
  education: { pill: '📚 Pembelajaran', option: '📚 Pembelajaran', table: '📚 Pembelajaran' },
  entertainment: { pill: '🎭 Hiburan', option: '🎭 Hiburan', table: '🎭 Hiburan' },
}

/** DATA-M15-01 (#2 body, and the body of #3 / #4). */
export interface HadiahReward {
  id: number
  category: HadiahCategory
  vendor: string
  title: string
  description: string | null
  denominationRm: number
  tokenCost: number
  iconEmoji: string | null
  /** `null` = unlimited (shown "∞"). */
  stockQuantity: number | null
  /** `null` = no cap. */
  maxPerMonthPerStudent: number | null
  voucherValidityDays: number
  deliveryMethod: DeliveryMethod
  vendorSku: string | null
  displayOrder: number
  imageUrl: string | null
  termsText: string | null
  isActive: boolean
  requiresParentConsent: boolean
  createdAt: string
  updatedAt: string
}

/**
 * `HadiahInput` (#3, #4): every writable field of §6.2. Required: `category`, `vendor`, `title`,
 * `denominationRm`, `tokenCost`. An omitted optional field takes the BR-M15-13 default
 * (`voucherValidityDays` 365, `deliveryMethod` 'manual', `displayOrder` 100, `isActive` true,
 * `requiresParentConsent` false, other fields null). Numbers may be sent as numbers or digit strings.
 */
export interface HadiahInput {
  category: HadiahCategory
  vendor: string
  title: string
  description?: string | null
  denominationRm: number
  tokenCost: number
  iconEmoji?: string | null
  stockQuantity?: number | null
  maxPerMonthPerStudent?: number | null
  voucherValidityDays?: number
  deliveryMethod?: DeliveryMethod
  vendorSku?: string | null
  displayOrder?: number
  imageUrl?: string | null
  termsText?: string | null
  isActive?: boolean
  requiresParentConsent?: boolean
}

/** #1 row. */
export interface HadiahListItem {
  id: number
  category: HadiahCategory
  /** The long table label of BR-M15-01. */
  categoryLabel: string
  vendor: string
  title: string
  iconEmoji: string | null
  denominationRm: number
  tokenCost: number
  /** `null` = "∞". */
  stockQuantity: number | null
  /** Q-M15-RED-REWARD: non-cancelled redemptions. */
  redemptionCount: number
  isActive: boolean
}

/** #1 meta extras (page fields come from the list envelope). */
export interface HadiahListMeta {
  /** A known key, `'all'` (no `cat` or `cat=all`), or `null` (unknown key: no pill active, no rows). */
  activeCat: HadiahCategory | 'all' | null
  cards: { total: number; active: number; redemptionsThisMonth: number; pendingAdmin: number }
}

export interface HadiahListQuery {
  cat?: string
  page?: number
  signal?: AbortSignal
}

export type BulkAction =
  'activate' | 'deactivate' | 'delete' | 'set_stock' | 'set_max_per_month' | 'set_token_cost'

/** #5 request. Values are the raw page strings (BR-M15-12); see SRS BR-M15-11. */
export interface HadiahBulkRequest {
  action: BulkAction
  ids: number[]
  stockValue?: string
  maxPerMonthValue?: string
  /** The raw trimmed prompt text (as live); the mock parses it with `parseInt` semantics. */
  tokenCostDeltaPct?: string
}

/** #5 data. `affected` = rewards changed (removed for `delete`); `keptIds` only for `delete`. */
export interface HadiahBulkResult {
  affected: number
  keptIds?: number[]
}

/** #6 row. */
export interface RedemptionListItem {
  id: number
  user: { id: number; name: string; email: string }
  rewardId: number
  rewardTitle: string
  rewardVendor: string
  denominationRm: number
  tokenCost: number
  status: RedemptionStatus
  createdAt: string
}

export interface RedemptionListMeta {
  /** A status key, `'all'`, or `null` (unknown value: no pill active, empty list). */
  activeStatus: RedemptionStatus | 'all' | null
}

export interface RedemptionListQuery {
  status?: string
  page?: number
  signal?: AbortSignal
}

/** #7 data. */
export interface DeliverResult {
  id: number
  status: 'delivered'
  deliveredAt: string
  expiresAt: string
}

/** #8 / #16 data. */
export interface CancelResult {
  id: number
  status: 'cancelled'
  refundedTokens: number
}

/** #9 data (hook `m15Redeem`; S5 builds no shop, user decision OQ-M15-01). */
export interface RedeemResult {
  id: number
  status: RedemptionStatus
  tokenBalance: number
}

/** DATA-M15-03 as returned by #10. */
export interface MysteryBoxView {
  id: number
  name: string
  description: string
  icon: string
  rarity: 'rare' | 'epic' | 'legendary' | null
  costTokens: number
  coinMin: number
  coinMax: number
  xpMin: number
  xpMax: number
  color1: string
  color2: string
}

export interface MysteryBoxHistoryItem {
  id: number
  boxId: number
  boxName: string
  coins: number
  xp: number
  createdAt: string
}

/** #10 data. `history` = the viewer's openings, newest first, 10 at most. */
export interface MysteryBoxesView {
  tokenBalance: number
  boxes: MysteryBoxView[]
  history: MysteryBoxHistoryItem[]
}

/** #11 data. */
export interface MysteryBoxOpened {
  openingId: number
  boxId: number
  boxName: string
  icon: string
  coins: number
  xp: number
  tokenBalance: number
  syilingBalance: number
}

export interface PrizeLineView {
  label: string
  valueSen: number
  qty: number
}

export interface OpenDrawView {
  id: number
  title: string
  description: string
  ticketCostSyiling: number
  maxTicketsPerStudent: number
  ticketsOwned: number
  /** Local date `yyyy-MM-dd`, or `null` (M14). */
  closesAt: string | null
  prizePool: PrizeLineView[]
}

/** #12 data: open draws ordered by close date (null last) then id. */
export interface CabutanView {
  syilingBalance: number
  draws: OpenDrawView[]
}

/** #13 data. */
export interface TicketBought {
  drawId: number
  ticketsOwned: number
  syilingBalance: number
}

/** #14 item. */
export interface ParentApprovalItem {
  id: number
  child: { id: number; name: string }
  rewardTitle: string
  rewardIcon: string | null
  tokenCost: number
  status: RedemptionStatus
  createdAt: string
}

/** #14 data. */
export interface ParentApprovalsView {
  pending: ParentApprovalItem[]
  history: ParentApprovalItem[]
}

/** #15 data. */
export interface ApproveResult {
  id: number
  status: 'pending_admin'
}

/** Module error codes carried in `ApiError.code` (all 409). */
export type M15ConflictCode =
  | 'OUT_OF_STOCK'
  | 'MONTHLY_CAP'
  | 'INSUFFICIENT_TOKENS'
  | 'DRAW_CLOSED'
  | 'TICKET_LIMIT'
  | 'INSUFFICIENT_BALANCE'
  | 'CONFLICT'

// --- L43 Kedai Hadiah Digital (SRS M15 v1.6 §7 #19, #20; BR-M15-26…28) ---------------------------------

/** #19 item: the list is empty for every account and every `cat` (BR-M15-26), so no item shape exists. */
export type DigitalShopItem = never

/** #20 item: empty for every account (BR-M15-28). */
export type DigitalRedemptionItem = never

/** #19 meta extras (`totalItems` is 0). */
export interface DigitalItemsMeta {
  /** `'all'` for no `cat` or `cat=all`; the key when known (BR-M15-27); `null` for an unknown or repeated value. */
  activeCat: HadiahCategory | 'all' | null
}

export interface DigitalItemsQuery {
  cat?: string
  signal?: AbortSignal
}
