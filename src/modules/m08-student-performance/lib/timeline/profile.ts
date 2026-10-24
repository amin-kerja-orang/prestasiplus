/**
 * S18 display helpers (SRS M08 FR-M08-105, BR-M08-25). Pure functions.
 */

import { formatNumber } from '@/lib/number'

/**
 * The one table from the M14 tier key to the live English label ("🥉 Gangsa", "397 syiling lagi ke
 * Silver") and the badge colour (M14 catalogue colours, with the observed bronze `#CD7F32`).
 */
const TIERS: Record<string, { label: string; colour: string }> = {
  bronze: { label: 'Gangsa', colour: '#cd7f32' },
  silver: { label: 'Perak', colour: '#94a3b8' },
  gold: { label: 'Emas', colour: '#d4a017' },
  platinum: { label: 'Platinum', colour: '#64748b' },
}
export const tierName = (key: string): string => TIERS[key]?.label ?? key
export const tierColour = (key: string): string => TIERS[key]?.colour ?? '#cd7f32'

/** "103" / "1,234": the `ms-MY` grouping. */
export const count = (n: number): string => formatNumber(n)

/** "0%" / "93.5%": one decimal, no trailing ".0". */
export const percent = (n: number): string =>
  `${formatNumber(n, { decimals: 1, dropZeroFraction: true })}%`

/** The avatar's initial (the live avatar image is not reproducible: fictitious profiles have none). */
export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase()

/** The absolute public URL of a profile path (`timeline.profileUrl` is a path). */
export const absoluteUrl = (path: string, origin: string = window.location.origin): string =>
  `${origin}${path}`
