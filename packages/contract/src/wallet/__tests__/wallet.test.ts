import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { WALLET_COMPONENT_SCHEMAS } from '../paths'
import {
  WALLET_ERRORS,
  WALLET_LEDGER_TYPES,
  WalletGamificationSummarySchema,
  WalletLedgerEntrySchema,
  WalletStreakSummarySchema,
  WalletSummarySchema,
  WalletTierRefSchema,
  WalletTransactionsQuerySchema,
  WalletTransactionsResponseSchema,
} from '../schema'

/** Mock seed tiers (SEED_TIERS) and a wallet like the mock's student account. */
const bronze = { key: 'bronze', labelMs: 'Gangsa', icon: '🥉', color: '#cd7f32', minSyiling: 0, conversionRate: 50 }
const silver = { key: 'silver', labelMs: 'Perak', icon: '🥈', color: '#c0c0c0', minSyiling: 500, conversionRate: 40 }

const wallet = {
  userId: '2',
  currentSyiling: 370,
  totalSyilingEarned: 370,
  tokenBalance: 0,
  xp: 916,
  level: 8,
  xpNeeded: 170,
  levelProgressPct: 100,
  tier: bronze,
  nextTier: { ...silver, pct: 74, need: 130 },
  title: { name: 'Pelajar', emoji: '🎓' },
  nextTitle: { name: 'Master', emoji: '', threshold: 2000, need: 1630 },
  earnedToday: 12,
  earnedThisWeek: 40,
  streak: { current: 2, best: 5, multiplier: 1 },
}
/** BR-M14-02 defaults for a user without a wallet row. */
const emptyWallet = {
  ...wallet,
  currentSyiling: 0,
  totalSyilingEarned: 0,
  xp: 0,
  level: 1,
  xpNeeded: 100,
  levelProgressPct: 0,
  nextTier: { ...silver, pct: 0, need: 500 },
  title: { name: 'Permulaan', emoji: '📚' },
  nextTitle: { name: 'Pelajar', emoji: '🎓', threshold: 300, need: 300 },
  earnedToday: 0,
  earnedThisWeek: 0,
  streak: { current: 0, best: 0, multiplier: 1 },
}
const entry = {
  id: '9001',
  type: 'earn',
  amount: 42,
  balanceAfter: 370,
  source: 'quiz_practice',
  description: 'Latih Tubi: 14 betul — 70%',
  createdAt: '2026-10-16T09:30:00+08:00',
}

describe('WalletSummary (GET /gamification/wallet)', () => {
  it('parses a mock-shaped wallet and the empty-wallet defaults', () => {
    expect(WalletSummarySchema.safeParse(wallet).success).toBe(true)
    expect(WalletSummarySchema.safeParse(emptyWallet).success).toBe(true)
  })

  it('accepts the top tier and the last title (nulls) and a negative seed token balance', () => {
    expect(
      WalletSummarySchema.safeParse({ ...wallet, nextTier: null, nextTitle: null, tokenBalance: -3 }).success,
    ).toBe(true)
  })

  it('rejects numeric ids, missing keys, extra keys and bad numbers', () => {
    expect(WalletSummarySchema.safeParse({ ...wallet, userId: 2 }).success).toBe(false)
    const { streak: _streak, ...noStreak } = wallet
    expect(WalletSummarySchema.safeParse(noStreak).success).toBe(false)
    expect(WalletSummarySchema.safeParse({ ...wallet, hasWallet: true }).success).toBe(false)
    expect(WalletSummarySchema.safeParse({ ...wallet, currentSyiling: 1.5 }).success).toBe(false)
    expect(WalletSummarySchema.safeParse({ ...wallet, currentSyiling: -1 }).success).toBe(false)
    expect(WalletSummarySchema.safeParse({ ...wallet, levelProgressPct: 101 }).success).toBe(false)
    expect(WalletSummarySchema.safeParse({ ...wallet, level: 0 }).success).toBe(false)
    expect(WalletSummarySchema.safeParse({ ...wallet, nextTier: bronze }).success).toBe(false)
  })

  it('exposes no internal or legacy column', () => {
    const keys = JSON.stringify(Object.keys(WalletSummarySchema.shape))
    expect(keys).not.toMatch(/legacy|hasWallet/)
  })
})

describe('WalletTierRef', () => {
  it('accepts a custom admin-created tier key', () => {
    expect(WalletTierRefSchema.safeParse({ ...bronze, key: 'diamond' }).success).toBe(true)
  })
  it('rejects a missing label or a negative threshold', () => {
    expect(WalletTierRefSchema.safeParse({ ...bronze, labelMs: '' }).success).toBe(false)
    expect(WalletTierRefSchema.safeParse({ ...bronze, minSyiling: -1 }).success).toBe(false)
  })
})

describe('WalletStreakSummary', () => {
  it('parses the mock streak and rejects negatives', () => {
    expect(WalletStreakSummarySchema.safeParse({ current: 0, best: 0, multiplier: 1 }).success).toBe(true)
    expect(WalletStreakSummarySchema.safeParse({ current: -1, best: 0, multiplier: 1 }).success).toBe(false)
  })
})

describe('WalletLedgerEntry', () => {
  it('parses every ledger type, signed amounts included', () => {
    for (const type of WALLET_LEDGER_TYPES) {
      expect(WalletLedgerEntrySchema.safeParse({ ...entry, type }).success).toBe(true)
    }
    expect(
      WalletLedgerEntrySchema.safeParse({ ...entry, type: 'convert', amount: -100, balanceAfter: 270, source: 'token_conversion' }).success,
    ).toBe(true)
  })
  it('rejects unknown types, numeric ids, non +08:00 timestamps and internal keys', () => {
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, type: 'gift' }).success).toBe(false)
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, id: 9001 }).success).toBe(false)
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, userId: '2' }).success).toBe(false)
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, refId: 'x' }).success).toBe(false)
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, amount: 1.5 }).success).toBe(false)
    expect(WalletLedgerEntrySchema.safeParse({ ...entry, source: '' }).success).toBe(false)
  })
})

describe('transactions (GET /gamification/transactions)', () => {
  it('query: type is optional and any string is accepted (unknown type = no rows)', () => {
    expect(WalletTransactionsQuerySchema.parse({})).toEqual({})
    expect(WalletTransactionsQuerySchema.parse({ type: 'earn' })).toEqual({ type: 'earn' })
    expect(WalletTransactionsQuerySchema.safeParse({ type: 'whatever' }).success).toBe(true)
    expect(WalletTransactionsQuerySchema.safeParse({ type: 5 }).success).toBe(false)
  })

  it('parses the mock body: all rows, meta { currentSyiling, type }, no page keys', () => {
    expect(
      WalletTransactionsResponseSchema.safeParse({
        data: [entry, { ...entry, id: '9000', balanceAfter: 328 }],
        meta: { currentSyiling: 370, type: '' },
      }).success,
    ).toBe(true)
    expect(
      WalletTransactionsResponseSchema.safeParse({ data: [], meta: { currentSyiling: 0, type: 'bogus' } }).success,
    ).toBe(true)
  })

  it('rejects ListMeta-style meta, a missing meta and bad rows', () => {
    const meta = { currentSyiling: 370, type: '' }
    expect(
      WalletTransactionsResponseSchema.safeParse({
        data: [],
        meta: { ...meta, page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      }).success,
    ).toBe(false)
    expect(WalletTransactionsResponseSchema.safeParse({ data: [] }).success).toBe(false)
    expect(WalletTransactionsResponseSchema.safeParse({ data: [{ ...entry, type: 'x' }], meta }).success).toBe(false)
    expect(WalletTransactionsResponseSchema.safeParse({ data: [], meta: { currentSyiling: 0 } }).success).toBe(false)
  })
})

describe('WalletGamificationSummary (GET /me/gamification-summary)', () => {
  it('parses the mock chips and the 0/0/0 defaults', () => {
    expect(WalletGamificationSummarySchema.safeParse({ coins: 370, points: 916, streakDays: 2 }).success).toBe(true)
    expect(WalletGamificationSummarySchema.safeParse({ coins: 0, points: 0, streakDays: 0 }).success).toBe(true)
  })
  it('rejects missing, negative, fractional and extra keys', () => {
    expect(WalletGamificationSummarySchema.safeParse({ coins: 1, points: 1 }).success).toBe(false)
    expect(WalletGamificationSummarySchema.safeParse({ coins: -1, points: 0, streakDays: 0 }).success).toBe(false)
    expect(WalletGamificationSummarySchema.safeParse({ coins: 1.5, points: 0, streakDays: 0 }).success).toBe(false)
    expect(WalletGamificationSummarySchema.safeParse({ coins: 1, points: 1, streakDays: 1, xp: 1 }).success).toBe(false)
  })
})

describe('wallet errors', () => {
  it('INSUFFICIENT_BALANCE is a 409 with the two exact BM messages', () => {
    expect(WALLET_ERRORS.INSUFFICIENT_BALANCE.status).toBe(409)
    expect(WALLET_ERRORS.INSUFFICIENT_BALANCE.messages).toEqual([
      'Baki syiling tidak mencukupi.',
      'Baki token tidak mencukupi.',
    ])
    expect(
      ErrorBodySchema.safeParse({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Baki syiling tidak mencukupi.' } }).success,
    ).toBe(true)
  })
})

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, unknown>; parameters?: { name: string; in: string }[] }>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains the three wallet paths, GET only, with 200 and 401', () => {
    for (const path of ['/gamification/wallet', '/gamification/transactions', '/me/gamification-summary']) {
      const item = doc.paths[path]
      expect(item, path).toBeDefined()
      expect(Object.keys(item as object)).toEqual(['get'])
      expect(Object.keys(item?.get?.responses ?? {})).toEqual(['200', '401'])
    }
  })

  it('documents the optional type query of the transactions list and no paging params', () => {
    const params = doc.paths['/gamification/transactions']?.get?.parameters ?? []
    expect(params.map((p) => p.name)).toEqual(['type'])
    expect(params[0]?.in).toBe('query')
  })

  it('contains every wallet component, each id prefixed Wallet', () => {
    for (const name of Object.keys(WALLET_COMPONENT_SCHEMAS)) {
      expect(name.startsWith('Wallet'), name).toBe(true)
      expect(doc.components.schemas[name], name).toBeDefined()
    }
  })
})
