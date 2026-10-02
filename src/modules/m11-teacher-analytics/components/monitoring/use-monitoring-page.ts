/**
 * Data, in-place 404 / 403 and tab title of one S3-S5 page. An unknown id answers 404 and a school
 * admin asking for another school answers 403 (alias scope, INFERRED): both render the standalone
 * error page in place (FR-M11-07, SRS §9).
 */
import { computed, watch, type WatchSource } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'

export function useMonitoringPage<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: WatchSource | readonly WatchSource[],
  title: (data: T) => string,
) {
  const { data, error, loading, reload } = useApi(fetcher, deps)
  const pageMeta = usePageMeta()

  const status = computed(() => (isApiError(error.value) ? error.value.status : null))
  const blocked = computed(() => status.value === 404 || status.value === 403)
  watch(
    status,
    (code) => {
      if (code === 404) setRouteOutcome(404)
      else if (code === 403) setRouteOutcome(403)
    },
    { immediate: true },
  )
  watch(
    data,
    (value) => {
      if (value) pageMeta.setTitle(title(value))
    },
    { immediate: true },
  )
  return { data, error, loading, reload, blocked }
}
