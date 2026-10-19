/**
 * M02 BR-12 expiry rule (v1.22, XR-M19-04) = M19 `billing.computeExpiry(package, billing, from)`
 * (M19 BR-M19-14). M19 is not built yet, so the pure rule is hosted here, **provisionally**: the
 * M02 S3 save (#5) uses it, and M19's `billing.computeExpiry` must return exactly this when M19 is
 * built (it may move there unchanged). Writes go through `users.setSubscription`.
 *
 * - `regular_monthly` (billing `monthly`): `from` + 1 calendar month, same MYT time; the last day of
 *   the month when the next month is shorter;
 * - `personal` (M19 v1.2 split, DV-M19-18): billing `monthly` ("Personal Bulanan") → `from` + 1
 *   calendar month, like `regular_monthly`; billing `onetime` ("Personal Setahun") → the next
 *   10 January 23:59:59 MYT after `from`;
 * - `none`: null (INFERRED).
 */

import { toIsoMyt } from '@/lib/time'

export type PackageCode = 'none' | 'regular_monthly' | 'personal'
export type Billing = 'monthly' | 'onetime'

const MYT_OFFSET_MS = 8 * 3_600_000

/** Expiry (ISO 8601, +08:00) of `pkg` bought at `from` (epoch ms), or null. */
export function computeExpiry(pkg: PackageCode, billing: Billing, from: number): string | null {
  if (pkg === 'none') return null
  // Calendar arithmetic in MYT wall-clock time (UTC fields of the shifted instant).
  const wall = new Date(from + MYT_OFFSET_MS)
  const y = wall.getUTCFullYear()
  const m = wall.getUTCMonth()
  if (pkg === 'regular_monthly' || billing === 'monthly') {
    const lastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate()
    const day = Math.min(wall.getUTCDate(), lastDay)
    const next = Date.UTC(
      y,
      m + 1,
      day,
      wall.getUTCHours(),
      wall.getUTCMinutes(),
      wall.getUTCSeconds(),
      wall.getUTCMilliseconds(),
    )
    return toIsoMyt(next - MYT_OFFSET_MS)
  }
  // personal one-time: the next 10 January 23:59:59 MYT strictly after `from`.
  let target = Date.UTC(y, 0, 10, 23, 59, 59) - MYT_OFFSET_MS
  if (target <= from) target = Date.UTC(y + 1, 0, 10, 23, 59, 59) - MYT_OFFSET_MS
  return toIsoMyt(target)
}
