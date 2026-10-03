/**
 * Shared pieces of the M16 repositories: the error class, the bound clock, the pure battle rules
 * (BR-M16-07, BR-M16-10) and the user / school lookups used for display fields.
 */

import { toIsoMyt, type Clock } from '@/lib/time'
import type { PrngRegistry } from '@/mock/determinism'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import type { Winner } from '../types'

export type M16ErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT'

/** A refused M16 write (nothing is written). Handlers map `code` to the §7 error responses. */
export class M16Error extends Error {
  readonly code: M16ErrorCode
  /** The request field a validation refusal belongs to, when known. */
  readonly field: string | undefined
  /** Every failing field with its message (a 422 with several fields). */
  readonly fields: Readonly<Record<string, string>> | undefined
  constructor(
    code: M16ErrorCode,
    message: string,
    field?: string,
    fields?: Readonly<Record<string, string>>,
  ) {
    super(message)
    this.name = 'M16Error'
    this.code = code
    this.field = field
    this.fields = fields
  }
}

let boundClock: Clock | null = null

/** Bound by the M16 seed (every boot and reset). */
export function bindM16Clock(clock: Clock): void {
  boundClock = clock
}

let boundPrng: PrngRegistry | null = null

/** Bound by the M16 seed: the registry the test hooks draw from (hooks run outside a request). */
export function bindM16Prng(prng: PrngRegistry): void {
  boundPrng = prng
}

export function m16Prng(): PrngRegistry {
  if (!boundPrng) throw new Error('M16: not booted (no PRNG bound)')
  return boundPrng
}

/** Now (epoch ms) of the runtime being served. */
export function m16Now(): number {
  if (!boundClock) throw new Error('M16: not booted (no clock bound)')
  return boundClock.now()
}

export const nowIso = (): string => toIsoMyt(m16Now())

// --- battle rules (BR-M16-07, BR-M16-10) -------------------------------------------------------

export const ARENA_QUESTIONS = 10
export const QUESTION_SECONDS = 15

/** Winner of a battle: higher total; equal non-zero = seri (null); 0-0 = player B (DV-M16-35). */
export function winnerOf(scoreA: number, scoreB: number): Winner {
  if (scoreA === 0 && scoreB === 0) return 'B'
  if (scoreA > scoreB) return 'A'
  if (scoreB > scoreA) return 'B'
  return null
}

/** A correct answer after `seconds` whole seconds scores `1000 - round(500 * s / 15)`. */
export function arenaPoints(seconds: number): number {
  const s = Math.min(QUESTION_SECONDS, Math.max(0, Math.floor(seconds)))
  return 1000 - Math.round((500 * s) / QUESTION_SECONDS)
}

/** Seed rule: correct = floor(score / 500), capped at 10 (PROPOSED, §6.11.1). */
export const seedCorrect = (score: number): number =>
  Math.min(ARENA_QUESTIONS, Math.floor(score / 500))

/** "Skor" of one side: round(score / 100) (PROPOSED, BR-M16-12). */
export const sideSkor = (score: number): number => Math.round(score / 100)

// --- display lookups -----------------------------------------------------------------------------

export function gradeLabel(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return ''
  if (grade >= 1 && grade <= 6) return `Darjah ${String(grade)}`
  if (grade >= 7 && grade <= 11) return `Tingkatan ${String(grade - 6)}`
  return ''
}

export const userName = (id: number): string => users.get(id)?.name ?? 'Pelajar'

export const schoolName = (id: number | null | undefined): string =>
  id === null || id === undefined ? '' : (schools.get(id)?.name ?? '')

/** Current M02 school of a user, or null. */
export const currentSchoolOf = (userId: number): number | null =>
  users.get(userId)?.schoolId ?? null
