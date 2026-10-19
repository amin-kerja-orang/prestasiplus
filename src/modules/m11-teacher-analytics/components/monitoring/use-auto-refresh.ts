/**
 * S2 auto-refresh (FR-M11-34, BR-M11-25): a 300 s countdown shown as `m:ss`, one step per second while
 * running, a reload at 0 (the countdown then restarts at 5:00), a pause / play toggle; resuming at
 * ≤ 0 restarts at 300. Uses the page clock (`setInterval`) so E2E can advance it.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export const AUTO_REFRESH_SECONDS = 300

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds)
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`
}

export function useAutoRefresh(onReload: () => void) {
  const remaining = ref(AUTO_REFRESH_SECONDS)
  const running = ref(true)
  let timer: ReturnType<typeof setInterval> | null = null

  function tick() {
    if (!running.value) return
    remaining.value -= 1
    if (remaining.value <= 0) {
      onReload()
      remaining.value = AUTO_REFRESH_SECONDS
    }
  }

  function toggle() {
    if (running.value) {
      running.value = false
      return
    }
    if (remaining.value <= 0) remaining.value = AUTO_REFRESH_SECONDS
    running.value = true
  }

  /** Back to 5:00 (a manual refresh reloads the page on live). */
  function restart() {
    remaining.value = AUTO_REFRESH_SECONDS
  }

  onMounted(() => {
    timer = setInterval(tick, 1000)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    timer = null
  })

  return {
    remaining,
    running,
    display: computed(() => formatCountdown(remaining.value)),
    toggle,
    restart,
  }
}
