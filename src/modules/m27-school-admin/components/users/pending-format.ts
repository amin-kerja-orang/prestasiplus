/** Copy and helpers of S7b "Guru Menunggu Pengesahan" (docs/design/m27-pending-teacher-verify.md, sections 5 and 8). */

import { isApiError } from '@/api'

export const PENDING_PATH = '/admin-sekolah/guru/menunggu'
export const PENDING_TITLE = 'Guru Menunggu Pengesahan'
export const PENDING_UNIT = 'Menunggu Pengesahan'
/** Copy 15: a 404 (or a defensive 409) on verify. */
export const GONE_MESSAGE = 'Guru ini tidak lagi menunggu pengesahan. Senarai telah dikemas kini.'

export const foundText = (formattedCount: string): string => `${formattedCount} guru menunggu pengesahan`

/** Copy 10a: the accessible name of a row button (starts with the visible label). */
export const verifyLabel = (name: string): string => `Sahkan ${name}`

export const confirmMessage = (name: string): string =>
  `Sahkan ${name} sebagai guru sekolah ini? Akaun akan diaktifkan dan guru akan dimaklumkan.`

/** The row is no longer pending (unknown, other school, already verified): contract 404, defensive 409. */
export const isGone = (err: unknown): boolean => isApiError(err) && (err.status === 404 || err.status === 409)

/** E-mail cell: "-" when the account has none. */
export const emailText = (email: string | null): string => (email === null || email === '' ? '-' : email)

/**
 * The id that should take focus after `removed` left the list: the nearest row after it that is still listed,
 * else the nearest before it, else `null` (focus goes to the heading).
 */
export function focusTargetAfter(before: readonly string[], removed: string, after: readonly string[]): string | null {
  const at = before.indexOf(removed)
  const still = new Set(after)
  for (let i = at + 1; i < before.length; i += 1) {
    const id = before[i]
    if (id !== undefined && still.has(id)) return id
  }
  for (let i = at - 1; i >= 0; i -= 1) {
    const id = before[i]
    if (id !== undefined && still.has(id)) return id
  }
  return null
}
