/**
 * `useSearchPicker()` (overview §9): the headless logic of the live school and student pickers
 * (M01 register/profile, M02, M04). Each screen keeps its own markup and its own loading and empty
 * behaviour; this composable only holds the state.
 *
 * - `setTerm(value)` (bind to `@input`) debounces the search by `debounceMs` (default 300 ms).
 * - A term shorter than `minChars` searches nothing: results are emptied, any pending or in-flight
 *   search is dropped. Each screen passes its own live threshold.
 * - `searching` is `true` while a search request is in flight; a newer search aborts an older one
 *   and a stale result is never written.
 * - `onFocus()` opens the list (when `openOnFocus`, default `true`); `close()` closes it; results
 *   arriving open it. A click outside `root` closes it (`@click.outside`).
 * - `select(item)` stores the chosen item and closes the list.
 */

import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

import { useClickOutside } from './useClickOutside'
import { useDebounce } from './useDebounce'

export interface SearchPickerOptions<T> {
  /** Performs the search (e.g. `GET /api/schools/search`). */
  search: (term: string, signal: AbortSignal) => Promise<T[]>
  /** Minimum term length that triggers a search (the screen's live threshold). */
  minChars: number
  /** Debounce in ms. Default 300. */
  debounceMs?: number
  /** Open the list on focus. Default `true`. */
  openOnFocus?: boolean
  /** Picker root element: a click outside it closes the list. */
  root?: Ref<Element | null | undefined>
  /** Called with the chosen item. */
  onSelect?: (item: T) => void
}

export interface SearchPicker<T> {
  term: Ref<string>
  results: ShallowRef<T[]>
  selected: ShallowRef<T | null>
  open: Ref<boolean>
  searching: Ref<boolean>
  /** The last search error (the screen decides whether to show anything). */
  error: ShallowRef<unknown>
  setTerm: (value: string) => void
  onFocus: () => void
  close: () => void
  select: (item: T) => void
  /** Clears term, results and selection. */
  reset: () => void
}

export function useSearchPicker<T>(options: SearchPickerOptions<T>): SearchPicker<T> {
  const term = ref('')
  const results = shallowRef<T[]>([])
  const selected = shallowRef<T | null>(null)
  const open = ref(false)
  const searching = ref(false)
  const error = shallowRef<unknown>(null)
  let controller: AbortController | null = null
  let seq = 0

  const abortInFlight = () => {
    seq += 1
    controller?.abort()
    controller = null
    searching.value = false
  }

  async function run(value: string): Promise<void> {
    abortInFlight()
    const current = new AbortController()
    controller = current
    const id = seq
    searching.value = true
    error.value = null
    try {
      const found = await options.search(value, current.signal)
      if (id !== seq) return
      results.value = found
      open.value = true
    } catch (err) {
      if (id !== seq) return
      error.value = err
      results.value = []
    } finally {
      if (id === seq) {
        searching.value = false
        controller = null
      }
    }
  }

  const debounced = useDebounce((value: string) => void run(value), options.debounceMs ?? 300)

  function setTerm(value: string): void {
    term.value = value
    if (value.length < options.minChars) {
      debounced.cancel()
      abortInFlight()
      results.value = []
      return
    }
    debounced(value)
  }

  function onFocus(): void {
    if (options.openOnFocus !== false) open.value = true
  }

  function close(): void {
    open.value = false
  }

  function select(item: T): void {
    selected.value = item
    open.value = false
    options.onSelect?.(item)
  }

  function reset(): void {
    debounced.cancel()
    abortInFlight()
    term.value = ''
    results.value = []
    selected.value = null
    open.value = false
    error.value = null
  }

  if (options.root) {
    useClickOutside(options.root, close, { enabled: open })
  }

  return {
    term,
    results,
    selected,
    open,
    searching,
    error,
    setTerm,
    onFocus,
    close,
    select,
    reset,
  }
}
