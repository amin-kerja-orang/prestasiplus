/** S23 Ringkasan Eksekutif shared constants and helpers (design `docs/design/m18-amaran-summary.md` section 4). */

import { formatMyt } from '@/lib/time'

export const TITLE = 'Ringkasan Eksekutif'
export const EMPTY_DISTRIBUTION = 'Tiada data pelajar lagi.'
export const FOOTER_LINE_2 = 'Untuk maklumat lanjut, hubungi pentadbir sistem.'

/** `generatedAt` is epoch milliseconds; "d MMMM yyyy, HH:mm" in Malaysia time, or `null` when invalid. */
export function formatGenerated(epochMs: unknown): string | null {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs) || epochMs < 0) return null
  return formatMyt(epochMs, 'd MMMM yyyy, HH:mm')
}

/** "Purata Kombo": one decimal. */
export const formatAvg = (value: number): string => value.toFixed(1)

/** Tab title of the SRS: "Ringkasan Eksekutif — {title} | PRESTASIPLUS". */
export const tabTitle = (title: string): string => `${TITLE} — ${title} | PRESTASIPLUS`
