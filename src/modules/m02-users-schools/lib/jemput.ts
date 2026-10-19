/**
 * L45 S1 `/jemput-ibu-bapa` helpers (SRS L45 FR-L45-07/09/15; BR-L45-11). Pure functions, so they
 * are unit-tested without a DOM.
 */

import type { LinkedParent } from '../api/parent-invite'

export const JEMPUT_PATH = '/jemput-ibu-bapa'

/** The red alert for a failed regenerate and the load error (UNVERIFIED COPY, shared with M01 §8). */
export const JEMPUT_GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** FR-L45-09: the prepared WhatsApp message, before the URL. */
export const WHATSAPP_MESSAGE_PREFIX =
  'Salam ibu/bapa! Klik link ini untuk pantau perkembangan saya di PRESTASIPLUS: '

/** BR-L45-11: the origin is read at render time and never stored. */
export function inviteUrl(token: string, origin: string): string {
  return `${origin}/ibu-bapa/terima/${token}`
}

/** FR-L45-09. */
export function whatsAppHref(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(WHATSAPP_MESSAGE_PREFIX + url)}`
}

/** FR-L45-15: by name ascending, case-insensitive, Malay collation. */
export function sortParents(parents: readonly LinkedParent[]): LinkedParent[] {
  return [...parents].sort((a, b) => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }))
}
