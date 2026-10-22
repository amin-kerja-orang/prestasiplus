import { Prisma } from '../../db/generated/client'

/**
 * BR-M20-08, the ONE visibility rule of the buyer slice: a product is shown when it is active and its
 * seller (if any) is active. Stock does not matter. Search, related products, the seller shop, the hand-off
 * and the view counter all use it; the Prisma form and the SQL form below are the same rule and a unit
 * test pins both.
 */
export const VISIBLE_PRODUCT: Prisma.MarketplaceProductWhereInput = {
  status: 'active',
  OR: [{ sellerId: null }, { seller: { status: 'active' } }],
}

/** Same rule for raw SQL: needs `marketplace_products p LEFT JOIN marketplace_sellers s ON s.id = p.seller_id`. */
export const VISIBLE_SQL = Prisma.sql`p.status = 'active' AND (p.seller_id IS NULL OR s.status = 'active')`
