/**
 * The one-time info flash of S6 (FR-M05-72): S7 for a subject with no queued question sets it, then
 * navigates to S6, which shows it once. Held in memory only, so a reload clears it (live: Laravel
 * session flash, gone after the next request).
 */

export const NO_WRONG_FLASH = 'Tiada soalan salah untuk subjek ini. Tahniah!'

let pending: string | null = null

export function setRevisionFlash(message: string = NO_WRONG_FLASH): void {
  pending = message
}

/** Returns the pending flash and clears it. */
export function takeRevisionFlash(): string | null {
  const message = pending
  pending = null
  return message
}
