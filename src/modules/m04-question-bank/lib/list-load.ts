/**
 * Shared by the two M04 lists (Studio and Bank Soalan): the text of a failed list read and the debounce that
 * applies draft filter values to the URL (REQ-A-027). `GET /api/questions` has a per-user limit, so typing
 * must not fire one read per key; a 429 shows its own message instead of the generic load error.
 */

import { onBeforeUnmount, watch, type Ref } from 'vue'

import { isApiError } from '@/api'

import { LOAD_ERROR } from './ui-errors'

/** Wait after the last keystroke or select change before the list is read (REQ-A-027). */
export const FILTER_DEBOUNCE_MS = 300

/** [PROPOSED] UX-83 fallback when the server sends no message of its own. `{n}` = Retry-After seconds. */
export function rateLimitedFallback(retryAfter: number | undefined): string {
  const wait = retryAfter !== undefined && retryAfter > 0 ? `dalam ${retryAfter} saat` : 'sebentar lagi'
  return `Terlalu banyak carian dalam masa singkat. Cuba lagi ${wait}.`
}

/** Text of the red box above a list that failed to load: the 429 message, else the usual load error. */
export function listLoadMessage(err: unknown): string {
  if (isApiError(err) && (err.status === 429 || err.code === 'RATE_LIMITED')) {
    // On the real API `errorFromResponse` already replaces every 429 message with a generic BM line, so a
    // known wait (body `retryAfter` or the Retry-After header) must win over the message text.
    if (err.retryAfter !== undefined) return rateLimitedFallback(err.retryAfter)
    const own = err.message.trim()
    return own === '' || /^HTTP \d+$/.test(own) ? rateLimitedFallback(undefined) : own
  }
  return LOAD_ERROR
}

/**
 * Applies the draft filter values 300 ms after the last change. `apply` must itself skip a no-op (same
 * filter as the URL), so the draft being re-synced from the URL never causes a second read. Returns
 * `cancel`, to call when the filter is applied by hand (Tapis) so the same change is not applied twice.
 */
export function useDebouncedFilter(
  draft: Ref<Record<string, string>>,
  keys: readonly string[],
  apply: () => unknown,
  delay: number = FILTER_DEBOUNCE_MS,
): { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  watch(
    () => keys.map((k) => draft.value[k]),
    () => {
      cancel()
      timer = setTimeout(() => {
        timer = null
        void apply()
      }, delay)
    },
  )
  onBeforeUnmount(cancel)
  return { cancel }
}
