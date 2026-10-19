import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import {
  REWARD_BULK_ACTIONS,
  REWARD_CATEGORIES,
  REWARD_ERRORS,
  REWARD_ERROR_CODES,
  REWARD_MESSAGES,
  REWARD_REDEMPTION_STATUSES,
  REWARD_VALIDATION_MESSAGES,
  RewardBulkRequestSchema,
  RewardBulkResultSchema,
  RewardCabutanViewSchema,
  RewardCancelResultSchema,
  RewardDeliverRequestSchema,
  RewardDeliverResultSchema,
  RewardInputSchema,
  RewardItemSchema,
  RewardListQuerySchema,
  RewardListResponseSchema,
  RewardMysteryBoxOpenedSchema,
  RewardMysteryBoxesViewSchema,
  RewardRedeemRequestSchema,
  RewardRedeemResultSchema,
  RewardRedemptionListQuerySchema,
  RewardRedemptionListResponseSchema,
  RewardTicketBoughtSchema,
  ShopDigitalItemsQuerySchema,
  ShopDigitalItemsResponseSchema,
  ShopDigitalRedemptionsResponseSchema,
} from '../rewards'

const AT = '2026-10-16T09:30:00+08:00'
const item = {
  id: '5',
  category: 'ewallet',
  vendor: 'Vendor Contoh',
  title: 'Baucar E-Dompet RM10',
  description: null,
  denominationRm: 10,
  tokenCost: 20,
  iconEmoji: '💳',
  stockQuantity: 50,
  maxPerMonthPerStudent: 2,
  voucherValidityDays: 365,
  deliveryMethod: 'manual',
  vendorSku: null,
  displayOrder: 100,
  imageUrl: null,
  termsText: null,
  isActive: true,
  requiresParentConsent: false,
  createdAt: AT,
  updatedAt: AT,
}
const input = { category: 'ewallet', vendor: 'Vendor Contoh', title: 'Baucar E-Dompet RM10', denominationRm: 10, tokenCost: 20 }
const meta = { page: 1, pageSize: 50, totalItems: 1, totalPages: 1, from: 1, to: 1 }
const unpagedEmpty = { page: 1, pageSize: 1, totalItems: 0, totalPages: 1, from: null, to: null }

describe('admin catalogue', () => {
  it('parses a reward, with unlimited stock and no cap', () => {
    expect(RewardItemSchema.safeParse(item).success).toBe(true)
    expect(RewardItemSchema.safeParse({ ...item, stockQuantity: null, maxPerMonthPerStudent: null }).success).toBe(true)
    expect(RewardItemSchema.safeParse({ ...item, category: 'crypto' }).success).toBe(false)
    expect(RewardItemSchema.safeParse({ ...item, updatedAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(RewardItemSchema.safeParse({ ...item, id: 5 }).success).toBe(false)
  })

  it('has the nine categories, four statuses and six bulk actions', () => {
    expect(REWARD_CATEGORIES).toHaveLength(9)
    expect(REWARD_REDEMPTION_STATUSES).toEqual(['pending_parent_consent', 'pending_admin', 'delivered', 'cancelled'])
    expect(REWARD_BULK_ACTIONS).toHaveLength(6)
  })

  it('accepts the minimal create body and all optional fields', () => {
    expect(RewardInputSchema.safeParse(input).success).toBe(true)
    expect(
      RewardInputSchema.safeParse({
        ...input,
        description: 'Penerangan',
        iconEmoji: '💳',
        stockQuantity: 0,
        maxPerMonthPerStudent: 99,
        voucherValidityDays: 1825,
        deliveryMethod: 'instant',
        vendorSku: 'SKU-1',
        displayOrder: 0,
        imageUrl: 'https://cdn.contoh.test/a.png',
        termsText: 'Terma',
        isActive: false,
        requiresParentConsent: true,
      }).success,
    ).toBe(true)
    expect(RewardInputSchema.safeParse({ ...input, stockQuantity: null, imageUrl: null, description: null }).success).toBe(true)
  })

  it('rejects out-of-range and malformed create bodies', () => {
    const bad = (patch: Record<string, unknown>) => RewardInputSchema.safeParse({ ...input, ...patch }).success
    expect(bad({ category: 'crypto' })).toBe(false)
    expect(bad({ vendor: '' })).toBe(false)
    expect(bad({ vendor: 'x'.repeat(101) })).toBe(false)
    expect(bad({ title: '   ' })).toBe(false)
    expect(bad({ title: 'x'.repeat(201) })).toBe(false)
    expect(bad({ denominationRm: 0 })).toBe(false)
    expect(bad({ denominationRm: 10_001 })).toBe(false)
    expect(bad({ tokenCost: 0 })).toBe(false)
    expect(bad({ stockQuantity: -1 })).toBe(false)
    expect(bad({ maxPerMonthPerStudent: 0 })).toBe(false)
    expect(bad({ maxPerMonthPerStudent: 100 })).toBe(false)
    expect(bad({ voucherValidityDays: 1826 })).toBe(false)
    expect(bad({ displayOrder: 10_000 })).toBe(false)
    expect(bad({ deliveryMethod: 'post' })).toBe(false)
    expect(bad({ imageUrl: 'ftp://x.test/a.png' })).toBe(false)
    expect(bad({ imageUrl: 'https://x.test/a b.png' })).toBe(false)
    expect(bad({ iconEmoji: 'x'.repeat(9) })).toBe(false)
    expect(bad({ isActive: 'yes' })).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit keys to build an invalid payload
    const { tokenCost: _t, ...missing } = input
    expect(RewardInputSchema.safeParse(missing).success).toBe(false)
  })

  it('parses the list page with activeCat and the four cards', () => {
    const listItem = {
      id: '5',
      category: 'ewallet',
      categoryLabel: '💳 E-Wallet',
      vendor: 'Vendor Contoh',
      title: 'Baucar E-Dompet RM10',
      iconEmoji: null,
      denominationRm: 10,
      tokenCost: 20,
      stockQuantity: null,
      redemptionCount: 3,
      isActive: true,
    }
    const cards = { total: 1, active: 1, redemptionsThisMonth: 2, pendingAdmin: 1 }
    expect(RewardListResponseSchema.safeParse({ data: [listItem], meta: { ...meta, activeCat: 'all', cards } }).success).toBe(true)
    expect(RewardListResponseSchema.safeParse({ data: [], meta: { ...meta, totalItems: 0, from: null, to: null, activeCat: null, cards } }).success).toBe(true)
    expect(RewardListResponseSchema.safeParse({ data: [listItem], meta: { ...meta, activeCat: 'crypto', cards } }).success).toBe(false)
    expect(RewardListResponseSchema.safeParse({ data: [listItem], meta: { ...meta, activeCat: 'all' } }).success).toBe(false)
    expect(RewardListQuerySchema.parse({ cat: 'telco', page: '2' })).toEqual({ cat: 'telco', page: 2 })
    expect(RewardListQuerySchema.safeParse({ cat: 'anything' }).success).toBe(true)
  })

  it('validates the bulk body and result', () => {
    expect(RewardBulkRequestSchema.safeParse({ action: 'activate', ids: ['1', '2'] }).success).toBe(true)
    expect(RewardBulkRequestSchema.safeParse({ action: 'set_stock', ids: ['1'], stockValue: '' }).success).toBe(true)
    expect(RewardBulkRequestSchema.safeParse({ action: 'set_token_cost', ids: ['1'], tokenCostDeltaPct: '-10' }).success).toBe(true)
    expect(RewardBulkRequestSchema.safeParse({ action: 'explode', ids: ['1'] }).success).toBe(false)
    expect(RewardBulkRequestSchema.safeParse({ action: 'delete', ids: [] }).success).toBe(false)
    expect(RewardBulkRequestSchema.safeParse({ action: 'delete', ids: [1] }).success).toBe(false)
    expect(RewardBulkRequestSchema.safeParse({ action: 'delete' }).success).toBe(false)
    expect(RewardBulkResultSchema.safeParse({ affected: 1 }).success).toBe(true)
    expect(RewardBulkResultSchema.safeParse({ affected: 1, keptIds: ['7'] }).success).toBe(true)
  })

  it('parses the redemption queue, with the default and unknown status filters', () => {
    const row = {
      id: '11',
      user: { id: '12', name: 'Aina Contoh', email: 'aina@contoh.test' },
      rewardId: '5',
      rewardTitle: 'Baucar E-Dompet RM10',
      rewardVendor: 'Vendor Contoh',
      denominationRm: 10,
      tokenCost: 20,
      status: 'pending_admin',
      createdAt: AT,
    }
    expect(RewardRedemptionListResponseSchema.safeParse({ data: [row], meta: { ...meta, activeStatus: 'pending_admin' } }).success).toBe(true)
    expect(RewardRedemptionListResponseSchema.safeParse({ data: [], meta: { ...meta, activeStatus: null } }).success).toBe(true)
    expect(RewardRedemptionListResponseSchema.safeParse({ data: [{ ...row, status: 'shipped' }], meta: { ...meta, activeStatus: 'all' } }).success).toBe(false)
    expect(RewardRedemptionListQuerySchema.safeParse({}).success).toBe(true)
  })

  it('validates deliver and cancel', () => {
    expect(RewardDeliverRequestSchema.safeParse({ code: 'ABCD-1234' }).success).toBe(true)
    expect(RewardDeliverRequestSchema.safeParse({ code: 'x'.repeat(100) }).success).toBe(true)
    expect(RewardDeliverRequestSchema.safeParse({ code: 'x'.repeat(101) }).success).toBe(false)
    expect(RewardDeliverRequestSchema.safeParse({ code: '  ' }).success).toBe(false)
    expect(RewardDeliverRequestSchema.safeParse({}).success).toBe(false)
    expect(RewardDeliverResultSchema.safeParse({ id: '11', status: 'delivered', deliveredAt: AT, expiresAt: '2027-10-16T09:30:00+08:00' }).success).toBe(true)
    expect(RewardDeliverResultSchema.safeParse({ id: '11', status: 'pending_admin', deliveredAt: AT, expiresAt: AT }).success).toBe(false)
    expect(RewardCancelResultSchema.safeParse({ id: '11', status: 'cancelled', refundedTokens: 20 }).success).toBe(true)
  })
})

describe('student redeem, Kotak Misteri, Cabutan', () => {
  it('validates the redeem body and result', () => {
    expect(RewardRedeemRequestSchema.safeParse({ rewardId: '5' }).success).toBe(true)
    expect(RewardRedeemRequestSchema.safeParse({ rewardId: 5 }).success).toBe(false)
    expect(RewardRedeemRequestSchema.safeParse({}).success).toBe(false)
    expect(RewardRedeemResultSchema.safeParse({ id: '11', status: 'pending_parent_consent', tokenBalance: 4 }).success).toBe(true)
    expect(RewardRedeemResultSchema.safeParse({ id: '11', status: 'pending_admin', tokenBalance: -1 }).success).toBe(false)
  })

  it('parses the mystery box view and an opening', () => {
    const box = {
      id: '1',
      name: 'Kotak Gangsa',
      description: 'Kotak biasa',
      icon: '📦',
      rarity: null,
      costTokens: 2,
      coinMin: 1,
      coinMax: 20,
      xpMin: 1,
      xpMax: 10,
      color1: '#9ca3af',
      color2: '#6b7280',
    }
    const view = {
      tokenBalance: 5,
      boxes: [box, { ...box, id: '2', rarity: 'rare' }],
      history: [{ id: '1', boxId: '1', boxName: 'Kotak Gangsa', coins: 7, xp: 3, createdAt: AT }],
    }
    expect(RewardMysteryBoxesViewSchema.safeParse(view).success).toBe(true)
    expect(RewardMysteryBoxesViewSchema.safeParse({ ...view, boxes: [{ ...box, rarity: 'common' }] }).success).toBe(false)
    expect(RewardMysteryBoxesViewSchema.safeParse({ ...view, history: Array(11).fill(view.history[0]) }).success).toBe(false)
    const opened = { openingId: '2', boxId: '1', boxName: 'Kotak Gangsa', icon: '📦', coins: 7, xp: 3, tokenBalance: 3, syilingBalance: 127 }
    expect(RewardMysteryBoxOpenedSchema.safeParse(opened).success).toBe(true)
    expect(RewardMysteryBoxOpenedSchema.safeParse({ ...opened, syilingBalance: undefined }).success).toBe(false)
  })

  it('parses open draws and a bought ticket', () => {
    const draws = {
      syilingBalance: 120,
      draws: [
        {
          id: '4',
          title: 'Cabutan Hujung Tahun',
          description: '',
          ticketCostSyiling: 50,
          maxTicketsPerStudent: 10,
          ticketsOwned: 1,
          closesAt: '2026-12-31',
          prizePool: [{ label: 'Baucar Buku RM10', valueSen: 1000, qty: 3 }],
        },
        { id: '5', title: 'Tanpa tarikh', description: '', ticketCostSyiling: 10, maxTicketsPerStudent: 1, ticketsOwned: 0, closesAt: null, prizePool: [] },
      ],
    }
    expect(RewardCabutanViewSchema.safeParse(draws).success).toBe(true)
    expect(RewardCabutanViewSchema.safeParse({ ...draws, draws: [{ ...draws.draws[0], closesAt: '31-12-2026' }] }).success).toBe(false)
    expect(RewardTicketBoughtSchema.safeParse({ drawId: '4', ticketsOwned: 2, syilingBalance: 70 }).success).toBe(true)
    expect(RewardTicketBoughtSchema.safeParse({ drawId: 4, ticketsOwned: 2, syilingBalance: 70 }).success).toBe(false)
  })
})

describe('Kedai Hadiah Digital', () => {
  it('is always an empty list with the unpaged meta', () => {
    expect(ShopDigitalItemsResponseSchema.safeParse({ data: [], meta: { ...unpagedEmpty, activeCat: 'all' } }).success).toBe(true)
    expect(ShopDigitalItemsResponseSchema.safeParse({ data: [], meta: { ...unpagedEmpty, activeCat: 'telco' } }).success).toBe(true)
    expect(ShopDigitalItemsResponseSchema.safeParse({ data: [], meta: { ...unpagedEmpty, activeCat: null } }).success).toBe(true)
    expect(ShopDigitalItemsResponseSchema.safeParse({ data: [item], meta: { ...unpagedEmpty, activeCat: 'all' } }).success).toBe(false)
    expect(ShopDigitalItemsResponseSchema.safeParse({ data: [], meta: unpagedEmpty }).success).toBe(false)
    expect(ShopDigitalRedemptionsResponseSchema.safeParse({ data: [], meta: unpagedEmpty }).success).toBe(true)
    expect(ShopDigitalRedemptionsResponseSchema.safeParse({ data: [{}], meta: unpagedEmpty }).success).toBe(false)
    expect(ShopDigitalItemsQuerySchema.safeParse({ cat: 'bogus' }).success).toBe(true)
  })
})

describe('errors', () => {
  it('has a 409 status and the exact BM message for every module code', () => {
    expect(Object.keys(REWARD_ERRORS).sort()).toEqual([...REWARD_ERROR_CODES].sort())
    expect(REWARD_ERRORS.OUT_OF_STOCK.messages).toEqual(['Stok hadiah telah habis.'])
    expect(REWARD_ERRORS.MONTHLY_CAP.messages).toEqual(['Had tebusan bulanan dicapai.'])
    expect(REWARD_ERRORS.INSUFFICIENT_TOKENS.messages).toEqual(['Token tidak mencukupi.'])
    expect(REWARD_ERRORS.DRAW_CLOSED.messages).toEqual(['Cabutan ditutup.'])
    expect(REWARD_ERRORS.TICKET_LIMIT.messages).toEqual(['Had tiket dicapai.'])
    expect(REWARD_ERRORS.INSUFFICIENT_BALANCE.messages).toEqual(['Baki syiling tidak mencukupi.'])
    for (const code of REWARD_ERROR_CODES) {
      expect(REWARD_ERRORS[code].status).toBe(409)
      for (const message of REWARD_ERRORS[code].messages) {
        expect(ErrorBodySchema.safeParse({ error: { code, message } }).success).toBe(true)
      }
    }
  })

  it('carries VALIDATION_ERROR fields with the Laravel-style messages', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: REWARD_VALIDATION_MESSAGES.rewardIdRequired,
        fields: { rewardId: REWARD_VALIDATION_MESSAGES.rewardIdRequired },
      },
    }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(REWARD_MESSAGES.redemptionNotFound).toBe('Tebusan tidak dijumpai.')
    expect(REWARD_MESSAGES.notFound).toBe('Not Found.')
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> }
  const has = (path: string, method: string) => expect(doc.paths[path], path).toHaveProperty(method)

  it('contains the 7 student and 8 admin M15 operations', () => {
    has('/hadiah-digital/items', 'get')
    has('/hadiah-digital/redemptions', 'get')
    has('/hadiah/redemptions', 'post')
    has('/gamification/mystery-boxes', 'get')
    has('/gamification/mystery-boxes/{id}/open', 'post')
    has('/cabutan', 'get')
    has('/cabutan/{drawId}/tickets', 'post')
    has('/admin/hadiah', 'get')
    has('/admin/hadiah', 'post')
    has('/admin/hadiah/bulk', 'post')
    has('/admin/hadiah/redemptions', 'get')
    has('/admin/hadiah/redemptions/{id}/deliver', 'post')
    has('/admin/hadiah/redemptions/{id}/cancel', 'post')
    has('/admin/hadiah/{id}', 'get')
    has('/admin/hadiah/{id}', 'put')
  })

  it('registers exactly 42 BE-23 operations', () => {
    // Count by BE-23 tags, not by path prefix: BE-11 adds /gamification/wallet and /gamification/transactions (tag 'wallet').
    const be23Tags = ['gamification', 'gamification-admin', 'rewards', 'rewards-admin', 'shop']
    const count = Object.values(doc.paths)
      .flatMap((ops) => Object.values(ops as Record<string, { tags?: string[] }>))
      .filter((op) => op.tags?.some((t) => be23Tags.includes(t))).length
    expect(count).toBe(42)
  })
})
