/** The mock clock of M15 (bound at seed; BR-M15-25, overview §6.12). */

import type { Clock } from '@/lib/time'

let bound: Clock | null = null

export function bindM15Clock(clock: Clock): void {
  bound = clock
}

export function nowMs(): number {
  if (!bound) throw new Error('M15: not booted (no clock bound)')
  return bound.now()
}
