// Dev/e2e chart registry (F-17, ADR-0012, overview §9 `ChartCanvas`).
// Each mounted `ChartCanvas` with a `testId` publishes `{type, data, options}` in
// `window.__charts[testId]` so E2E can assert labels, values, colours and axis
// settings (a canvas cannot be read by pixels). The check is a static env
// comparison, so the demo build (`VITE_TEST_HOOKS=false`) dead-code-eliminates it.
import type { ChartData, ChartOptions, ChartType } from 'chart.js'

export interface ChartRegistryEntry {
  type: ChartType
  data: ChartData
  options: ChartOptions
}

declare global {
  interface Window {
    __charts?: Record<string, ChartRegistryEntry>
  }
}

/** Publishes (or replaces) the config of the chart `testId`. No-op outside dev/e2e. */
export function publishChart(testId: string, entry: ChartRegistryEntry): void {
  if (import.meta.env.VITE_TEST_HOOKS === 'true') {
    if (typeof window === 'undefined') return
    const charts = (window.__charts ??= {})
    charts[testId] = entry
  }
}

/** Removes the chart `testId` from the registry. No-op outside dev/e2e. */
export function unpublishChart(testId: string): void {
  if (import.meta.env.VITE_TEST_HOOKS === 'true') {
    if (typeof window === 'undefined' || !window.__charts) return
    delete window.__charts[testId]
  }
}
