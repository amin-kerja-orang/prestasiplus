/**
 * `useApi(fetcher, deps)` (overview §9): page data the way a server-rendered live page gets it.
 *
 * - Fetches on creation (unless `immediate: false`) and again whenever a `deps` source changes
 *   (route params or query). No cache: every call goes to the API.
 * - A new fetch aborts the previous one (the fetcher receives an `AbortSignal`) and a stale result
 *   is never written.
 * - `error` holds the `ApiError` (or `Error`) of the last failed fetch; `data` is then `null`.
 * - The in-flight request is aborted when the owning component or effect scope is disposed.
 */

import {
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
  type WatchSource,
} from 'vue'

import type { ApiError } from '@/api'

export type ApiFetcher<T> = (signal: AbortSignal) => Promise<T>

export interface UseApiOptions {
  /** Fetch on creation. Default `true`. */
  immediate?: boolean
}

export interface UseApiResult<T> {
  data: ShallowRef<T | null>
  error: ShallowRef<ApiError | Error | null>
  loading: Ref<boolean>
  /** Fetches again (aborting a fetch in flight). Resolves when this fetch has settled. */
  reload: () => Promise<void>
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  )
}

export function useApi<T>(
  fetcher: ApiFetcher<T>,
  deps?: WatchSource | readonly WatchSource[],
  options: UseApiOptions = {},
): UseApiResult<T> {
  const data = shallowRef<T | null>(null)
  const error = shallowRef<ApiError | Error | null>(null)
  const loading = ref(false)
  let controller: AbortController | null = null
  let seq = 0

  async function reload(): Promise<void> {
    controller?.abort()
    const current = new AbortController()
    controller = current
    const id = ++seq
    loading.value = true
    error.value = null
    try {
      const result = await fetcher(current.signal)
      if (id !== seq) return
      data.value = result
    } catch (err) {
      if (id !== seq || current.signal.aborted || isAbortError(err)) return
      data.value = null
      error.value = err instanceof Error ? err : new Error(String(err))
    } finally {
      if (id === seq) {
        loading.value = false
        controller = null
      }
    }
  }

  if (deps !== undefined) {
    watch(deps as WatchSource | WatchSource[], () => void reload())
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      seq += 1
      controller?.abort()
      controller = null
    })
  }

  if (options.immediate !== false) void reload()

  return { data, error, loading, reload }
}
