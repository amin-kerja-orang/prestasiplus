/** Date and error helpers of the M15 student pages (BR-M15-16; times are Asia/Kuala_Lumpur). */

import { COMMON_COPY } from './copy'

const TZ = 'Asia/Kuala_Lumpur'

function parts(iso: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value
  return out
}

/** "dd/mm HH:MM", 24-hour, zero-padded, no year (S6 history row). */
export function formatDayMonthTime(iso: string): string {
  const p = parts(iso)
  return `${p.day ?? ''}/${p.month ?? ''} ${p.hour ?? ''}:${p.minute ?? ''}`
}

/** "dd/mm/yyyy" (S7 close date, PROPOSED). Accepts the M14 local date `yyyy-MM-dd` or an ISO datetime. */
export function formatDate(iso: string): string {
  const local = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (local) return `${local[3] ?? ''}/${local[2] ?? ''}/${local[1] ?? ''}`
  const p = parts(iso)
  return `${p.day ?? ''}/${p.month ?? ''}/${p.year ?? ''}`
}

/** Shared error convention (FR-M15-65, SRS §8.3): M15 adds no error copy, so handler text is never shown. */
export function errorMessage(): string {
  return COMMON_COPY.actionFailed
}
