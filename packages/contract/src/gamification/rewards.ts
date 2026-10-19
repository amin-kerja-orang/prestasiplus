import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { GamificationDrawPrizeSchema } from './admin'
import { count, nonBlank } from './shared'

/**
 * M15 rewards shop (BE-23): the Hadiah catalogue and its redemption queue (admin), token
 * redemption, Kotak Misteri, Cabutan Bertuah tickets and the Kedai Hadiah Digital reads.
 * The three parent-approval routes are not in B1 (UD-3) and have no schema.
 *
 * The frontend mock (`src/modules/m15-rewards-shop`) is the wire spec. Ids are opaque strings (`Id`)
 * where the mock uses integers. Money fields keep the mock's shape: `denominationRm` is an integer
 * (RM), `valueSen` an integer in sen. Validation messages of the admin writes are the mock's
 * Laravel-style English texts (no BM copy exists); see `REWARD_VALIDATION_MESSAGES`.
 */

// ---------------------------------------------------------------------------------------------
// Enums, errors, messages
// ---------------------------------------------------------------------------------------------

export const REWARD_CATEGORIES = [
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
export const RewardCategorySchema = z.enum(REWARD_CATEGORIES).meta({ id: 'RewardCategory' })
export type RewardCategory = z.infer<typeof RewardCategorySchema>

export const REWARD_DELIVERY_METHODS = ['manual', 'api', 'instant'] as const
export const RewardDeliveryMethodSchema = z
  .enum(REWARD_DELIVERY_METHODS)
  .meta({ id: 'RewardDeliveryMethod' })
export type RewardDeliveryMethod = z.infer<typeof RewardDeliveryMethodSchema>

export const REWARD_REDEMPTION_STATUSES = [
  'pending_parent_consent',
  'pending_admin',
  'delivered',
  'cancelled',
] as const
export const RewardRedemptionStatusSchema = z
  .enum(REWARD_REDEMPTION_STATUSES)
  .meta({ id: 'RewardRedemptionStatus' })
export type RewardRedemptionStatus = z.infer<typeof RewardRedemptionStatusSchema>

export const REWARD_BULK_ACTIONS = [
  'activate',
  'deactivate',
  'delete',
  'set_stock',
  'set_max_per_month',
  'set_token_cost',
] as const
export const RewardBulkActionSchema = z.enum(REWARD_BULK_ACTIONS).meta({ id: 'RewardBulkAction' })
export type RewardBulkAction = z.infer<typeof RewardBulkActionSchema>

/** Module error codes of the M15 routes; all answer 409 (a missing row is the generic 404 `NOT_FOUND`). */
export const REWARD_ERROR_CODES = [
  'OUT_OF_STOCK',
  'MONTHLY_CAP',
  'INSUFFICIENT_TOKENS',
  'DRAW_CLOSED',
  'TICKET_LIMIT',
  'INSUFFICIENT_BALANCE',
  'CONFLICT',
] as const
export const RewardErrorCodeSchema = z.enum(REWARD_ERROR_CODES).meta({ id: 'RewardErrorCode' })
export type RewardErrorCode = z.infer<typeof RewardErrorCodeSchema>

/** Exact status and BM message per module code (`CONFLICT` has two: queue and parent consent). */
export const REWARD_ERRORS = {
  OUT_OF_STOCK: { status: 409, messages: ['Stok hadiah telah habis.'] },
  MONTHLY_CAP: { status: 409, messages: ['Had tebusan bulanan dicapai.'] },
  INSUFFICIENT_TOKENS: { status: 409, messages: ['Token tidak mencukupi.'] },
  DRAW_CLOSED: { status: 409, messages: ['Cabutan ditutup.'] },
  TICKET_LIMIT: { status: 409, messages: ['Had tiket dicapai.'] },
  INSUFFICIENT_BALANCE: { status: 409, messages: ['Baki syiling tidak mencukupi.'] },
  CONFLICT: {
    status: 409,
    messages: ['Tebusan ini tidak lagi menunggu pemprosesan.', 'Tebusan ini tidak lagi menunggu kelulusan.'],
  },
} as const satisfies Record<RewardErrorCode, { status: number; messages: readonly string[] }>

/** Messages of the generic codes the M15 routes raise. */
export const REWARD_MESSAGES = {
  rewardNotFound: 'Hadiah tidak dijumpai.',
  redemptionNotFound: 'Tebusan tidak dijumpai.',
  boxNotFound: 'Kotak tidak dijumpai.',
  /** Default message of an unmatched id: unknown reward/redemption on the admin GET/PUT/deliver, or a non-numeric path id. */
  notFound: 'Not Found.',
} as const

/** Laravel-style validation messages of the admin writes (field -> message), as the mock emits them. */
export const REWARD_VALIDATION_MESSAGES = {
  rewardIdRequired: 'The reward id field is required.',
  actionRequired: 'The action field is required.',
  actionInvalid: 'The selected action is invalid.',
  idsRequired: 'The ids field is required.',
  idsInvalid: 'The ids field must contain positive integers.',
  stockValue: 'The stock value must be 0-999999 or empty.',
  maxPerMonthValue: 'The max per month value must be 0-99 or empty.',
  tokenCostDeltaPct: 'The token cost adjustment must be between -90 and 500 (not 0).',
  codeRequired: 'The code field is required.',
  codeTooLong: 'The code field must not be greater than 100 characters.',
  categoryRequired: 'The category field is required.',
  categoryInvalid: 'The selected category is invalid.',
  deliveryMethodInvalid: 'The selected delivery method is invalid.',
  imageUrlInvalid: 'The image url field must be a valid URL.',
  isActiveInvalid: 'The is active field must be true or false.',
  requiresParentConsentInvalid: 'The requires parent consent field must be true or false.',
} as const

const FIELD = (description: string) => ({ description })
const optionalText = (max: number) => z.string().max(max).nullable().optional()

// ---------------------------------------------------------------------------------------------
// Admin: the Hadiah catalogue
// ---------------------------------------------------------------------------------------------

/** A reward of the catalogue (edit form). `null` stock = unlimited, `null` cap = no cap. */
export const RewardItemSchema = z
  .object({
    id: IdSchema,
    category: RewardCategorySchema,
    vendor: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    denominationRm: z.number().int().min(1),
    tokenCost: z.number().int().min(1),
    iconEmoji: z.string().nullable(),
    stockQuantity: count.nullable(),
    maxPerMonthPerStudent: count.nullable(),
    voucherValidityDays: z.number().int().min(1),
    deliveryMethod: RewardDeliveryMethodSchema,
    vendorSku: z.string().nullable(),
    displayOrder: count,
    imageUrl: z.string().nullable(),
    termsText: z.string().nullable(),
    isActive: z.boolean(),
    requiresParentConsent: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'RewardItem' })
export type RewardItem = z.infer<typeof RewardItemSchema>

/**
 * `POST /admin/hadiah` and `PUT /admin/hadiah/{id}` body (PUT replaces: an omitted optional field
 * falls back to its default, it is not a patch). Defaults: `voucherValidityDays` 365,
 * `deliveryMethod` manual, `displayOrder` 100, `isActive` true, `requiresParentConsent` false,
 * every other optional field null.
 */
export const RewardInputSchema = z
  .object({
    category: RewardCategorySchema,
    vendor: nonBlank(100),
    title: nonBlank(200),
    description: optionalText(1000),
    denominationRm: z.number().int().min(1).max(10_000),
    tokenCost: z.number().int().min(1).max(10_000),
    iconEmoji: optionalText(8),
    stockQuantity: z.number().int().min(0).max(999_999_999).nullable().optional().meta(FIELD('null or absent = unlimited.')),
    maxPerMonthPerStudent: z.number().int().min(1).max(99).nullable().optional().meta(FIELD('null or absent = no cap.')),
    voucherValidityDays: z.number().int().min(1).max(1825).optional(),
    deliveryMethod: RewardDeliveryMethodSchema.optional(),
    vendorSku: optionalText(100),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    imageUrl: z
      .string()
      .max(500)
      .regex(/^[Hh][Tt][Tt][Pp][Ss]?:\/\/\S+$/)
      .nullable()
      .optional(),
    termsText: optionalText(2000),
    isActive: z.boolean().optional(),
    requiresParentConsent: z.boolean().optional(),
  })
  .meta({ id: 'RewardInput' })
export type RewardInput = z.infer<typeof RewardInputSchema>

/** Query of `GET /admin/hadiah`; the page size is fixed at 50. */
export const RewardListQuerySchema = z
  .object({
    cat: z.string().optional().meta(FIELD('A category key or "all"; an unknown value gives no rows and activeCat null.')),
    page: z.coerce.number().int().min(1).optional().meta(FIELD('An invalid page reads as 1.')),
  })
  .meta({ id: 'RewardListQuery' })
export type RewardListQuery = z.infer<typeof RewardListQuerySchema>

export const RewardListItemSchema = z
  .object({
    id: IdSchema,
    category: RewardCategorySchema,
    categoryLabel: z.string().meta(FIELD('The long table label of the category (BM, with emoji).')),
    vendor: z.string(),
    title: z.string(),
    iconEmoji: z.string().nullable(),
    denominationRm: z.number().int().min(1),
    tokenCost: z.number().int().min(1),
    stockQuantity: count.nullable(),
    redemptionCount: count.meta(FIELD('Non-cancelled redemptions of this reward.')),
    isActive: z.boolean(),
  })
  .meta({ id: 'RewardListItem' })
export type RewardListItem = z.infer<typeof RewardListItemSchema>

/** Standard list meta plus the active category and the four cards. */
export const RewardListMetaSchema = ListMetaSchema.extend({
  activeCat: z.union([RewardCategorySchema, z.literal('all')]).nullable(),
  cards: z.object({
    total: count,
    active: count,
    redemptionsThisMonth: count,
    pendingAdmin: count,
  }),
}).meta({ id: 'RewardListMeta' })
export type RewardListMeta = z.infer<typeof RewardListMetaSchema>

export const RewardListResponseSchema = z
  .object({ data: z.array(RewardListItemSchema), meta: RewardListMetaSchema })
  .meta({ id: 'RewardListResponse' })
export type RewardListResponse = z.infer<typeof RewardListResponseSchema>

/**
 * `POST /admin/hadiah/bulk` body. The value fields are the raw page strings:
 * `stockValue` empty (= unlimited) or digits <= 999999; `maxPerMonthValue` empty or 0 (= no cap)
 * or digits <= 99; `tokenCostDeltaPct` a non-zero integer text in -90..500 (parseInt semantics).
 * Only the field of the chosen action is read.
 */
export const RewardBulkRequestSchema = z
  .object({
    action: RewardBulkActionSchema,
    ids: z.array(IdSchema).min(1).meta(FIELD('Reward ids; unknown ids are ignored, duplicates collapsed.')),
    stockValue: z.string().optional(),
    maxPerMonthValue: z.string().optional(),
    tokenCostDeltaPct: z.string().optional(),
  })
  .meta({ id: 'RewardBulkRequest' })
export type RewardBulkRequest = z.infer<typeof RewardBulkRequestSchema>

/** `keptIds` only for `delete`: rewards that have any redemption row are kept, not deleted. */
export const RewardBulkResultSchema = z
  .object({ affected: count, keptIds: z.array(IdSchema).optional() })
  .meta({ id: 'RewardBulkResult' })
export type RewardBulkResult = z.infer<typeof RewardBulkResultSchema>

// ---------------------------------------------------------------------------------------------
// Admin: the redemption queue
// ---------------------------------------------------------------------------------------------

/** Query of `GET /admin/hadiah/redemptions`; the page size is fixed at 50, newest first. */
export const RewardRedemptionListQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .meta(FIELD('A status key or "all"; absent = pending_admin; any other value gives an empty list and activeStatus null.')),
    page: z.coerce.number().int().min(1).optional().meta(FIELD('An invalid page reads as 1.')),
  })
  .meta({ id: 'RewardRedemptionListQuery' })
export type RewardRedemptionListQuery = z.infer<typeof RewardRedemptionListQuerySchema>

export const RewardRedemptionListItemSchema = z
  .object({
    id: IdSchema,
    user: z.object({ id: IdSchema, name: z.string(), email: z.string() }),
    rewardId: IdSchema,
    rewardTitle: z.string(),
    rewardVendor: z.string(),
    denominationRm: z.number().int().min(1),
    tokenCost: z.number().int().min(1),
    status: RewardRedemptionStatusSchema,
    createdAt: TimestampSchema,
  })
  .meta({ id: 'RewardRedemptionListItem' })
export type RewardRedemptionListItem = z.infer<typeof RewardRedemptionListItemSchema>

export const RewardRedemptionListMetaSchema = ListMetaSchema.extend({
  activeStatus: z.union([RewardRedemptionStatusSchema, z.literal('all')]).nullable(),
}).meta({ id: 'RewardRedemptionListMeta' })
export type RewardRedemptionListMeta = z.infer<typeof RewardRedemptionListMetaSchema>

export const RewardRedemptionListResponseSchema = z
  .object({ data: z.array(RewardRedemptionListItemSchema), meta: RewardRedemptionListMetaSchema })
  .meta({ id: 'RewardRedemptionListResponse' })
export type RewardRedemptionListResponse = z.infer<typeof RewardRedemptionListResponseSchema>

/** `POST /admin/hadiah/redemptions/{id}/deliver` body: the voucher code (trimmed, 1 to 100 characters). */
export const RewardDeliverRequestSchema = z
  .object({ code: nonBlank(100) })
  .meta({ id: 'RewardDeliverRequest' })
export type RewardDeliverRequest = z.infer<typeof RewardDeliverRequestSchema>

/** `expiresAt` = now + the reward `voucherValidityDays` (default 365). */
export const RewardDeliverResultSchema = z
  .object({
    id: IdSchema,
    status: z.literal('delivered'),
    deliveredAt: TimestampSchema,
    expiresAt: TimestampSchema,
  })
  .meta({ id: 'RewardDeliverResult' })
export type RewardDeliverResult = z.infer<typeof RewardDeliverResultSchema>

/** Admin cancel of a `pending_admin` redemption: tokens are refunded, stock restored if reserved. */
export const RewardCancelResultSchema = z
  .object({ id: IdSchema, status: z.literal('cancelled'), refundedTokens: count })
  .meta({ id: 'RewardCancelResult' })
export type RewardCancelResult = z.infer<typeof RewardCancelResultSchema>

// ---------------------------------------------------------------------------------------------
// Student: redeem, Kotak Misteri, Cabutan
// ---------------------------------------------------------------------------------------------

/** `POST /hadiah/redemptions` body. */
export const RewardRedeemRequestSchema = z
  .object({ rewardId: IdSchema })
  .meta({ id: 'RewardRedeemRequest' })
export type RewardRedeemRequest = z.infer<typeof RewardRedeemRequestSchema>

/** `status` is `pending_parent_consent` when the reward needs parent consent, else `pending_admin`. */
export const RewardRedeemResultSchema = z
  .object({ id: IdSchema, status: RewardRedemptionStatusSchema, tokenBalance: count })
  .meta({ id: 'RewardRedeemResult' })
export type RewardRedeemResult = z.infer<typeof RewardRedeemResultSchema>

export const RewardMysteryBoxSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    rarity: z.enum(['rare', 'epic', 'legendary']).nullable(),
    costTokens: z.number().int().min(1),
    coinMin: count,
    coinMax: count,
    xpMin: count,
    xpMax: count,
    color1: z.string(),
    color2: z.string(),
  })
  .meta({ id: 'RewardMysteryBox' })
export type RewardMysteryBox = z.infer<typeof RewardMysteryBoxSchema>

export const RewardMysteryBoxHistoryItemSchema = z
  .object({
    id: IdSchema,
    boxId: IdSchema,
    boxName: z.string(),
    coins: count,
    xp: count,
    createdAt: TimestampSchema,
  })
  .meta({ id: 'RewardMysteryBoxHistoryItem' })
export type RewardMysteryBoxHistoryItem = z.infer<typeof RewardMysteryBoxHistoryItemSchema>

/** `history` = the caller's last openings, newest first, at most 10. */
export const RewardMysteryBoxesViewSchema = z
  .object({
    tokenBalance: count,
    boxes: z.array(RewardMysteryBoxSchema),
    history: z.array(RewardMysteryBoxHistoryItemSchema).max(10),
  })
  .meta({ id: 'RewardMysteryBoxesView' })
export type RewardMysteryBoxesView = z.infer<typeof RewardMysteryBoxesViewSchema>

/** Both balances are the values after the opening; `coins` and `xp` fall inside the box ranges. */
export const RewardMysteryBoxOpenedSchema = z
  .object({
    openingId: IdSchema,
    boxId: IdSchema,
    boxName: z.string(),
    icon: z.string(),
    coins: count,
    xp: count,
    tokenBalance: count,
    syilingBalance: count,
  })
  .meta({ id: 'RewardMysteryBoxOpened' })
export type RewardMysteryBoxOpened = z.infer<typeof RewardMysteryBoxOpenedSchema>

export const RewardCabutanDrawSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    description: z.string(),
    ticketCostSyiling: count,
    maxTicketsPerStudent: z.number().int().min(1),
    ticketsOwned: count,
    closesAt: DateOnlySchema.nullable(),
    prizePool: z.array(GamificationDrawPrizeSchema),
  })
  .meta({ id: 'RewardCabutanDraw' })
export type RewardCabutanDraw = z.infer<typeof RewardCabutanDrawSchema>

/** Open draws only (`status` open and `closesAt` today or later in Malaysia time, or null), by closing date (null last) then id. */
export const RewardCabutanViewSchema = z
  .object({ syilingBalance: count, draws: z.array(RewardCabutanDrawSchema) })
  .meta({ id: 'RewardCabutanView' })
export type RewardCabutanView = z.infer<typeof RewardCabutanViewSchema>

export const RewardTicketBoughtSchema = z
  .object({ drawId: IdSchema, ticketsOwned: z.number().int().min(1), syilingBalance: count })
  .meta({ id: 'RewardTicketBought' })
export type RewardTicketBought = z.infer<typeof RewardTicketBoughtSchema>

// ---------------------------------------------------------------------------------------------
// Kedai Hadiah Digital (L43): reads that are empty for every account
// ---------------------------------------------------------------------------------------------

/** Query of `GET /hadiah-digital/items`. */
export const ShopDigitalItemsQuerySchema = z
  .object({
    cat: z.string().optional().meta(FIELD('A category key or "all"; an unknown or repeated value gives activeCat null.')),
  })
  .meta({ id: 'ShopDigitalItemsQuery' })
export type ShopDigitalItemsQuery = z.infer<typeof ShopDigitalItemsQuerySchema>

/** Unpaged list meta (page 1, pageSize max(1, n)) plus the active category. */
export const ShopDigitalItemsMetaSchema = ListMetaSchema.extend({
  activeCat: z.union([RewardCategorySchema, z.literal('all')]).nullable(),
}).meta({ id: 'ShopDigitalItemsMeta' })
export type ShopDigitalItemsMeta = z.infer<typeof ShopDigitalItemsMetaSchema>

/** `data` is always `[]` (the reward store is never read), so no item shape exists. */
export const ShopDigitalItemsResponseSchema = z
  .object({ data: z.array(z.unknown()).max(0), meta: ShopDigitalItemsMetaSchema })
  .meta({ id: 'ShopDigitalItemsResponse' })
export type ShopDigitalItemsResponse = z.infer<typeof ShopDigitalItemsResponseSchema>

/** `data` is always `[]` for every account. */
export const ShopDigitalRedemptionsResponseSchema = z
  .object({ data: z.array(z.unknown()).max(0), meta: ListMetaSchema })
  .meta({ id: 'ShopDigitalRedemptionsResponse' })
export type ShopDigitalRedemptionsResponse = z.infer<typeof ShopDigitalRedemptionsResponseSchema>
