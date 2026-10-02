/**
 * `useFlash()` (overview §9): the Laravel session flash, backed by the `flash` store.
 *
 * Pages call `success(msg)` / `error(msg)` (or `set`) before navigating; the router consumes it
 * after navigation; shells and auth pages pass `flash` to `<FlashOutlet :flash="flash" />`.
 */

import { computed } from 'vue'

import { useFlashStore } from '@/stores/flash'

export function useFlash() {
  const store = useFlashStore()
  return {
    /** The flash shown on the current page. */
    flash: computed(() => store.current),
    set: store.set,
    success: store.success,
    error: store.error,
    show: store.show,
    consume: store.consume,
    clear: store.clear,
  }
}
