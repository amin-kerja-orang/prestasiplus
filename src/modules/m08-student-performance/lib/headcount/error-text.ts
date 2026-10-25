import { isApiError } from '@/api'

import { LOAD_ERROR } from '../prestasi/load'

/** The API's generic English defaults (`api-error.ts`): never shown in the BM UI (SWE). */
const GENERIC_SERVER_TEXTS: readonly string[] = [
  'server error',
  'not found',
  'this action is unauthorized',
  'unauthenticated',
  'conflict',
  'the given data was invalid',
  'payload too large',
]

/**
 * The BM line of a failed headcount action: the headcount service's own message of a 409 or 422
 * (as `HeadcountCreatePage`), else the generic BM load error. A transport text (status 0, `HTTP <n>`),
 * a 5xx and the API's generic English defaults never reach the screen.
 */
export function headcountActionError(err: unknown): string {
  if (!isApiError(err) || (err.status !== 409 && err.status !== 422)) return LOAD_ERROR
  const text = err.message.trim().replace(/\.$/, '').toLowerCase()
  if (text === '' || /^http \d+$/.test(text) || GENERIC_SERVER_TEXTS.includes(text)) {
    return LOAD_ERROR
  }
  return err.message
}
