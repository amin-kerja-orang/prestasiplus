/** Shared by S23 and S21: the text a failed load shows next to "Cuba Semula". */

export const GENERIC_LOAD_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/**
 * The server's message when it says something; an empty message or the client's bare "HTTP {status}" fallback
 * carries no information for the user, so those become the generic BM line.
 */
export function loadErrorMessage(error: { message: string } | null | undefined): string {
  if (!error || error.message === '' || /^HTTP \d+$/.test(error.message)) return GENERIC_LOAD_ERROR
  return error.message
}
