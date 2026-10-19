/**
 * Id spaces of the M05 datasets (SRS M05 §6.1, §6.2, §6.14.3; overview §6.5, X-12).
 *
 * - **Answers:** integer ids 1–478,499 (generated slots; an anchor takes a slot of its own cell, so
 *   the dataset keeps 478,499 rows); runtime answers from 9,000,001 (`floor`).
 * - **Sessions:** generated `g1…g32122` (opaque: anchors may push the last generated id up, X-12),
 *   anchors in a reserved key range with ids of one or two capital letters and 1–5 digits ("A2",
 *   "P1", "M4", "H01"), runtime ids opaque (`s_…`, never decoded, ordered after keyed rows).
 */

import type { IdCodec } from '@/mock/dataset'

import { ANSWERS_TOTAL, SESSIONS_TOTAL } from './pins'

export const ANSWER_ID_MAX = ANSWERS_TOTAL
export const ANSWER_RUNTIME_FLOOR = 9_000_001
/**
 * Anchor answers take ids in a reserved range above the generated ids (INFERRED; the SRS §6.2 says
 * an anchor "takes the id of the generated row it replaces"). Inside the fully packed 1–478,499
 * range every anchor would displace a generated slot to the nearest free id, which costs seconds
 * at compile once other modules contribute thousands of anchors (M18 6,563, M17 2,378). Blocks:
 * M05 500,001–509,999 (canonical accounts from 500,001); other contributors 510,001–999,999.
 */
export const ANSWER_ANCHOR_RANGE: readonly [number, number] = [500_001, 999_999]

export const SESSION_KEY_MAX = SESSIONS_TOTAL
/** First key of the session anchor range. */
export const SESSION_ANCHOR_BASE = 1_000_000
const LETTERS = 27 // 1–26 per letter, 0 = none
const DIGIT_LENGTHS = 6
const NUMBERS = 100_000
export const SESSION_ANCHOR_RANGE: readonly [number, number] = [
  SESSION_ANCHOR_BASE,
  SESSION_ANCHOR_BASE + LETTERS * LETTERS * DIGIT_LENGTHS * NUMBERS - 1,
]

const ANCHOR_ID = /^([A-Z]{1,2})(\d{1,5})$/
const GENERATED_ID = /^g([1-9]\d*)$/

/** Whether `id` is a valid anchor session id ("A2", "H01"). */
export function isAnchorSessionId(id: string): boolean {
  return ANCHOR_ID.test(id)
}

function letterCode(letters: string): number {
  let code = 0
  for (const ch of letters) code = code * LETTERS + (ch.charCodeAt(0) - 64)
  return code
}

function lettersOf(code: number): string {
  let out = ''
  let c = code
  while (c > 0) {
    out = String.fromCharCode(64 + (c % LETTERS)) + out
    c = Math.floor(c / LETTERS)
  }
  return out
}

export const sessionIdCodec: IdCodec<string> = {
  encode(key) {
    if (key < SESSION_ANCHOR_BASE) return `g${String(key)}`
    const rest = key - SESSION_ANCHOR_BASE
    const num = rest % NUMBERS
    const packed = Math.floor(rest / NUMBERS)
    const len = packed % DIGIT_LENGTHS
    const code = Math.floor(packed / DIGIT_LENGTHS)
    return `${lettersOf(code)}${String(num).padStart(len, '0')}`
  },
  decode(id) {
    const g = GENERATED_ID.exec(id)
    if (g) {
      const n = Number(g[1])
      return n < SESSION_ANCHOR_BASE ? n : undefined
    }
    const a = ANCHOR_ID.exec(id)
    if (!a) return undefined
    const digits = a[2] as string
    return (
      SESSION_ANCHOR_BASE +
      (letterCode(a[1] as string) * DIGIT_LENGTHS + digits.length) * NUMBERS +
      Number(digits)
    )
  },
}

/** Generated session key of an id ("g12" → 12), else null. */
export function generatedSessionKey(id: string | null): number | null {
  if (id === null) return null
  const g = GENERATED_ID.exec(id)
  return g ? Number(g[1]) : null
}
