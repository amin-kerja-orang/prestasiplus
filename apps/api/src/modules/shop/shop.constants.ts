import type { RewardCategory, RewardMysteryBox } from '@pp/contract'

import type { RateLimitSpec } from '../../common/throttle'

/**
 * Limits of the M15 shop (BE-23). Student writes (redeem, ticket, box) are limited per user; the admin writes
 * share the admin write ceiling of the other admin modules (own bucket).
 */
export const SHOP_LIMITS = {
  read: { bucket: 'shop.read', env: 'THROTTLE_WALLET_READ_PER_MINUTE', default: 240, per: 'user' },
  adminRead: { bucket: 'shop.admin.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'shop.write', env: 'THROTTLE_SHOP_WRITE_PER_MINUTE', default: 30, per: 'user' },
  adminWrite: { bucket: 'shop.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Page size of both admin lists (fixed, BR-M15-02 / BR-M15-15). */
export const ADMIN_PAGE_SIZE = 50

/** Admin catalogue table labels (mock `HADIAH_CATEGORY_LABELS[...].table`). */
export const CATEGORY_TABLE_LABELS: Readonly<Record<RewardCategory, string>> = {
  flagship: '🏆 Mahkota',
  ewallet: '💳 E-Wallet',
  telco: '📱 Telco Topup',
  gaming: '🎮 Gaming',
  streaming: '🎬 Streaming',
  food_beverage: '🍔 Makanan & Minuman',
  ecommerce: '🛒 E-Commerce',
  education: '📚 Pembelajaran',
  entertainment: '🎭 Hiburan',
}

/**
 * Mod Pelajar (an admin acting as a student, `isTestActor`): the three spending POSTs are refused with 403 so a test
 * session never consumes real stock, coins or tokens and never creates a real redemption, ticket or opening.
 * No contract code exists for this, so it is the generic `FORBIDDEN` with this BM text (reported as a deviation).
 */
export const MOD_PELAJAR_REFUSAL = 'Tidak dibenarkan dalam Mod Pelajar.'

/** DATA-M15-03: the four mystery boxes (constants; `id` is the wire id as text). */
export const MYSTERY_BOXES: readonly RewardMysteryBox[] = [
  { id: '1', name: 'Kotak Gangsa', description: 'Kotak biasa — ganjaran kecil tapi pasti!', icon: '📦', rarity: null, costTokens: 2, coinMin: 1, coinMax: 20, xpMin: 1, xpMax: 10, color1: '#9ca3af', color2: '#6b7280' },
  { id: '2', name: 'Kotak Perak', description: 'Kotak lebih besar — peluang ganjaran lebih baik', icon: '🎁', rarity: 'rare', costTokens: 5, coinMin: 10, coinMax: 50, xpMin: 5, xpMax: 25, color1: '#3b82f6', color2: '#2563eb' },
  { id: '3', name: 'Kotak Emas', description: 'Kotak premium — ganjaran besar menanti!', icon: '✨', rarity: 'epic', costTokens: 10, coinMin: 25, coinMax: 150, xpMin: 10, xpMax: 50, color1: '#8b5cf6', color2: '#7c3aed' },
  { id: '4', name: 'Kotak Legenda', description: 'Kotak terhebat — ganjaran WOW!', icon: '👑', rarity: 'legendary', costTokens: 25, coinMin: 100, coinMax: 500, xpMin: 25, xpMax: 100, color1: '#f59e0b', color2: '#ef4444' },
]

/** Ledger and token-movement sources of the shop (the idempotency key is `(user, source, sourceId)`). */
export const SOURCES = {
  redeem: 'hadiah_redeem',
  refund: 'hadiah_refund',
  box: 'mystery_box',
  ticket: 'cabutan_ticket',
} as const
