/**
 * Kept as a thin re-export: other M02 pages import from here. The implementation lives once in `user-list.ts`
 * (M02-T4); new code should import it from there.
 */
import { isApiError } from '@/api'

export { errorLines, GENERIC_ERROR, USERS_LIST_PATH } from './user-list'

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}
