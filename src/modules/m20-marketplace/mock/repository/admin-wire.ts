/**
 * Wire shapes of the admin routes (API-ADM-19, `@pp/contract` `MarketplaceAdmin*`): ids are decimal
 * strings, the owner of a seller is masked, the actions come from `marketplaceSellerActions`.
 * Reads only; every write happens inside a repository method.
 */

import {
  MARKETPLACE_OFFICIAL_SHOP_NAME,
  marketplaceSellerActions,
  type MarketplaceAdminProductDetail,
  type MarketplaceAdminProductRow,
  type MarketplaceAdminSellerDetail,
  type MarketplaceAdminSellerRow,
} from '@pp/contract'

import { users } from '@/modules/m01-authentication/mock'

import { initialOf } from './format'
import { categoriesTable, imagesTable, productsTable, sellersTable } from './tables'
import type { MpProduct, MpSeller } from './types'

/** Same rule as the API: each word of the account name is cut to its first letter plus "***". */
export function maskOwnerName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${Array.from(w)[0] ?? ''}***`)
    .join(' ')
}

const imagesOf = (productId: number) => imagesTable.query({ where: { productId }, sort: 'position' }).rows

export function adminProductRow(p: MpProduct): MarketplaceAdminProductRow {
  const seller = p.sellerId === null ? undefined : sellersTable.get(p.sellerId)
  const first = imagesOf(p.id)[0]
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    thumbnailUrl: first ? first.url : null,
    sellerId: p.sellerId === null ? null : String(p.sellerId),
    sellerName: seller ? seller.shopName : MARKETPLACE_OFFICIAL_SHOP_NAME,
    categoryId: String(p.categoryId),
    categoryName: categoriesTable.get(p.categoryId)?.name ?? '',
    condition: p.condition,
    stockStatus: p.stockStatus,
    status: p.status,
    views: p.views,
    createdAt: p.createdAt,
  }
}

export function adminProductDetail(p: MpProduct): MarketplaceAdminProductDetail {
  return {
    ...adminProductRow(p),
    description: p.description,
    shippingMethod: p.shippingMethod,
    shippingFee: p.shippingFee,
    location: p.location,
    images: imagesOf(p.id).map((i) => ({ id: String(i.id), position: i.position, url: i.url })),
    updatedAt: p.updatedAt,
  }
}

export function adminSellerRow(s: MpSeller): MarketplaceAdminSellerRow {
  const verified = s.verifiedAt !== null
  return {
    id: String(s.id),
    shopName: s.shopName,
    initial: initialOf(s.shopName),
    ownerMasked: maskOwnerName(users.get(s.userId)?.name ?? ''),
    status: s.status,
    verified,
    productCount: productsTable.count({ sellerId: s.id }),
    actions: marketplaceSellerActions(s.status, verified),
    createdAt: s.createdAt,
  }
}

export function adminSellerDetail(s: MpSeller): MarketplaceAdminSellerDetail {
  return {
    ...adminSellerRow(s),
    description: s.description,
    phone: s.phone,
    whatsapp: s.whatsapp,
    verifiedAt: s.verifiedAt,
    whatsappClicks: s.whatsappClicks,
  }
}
