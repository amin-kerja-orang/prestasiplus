/**
 * Data, loading state and in-place 403 / 404 of one Kirkpatrick screen (SRS M12 FR-M12-17, §8.3). A
 * 403 or 404 from the API renders the standalone error page in place. Pages pass the endpoint call
 * and the sources that trigger a reload (the route query).
 */
import { computed, watch, type WatchSource } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'

export function useKirkpatrickPage<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps?: WatchSource | readonly WatchSource[],
) {
  const { data, error, loading, reload } = useApi(fetcher, deps)
  const status = computed(() => (isApiError(error.value) ? error.value.status : null))
  watch(
    status,
    (code) => {
      if (code === 404) setRouteOutcome(404)
      else if (code === 403) setRouteOutcome(403)
    },
    { immediate: true },
  )
  return { data, error, loading, reload }
}

/** A route query value as a string (first value, "" when absent). */
export function queryString(v: unknown): string {
  return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : ''
}
