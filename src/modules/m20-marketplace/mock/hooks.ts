/**
 * M20 test hooks (`window.__mock`, dev and e2e builds; SRS M20 v1.2 §6.13; hook names are global).
 * Test-only fixtures never enter the default seed; `mock.reset()` discards them.
 *
 * | Hook | Effect |
 * |---|---|
 * | `m20LoadFixture(name)` | `'m20-many'`: 15 extra active products of seller 1 (ids 11–25, for paging); `'m20-second-seller'`: seller 2 "Kedai Ujian Demo" owned by pelajar 2 (active, verified) with one product; `'m20-out-of-stock'`: product 4 becomes `out_of_stock` |
 * | `m20WhatsappLog()` | the wa.me URLs handed over by #16 since the last seed (D14: e2e asserts them instead of following the link) |
 *
 * A bad call throws a `RangeError` (the hook promise rejects). Test fixtures carry no images.
 */

import { toIso } from './repository/format'
import { nowMs } from './repository/clock'
import { mpProductsRepository, mpSellersRepository } from './repository/marketplace'
import type { MpProduct } from './repository/types'
import { whatsappLog } from './whatsapp-log'

/** Shared defaults of a fixture product; names are fictitious (not observed live). */
function fixtureProduct(
  id: number,
  sellerId: number,
  name: string,
  categoryId: number,
  price: string,
  at: string,
): MpProduct {
  return {
    id,
    sellerId,
    name,
    slug: `${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-ujian${String(id)}`,
    categoryId,
    price,
    originalPrice: null,
    description: null,
    condition: 'new',
    stockStatus: 'available',
    status: 'active',
    shippingMethod: 'pickup',
    shippingFee: null,
    location: '',
    views: 0,
    createdAt: at,
    updatedAt: at,
  }
}

function m20LoadFixture(name: string): { loaded: string } {
  const at = toIso(nowMs())
  if (name === 'm20-many') {
    const rows: MpProduct[] = []
    for (let id = 11; id <= 25; id += 1) {
      if (mpProductsRepository.get(id)) continue // idempotent: a second load adds nothing
      const n = id - 10
      rows.push(
        fixtureProduct(
          id,
          1,
          `Produk Ujian ${String(n)}`,
          ((n - 1) % 6) + 1,
          `${String(n + 4)}.00`,
          at,
        ),
      )
    }
    if (rows.length > 0) mpProductsRepository.insertMany(rows)
    return { loaded: name }
  }
  if (name === 'm20-second-seller') {
    if (mpSellersRepository.get(2)) return { loaded: name }
    mpSellersRepository.insertMany([
      {
        id: 2,
        userId: 2,
        shopName: 'Kedai Ujian Demo',
        description: null,
        phone: '0100000001',
        whatsapp: '60100000001',
        status: 'active',
        verifiedAt: at,
        whatsappClicks: 0,
        createdAt: at,
      },
    ])
    mpProductsRepository.insertMany([fixtureProduct(11, 2, 'Produk Kedai Ujian', 4, '12.00', at)])
    return { loaded: name }
  }
  if (name === 'm20-out-of-stock') {
    mpProductsRepository.patch(4, { stockStatus: 'out_of_stock' })
    return { loaded: name }
  }
  throw new RangeError(
    `m20LoadFixture: unknown fixture '${name}' (m20-many | m20-second-seller | m20-out-of-stock)`,
  )
}

function m20WhatsappLog(): string[] {
  return whatsappLog()
}

/** The plugin's `hooks` field. */
export const m20Hooks = { m20LoadFixture, m20WhatsappLog }
