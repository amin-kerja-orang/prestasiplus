/**
 * `flash` store: the Laravel session flash (overview §5.4 step 5, §9 `FlashOutlet` + `useFlash()`).
 *
 * Lifecycle, as a live redirect-with-flash:
 * 1. a page sets a **pending** flash (`set`) and then navigates;
 * 2. the router's after-each hook calls `consume()`: the pending flash becomes the **current** one
 *    and the pending slot is emptied. A navigation with nothing pending clears the current flash;
 * 3. `FlashOutlet` renders `current` until the next navigation (no timer).
 *
 * `show()` sets the current flash directly, for a page that stays on its route (live redirected
 * back to the same page).
 */

import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { FlashMessage } from '@/components/feedback'

export const useFlashStore = defineStore('flash', () => {
  /** Set before navigation; shown on the next page. */
  const pending = shallowRef<FlashMessage | null>(null)
  /** Shown by `FlashOutlet` on the current page. */
  const current = shallowRef<FlashMessage | null>(null)

  /** Queues `message` for the next page. */
  function set(message: FlashMessage): void {
    pending.value = message
  }

  function success(message: FlashMessage['message']): void {
    set({ type: 'success', message })
  }

  function error(message: FlashMessage['message']): void {
    set({ type: 'error', message })
  }

  /** Shows `message` on the current page now. */
  function show(message: FlashMessage): void {
    current.value = message
  }

  /** After navigation: pending → current (or none). Returns the new current flash. */
  function consume(): FlashMessage | null {
    current.value = pending.value
    pending.value = null
    return current.value
  }

  function clear(): void {
    pending.value = null
    current.value = null
  }

  return { pending, current, set, success, error, show, consume, clear }
})

export type FlashStore = ReturnType<typeof useFlashStore>
