/** The mock clock of M22 (bound at seed; overview §6.12). */

import { toIsoMyt, type Clock } from '@/lib/time'

let bound: Clock | null = null

export function bindM22Clock(clock: Clock): void {
  bound = clock
}

export function nowMs(): number {
  if (!bound) throw new Error('M22: not booted (no clock bound)')
  return bound.now()
}

export function nowIso(): string {
  return toIsoMyt(nowMs())
}
