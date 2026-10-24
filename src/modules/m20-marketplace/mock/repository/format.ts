/** Pure formatting rules of M20 (SRS M20 v1.2 BR-M20-16, BR-M20-17, BR-M20-19, BR-M20-21, FR-M20-11). */

import { toIsoMyt } from '@/lib/time'

import type { ShippingMethod } from '../../api/types'

/** ISO 8601 +08:00 at whole seconds. */
export function toIso(ms: number): string {
  return toIsoMyt(ms - (((ms % 1000) + 1000) % 1000))
}

/** FR-M20-11: `round((original - price) / original * 100)`; `null` without an original price. */
export function discountPct(price: string, originalPrice: string | null): number | null {
  if (originalPrice === null) return null
  const original = Number(originalPrice)
  if (!(original > 0)) return null
  return Math.round(((original - Number(price)) / original) * 100)
}

/** BR-M20-17 (observed copy). A postage product without a fee shows no amount (INFERRED). */
export function shippingLine(method: ShippingMethod, fee: string | null): string {
  switch (method) {
    case 'postage':
      return fee === null ? 'Pos / Kurier' : `Pos / Kurier (RM${Number(fee).toFixed(2)})`
    case 'free':
      return 'Penghantaran Percuma 🎉'
    case 'cod':
      return 'Bayar Semasa Penghantaran (COD)'
    case 'pickup':
      return 'Ambil Sendiri (Pickup)'
  }
}

/** BR-M20-16: five characters, round(avg) "★" then "☆"; `null` (no reviews) = "☆☆☆☆☆" (INFERRED fill). */
export function ratingStars(avg: number | null): string {
  const filled = avg === null ? 0 : Math.max(0, Math.min(5, Math.round(avg)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

/** First letter of a shop name, upper case (the S7 / S8 avatar). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0]
  return first ? first.toUpperCase() : '?'
}

/** BR-M20-21: the platform product's number (fictitious, DV-M19-09 precedent). */
export function platformWhatsappNumber(): string {
  return '60000000000'
}

/** BR-M20-21 (PROPOSED COPY). */
export function whatsappMessage(productName: string): string {
  return `Salam, saya berminat dengan produk "${productName}" di PRESTASIPLUS Marketplace.`
}
