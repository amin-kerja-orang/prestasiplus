/**
 * M20 seed (SRS M20 v1.2 §6.11): 6 categories, the one seller "JomBelajar Official" owned by account 1,
 * the 10 observed products and their 45 images; no documents, no reviews. `finalise` checks the
 * named-query seed values of §6.8 and stops the boot on a mismatch.
 */

import type { SeedContext } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import type { MpImage } from '../repository/types'
import { bindM20Clock } from '../repository/clock'
import {
  mpCategoriesRepository,
  mpImagesRepository,
  mpProductsRepository,
  mpReviewsRepository,
  mpSellersRepository,
} from '../repository/marketplace'
import { resetWhatsappLog } from '../whatsapp-log'
import { CATEGORY_SEED, IMAGE_COUNTS, imageUrl, PRODUCT_SEED, SELLER_SEED } from '../data/seed-data'

/** Image ids run contiguously product by product: #1 1–4, #2 5–9, … #10 41–45 (R15). */
export function imageSeed(): MpImage[] {
  const rows: MpImage[] = []
  let id = 1
  IMAGE_COUNTS.forEach((n, i) => {
    const productId = i + 1
    for (let position = 1; position <= n; position += 1) {
      rows.push({ id, productId, position, url: imageUrl(productId, position) })
      id += 1
    }
  })
  return rows
}

export function seedMarketplace(ctx: SeedContext): void {
  bindM20Clock(ctx.clock)
  // The recorded hand-over log is module state: a boot / reset never inherits it.
  resetWhatsappLog()
  mpCategoriesRepository.seedRows(CATEGORY_SEED)
  mpSellersRepository.insertMany(SELLER_SEED)
  mpProductsRepository.insertMany(PRODUCT_SEED)
  mpImagesRepository.insertMany(imageSeed())
}

/** §6.8 / §6.9 values at the default seed; every one must hold or the boot stops. */
export function checkSeed(): void {
  const issues: string[] = []
  if (mpCategoriesRepository.all().length !== 6) issues.push('categories != 6')
  if (mpProductsRepository.total() !== 10) issues.push('products != 10')
  if (mpImagesRepository.total() !== 45) issues.push('images != 45')
  if (mpSellersRepository.total() !== 1) issues.push('sellers != 1')
  if (mpProductsRepository.sellerProductCount(1) !== 10) issues.push('Q-M20-SELLER-PRODUCTS != 10')
  if (mpProductsRepository.sellerActiveCount(1) !== 10) issues.push('Q-M20-SELLER-ACTIVE != 10')
  if (mpProductsRepository.sellerVisibleCount(1) !== 10) issues.push('Q-M20-SELLER-VISIBLE != 10')
  if (mpProductsRepository.viewsSum(1) !== 111) issues.push('Q-M20-VIEWS-SUM != 111')
  if (mpSellersRepository.get(1)?.whatsappClicks !== 16) issues.push('Q-M20-WA-CLICKS != 16')
  if (mpReviewsRepository.countForSeller(1) !== 0) issues.push('Q-M20-SELLER-REVIEWS != 0')
  for (const [productId, n] of [
    [1, 4],
    [2, 5],
    [3, 5],
    [4, 3],
    [5, 4],
    [6, 4],
    [7, 5],
    [8, 5],
    [9, 5],
    [10, 5],
  ] as const) {
    if (mpImagesRepository.forProduct(productId).length !== n) {
      issues.push(`Q-M20-IMAGES(${String(productId)}) != ${String(n)}`)
    }
  }
  const related = (id: number) => mpProductsRepository.related(id).map((p) => p.id)
  if (related(1).join() !== '6') issues.push('Q-M20-RELATED(1) != [6]')
  if (related(5).join() !== '2,7') issues.push('Q-M20-RELATED(5) != [2,7]')
  if (related(7).join() !== '2,5') issues.push('Q-M20-RELATED(7) != [2,5]')
  for (const s of SELLER_SEED) {
    if (!users.get(s.userId))
      issues.push(`seller ${String(s.id)}: user ${String(s.userId)} missing`)
  }
  if (issues.length > 0) {
    throw new Error(`M20 seed check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`)
  }
}
