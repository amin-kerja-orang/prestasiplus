/** The mock clock of M20 (bound at seed; overview §6.12). */

import type { Clock } from '@/lib/time'

let bound: Clock | null = null

export function bindM20Clock(clock: Clock): void {
  bound = clock
}

export function nowMs(): number {
  if (!bound) throw new Error('M20: not booted (no clock bound)')
  return bound.now()
}
