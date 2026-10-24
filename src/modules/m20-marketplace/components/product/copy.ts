/** Exact BM copy of the buyer screens S6 / S7 / S8 (SRS M20 v1.2 §8.1) and the shared formats. */

export const MARKETPLACE_COPY = {
  headerTitle: 'Marketplace',
  headerSubtitle: 'Peralatan sekolah untuk pelajar 🛒',
  tabTitle: 'Marketplace - PRESTASIPLUS',
  searchPlaceholder: 'Cari peralatan sekolah...',
  allCategories: 'Semua Kategori',
  allConditions: 'Semua Keadaan',
  conditionNew: 'Baru',
  conditionUsed: 'Terpakai',
  sortLatest: 'Terbaru',
  sortPriceLow: 'Harga ↑',
  sortPriceHigh: 'Harga ↓',
  sortPopular: 'Popular',
  submit: 'Cari',
  chipAll: 'Semua',
  emptyIcon: '🛒',
  emptyTitle: 'Tiada Produk Dijumpai',
  emptyHint: 'Cuba tukar kata kunci atau kategori',
  back: 'Kembali ke Marketplace',
  used: 'Terpakai',
  loadFailed: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
} as const

export const SHOP_COPY = {
  headerTitle: 'Kedai Penjual',
  tabSuffix: 'Marketplace PRESTASIPLUS',
  joined: 'Bergabung',
  products: 'produk',
} as const

export const CONDITION_OPTIONS = [
  { value: 'new', label: MARKETPLACE_COPY.conditionNew },
  { value: 'used', label: MARKETPLACE_COPY.conditionUsed },
] as const

export const SORT_OPTIONS = [
  { value: 'latest', label: MARKETPLACE_COPY.sortLatest },
  { value: 'price_low', label: MARKETPLACE_COPY.sortPriceLow },
  { value: 'price_high', label: MARKETPLACE_COPY.sortPriceHigh },
  { value: 'popular', label: MARKETPLACE_COPY.sortPopular },
] as const

/** BR-M20-19: "RM 89.90" (price) from a decimal string. */
export function formatPrice(value: string): string {
  return `RM ${Number(value).toFixed(2)}`
}

/** Query values as the page keeps them (`q`, `category`, `condition`, `sort`). */
export interface BuyerQuery {
  q: string
  category: string
  condition: string
  sort: string
}

function first(value: unknown): string {
  const v = Array.isArray(value) ? (value[0] as unknown) : value
  return typeof v === 'string' ? v : ''
}

/** Reads the four filter values from a route query (repeated or non-string values count as empty). */
export function readBuyerQuery(query: Record<string, unknown>): BuyerQuery {
  return {
    q: first(query.q),
    category: first(query.category),
    condition: first(query.condition),
    sort: first(query.sort),
  }
}

/** The page number of a route query: an integer >= 1, else 1 (V-M20-03). */
export function readPage(query: Record<string, unknown>): number {
  const n = Number(first(query.page))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** The four shipping methods as the card icon sees them (BR-M20-17 lines; #14 carries only the line). */
export type ShippingKind = 'postage' | 'free' | 'cod' | 'pickup'

/**
 * Maps a BR-M20-17 shipping line ("Pos / Kurier (RM8.00)", "Penghantaran Percuma 🎉",
 * "Bayar Semasa Penghantaran (COD)", "Ambil Sendiri (Pickup)") to its method, so the S6 card shows the live
 * icon: fa-truck, fa-gift, fa-hand-holding-usd, fa-map-marker-alt.
 */
export function shippingKindOf(line: string): ShippingKind {
  if (line.startsWith('Pos')) return 'postage'
  if (line.startsWith('Penghantaran Percuma')) return 'free'
  if (line.startsWith('Bayar Semasa Penghantaran')) return 'cod'
  return 'pickup'
}
