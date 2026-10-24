/** Shared by S23 and S21: the text a failed load shows next to "Cuba Semula". */

import { isApiError, RATE_LIMITED_MESSAGE_BM } from '@/api'

export const GENERIC_LOAD_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/**
 * Picks the line for a failed load by status, never by the server's text (SW11-08, DV-M18-26): the API and the
 * client carry English or raw messages ("Internal server error", "Failed to fetch", "HTTP 503", a 422 rule text).
 * A network failure (status 0 or a plain `Error`), a 5xx and a 4xx validation (400, 422) show the generic BM line;
 * a 429 shows the BM rate-limit line; any other status keeps the server's message unless it is empty or the bare
 * client fallback "HTTP {status}".
 */
export function loadErrorMessage(error: { message: string } | null | undefined): string {
  if (!isApiError(error)) return GENERIC_LOAD_ERROR
  const { status, message } = error
  if (status === 429) return RATE_LIMITED_MESSAGE_BM
  if (status === 0 || status >= 500 || status === 400 || status === 422) return GENERIC_LOAD_ERROR
  if (message === '' || /^HTTP \d+$/.test(message)) return GENERIC_LOAD_ERROR
  return message
}
