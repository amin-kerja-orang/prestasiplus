// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Ticks = { precision?: number }
type Cfg = {
  options: {
    layout: { padding: { right: number } }
    scales: { y: { ticks: Ticks }; x: { ticks: Ticks } }
  }
}
const configs: Cfg[] = []

vi.mock('chart.js', () => {
  class Chart {
    static register(): void {}
    constructor(_el: unknown, cfg: Cfg) {
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

function mountChart(seriesData: number[][], horizontal = false): Cfg {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  )
  mount(DsChart, {
    props: {
      title: 'Trend',
      labels: seriesData[0]!.map((_, i) => `L${i}`),
      series: seriesData.map((data, i) => ({ label: `S${i}`, data })),
      horizontal,
    },
  })
  return configs[0]!
}

describe('DsChart integer ticks (G5-M11 #7)', () => {
  it('uses whole-number steps when every value is an integer', () => {
    expect(mountChart([[0, 1, 1]]).options.scales.y.ticks.precision).toBe(0)
  })

  it('also applies to the value axis of a horizontal chart', () => {
    expect(mountChart([[2, 3]], true).options.scales.x.ticks.precision).toBe(0)
  })

  it('keeps automatic ticks for fractional data', () => {
    expect(mountChart([[57.9, 60]]).options.scales.y.ticks.precision).toBeUndefined()
  })

  it('keeps automatic ticks for mixed integer and fractional series', () => {
    const cfg = mountChart([
      [1, 2, 3],
      [1.5, 2, 3],
    ])
    expect(cfg.options.scales.y.ticks.precision).toBeUndefined()
  })

  it('keeps automatic ticks when a series contains NaN', () => {
    expect(mountChart([[1, Number.NaN, 3]]).options.scales.y.ticks.precision).toBeUndefined()
  })

  it('keeps automatic ticks when a series contains null', () => {
    const data = [1, null, 3] as unknown as number[]
    expect(mountChart([data]).options.scales.y.ticks.precision).toBeUndefined()
  })
})

describe('DsChart right layout padding', () => {
  it('is 16 for vertical charts', () => {
    expect(mountChart([[1, 2]]).options.layout.padding.right).toBe(16)
  })

  it('is 32 for horizontal charts', () => {
    expect(mountChart([[1, 2]], true).options.layout.padding.right).toBe(32)
  })
})
