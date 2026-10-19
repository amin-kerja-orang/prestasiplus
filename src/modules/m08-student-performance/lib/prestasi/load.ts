/**
 * Page loading for the Prestasi screens (SRS M08 §8.3): the content stays empty until the mock answers;
 * an unknown id is the standard 404 page and a forbidden view the 403 page (FR-M08-07, FR-M08-08);
 * any other failure shows the global load-error box with "Cuba Semula".
 */

import { watch, type WatchSource } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, type ApiFetcher } from '@/composables'

/** Global load-error text (SRS M08 §8.3, the M01 / M23 convention). */
export const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

export interface RouteDataOptions {
  /** An unknown id is the 403 page, not the 404 page (S11, FR-M08-08). */
  notFoundAs403?: boolean
}

export function useRouteData<T>(
  fetcher: ApiFetcher<T>,
  deps?: WatchSource | readonly WatchSource[],
  options: RouteDataOptions = {},
) {
  const result = useApi(fetcher, deps)
  watch(
    result.error,
    (err) => {
      if (!isApiError(err)) return
      if (err.status === 404) setRouteOutcome(options.notFoundAs403 ? 403 : 404)
      else if (err.status === 403) setRouteOutcome(403)
    },
    { immediate: true },
  )
  return result
}

/** True when the failure is a plain load error (not the 404 / 403 page). */
export function isLoadError(err: unknown): boolean {
  if (err === null || err === undefined) return false
  return !(isApiError(err) && (err.status === 404 || err.status === 403))
}
