// @vitest-environment jsdom
// Integration check with the real Chart.js: jsdom has no 2D context, so getContext
// returns a no-op context stub (every method is a no-op, measureText has a width).
import { mount } from '@vue/test-utils'
import { Chart, type ChartData } from 'chart.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ChartCanvas from '../ChartCanvas.vue'

function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = { canvas }
  return new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'measureText') return () => ({ width: 10 })
      if (key === 'getLineDash') return () => []
      return () => undefined
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

const data: ChartData = {
  labels: ['19/02', '11/05', '19/05'],
  datasets: [{ label: 'Ketepatan (%)', data: [57.1, 33.8, 10.0] }],
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return fakeContext(this)
  } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ChartCanvas with real Chart.js (F-17)', () => {
  it('creates, updates and destroys a registered line chart', async () => {
    const wrapper = mount(ChartCanvas, {
      props: { type: 'line', data, options: { animation: false } },
    })
    const canvas = wrapper.get('canvas').element
    const chart = Chart.getChart(canvas)
    expect(chart).toBeDefined()
    expect((wrapper.vm as unknown as { chart: unknown }).chart).toBe(chart)
    expect(chart!.data.labels).toEqual(['19/02', '11/05', '19/05'])

    await wrapper.setProps({ data: { labels: ['20/05'], datasets: [{ data: [80] }] } })
    expect(Chart.getChart(canvas)).toBe(chart)
    expect(chart!.data.labels).toEqual(['20/05'])

    wrapper.unmount()
    expect(Chart.getChart(canvas)).toBeUndefined()
  })
})
