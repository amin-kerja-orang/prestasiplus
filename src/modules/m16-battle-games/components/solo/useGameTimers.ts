import { onBeforeUnmount } from 'vue'

/**
 * Timers of a game page (NFR-M16-01): plain `setTimeout` / `setInterval`, which the Playwright clock and
 * Vitest fake timers both drive. Every handle is cleared when the page is left, so no timer survives it.
 */
export function useGameTimers() {
  const timeouts = new Set<ReturnType<typeof setTimeout>>()
  const intervals = new Set<ReturnType<typeof setInterval>>()

  function after(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      timeouts.delete(id)
      fn()
    }, ms)
    timeouts.add(id)
    return id
  }

  function every(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    const id = setInterval(fn, ms)
    intervals.add(id)
    return id
  }

  function clearAfter(id: ReturnType<typeof setTimeout> | null | undefined): void {
    if (id === null || id === undefined) return
    clearTimeout(id)
    timeouts.delete(id)
  }

  function clearEvery(id: ReturnType<typeof setInterval> | null | undefined): void {
    if (id === null || id === undefined) return
    clearInterval(id)
    intervals.delete(id)
  }

  function clearAll(): void {
    for (const id of timeouts) clearTimeout(id)
    for (const id of intervals) clearInterval(id)
    timeouts.clear()
    intervals.clear()
  }

  onBeforeUnmount(clearAll)

  return { after, every, clearAfter, clearEvery, clearAll }
}
