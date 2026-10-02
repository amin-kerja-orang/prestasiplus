/**
 * M20 mock plugin (SRS M20 v1.2 §6, §7; task M20-T1, student slice; overview §6.7, D11/D12). Owner of
 * the categories, products, images, sellers, seller documents and reviews (small materialised tables,
 * §6.10). Users are read through M01 only (the seller owner is checked at the seed).
 *
 * PUBLIC exports (`@/modules/m20-marketplace/mock`): the repositories `mpCategories`, `mpProducts`,
 * `mpImages`, `mpSellers`, `mpReviews`; `mpSellers.forUser(userId)` is the contract of the user-shell
 * link "Kedai Saya" (FR-M20-79, XR-M20-02).
 *
 * Routes: #13–#17 buyer (`handlers/buyer.ts`). Admin #1–#12 (M20-T4) and seller #18–#24 (M20-T6) are
 * deferred. Hooks: `hooks.ts` (§6.13). Seeded product photos are referenced by path only; the files
 * are not in the repo yet (see `data/seed-data.ts`).
 *
 * Bump `version` whenever the seed or a cheap field changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { buyerRoutes } from './handlers/buyer'
import { m20Hooks } from './hooks'
import {
  mpCategoriesRepository,
  mpImagesRepository,
  mpProductsRepository,
  mpReviewsRepository,
  mpSellersRepository,
} from './repository/marketplace'
import { M20_TABLES } from './repository/tables'
import { checkSeed, seedMarketplace } from './seeds/seed'

const plugin = defineMockModule({
  id: 'M20',
  dependsOn: ['core', 'M01'],
  version: 1,
  tables: M20_TABLES,
  repositories: {
    mpCategories: mpCategoriesRepository,
    mpProducts: mpProductsRepository,
    mpImages: mpImagesRepository,
    mpSellers: mpSellersRepository,
    mpReviews: mpReviewsRepository,
  },
  seed: seedMarketplace,
  finalise: checkSeed,
  routes: [...buyerRoutes],
  hooks: m20Hooks,
})

export default plugin

export const { mpCategories, mpProducts, mpImages, mpSellers, mpReviews } = plugin.repositories

export type { MpImage, MpProduct, MpReview, MpSeller, MpSellerDocument } from './repository/types'
