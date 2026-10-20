/**
 * Page loading for the Prestasi screens (SRS M08 §8.3): the content stays empty until the mock answers;
 * an unknown id is the standard 404 page and a forbidden view the 403 page (FR-M08-07, FR-M08-08);
 * any other failure shows the global load-error box with "Cuba Semula".
 */

import { watch, type WatchSource } from 'vue'

import { isApiError } from '@/api'
import { isHttpMode } from '@/api/mode'
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

/**
 * Real API only (BE-19, privacy OQ-3): a 404 on a headcount action means the config is gone or outside the
 * viewer's scope, so the page becomes the standard not-found page and nothing says which. Returns true when
 * it handled the error. Mock mode (which answers 403) is unchanged.
 */
export function notFoundOutcome(err: unknown): boolean {
  if (!isHttpMode() || !isApiError(err) || err.status !== 404) return false
  setRouteOutcome(404)
  return true
}

/** True when the failure is a plain load error (not the 404 / 403 page). */
export function isLoadError(err: unknown): boolean {
  if (err === null || err === undefined) return false
  return !(isApiError(err) && (err.status === 404 || err.status === 403))
}
