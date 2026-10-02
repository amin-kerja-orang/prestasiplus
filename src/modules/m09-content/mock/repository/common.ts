/** Shared helpers of the M09 repositories: errors, the bound clock, author lookups. */

import { mytParts, toIsoMyt, type Clock } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'

import { initialOf, ROLE_LABELS } from '../data/labels'
import type { AuthorRef } from '../types'

export type M09ErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT'

/** A refused M09 write (nothing is written). Handlers map `code` to the §7 error responses. */
export class M09Error extends Error {
  readonly code: M09ErrorCode
  /** The request field a validation refusal belongs to (e.g. `isPinned`), when known. */
  readonly field: string | undefined
  constructor(code: M09ErrorCode, message: string, field?: string) {
    super(message)
    this.field = field
    this.name = 'M09Error'
    this.code = code
  }
}

let boundClock: Clock | null = null

/** Bound by the M09 seed (every boot and reset). */
export function bindM09Clock(clock: Clock): void {
  boundClock = clock
}

/** Now (epoch ms) of the runtime being served. */
export function m09Now(): number {
  if (!boundClock) throw new Error('M09: not booted (no clock bound)')
  return boundClock.now()
}

export const nowIso = (): string => toIsoMyt(m09Now())

/** Today as `YYYY-MM-DD` (Asia/Kuala_Lumpur). */
export function todayKey(): string {
  const p = mytParts(m09Now())
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

const UNKNOWN_AUTHOR = 'Pengguna'

/** `{name, initial}` of an author (BR-M09-29); the name comes from the M01 users store. */
export function authorRef(userId: number): AuthorRef {
  const name = users.get(userId)?.name ?? UNKNOWN_AUTHOR
  return { name, initial: initialOf(name) }
}

/** `{name, initial, roleLabel}` of a video uploader. */
export function uploaderRef(userId: number): { name: string; initial: string; roleLabel: string } {
  const user = users.get(userId)
  const name = user?.name ?? UNKNOWN_AUTHOR
  return { name, initial: initialOf(name), roleLabel: ROLE_LABELS[user?.role ?? ''] ?? '' }
}

export const norm = (text: string): string => text.trim().toLowerCase()
