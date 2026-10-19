import type { Timestamp } from '@pp/contract'

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

/** Serialise an instant in Malaysia time with the explicit `+08:00` offset (contract Timestamp). */
export function toMytTimestamp(date: Date = new Date()): Timestamp {
  return new Date(date.getTime() + MYT_OFFSET_MS).toISOString().replace('Z', '+08:00')
}
