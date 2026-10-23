/** Copy and helpers of S7b "Guru Menunggu Pengesahan" (docs/design/m27-pending-teacher-verify.md, sections 5, 8 and 16). */

import { isApiError } from '@/api'

export const PENDING_PATH = '/admin-sekolah/guru/menunggu'
export const PENDING_TITLE = 'Guru Menunggu Pengesahan'
export const PENDING_UNIT = 'Menunggu Pengesahan'
/** Copy 15: a 404 (or a defensive 409) on verify. */
export const GONE_MESSAGE = 'Guru ini tidak lagi menunggu pengesahan. Senarai telah dikemas kini.'

export const foundText = (formattedCount: string): string => `${formattedCount} guru menunggu pengesahan`

/** Copy 10a: the accessible name of a row button (starts with the visible label). */
export const verifyLabel = (name: string): string => `Sahkan ${name}`

/**
 * Copy 24 (#208 follow-up): the e-mail and phone of a pending row are typed in by the registrant and nobody has
 * checked them, so the page says so above the list and the admin verifies only a person they know works here.
 */
export const UNCHECKED_NOTICE =
  'Emel dan telefon di bawah diisi sendiri oleh pendaftar dan belum disemak. Sahkan hanya guru yang anda pasti bertugas di sekolah ini.'

/** The details the dialog repeats: the e-mail and phone already formatted for display ("-" when missing). */
export interface ConfirmDetails {
  name: string
  email: string
  phone: string
  requestedAt: string
}

const shown = (value: string): boolean => value !== '' && value !== '-'

/**
 * Copy 12 (final, #208 follow-up): the dialog repeats what the admin can check (e-mail, phone, registration date;
 * a missing value is left out rather than shown as "-") and warns that the registrant typed them in.
 */
export function confirmMessage(row: ConfirmDetails): string {
  const parts = [`Sahkan ${row.name} sebagai guru sekolah ini?`]
  if (shown(row.email)) parts.push(`Emel: ${row.email}.`)
  if (shown(row.phone)) parts.push(`Telefon: ${row.phone}.`)
  parts.push(`Tarikh Daftar: ${row.requestedAt}.`)
  parts.push('Butiran ini diisi sendiri oleh pendaftar dan belum disemak.')
  parts.push('Sahkan hanya jika anda pasti guru ini bertugas di sekolah ini.')
  parts.push('Akaun akan diaktifkan dan guru akan dimaklumkan.')
  return parts.join(' ')
}

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
