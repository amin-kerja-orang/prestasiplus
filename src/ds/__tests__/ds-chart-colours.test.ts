// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const configs: { data: { datasets: { backgroundColor: unknown }[] } }[] = []

vi.mock('chart.js', () => {
  class Chart {
    static register(): void {}
    constructor(_el: unknown, cfg: (typeof configs)[number]) {
      configs.push(cfg)
    }
    destroy(): void {}
  }
  const stub = {}
  return {
    Chart,
    ArcElement: stub,
    BarController: stub,
    BarElement: stub,
    CategoryScale: stub,
    DoughnutController: stub,
    Legend: stub,
    LinearScale: stub,
    LineController: stub,
    LineElement: stub,
    PointElement: stub,
    Tooltip: stub,
  }
})

import DsChart from '../DsChart.vue'

afterEach(() => {
  configs.length = 0
  vi.restoreAllMocks()
})

describe('DsChart staff colours (S-02)', () => {
  it('falls back to palette tokens when --ds-cat-* is unset (no personality scope)', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: (v: string) => (v === '--color-kobalt-600' ? '#2440f0' : ''),
        }) as unknown as CSSStyleDeclaration,
    )
    mount(DsChart, {
      props: { title: 'Gred', labels: ['A', 'B'], series: [{ label: 'Murid', data: [1, 2] }] },
    })
    expect(configs[0]?.data.datasets[0]?.backgroundColor).toBe('#2440f0')
  })
})
