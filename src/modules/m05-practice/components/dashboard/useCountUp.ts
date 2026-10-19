/**
 * `useCountUp(target, rule)` (FR-M05-11): the live Alpine counter. The value starts at 0, waits
 * `delayMs`, then adds `step(target)` every `intervalMs` until it reaches `target`. Timers are
 * plain `setTimeout` / `setInterval` (the E2E clock and the unit-test fake timers both drive them)
 * and are cleared when the owning component unmounts.
 */

import { onBeforeUnmount, onMounted, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

import type { CountUpRule } from './dashboard-lib'

export function useCountUp(target: MaybeRefOrGetter<number>, rule: CountUpRule): Ref<number> {
  const count = ref(0)
  let delay: ReturnType<typeof setTimeout> | null = null
  let ticker: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (delay !== null) clearTimeout(delay)
    if (ticker !== null) clearInterval(ticker)
    delay = null
    ticker = null
  }

  onMounted(() => {
    delay = setTimeout(() => {
      const goal = toValue(target)
      ticker = setInterval(() => {
        count.value += rule.step(goal)
        if (count.value >= goal) {
          count.value = goal
          if (ticker !== null) clearInterval(ticker)
          ticker = null
        }
      }, rule.intervalMs)
    }, rule.delayMs)
  })

  onBeforeUnmount(stop)
  return count
}
