/**
 * Page loading for the PKSK student screens (SRS M07 §8, FR-M07-18, FR-M07-19): the content stays
 * empty until the mock answers; an unknown domain code is the standard 404 page; a level without
 * access (403) redirects to `/pksk` with no message (INFERRED, L-1); any other failure shows the
 * global load-error box with "Cuba Semula".
 */

import { watch, type WatchSource } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, type ApiFetcher } from '@/composables'

/** Global load-error text (the M01 / M08 convention). */
export const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

export function usePkskData<T>(
  fetcher: ApiFetcher<T>,
  deps?: WatchSource | readonly WatchSource[],
) {
  const router = useRouter()
  const result = useApi(fetcher, deps)
  watch(
    result.error,
    (err) => {
      if (!isApiError(err)) return
      if (err.status === 404) setRouteOutcome(404)
      else if (err.status === 403) void router.replace('/pksk')
    },
    { immediate: true },
  )
  return result
}

/** True when the failure is a plain load error (not the 404 page or the gate redirect). */
export function isLoadError(err: unknown): boolean {
  if (err === null || err === undefined) return false
  return !(isApiError(err) && (err.status === 404 || err.status === 403))
}
