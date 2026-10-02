/**
 * Data, 404 and tab title of one S4-S7 page: an unknown id or one outside the viewer's scope answers
 * 404 and renders the M01 global 404 page in place (FR-M17-07, BR-M17-30); the tab reads
 * "{name} - Command Center" once the data is there.
 */
import { computed, watch, type WatchSource } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'

export function useCcPage<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: WatchSource | readonly WatchSource[],
  name: (data: T) => string,
) {
  const { data, error, loading } = useApi(fetcher, deps)
  const pageMeta = usePageMeta()

  const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
  watch(
    notFound,
    (is404) => {
      if (is404) setRouteOutcome(404)
    },
    { immediate: true },
  )
  watch(
    data,
    (value) => {
      if (value) pageMeta.setTitle(`${name(value)} - Command Center`)
    },
    { immediate: true },
  )
  return { data, error, loading, notFound }
}
