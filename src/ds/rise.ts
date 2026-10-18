/**
 * Staff KPI `rise` entry plays once per page load (design language D-3): the first tiles that
 * mount open a short window, and tiles mounting inside it animate; later tiles (route changes,
 * refreshes) do not.
 */
const WINDOW_MS = 1500
let windowEnd = 0

export function staffRiseAllowed(now: number = Date.now()): boolean {
  if (windowEnd === 0) {
    windowEnd = now + WINDOW_MS
    return true
  }
  return now < windowEnd
}

/** Test hook. */
export function resetStaffRise(): void {
  windowEnd = 0
}
