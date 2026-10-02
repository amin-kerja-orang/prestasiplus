/**
 * S12-S16 static lookups and formatters (SRS FR-M02-82..97, BR-22, BR-23, BR-33). The mock owns its
 * own copies of the package data; UI code never imports `mock/`.
 */

import { isApiError } from '@/api'
import { formatCurrency } from '@/lib/number'

import type { PackageTier, SubscriptionStatus } from '../api/subscriptions'

export const SUBSCRIPTION_ROUTES = {
  list: 'm02.subscriptions.list',
  create: 'm02.subscriptions.create',
  detail: 'm02.subscriptions.detail',
  invoice: 'm02.subscriptions.invoice',
  userPackages: 'm02.users.packages',
} as const

export const SUBSCRIPTIONS_LIST_PATH = '/admin/school-subscriptions'

/** BR-23 filter labels ("Tamat" / "Dibatalkan"; the stat card says "Tamat Tempoh"). */
export const STATUS_FILTER_OPTIONS: readonly { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'grace', label: 'Tempoh Ihsan' },
  { value: 'expired', label: 'Tamat' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

/** FR-M02-83: only T4 and T5 are filterable. */
export const FORM_LEVEL_FILTER_OPTIONS = [
  { value: 't4', label: 'Tingkatan 4' },
  { value: 't5', label: 'Tingkatan 5' },
] as const

/** BR-23 badge labels and their full class strings. */
export const STATUS_BADGE: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: 'Aktif', cls: 'bg-emerald-100 text-emerald-700' },
  grace: { label: 'Tempoh Ihsan', cls: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Tamat', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Batal', cls: 'bg-slate-100 text-slate-500' },
}

export const TIER_LABEL: Record<PackageTier, string> = { basic: 'Pemantauan', full: 'Penuh' }

/** FR-M02-95 extend presets. */
export const EXTEND_PRESETS: readonly { label: string; days: number }[] = [
  { label: '7 Hari', days: 7 },
  { label: '14 Hari', days: 14 },
  { label: '1 Bulan', days: 30 },
  { label: '2 Bulan', days: 60 },
  { label: '3 Bulan', days: 90 },
  { label: '6 Bulan', days: 180 },
  { label: '1 Tahun', days: 365 },
]

/** FR-M02-90 "Tunjuk" (25, 50, 100, 200) and the default page size (DV-M02-11). */
export const DEFAULT_PER_PAGE = 50

/** Native `min` / `max` of every quota input (DV-M02-07). */
export const QUOTA_MIN = 1
export const QUOTA_MAX = 2000

/** "RM30.00" / "RM15,000.00" from a number or a decimal string (BR-33). */
export function money(value: number | string): string {
  return formatCurrency(Number(value))
}

/** The bar colour at `percent` (FR-M02-88: emerald below 100, red at 100; threshold INFERRED). */
export function barClass(percent: number): string {
  return percent >= 100 ? 'bg-red-500' : 'bg-emerald-500'
}

/** Form level badge text: upper-case ("T5", "D1_D6"). */
export function levelLabel(level: string): string {
  return level.toUpperCase()
}

/** An unknown id is the standard 404 page, as live (module decision); other load failures keep the red box. */
export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}
