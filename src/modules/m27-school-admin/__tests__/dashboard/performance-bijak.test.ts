// @vitest-environment jsdom
/** US-33: the performance panel is labelled as Bijak SPM results in http mode only. */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { SchoolDashboard } from '../../api/dashboard'

type Perf = SchoolDashboard['performance']

const full: Perf = {
  gps: { value: null, grade: null, band: null, entries: 0 },
  risk: null,
  practice: { accuracy: 61.4, sessions: 57, questions: 803 },
  levels: [{ code: 't4', name: 'Tingkatan 4', accuracy: 66.2 }],
  distribution: [{ grade: 'A', count: 3, pct: 100 }],
  total: 3,
}
const suppressed: Perf = {
  gps: { value: null, grade: null, band: null, entries: 0 },
  risk: null,
  practice: { accuracy: null, sessions: 0, questions: 0 },
  levels: [],
  distribution: [],
  total: 0,
}

async function render(mode: 'http' | 'mock', performance: Perf) {
  vi.resetModules()
  vi.stubEnv('VITE_API_MODE', mode)
  const { default: PerformanceSummary } = await import(
    '../../components/dashboard/PerformanceSummary.vue'
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  return mount(PerformanceSummary, { props: { performance }, global: { plugins: [router] } })
}
const has = (w: Awaited<ReturnType<typeof render>>, id: string) =>
  w.find(`[data-testid="${id}"]`).exists()

afterEach(() => vi.unstubAllEnvs())

describe('PerformanceSummary Bijak SPM label (US-33)', () => {
  it('shows the Bijak SPM heading in http mode', async () => {
    const w = await render('http', full)
    expect(w.get('[data-testid="sd-performance-source"]').text()).toBe('Keputusan Bijak SPM')
    expect(has(w, 'sd-performance-empty')).toBe(false)
  })

  it('does not show it in mock mode, even for an empty block', async () => {
    const w = await render('mock', suppressed)
    expect(has(w, 'sd-performance-source')).toBe(false)
    expect(has(w, 'sd-performance-empty')).toBe(false)
    expect(has(w, 'sd-panels')).toBe(true)
  })

  it('shows Tiada data for a suppressed block in http mode', async () => {
    const w = await render('http', suppressed)
    expect(w.get('[data-testid="sd-performance-empty"]').text()).toContain('Tiada data')
    expect(has(w, 'sd-panels')).toBe(false)
  })
})
