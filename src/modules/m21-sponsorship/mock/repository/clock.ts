/** The mock clock of M21 (bound at seed; overview §6.12). */

import { toIsoMyt, type Clock } from '@/lib/time'

let bound: Clock | null = null

export function bindM21Clock(clock: Clock): void {
  bound = clock
}

export function nowMs(): number {
  if (!bound) throw new Error('M21: not booted (no clock bound)')
  return bound.now()
}

/** The current instant as an ISO string with the MYT offset (`createdAt` of new rows). */
export function nowIso(): string {
  return toIsoMyt(nowMs())
}
