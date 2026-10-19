/**
 * Debounce helpers (overview §9; Alpine `x-model.debounce` / `@input.debounce` idioms).
 * Timers use `setTimeout`, so Vitest fake timers and the Playwright clock control them. A pending
 * call is cancelled when the owning component or effect scope is disposed.
 */

import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  toValue,
  watch,
  type Ref,
  type WatchSource,
} from 'vue'

export interface DebouncedFn<A extends unknown[]> {
  (...args: A): void
  /** Drops the pending call. */
  cancel(): void
  /** Runs the pending call now (if any). */
  flush(): void
  /** `true` while a call is waiting. */
  readonly pending: Readonly<Ref<boolean>>
}

/** Returns `fn` debounced by `delay` ms (trailing call with the last arguments). */
export function useDebounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): DebouncedFn<A> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: A | null = null
  const pending = ref(false)

  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    lastArgs = null
    pending.value = false
  }

  const flush = () => {
    if (timer === null || lastArgs === null) return
    const args = lastArgs
    cancel()
    fn(...args)
  }

  const debounced = ((...args: A) => {
    if (timer !== null) clearTimeout(timer)
    lastArgs = args
    pending.value = true
    timer = setTimeout(flush, delay)
  }) as DebouncedFn<A>

  debounced.cancel = cancel
  debounced.flush = flush
  Object.defineProperty(debounced, 'pending', { value: readonly(pending) })

  if (getCurrentScope()) onScopeDispose(cancel)
  return debounced
}

/** A read-only ref that follows `source` once it has been still for `delay` ms. */
export function useDebouncedRef<T>(source: WatchSource<T>, delay: number): Readonly<Ref<T>> {
  const out = shallowRef<T>(toValue(source))
  const update = useDebounce((next: T) => {
    out.value = next
  }, delay)
  watch(source, (next) => update(next))
  return readonly(out) as Readonly<Ref<T>>
}
