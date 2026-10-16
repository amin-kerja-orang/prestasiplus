import { z } from '../zod'

/**
 * Timestamps (v2-data-migration X3, ADR-0018 item 6).
 *
 * Storage is UTC (`timestamptz`); the API SERIALISES every instant in Malaysia time with the
 * explicit `+08:00` offset, e.g. `2026-10-16T09:30:00+08:00` (optionally with milliseconds). Epoch
 * twins (`createdAtMs`) are computed on the client/mock, never part of the contract.
 */
const MYT_TIMESTAMP = /\+08:00$/

/** Response timestamp: ISO 8601, always `+08:00`. */
export const TimestampSchema = z.iso
  .datetime({ offset: true })
  .regex(MYT_TIMESTAMP, 'Timestamp must be ISO 8601 with the +08:00 offset')
  .meta({
    id: 'Timestamp',
    format: 'date-time',
    description: 'ISO 8601 instant serialised in Malaysia time (+08:00).',
    example: '2026-10-16T09:30:00+08:00',
  })
export type Timestamp = z.infer<typeof TimestampSchema>

/** Request timestamp: any ISO 8601 instant with an offset (or Z); the server normalises it. */
export const TimestampInputSchema = z.iso.datetime({ offset: true }).meta({
  id: 'TimestampInput',
  description: 'ISO 8601 instant with an explicit offset (or Z).',
})
export type TimestampInput = z.infer<typeof TimestampInputSchema>

/**
 * Calendar date (`YYYY-MM-DD`) in Malaysia time (`Asia/Kuala_Lumpur`); day boundaries for streaks
 * and daily limits are computed in that zone (v2-data-migration Q8).
 */
export const DateOnlySchema = z.iso.date().meta({
  id: 'DateOnly',
  description: 'Calendar date (YYYY-MM-DD) in Malaysia time.',
  example: '2026-10-16',
})
export type DateOnly = z.infer<typeof DateOnlySchema>
