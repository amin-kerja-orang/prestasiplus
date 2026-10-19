import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import {
  WalletErrorCodeSchema,
  WalletGamificationSummarySchema,
  WalletLedgerEntrySchema,
  WalletLedgerTypeSchema,
  WalletNextTierSchema,
  WalletNextTitleSchema,
  WalletStreakSummarySchema,
  WalletSummarySchema,
  WalletTierRefSchema,
  WalletTitleSchema,
  WalletTransactionsMetaSchema,
  WalletTransactionsQuerySchema,
  WalletTransactionsResponseSchema,
} from './schema'

/** Components contributed by BE-11 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const WALLET_COMPONENT_SCHEMAS = {
  WalletLedgerType: WalletLedgerTypeSchema,
  WalletErrorCode: WalletErrorCodeSchema,
  WalletTierRef: WalletTierRefSchema,
  WalletNextTier: WalletNextTierSchema,
  WalletTitle: WalletTitleSchema,
  WalletNextTitle: WalletNextTitleSchema,
  WalletStreakSummary: WalletStreakSummarySchema,
  WalletSummary: WalletSummarySchema,
  WalletLedgerEntry: WalletLedgerEntrySchema,
  WalletTransactionsQuery: WalletTransactionsQuerySchema,
  WalletTransactionsMeta: WalletTransactionsMetaSchema,
  WalletTransactionsResponse: WalletTransactionsResponseSchema,
  WalletGamificationSummary: WalletGamificationSummarySchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Registers the three wallet read endpoints (BE-11). Bodies are `{ data }` or `{ error }`. */
export function registerWalletPaths(registry: OpenAPIRegistry): void {
  const unauthorized = err('UNAUTHORIZED: no valid session.')

  registry.registerPath({
    method: 'get',
    path: '/gamification/wallet',
    tags: ['wallet'],
    summary: 'Own wallet summary',
    description:
      'Any signed-in user; every figure is the caller\'s own (no id parameter). A user without a wallet row reads the defaults (BR-M14-02). Read only: nothing is created.',
    responses: { 200: json(envelopeOf(WalletSummarySchema), 'The caller\'s wallet.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/gamification/transactions',
    tags: ['wallet'],
    summary: 'Own syiling ledger',
    description:
      'Every ledger row of the caller, newest first, NOT paginated (as the mock; OQ-API-B4-2). meta is { currentSyiling, type }, not ListMeta. An unknown type returns an empty list, not an error.',
    request: { query: WalletTransactionsQuerySchema },
    responses: { 200: json(WalletTransactionsResponseSchema, 'Ledger rows with meta.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/me/gamification-summary',
    tags: ['wallet'],
    summary: 'App shell chips: coins, points, streak days',
    description: 'Any signed-in user. A user without wallet or streak rows reads 0 / 0 / 0.',
    responses: {
      200: json(envelopeOf(WalletGamificationSummarySchema), 'coins = currentSyiling, points = xp, streakDays = streak.current.'),
      401: unauthorized,
    },
  })
}
