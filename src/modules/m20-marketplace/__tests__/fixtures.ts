/** Shared fixtures of the M20 buyer UI tests (values follow the SRS M20 §6.11 seed). */
import type { MarketplaceCategory, ProductCard, ProductDetail, SellerCard, ShopView } from '../api'

export const CATEGORIES: MarketplaceCategory[] = [
  { id: 1, slug: 'peralatan-sekolah', name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' },
  { id: 2, slug: 'buku-rujukan', name: 'Buku & Rujukan', icon: 'fa-book' },
  { id: 3, slug: 'uniform-pakaian', name: 'Uniform & Pakaian', icon: 'fa-tshirt' },
  { id: 4, slug: 'stationery', name: 'Stationery', icon: 'fa-pen' },
  { id: 5, slug: 'digital', name: 'Digital & E-Book', icon: 'fa-tablet-alt' },
  { id: 6, slug: 'lain-lain', name: 'Lain-lain', icon: 'fa-th-large' },
]

export const SELLER_CARD: SellerCard = {
  id: 1,
  shopName: 'JomBelajar Official',
  initial: 'J',
  verified: true,
  ratingStars: '☆☆☆☆☆',
  activeProductCount: 10,
}

export const CARD_1: ProductCard = {
  id: 1,
  slug: 'beg-sekolah-anti-air-premium-vH1Fj',
  name: 'Beg Sekolah Anti-Air Premium',
  price: '89.90',
  originalPrice: '129.90',
  discountPct: 31,
  condition: 'new',
  thumbnailUrl: '/images/marketplace/products/1/img_1.jpg',
  seller: { shopName: 'JomBelajar Official', verified: true },
  shippingLine: 'Pos / Kurier (RM8.00)',
}

export const CARD_3: ProductCard = {
  id: 3,
  slug: 'uniform-sekolah-baju-putih-lengan-panjang-saiz-m-hE8Jf',
  name: 'Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)',
  price: '15.00',
  originalPrice: '35.00',
  discountPct: 57,
  condition: 'used',
  thumbnailUrl: '/images/marketplace/products/3/img_1.jpg',
  seller: { shopName: 'JomBelajar Official', verified: true },
  shippingLine: 'Cash on Delivery (COD)',
}

export const CARD_5: ProductCard = {
  id: 5,
  slug: 'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84',
  name: 'E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)',
  price: '19.90',
  originalPrice: null,
  discountPct: null,
  condition: 'new',
  thumbnailUrl: null,
  seller: null,
  shippingLine: 'Penghantaran Percuma 🎉',
}

export const DETAIL_1: ProductDetail = {
  id: 1,
  slug: CARD_1.slug,
  name: CARD_1.name,
  categoryId: 1,
  category: CATEGORIES[0]!,
  price: '89.90',
  originalPrice: '129.90',
  discountPct: 31,
  description: 'Beg sekolah kalis air dengan 4 kompartmen.',
  condition: 'new',
  stockStatus: 'available',
  shippingMethod: 'postage',
  shippingFee: '8.00',
  shippingLine: 'Pos / Kurier (RM8.00)',
  location: 'Kuala Lumpur',
  views: 31,
  createdAt: '2026-02-09T12:00:00+08:00',
  images: [1, 2, 3, 4].map((n) => ({
    id: n,
    position: n,
    url: `/images/marketplace/products/1/img_${String(n)}.jpg`,
  })),
  seller: SELLER_CARD,
  reviews: [],
  reviewCount: 0,
  related: [
    { ...CARD_5, id: 6, slug: 'kotak-pensel', name: 'Kotak Pensel 3 Tingkat Disney Frozen' },
  ],
}

export const SHOP_1: ShopView = {
  shop: {
    id: 1,
    shopName: 'JomBelajar Official',
    initial: 'J',
    description: 'Kedai rasmi JomBelajar',
    verified: true,
    ratingStars: '☆☆☆☆☆',
    reviewCount: 0,
    productCount: 10,
    createdAt: '2026-02-09T12:00:00+08:00',
  },
  products: [CARD_1, CARD_5],
}

export function listOf(rows: ProductCard[], totalPages = 1) {
  return {
    data: rows,
    meta: { page: 1, pageSize: 20, totalItems: rows.length, totalPages },
  }
}
