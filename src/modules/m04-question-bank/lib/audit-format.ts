/** Formats of S8 to S12: "dd Mon yyyy" with English month abbreviations, as live (FR-M04-88, FN-M04-5.1.3). */

import { formatMyt, formatTime } from '@/lib/time'

export const formatEnDate = (iso: string): string => formatMyt(iso, 'dd MMM yyyy', { months: 'en' })

export { formatTime }

/** Text cut at `max` characters plus "..." (S8 uses the API excerpt, S12 cuts at about 200). */
export function cutText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text
}
