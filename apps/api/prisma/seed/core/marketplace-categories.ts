/**
 * Marketplace categories (BE-46): the 6 constant categories of the M20 mock seed (SRS M20 6.11). This is
 * REFERENCE data, not demo data: the marketplace filter chips and every product need these rows from
 * day one, and the names are observed public values. Idempotent (upsert by `slug`), deterministic,
 * and `legacy_*` is never set. The demo shop and products (`../marketplace.ts`) stay demo data.
 */
import type { SeedModule } from '../index'

export const MARKETPLACE_CATEGORIES = [
  { slug: 'peralatan-sekolah', name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' },
  { slug: 'buku-rujukan', name: 'Buku & Rujukan', icon: 'fa-book' },
  { slug: 'uniform-pakaian', name: 'Uniform & Pakaian', icon: 'fa-tshirt' },
  { slug: 'stationery', name: 'Stationery', icon: 'fa-pen' },
  { slug: 'digital', name: 'Digital & E-Book', icon: 'fa-tablet-alt' },
  { slug: 'lain-lain', name: 'Lain-lain', icon: 'fa-th-large' },
] as const

export const marketplaceCategoriesSeed: SeedModule = {
  name: 'core-marketplace-categories',
  kind: 'reference',
  async run(ctx) {
    for (const c of MARKETPLACE_CATEGORIES) {
      await ctx.prisma.marketplaceCategory.upsert({
        where: { slug: c.slug },
        create: { ...c },
        update: { name: c.name, icon: c.icon },
      })
    }
  },
}
