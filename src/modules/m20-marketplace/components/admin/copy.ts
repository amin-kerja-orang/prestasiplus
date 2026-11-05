/**
 * Exact BM copy and small helpers of the M20 admin screens (PRD 30 P2-12 `Marketplace: Produk`, P2-13
 * `Marketplace: Penjual`; S7-T08). Texts the API contract already owns are re-exported from `@pp/contract`
 * (`MARKETPLACE_ADMIN_MESSAGES`, `MARKETPLACE_ADMIN_PROPOSED`, the status and action labels); the rest are
 * written in the PRD. Anything the PRD does not give is marked INFERRED.
 */

import {
  MARKETPLACE_ADMIN_LIMITS,
  MARKETPLACE_ADMIN_MESSAGES,
  MARKETPLACE_ADMIN_PROPOSED,
  MARKETPLACE_SELLER_ACTION_LABELS,
  type MarketplaceAdminProductCreate,
  type MarketplaceAdminSellerOption,
  type MarketplaceCondition,
  type MarketplaceProductStatus,
  type MarketplaceStockStatus,
  type MarketplaceSellerAction,
} from '@pp/contract'

import { isApiError } from '@/api'

export const ADMIN_PRODUCTS_PATH = '/admin/marketplace/products'
export const ADMIN_SELLERS_PATH = '/admin/marketplace/sellers'

export const ADMIN_ROUTES = {
  products: 'm20.admin-products',
  productCreate: 'm20.admin-product-create',
  productEdit: 'm20.admin-product-edit',
  sellers: 'm20.admin-sellers',
  seller: 'm20.admin-seller',
} as const

export const ADMIN_COPY = {
  productsTitle: 'Marketplace — Produk',
  sellersTitle: 'Marketplace — Penjual',
  statTotalProducts: 'Jumlah Produk',
  statActive: 'Aktif',
  statTotalSellers: 'Jumlah Penjual',
  statPendingSellers: 'Menunggu Pengesahan',
  searchPlaceholder: 'Cari produk...',
  allCategories: 'Semua Kategori',
  allStatuses: 'Semua Status',
  apply: 'Tapis',
  reset: 'Reset',
  add: 'Tambah Produk',
  productsFound: (n: number) => `${String(n)} produk dijumpai`,
  sellersFound: (n: number) => `${String(n)} penjual dijumpai`,
  productsEmptyTitle: '📦 Tiada Produk',
  productsEmptyHint: 'Tambah produk pertama sekarang!',
  /** INFERRED: a filter that matches nothing keeps the empty card but drops the "add the first" hint. */
  productsNoMatch: 'Tiada produk dijumpai',
  sellersEmpty: 'Tiada penjual dijumpai',
  productCount: (n: number) => `${String(n)} produk`,
  loadFailed: 'Maaf, berlaku ralat. Sila cuba semula.',
  /** INFERRED: the PRD gives no row label; the edit action is an icon button named "Edit". */
  edit: 'Edit',
  delete: 'Padam',
  deleteConfirmYes: 'Ya, Padam',
  cancel: 'Batal',
  viewDetail: 'Lihat Detail',
  /** PRD P2-13: the owner line of a card. */
  owner: 'Pemilik',
  // Form (P12-01..11)
  createTitle: 'Tambah Produk Marketplace',
  /** INFERRED: the PRD names only the create form; the edit form keeps the same pattern. */
  editTitle: 'Edit Produk Marketplace',
  seller: 'Penjual',
  name: 'Nama Produk',
  category: 'Kategori',
  categoryPlaceholder: 'Pilih kategori',
  price: 'Harga (RM)',
  originalPrice: 'Harga Asal (RM)',
  originalPriceHint: 'Untuk tunjukkan diskaun',
  description: 'Penerangan',
  condition: 'Keadaan',
  stockStatus: 'Status Stok',
  shippingMethod: 'Kaedah Penghantaran',
  shippingFee: 'Kos Penghantaran (RM)',
  location: 'Lokasi',
  images: 'Gambar',
  imagesHint: 'JPG, PNG, WEBP. Maks 2MB setiap gambar.',
  imagePick: 'Pilih gambar',
  imageUploading: 'Memuat naik…',
  /** INFERRED: removes an image picked in this form that is not saved yet. */
  imageDiscard: 'Buang',
  existingImages: (n: number) => `Gambar Sedia Ada (${String(n)})`,
  /** INFERRED: the first image is the main one (AC-ADM-P2-12.1). */
  mainImage: 'Utama',
  productStatus: 'Status Produk',
  save: 'Simpan Perubahan',
  submitCreate: 'Tambah Produk',
  productNotFound: 'Produk tidak dijumpai.',
  // Seller detail
  sellerDetailTitle: 'Semak Penjual',
  businessInfo: 'Maklumat Perniagaan',
  shopName: 'Nama Kedai',
  ownerLabel: 'Pemilik',
  status: 'Status',
  verified: 'Disahkan',
  verifiedYes: 'Ya',
  verifiedNo: 'Belum',
  phone: 'Telefon',
  whatsapp: 'WhatsApp',
  shopDescription: 'Penerangan Kedai',
  productsLabel: 'Produk',
  clicks: 'Klik WhatsApp',
  joined: 'Didaftar',
  sellerNotFound: 'Penjual tidak dijumpai.',
} as const

/** OPT-MARKET labels of the form controls (PRD 30 P2-12 reference line). */
export const CONDITION_CHOICES = [
  { value: 'new', label: '🆕 Baru' },
  { value: 'used', label: '♻️ Terpakai' },
] as const

export const STOCK_CHOICES = [
  { value: 'available', label: '✅ Ada' },
  { value: 'out_of_stock', label: '❌ Habis' },
] as const

export const SHIPPING_CHOICES = [
  { value: 'pickup', label: 'Ambil Sendiri' },
  { value: 'postage', label: 'Pos / Kurier' },
  { value: 'cod', label: 'COD' },
  { value: 'free', label: 'Percuma' },
] as const

export const PRODUCT_STATUS_CHOICES: readonly { value: MarketplaceProductStatus; label: string }[] = [
  { value: 'active', label: '🟢 Aktif' },
  { value: 'draft', label: '⏸️ Draf' },
  { value: 'rejected', label: '🔴 Ditolak' },
]

/** Card stock line (decision 2 on #506): the OPT-MARKET label, never a number. */
export const stockLabel = (stock: string): string =>
  STOCK_CHOICES.find((c) => c.value === stock)?.label ?? stock

export const conditionLabel = (condition: string): string =>
  condition === 'used' ? 'Terpakai' : 'Baru'

/** The sentinel value of the official option in the seller select (the API sends `id: null`). */
export const OFFICIAL_VALUE = 'official'
export const sellerOptionValue = (o: MarketplaceAdminSellerOption): string => o.id ?? OFFICIAL_VALUE

/** Confirm texts: "Padam produk ini?" and "{Tindakan} penjual ini?" with `Ya, {Tindakan}` / `Batal`. */
export const productDeleteConfirm = MARKETPLACE_ADMIN_PROPOSED.productDeleteConfirm
export const sellerConfirm = (a: MarketplaceSellerAction): string => MARKETPLACE_ADMIN_PROPOSED.sellerConfirm(a)
export const sellerConfirmYes = (a: MarketplaceSellerAction): string => `Ya, ${MARKETPLACE_SELLER_ACTION_LABELS[a]}`

export const SELLER_FLASH: Record<MarketplaceSellerAction, string> = {
  approve: MARKETPLACE_ADMIN_PROPOSED.flash.sellerApproved,
  verify: MARKETPLACE_ADMIN_PROPOSED.flash.sellerVerified,
  suspend: MARKETPLACE_ADMIN_PROPOSED.flash.sellerSuspended,
  ban: MARKETPLACE_ADMIN_PROPOSED.flash.sellerBanned,
}

// --- query helpers ---------------------------------------------------------------------------------

export function queryText(value: unknown): string {
  const v = Array.isArray(value) ? (value[0] as unknown) : value
  return typeof v === 'string' ? v : ''
}

export function queryPage(value: unknown): number {
  const n = Number(queryText(value))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

// --- errors ----------------------------------------------------------------------------------------

/** The text to show for a failed call: the API message (BM) for a 4xx, else the generic line. */
export function errorText(err: unknown): string {
  if (
    isApiError(err) &&
    err.status !== 0 &&
    err.status < 500 &&
    err.code !== 'NETWORK_ERROR' &&
    err.message !== '' &&
    !/^HTTP \d+$/.test(err.message)
  ) {
    return err.message
  }
  return ADMIN_COPY.loadFailed
}

export function fieldErrorsOf(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}

// --- form validation (P12-02..09; the same texts the API answers with) ----------------------------

export interface ProductFormValues {
  sellerId: string
  name: string
  categoryId: string
  price: string
  originalPrice: string
  description: string
  /** Always chosen (the radios start on `new` / `available`). */
  condition: MarketplaceCondition
  stockStatus: MarketplaceStockStatus
  /** `''` until a method is picked. */
  shippingMethod: string
  shippingFee: string
  location: string
  status: MarketplaceProductStatus
}

const MONEY = /^\d{1,7}(\.\d{1,2})?$/
const M = MARKETPLACE_ADMIN_MESSAGES
const L = MARKETPLACE_ADMIN_LIMITS

/** Field messages of the form, empty when it is valid. `imageCount` is existing plus new images. */
export function validateProductForm(v: ProductFormValues, imageCount: number): Record<string, string> {
  const f: Record<string, string> = {}
  if (v.sellerId.trim() === '') f.sellerId = M.sellerRequired
  const name = v.name.trim()
  if (name === '') f.name = M.nameRequired
  else if (name.length > L.nameMax) f.name = M.nameTooLong
  if (v.categoryId.trim() === '') f.categoryId = M.categoryRequired
  const price = v.price.trim()
  if (price === '') f.price = M.priceRequired
  else if (!MONEY.test(price)) f.price = M.priceFormat
  else if (Number(price) < L.priceMin || Number(price) > L.priceMax) f.price = M.priceRange
  const original = v.originalPrice.trim()
  if (original !== '') {
    if (!MONEY.test(original)) f.originalPrice = M.originalPriceFormat
    else if (Number(original) < L.priceMin || Number(original) > L.priceMax) f.originalPrice = M.originalPriceRange
    else if (f.price === undefined && !(Number(original) > Number(price))) f.originalPrice = M.originalPriceNotGreater
  }
  if (v.description.length > L.descriptionMax) f.description = M.descriptionTooLong
  if (v.shippingMethod === '') f.shippingMethod = M.shippingMethodRequired
  const fee = v.shippingFee.trim()
  if (fee !== '') {
    if (!MONEY.test(fee)) f.shippingFee = M.shippingFeeFormat
    else if (Number(fee) < L.feeMin || Number(fee) > L.feeMax) f.shippingFee = M.shippingFeeRange
  }
  if (v.location.length > L.locationMax) f.location = M.locationTooLong
  if (imageCount > L.maxImages) f.images = M.maxImages
  return f
}

/** The create body from the form (`images` = uploaded `FileRef.url` values). */
export function createBody(v: ProductFormValues, images: string[]): MarketplaceAdminProductCreate {
  const body: MarketplaceAdminProductCreate = {
    sellerId: v.sellerId === OFFICIAL_VALUE ? null : v.sellerId,
    name: v.name.trim(),
    categoryId: v.categoryId,
    price: v.price.trim(),
    originalPrice: v.originalPrice.trim() === '' ? null : v.originalPrice.trim(),
    description: v.description.trim() === '' ? null : v.description,
    condition: v.condition,
    stockStatus: v.stockStatus,
    shippingMethod: v.shippingMethod as MarketplaceAdminProductCreate['shippingMethod'],
    shippingFee: v.shippingFee.trim() === '' ? null : v.shippingFee.trim(),
    location: v.location.trim(),
    status: v.status,
  }
  if (images.length > 0) body.images = images
  return body
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024
