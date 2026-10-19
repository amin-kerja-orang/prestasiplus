import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import {
  GamificationAdminAwardRequestSchema,
  GamificationAdminAwardResultSchema,
  GamificationAdminChallengeInputSchema,
  GamificationAdminChallengeSchema,
  GamificationAdminOverviewSchema,
  GamificationAdminStudentRowSchema,
  GamificationAdminStudentsQuerySchema,
  GamificationAdminStudentsResponseSchema,
  GamificationAdminTierCreateSchema,
  GamificationAdminTierSchema,
  GamificationAdminTierUpdateSchema,
  GamificationAdminTransactionRowSchema,
  GamificationAdminTransactionsQuerySchema,
  GamificationAdminTransactionsResponseSchema,
  GamificationDeleteResultSchema,
  GamificationDrawCreateRequestSchema,
  GamificationDrawPrizeInputSchema,
  GamificationDrawPrizeSchema,
  GamificationDrawSchema,
  GamificationDrawStatusSchema,
  GamificationEconomySettingsSchema,
  GamificationEconomySettingsUpdateSchema,
  GamificationRewardControlSchema,
  GamificationRewardCostRequestSchema,
  GamificationSettingKeySchema,
  GamificationSettingSchema,
  GamificationSettingsListSchema,
  GamificationSettingsUpdateRequestSchema,
  GamificationSyilingRewardSchema,
  GamificationToggleResultSchema,
} from './admin'
import {
  RewardBulkActionSchema,
  RewardBulkRequestSchema,
  RewardBulkResultSchema,
  RewardCabutanDrawSchema,
  RewardCabutanViewSchema,
  RewardCancelResultSchema,
  RewardCategorySchema,
  RewardDeliverRequestSchema,
  RewardDeliverResultSchema,
  RewardDeliveryMethodSchema,
  RewardErrorCodeSchema,
  RewardInputSchema,
  RewardItemSchema,
  RewardListItemSchema,
  RewardListMetaSchema,
  RewardListQuerySchema,
  RewardListResponseSchema,
  RewardMysteryBoxHistoryItemSchema,
  RewardMysteryBoxOpenedSchema,
  RewardMysteryBoxSchema,
  RewardMysteryBoxesViewSchema,
  RewardRedeemRequestSchema,
  RewardRedeemResultSchema,
  RewardRedemptionListItemSchema,
  RewardRedemptionListMetaSchema,
  RewardRedemptionListQuerySchema,
  RewardRedemptionListResponseSchema,
  RewardRedemptionStatusSchema,
  RewardTicketBoughtSchema,
  ShopDigitalItemsMetaSchema,
  ShopDigitalItemsQuerySchema,
  ShopDigitalItemsResponseSchema,
  ShopDigitalRedemptionsResponseSchema,
} from './rewards'
import {
  GamificationAchievementItemSchema,
  GamificationAchievementsQuerySchema,
  GamificationAchievementsSchema,
  GamificationChallengeProgressSchema,
  GamificationChallengeTypeSchema,
  GamificationChallengesMetaSchema,
  GamificationChallengesResponseSchema,
  GamificationConvertRequestSchema,
  GamificationConvertResultSchema,
  GamificationConvertViewSchema,
  GamificationDashboardEntrySchema,
  GamificationDashboardSchema,
  GamificationDashboardStreakSchema,
  GamificationDashboardTierSchema,
  GamificationDashboardWalletSchema,
  GamificationDifficultySchema,
  GamificationLeaderboardRowSchema,
  GamificationLeaderboardSchema,
  GamificationLedgerKindSchema,
  GamificationMasteryRowSchema,
  GamificationPodiumEntrySchema,
  GamificationRaritySchema,
  GamificationReferralSchema,
  GamificationShareCardsSchema,
  GamificationTierGridItemSchema,
} from './schema'

/**
 * Components contributed by BE-23 (appended to COMPONENT_SCHEMAS in openapi.ts). The key of each
 * entry is the schema `.meta({ id })`; ids are prefixed `Gamification` (M14), `Reward` (M15
 * catalogue, redemptions, Kotak Misteri, Cabutan) and `Shop` (Kedai Hadiah Digital).
 */
export const GAMIFICATION_COMPONENT_SCHEMAS = {
  // M14 student
  GamificationLedgerKind: GamificationLedgerKindSchema,
  GamificationDifficulty: GamificationDifficultySchema,
  GamificationChallengeType: GamificationChallengeTypeSchema,
  GamificationRarity: GamificationRaritySchema,
  GamificationDashboardTier: GamificationDashboardTierSchema,
  GamificationDashboardStreak: GamificationDashboardStreakSchema,
  GamificationDashboardWallet: GamificationDashboardWalletSchema,
  GamificationDashboardEntry: GamificationDashboardEntrySchema,
  GamificationChallengeProgress: GamificationChallengeProgressSchema,
  GamificationMasteryRow: GamificationMasteryRowSchema,
  GamificationTierGridItem: GamificationTierGridItemSchema,
  GamificationDashboard: GamificationDashboardSchema,
  GamificationConvertView: GamificationConvertViewSchema,
  GamificationConvertRequest: GamificationConvertRequestSchema,
  GamificationConvertResult: GamificationConvertResultSchema,
  GamificationChallengesMeta: GamificationChallengesMetaSchema,
  GamificationChallengesResponse: GamificationChallengesResponseSchema,
  GamificationPodiumEntry: GamificationPodiumEntrySchema,
  GamificationLeaderboardRow: GamificationLeaderboardRowSchema,
  GamificationLeaderboard: GamificationLeaderboardSchema,
  GamificationAchievementsQuery: GamificationAchievementsQuerySchema,
  GamificationAchievementItem: GamificationAchievementItemSchema,
  GamificationAchievements: GamificationAchievementsSchema,
  GamificationShareCards: GamificationShareCardsSchema,
  GamificationReferral: GamificationReferralSchema,
  // M14 admin
  GamificationAdminOverview: GamificationAdminOverviewSchema,
  GamificationAdminTier: GamificationAdminTierSchema,
  GamificationAdminTierUpdate: GamificationAdminTierUpdateSchema,
  GamificationAdminTierCreate: GamificationAdminTierCreateSchema,
  GamificationToggleResult: GamificationToggleResultSchema,
  GamificationAdminChallenge: GamificationAdminChallengeSchema,
  GamificationAdminChallengeInput: GamificationAdminChallengeInputSchema,
  GamificationDeleteResult: GamificationDeleteResultSchema,
  GamificationAdminStudentsQuery: GamificationAdminStudentsQuerySchema,
  GamificationAdminStudentRow: GamificationAdminStudentRowSchema,
  GamificationAdminStudentsResponse: GamificationAdminStudentsResponseSchema,
  GamificationAdminAwardRequest: GamificationAdminAwardRequestSchema,
  GamificationAdminAwardResult: GamificationAdminAwardResultSchema,
  GamificationAdminTransactionsQuery: GamificationAdminTransactionsQuerySchema,
  GamificationAdminTransactionRow: GamificationAdminTransactionRowSchema,
  GamificationAdminTransactionsResponse: GamificationAdminTransactionsResponseSchema,
  GamificationSettingKey: GamificationSettingKeySchema,
  GamificationSetting: GamificationSettingSchema,
  GamificationSettingsList: GamificationSettingsListSchema,
  GamificationSettingsUpdateRequest: GamificationSettingsUpdateRequestSchema,
  GamificationEconomySettings: GamificationEconomySettingsSchema,
  GamificationEconomySettingsUpdate: GamificationEconomySettingsUpdateSchema,
  GamificationSyilingReward: GamificationSyilingRewardSchema,
  GamificationRewardCostRequest: GamificationRewardCostRequestSchema,
  GamificationDrawPrize: GamificationDrawPrizeSchema,
  GamificationDrawPrizeInput: GamificationDrawPrizeInputSchema,
  GamificationDrawStatus: GamificationDrawStatusSchema,
  GamificationDraw: GamificationDrawSchema,
  GamificationDrawCreateRequest: GamificationDrawCreateRequestSchema,
  GamificationRewardControl: GamificationRewardControlSchema,
  // M15
  RewardCategory: RewardCategorySchema,
  RewardDeliveryMethod: RewardDeliveryMethodSchema,
  RewardRedemptionStatus: RewardRedemptionStatusSchema,
  RewardBulkAction: RewardBulkActionSchema,
  RewardErrorCode: RewardErrorCodeSchema,
  RewardItem: RewardItemSchema,
  RewardInput: RewardInputSchema,
  RewardListQuery: RewardListQuerySchema,
  RewardListItem: RewardListItemSchema,
  RewardListMeta: RewardListMetaSchema,
  RewardListResponse: RewardListResponseSchema,
  RewardBulkRequest: RewardBulkRequestSchema,
  RewardBulkResult: RewardBulkResultSchema,
  RewardRedemptionListQuery: RewardRedemptionListQuerySchema,
  RewardRedemptionListItem: RewardRedemptionListItemSchema,
  RewardRedemptionListMeta: RewardRedemptionListMetaSchema,
  RewardRedemptionListResponse: RewardRedemptionListResponseSchema,
  RewardDeliverRequest: RewardDeliverRequestSchema,
  RewardDeliverResult: RewardDeliverResultSchema,
  RewardCancelResult: RewardCancelResultSchema,
  RewardRedeemRequest: RewardRedeemRequestSchema,
  RewardRedeemResult: RewardRedeemResultSchema,
  RewardMysteryBox: RewardMysteryBoxSchema,
  RewardMysteryBoxHistoryItem: RewardMysteryBoxHistoryItemSchema,
  RewardMysteryBoxesView: RewardMysteryBoxesViewSchema,
  RewardMysteryBoxOpened: RewardMysteryBoxOpenedSchema,
  RewardCabutanDraw: RewardCabutanDrawSchema,
  RewardCabutanView: RewardCabutanViewSchema,
  RewardTicketBought: RewardTicketBoughtSchema,
  ShopDigitalItemsQuery: ShopDigitalItemsQuerySchema,
  ShopDigitalItemsMeta: ShopDigitalItemsMetaSchema,
  ShopDigitalItemsResponse: ShopDigitalItemsResponseSchema,
  ShopDigitalRedemptionsResponse: ShopDigitalRedemptionsResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const IdParams = z.object({ id: IdSchema.meta({ description: 'Digits only; a non-numeric segment does not match the route (404 "Not Found.").' }) })
const DrawParams = z.object({ drawId: IdSchema.meta({ description: 'Digits only; a non-numeric segment does not match the route (404 "Not Found.").' }) })
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN_ADMIN = err('FORBIDDEN "This action is unauthorized." (role is not admin).')
const FORBIDDEN_ADMIN_WRITE = err('FORBIDDEN "This action is unauthorized." (role is not admin), or CSRF_INVALID (missing or wrong X-CSRF-Token).')
const FORBIDDEN_CSRF = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
const VALIDATION_FIELDS =
  'VALIDATION_ERROR "Sila lengkapkan semua medan wajib." with fields (name -> "Medan ini diperlukan." when missing or blank, "Medan ini tidak sah." when the type, range, enum or pattern is wrong; the first problem of every failing field).'
const VALIDATION_LARAVEL =
  'VALIDATION_ERROR with fields (name -> Laravel-style English message, see REWARD_VALIDATION_MESSAGES); the top-level message is the first field message plus " (and N more error(s))" when several.'

/**
 * Registers the M14 student, M14 admin (economy and operations) and M15 routes of BE-23.
 * Every response body is `{ data }`, `{ data, meta }` or `{ error }`. Teacher-economy routes
 * (`/guru/gamification*`, `/admin/gamification/guru*`) and parent-approval routes
 * (`/parent/hadiah-approvals*`) are not in B1 and are deliberately not registered.
 */
export function registerGamificationPaths(registry: OpenAPIRegistry): void {
  // -------------------------------------------------------------------------------------------
  // M14 student (8)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/gamification/dashboard',
    tags: ['gamification'],
    summary: 'Gamification hub (Syiling & Token)',
    description:
      'Own data: wallet figures, first 4 active challenges, latest 6 ledger rows, subject mastery (read from practice) and the active tier grid.',
    responses: { 200: json(envelopeOf(GamificationDashboardSchema), 'The dashboard.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/convert',
    tags: ['gamification'],
    summary: 'Token conversion view (Tukar Token)',
    description: 'Shows the conversion rate of the caller tier, the quick amounts and the tier grid.',
    responses: { 200: json(envelopeOf(GamificationConvertViewSchema), 'The conversion view.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/gamification/convert',
    tags: ['gamification'],
    summary: 'Convert syiling to tokens at the tier rate',
    description:
      'tokens = floor(syilingAmount / rate). Atomic: debits syiling with a ledger row (type convert, source token_conversion, description "Tukar {s} syiling → {t} token"), then credits the tokens. Success is 200, not 201. There is no daily cap.',
    request: { headers: [csrf], body: body(GamificationConvertRequestSchema) },
    responses: {
      200: json(envelopeOf(GamificationConvertResultSchema), 'Converted.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      422: err(
        'VALIDATION_ERROR "Jumlah syiling tidak sah." with fields.syilingAmount = the same text (not an integer, below the tier rate, or above the balance).',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/challenges',
    tags: ['gamification'],
    summary: 'Daily challenges with progress',
    description:
      'Active challenges by (sortOrder, id). Progress is computed for the current Malaysia day; progress equals target when already completed today. meta is {completed, active}, NOT the standard list meta. Completion and its reward are written by the session-completed hook (idempotent per user, challenge and Malaysia day), not by this route.',
    responses: { 200: json(GamificationChallengesResponseSchema, 'Challenges with meta.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/leaderboard',
    tags: ['gamification'],
    summary: 'Papan Pendahulu: top 50 by lifetime syiling',
    description: 'Global, not scoped. No query parameter is read (period and others are ignored).',
    responses: { 200: json(envelopeOf(GamificationLeaderboardSchema), 'Podium (ranks 1 to 3) and rows (ranks 4 to 50).'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/achievements',
    tags: ['gamification'],
    summary: 'Achievement catalogue with the caller unlock state',
    description: 'An unknown rarity is not an error: items is empty.',
    request: { query: GamificationAchievementsQuerySchema },
    responses: { 200: json(envelopeOf(GamificationAchievementsSchema), 'Achievements.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/share-cards',
    tags: ['gamification'],
    summary: 'Share cards of the caller profile',
    description: 'All-time answers and sessions come from practice data.',
    responses: { 200: json(envelopeOf(GamificationShareCardsSchema), 'Share-card figures.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/referral',
    tags: ['gamification'],
    summary: 'Rujuk Kawan: referral code, share links and stats',
    description:
      'Side effect on a GET: the first read creates the caller referral code. The referral reward is credited at registration, not here.',
    responses: { 200: json(envelopeOf(GamificationReferralSchema), 'Referral data.'), 401: UNAUTHORIZED },
  })

  // -------------------------------------------------------------------------------------------
  // M14 admin: economy (13)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/gamification/overview',
    tags: ['gamification-admin'],
    summary: 'Admin overview of the economy',
    description: 'National figures computed from the wallet and ledger data.',
    responses: { 200: json(envelopeOf(GamificationAdminOverviewSchema), 'Cards, tier distribution, top 10, latest 10 rows.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/gamification/tiers',
    tags: ['gamification-admin'],
    summary: 'All tiers (including inactive)',
    responses: { 200: json(z.object({ data: z.array(GamificationAdminTierSchema) }), 'Tiers.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/gamification/tiers/{id}',
    tags: ['gamification-admin'],
    summary: 'Update a tier',
    description: 'Wallets are not touched; a holder keeps the tier and tier assignment is re-evaluated at the next credit (a wallet tier never goes down). `tierName` cannot change.',
    request: { params: IdParams, headers: [csrf], body: body(GamificationAdminTierUpdateSchema) },
    responses: {
      200: json(envelopeOf(GamificationAdminTierSchema), 'The updated tier.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Tier tidak dijumpai."'),
      422: err(VALIDATION_FIELDS),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/gamification/tiers/{id}/toggle',
    tags: ['gamification-admin'],
    summary: 'Activate or deactivate a tier',
    description: 'Holders keep a deactivated tier. No body.',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(GamificationToggleResultSchema), 'The new state.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Tier tidak dijumpai."'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/gamification/tiers',
    tags: ['gamification-admin'],
    summary: 'Create a tier',
    description: 'tierName is stored lower-case and is unique. The new tier is active.',
    request: { headers: [csrf], body: body(GamificationAdminTierCreateSchema) },
    responses: {
      201: json(envelopeOf(GamificationAdminTierSchema), 'The created tier.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(`${VALIDATION_FIELDS} Or VALIDATION_ERROR "Nama tier sudah wujud." with fields.tierName (duplicate).`),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/gamification/challenges',
    tags: ['gamification-admin'],
    summary: 'All daily challenges (active or not)',
    description: 'Ordered by (sortOrder, id). The internal metric is hidden.',
    responses: { 200: json(z.object({ data: z.array(GamificationAdminChallengeSchema) }), 'Challenges.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/gamification/challenges/{id}',
    tags: ['gamification-admin'],
    summary: 'Update a daily challenge',
    description: 'Full replace, every field required. The internal metric is kept unless challengeType changes (then it resets to the type default).',
    request: { params: IdParams, headers: [csrf], body: body(GamificationAdminChallengeInputSchema) },
    responses: {
      200: json(envelopeOf(GamificationAdminChallengeSchema), 'The updated challenge.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Cabaran tidak dijumpai."'),
      422: err(VALIDATION_FIELDS),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/gamification/challenges/{id}/toggle',
    tags: ['gamification-admin'],
    summary: 'Activate or deactivate a daily challenge',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(GamificationToggleResultSchema), 'The new state.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Cabaran tidak dijumpai."'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/admin/gamification/challenges/{id}',
    tags: ['gamification-admin'],
    summary: 'Delete a daily challenge',
    description: 'Answers 200 with { data: { deleted: 1 } }, not 204. Completions are not touched (cascade rule is an open question).',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(GamificationDeleteResultSchema), 'Deleted.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Cabaran tidak dijumpai."'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/gamification/challenges',
    tags: ['gamification-admin'],
    summary: 'Create a daily challenge',
    description: 'The new challenge is active; its metric is the default of challengeType.',
    request: { headers: [csrf], body: body(GamificationAdminChallengeInputSchema) },
    responses: {
      201: json(envelopeOf(GamificationAdminChallengeSchema), 'The created challenge.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(VALIDATION_FIELDS),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/gamification/students',
    tags: ['gamification-admin'],
    summary: 'Student wallets',
    description:
      'All students (national). Page size is fixed at 20; pageSize in the query is ignored. An out-of-range page is an empty list with the requested page echoed.',
    request: { query: GamificationAdminStudentsQuerySchema },
    responses: { 200: json(GamificationAdminStudentsResponseSchema, 'A page of wallets.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/gamification/award',
    tags: ['gamification-admin'],
    summary: 'Award syiling to a student',
    description:
      'Atomic: creates the wallet if missing, raises syiling and lifetime syiling, re-assigns the tier, writes a ledger row (type bonus, source admin_award, description = reason). Success is 200, not 201. The mock writes no audit event (open question).',
    request: { headers: [csrf], body: body(GamificationAdminAwardRequestSchema) },
    responses: {
      200: json(envelopeOf(GamificationAdminAwardResultSchema), 'Awarded.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Pengguna tidak dijumpai."'),
      422: err(VALIDATION_FIELDS),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/gamification/transactions',
    tags: ['gamification-admin'],
    summary: 'All ledger rows',
    description: 'Newest first, page size fixed at 25. An unknown type gives an empty result; a malformed date is ignored.',
    request: { query: GamificationAdminTransactionsQuerySchema },
    responses: { 200: json(GamificationAdminTransactionsResponseSchema, 'A page of ledger rows.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  // -------------------------------------------------------------------------------------------
  // M14 admin: operations (6)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/gamification/settings',
    tags: ['gamification-admin'],
    summary: 'The ten gamification settings',
    description: 'Always all ten rows in the S9 order. kind is toggle for cash_withdrawal_enabled and games_award_syiling (value 0 or 1).',
    responses: { 200: json(envelopeOf(GamificationSettingsListSchema), 'Settings.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/gamification/settings',
    tags: ['gamification-admin'],
    summary: 'Save gamification settings',
    description: 'Only the posted keys change. Answers all ten rows. The mock writes no audit event (open question).',
    request: { headers: [csrf], body: body(GamificationSettingsUpdateRequestSchema) },
    responses: {
      200: json(envelopeOf(GamificationSettingsListSchema), 'All settings after the save.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(
        'VALIDATION_ERROR "Sila lengkapkan semua medan wajib." with fields.settings = "Medan ini diperlukan." (missing or empty array), fields["settings.{i}.key"] = "Medan ini diperlukan.", fields["settings.{i}.value"] = "Medan ini tidak sah."; or fields.settings = "Sila lengkapkan semua medan wajib." (unknown key, negative value, toggle above 1).',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/reward-control',
    tags: ['gamification-admin'],
    summary: 'Kawalan Reward',
    description: 'Tiles of the claims in current_session_year, the five shared economy settings, the syiling-priced rewards and every lucky draw (newest first).',
    responses: { 200: json(envelopeOf(GamificationRewardControlSchema), 'Reward control.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/reward-control/settings',
    tags: ['gamification-admin'],
    summary: 'Save the five shared economy settings',
    description: 'Any subset; blank or absent keys are skipped. Same store as /admin/gamification/settings.',
    request: { headers: [csrf], body: body(GamificationEconomySettingsUpdateSchema) },
    responses: {
      200: json(envelopeOf(GamificationEconomySettingsSchema), 'The five settings after the save.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(
        'VALIDATION_ERROR "Sila lengkapkan semua medan wajib." with fields[<camelName>] = "Medan ini tidak sah." (not an integer) or fields.settings = "Medan ini diperlukan." (nothing posted); a negative value is also 422 "Sila lengkapkan semua medan wajib." (no fields).',
      ),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/reward-control/rewards/{id}/cost',
    tags: ['gamification-admin'],
    summary: 'Set the RM cost value of a syiling-priced reward',
    request: { params: IdParams, headers: [csrf], body: body(GamificationRewardCostRequestSchema) },
    responses: {
      200: json(envelopeOf(GamificationSyilingRewardSchema), 'The reward with costRm = costValueSen / 100.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Hadiah tidak dijumpai."'),
      422: err(VALIDATION_FIELDS),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/reward-control/draws',
    tags: ['gamification-admin'],
    summary: 'Create a lucky draw (Cabutan Bertuah)',
    description:
      'status is open when openNow is true, else draft. The prize pool is stored as ordered prize lines; the draw cannot award more prizes than the sum of qty. Ticket purchase is M15 (POST /cabutan/{drawId}/tickets); there is no route that draws winners (open question).',
    request: { headers: [csrf], body: body(GamificationDrawCreateRequestSchema) },
    responses: {
      201: json(envelopeOf(GamificationDrawSchema), 'The created draw (ticketsSold 0).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(
        `${VALIDATION_FIELDS} Or VALIDATION_ERROR "Format JSON kolam hadiah tidak sah." with fields.prizePool (also the top-level message), or "Tarikh tutup tidak sah." (closesAt), or fields.closesAt "Medan ini tidak sah." (not a real date).`,
      ),
    },
  })

  // -------------------------------------------------------------------------------------------
  // M15 student (7)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/hadiah-digital/items',
    tags: ['shop'],
    summary: 'Kedai Hadiah Digital: items',
    description: 'Always an empty list for every account and every cat. meta is the unpaged list meta plus activeCat.',
    request: { query: ShopDigitalItemsQuerySchema },
    responses: { 200: json(ShopDigitalItemsResponseSchema, 'Empty list.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/hadiah-digital/redemptions',
    tags: ['shop'],
    summary: 'Kedai Hadiah Digital: own redemptions',
    description: 'Always an empty list for every account.',
    responses: { 200: json(ShopDigitalRedemptionsResponseSchema, 'Empty list.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/hadiah/redemptions',
    tags: ['rewards'],
    summary: 'Redeem a catalogue reward with tokens',
    description:
      'One transaction: snapshot redemption row, token debit (source hadiah_redeem, ref redemption:{id}), stock - 1 when stock is limited. Checks run in this order: reward exists and is active, stock, monthly cap (non-cancelled redemptions of that reward in the Malaysia calendar month), token balance. Any refusal rolls back everything.',
    request: { headers: [csrf], body: body(RewardRedeemRequestSchema) },
    responses: {
      201: json(envelopeOf(RewardRedeemResultSchema), 'Redeemed.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      404: err('NOT_FOUND "Hadiah tidak dijumpai." (missing or inactive reward).'),
      409: err(
        'OUT_OF_STOCK "Stok hadiah telah habis."; MONTHLY_CAP "Had tebusan bulanan dicapai."; INSUFFICIENT_TOKENS "Token tidak mencukupi.".',
      ),
      422: err('VALIDATION_ERROR fields.rewardId "The reward id field is required." (missing, non-numeric or below 1; the top-level message is the same text).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/mystery-boxes',
    tags: ['rewards'],
    summary: 'Kotak Misteri: boxes, token balance, last 10 openings',
    responses: { 200: json(envelopeOf(RewardMysteryBoxesViewSchema), 'Boxes and own history.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/gamification/mystery-boxes/{id}/open',
    tags: ['rewards'],
    summary: 'Open a mystery box',
    description:
      'One transaction: opening row, token debit (costTokens, source mystery_box), syiling credit of coins (ledger earn, source mystery_box, description "Kotak Misteri: {box name}", ref opening:{id}), xp added when above 0. coins and xp are uniform integers inside the box ranges (the RNG is not specified). Success is 200, not 201. No body.',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(RewardMysteryBoxOpenedSchema), 'Opened.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      404: err('NOT_FOUND "Kotak tidak dijumpai."'),
      409: err('INSUFFICIENT_TOKENS "Token tidak mencukupi."'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/cabutan',
    tags: ['rewards'],
    summary: 'Cabutan Bertuah: open draws',
    description: 'Only status open with closesAt today or later (Malaysia time) or null; ordered by closesAt ascending (null last), then id.',
    responses: { 200: json(envelopeOf(RewardCabutanViewSchema), 'Open draws with the caller ticket counts.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/cabutan/{drawId}/tickets',
    tags: ['rewards'],
    summary: 'Buy one draw ticket with syiling',
    description:
      'Debits ticketCostSyiling (ledger spend, source cabutan_ticket, description "Tiket Cabutan: {title}", ref draw:{id}) and inserts one ticket. No body.',
    request: { params: DrawParams, headers: [csrf] },
    responses: {
      201: json(envelopeOf(RewardTicketBoughtSchema), 'Ticket bought.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      409: err(
        'DRAW_CLOSED "Cabutan ditutup." (missing, not open, or closed by date); TICKET_LIMIT "Had tiket dicapai."; INSUFFICIENT_BALANCE "Baki syiling tidak mencukupi.".',
      ),
    },
  })

  // -------------------------------------------------------------------------------------------
  // M15 admin (8)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/hadiah',
    tags: ['rewards-admin'],
    summary: 'Rewards catalogue (admin list)',
    description: 'Page size fixed at 50, in catalogue order. meta carries activeCat and four cards.',
    request: { query: RewardListQuerySchema },
    responses: { 200: json(RewardListResponseSchema, 'A page of rewards.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/hadiah/bulk',
    tags: ['rewards-admin'],
    summary: 'Bulk action on rewards',
    description:
      'activate, deactivate, delete (rewards with any redemption row are kept and reported in keptIds), set_stock, set_max_per_month, set_token_cost (new cost = floor(cost * (1 + pct/100) + 0.5), clamped to 1..10000; denominationRm is unchanged).',
    request: { headers: [csrf], body: body(RewardBulkRequestSchema) },
    responses: {
      200: json(envelopeOf(RewardBulkResultSchema), 'Bulk result.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(VALIDATION_LARAVEL),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/hadiah/redemptions',
    tags: ['rewards-admin'],
    summary: 'Redemption queue',
    description: 'Page size fixed at 50, newest first. Absent status = pending_admin.',
    request: { query: RewardRedemptionListQuerySchema },
    responses: { 200: json(RewardRedemptionListResponseSchema, 'A page of redemptions.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/hadiah/redemptions/{id}/deliver',
    tags: ['rewards-admin'],
    summary: 'Mark a redemption delivered with a voucher code',
    description: 'The id is checked before the body is validated. No notification is sent to the student.',
    request: { params: IdParams, headers: [csrf], body: body(RewardDeliverRequestSchema) },
    responses: {
      200: json(envelopeOf(RewardDeliverResultSchema), 'Delivered.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Not Found." (unknown id).'),
      409: err('CONFLICT "Tebusan ini tidak lagi menunggu pemprosesan." (status is not pending_admin).'),
      422: err('VALIDATION_ERROR fields.code "The code field is required." / "The code field must not be greater than 100 characters.".'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/hadiah/redemptions/{id}/cancel',
    tags: ['rewards-admin'],
    summary: 'Cancel a pending_admin redemption and refund the tokens',
    description: 'Credits tokenCost back (source hadiah_refund, ref redemption:{id}), restores stock when it was reserved, status cancelled. No body.',
    request: { params: IdParams, headers: [csrf] },
    responses: {
      200: json(envelopeOf(RewardCancelResultSchema), 'Cancelled.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Tebusan tidak dijumpai."'),
      409: err('CONFLICT "Tebusan ini tidak lagi menunggu pemprosesan." (status is not pending_admin).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/admin/hadiah/{id}',
    tags: ['rewards-admin'],
    summary: 'One reward (edit form)',
    request: { params: IdParams },
    responses: {
      200: json(envelopeOf(RewardItemSchema), 'The reward.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN,
      404: err('NOT_FOUND "Not Found."'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/admin/hadiah',
    tags: ['rewards-admin'],
    summary: 'Create a reward',
    request: { headers: [csrf], body: body(RewardInputSchema) },
    responses: {
      201: json(envelopeOf(RewardItemSchema), 'The created reward.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(VALIDATION_LARAVEL),
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/hadiah/{id}',
    tags: ['rewards-admin'],
    summary: 'Replace a reward',
    description: 'Full body with the rules of create; an omitted optional field falls back to its default (not a patch). The id is checked before validation.',
    request: { params: IdParams, headers: [csrf], body: body(RewardInputSchema) },
    responses: {
      200: json(envelopeOf(RewardItemSchema), 'The updated reward.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Not Found."'),
      422: err(VALIDATION_LARAVEL),
    },
  })
}
