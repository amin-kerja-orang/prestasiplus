// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import type { ChartData, ChartOptions, Plugin } from 'chart.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'

import ChartCanvas from '../ChartCanvas.vue'

interface FakeChartShape {
  canvas: HTMLCanvasElement
  config: { type: string; data: ChartData; options: ChartOptions; plugins: Plugin[] }
  data: ChartData
  options: ChartOptions
  update: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

// jsdom has no canvas 2D context, so Chart.js itself is replaced by a recording fake.
const instances = vi.hoisted(() => [] as FakeChartShape[])

vi.mock('../register', async () => {
  const { vi: v } = await import('vitest')
  class FakeChart {
    canvas: HTMLCanvasElement
    config: FakeChartShape['config']
    data: ChartData
    options: ChartOptions
    update = v.fn()
    destroy = v.fn()
    constructor(canvas: HTMLCanvasElement, config: FakeChartShape['config']) {
      this.canvas = canvas
      this.config = config
      this.data = config.data
      this.options = config.options
      instances.push(this)
    }
  }
  return { Chart: FakeChart, registerChartComponents: v.fn() }
})

/** M05 FR-M05-101 "Trend Ketepatan" config (admin `?period=all` anchors). */
function trendKetepatan() {
  const data: ChartData<'line'> = {
    labels: ['19/02', '11/05', '19/05'],
    datasets: [
      {
        label: 'Ketepatan (%)',
        data: [57.1, 33.8, 10.0],
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Soalan',
        data: [35, 74, 10],
        borderColor: '#F59E0B',
        borderDash: [5, 5],
        borderWidth: 2,
        yAxisID: 'y1',
      },
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { usePointStyle: true } } },
    scales: {
      y: { min: 0, max: 100, title: { display: true, text: 'Ketepatan (%)' } },
      y1: {
        position: 'right',
        title: { display: true, text: 'Jumlah Soalan' },
        grid: { drawOnChartArea: false },
      },
    },
  }
  return { data: data as ChartData, options: options as ChartOptions }
}

beforeEach(() => {
  instances.length = 0
  delete window.__charts
  vi.stubEnv('VITE_TEST_HOOKS', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('ChartCanvas (F-17)', () => {
  it('creates one chart on the canvas with the given config', () => {
    const { data, options } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data, options } })
    expect(instances).toHaveLength(1)
    const chart = instances[0]!
    expect(chart.canvas).toBe(wrapper.get('canvas').element)
    expect(chart.config.type).toBe('line')
    expect(chart.config.data.labels).toEqual(['19/02', '11/05', '19/05'])
    expect(chart.config.data.datasets[1]).toMatchObject({ borderDash: [5, 5], yAxisID: 'y1' })
    expect(chart.config.options).toMatchObject({ interaction: { mode: 'index' } })
  })

  it('mounts the FR-M05-101 config and reads it back from window.__charts', () => {
    const { data, options } = trendKetepatan()
    mount(ChartCanvas, { props: { type: 'line', data, options, testId: 'progress-trend-chart' } })
    const entry = window.__charts?.['progress-trend-chart']
    expect(entry).toBeDefined()
    expect(entry!.type).toBe('line')
    expect(entry!.data.labels).toEqual(['19/02', '11/05', '19/05'])
    expect(entry!.data.datasets.map((d) => d.label)).toEqual(['Ketepatan (%)', 'Soalan'])
    expect(entry!.data.datasets[0]!.data).toEqual([57.1, 33.8, 10.0])
    expect(entry!.data.datasets[0]).toMatchObject({
      borderColor: '#6366F1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 6,
    })
    expect(entry!.data.datasets[1]!.data).toEqual([35, 74, 10])
    expect(entry!.options).toMatchObject({
      scales: {
        y: { min: 0, max: 100, title: { text: 'Ketepatan (%)' } },
        y1: { position: 'right', title: { text: 'Jumlah Soalan' } },
      },
      plugins: { legend: { labels: { usePointStyle: true } } },
    })
  })

  it('does not publish to the registry when test hooks are off (demo build)', () => {
    vi.stubEnv('VITE_TEST_HOOKS', 'false')
    const { data, options } = trendKetepatan()
    mount(ChartCanvas, { props: { type: 'line', data, options, testId: 'x' } })
    expect(window.__charts).toBeUndefined()
    expect(instances).toHaveLength(1)
  })

  it('defaults to responsive with no fixed aspect ratio, and the config may override', () => {
    const { data } = trendKetepatan()
    mount(ChartCanvas, { props: { type: 'line', data } })
    expect(instances[0]!.config.options).toMatchObject({
      responsive: true,
      maintainAspectRatio: false,
    })
    mount(ChartCanvas, { props: { type: 'line', data, options: { maintainAspectRatio: true } } })
    expect(instances[1]!.config.options.maintainAspectRatio).toBe(true)
  })

  it('sizes the box by its height prop and the container width (no fixed canvas width)', () => {
    const { data } = trendKetepatan()
    const wrapper = mount(ChartCanvas, {
      props: { type: 'line', data, height: '250px', testId: 'box' },
    })
    const box = wrapper.get('[data-testid="box"]')
    expect(box.attributes('style')).toContain('height: 250px')
    expect(box.classes()).toEqual(expect.arrayContaining(['relative', 'w-full', 'min-w-0']))
    expect(wrapper.get('canvas').attributes('width')).toBeUndefined()
  })

  it('passes a copy of the data, so Chart.js never holds the reactive prop', () => {
    const state = reactive(trendKetepatan())
    mount(ChartCanvas, { props: { type: 'line', data: state.data, options: state.options } })
    const passed = instances[0]!.config.data
    expect(passed).not.toBe(state.data)
    expect(passed.datasets[0]!.data).not.toBe(state.data.datasets[0]!.data)
    expect(passed.datasets[0]!.data).toEqual([57.1, 33.8, 10.0])
  })

  it('updates the chart and the registry when data changes in place', async () => {
    const state = reactive(trendKetepatan())
    mount(ChartCanvas, {
      props: { type: 'line', data: state.data, options: state.options, testId: 'trend' },
    })
    const chart = instances[0]!
    state.data.labels!.push('20/05')
    ;(state.data.datasets[0]!.data as number[]).push(80)
    await nextTick()
    expect(instances).toHaveLength(1)
    expect(chart.update).toHaveBeenCalledTimes(1)
    expect(chart.data.labels).toEqual(['19/02', '11/05', '19/05', '20/05'])
    expect(window.__charts?.trend?.data.datasets[0]!.data).toEqual([57.1, 33.8, 10.0, 80])
  })

  it('updates when the data prop is replaced or options change', async () => {
    const { data, options } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data, options } })
    const chart = instances[0]!
    await wrapper.setProps({ data: { labels: ['01/01'], datasets: [{ data: [1] }] } })
    expect(chart.update).toHaveBeenCalledTimes(1)
    expect(chart.data.labels).toEqual(['01/01'])
    await wrapper.setProps({ options: { animation: false } })
    expect(chart.update).toHaveBeenCalledTimes(2)
    expect(chart.options).toMatchObject({ animation: false, responsive: true })
  })

  it('recreates the chart when the type or plugins change', async () => {
    const { data } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data } })
    const first = instances[0]!
    const bands: Plugin = { id: 'bands', beforeDraw: () => undefined }
    await wrapper.setProps({ plugins: [bands] })
    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(instances).toHaveLength(2)
    expect(instances[1]!.config.plugins).toEqual([bands])
    await wrapper.setProps({ type: 'bar' })
    expect(instances[1]!.destroy).toHaveBeenCalledTimes(1)
    expect(instances[2]!.config.type).toBe('bar')
  })

  it('moves the registry entry when testId changes', async () => {
    const { data } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data, testId: 'a' } })
    await wrapper.setProps({ testId: 'b' })
    expect(window.__charts?.a).toBeUndefined()
    expect(window.__charts?.b?.data.labels).toEqual(['19/02', '11/05', '19/05'])
  })

  it('destroys the chart and unregisters it on unmount', () => {
    const { data } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data, testId: 'gone' } })
    const chart = instances[0]!
    expect(window.__charts?.gone).toBeDefined()
    wrapper.unmount()
    expect(chart.destroy).toHaveBeenCalledTimes(1)
    expect(window.__charts?.gone).toBeUndefined()
  })

  it('exposes the chart instance', () => {
    const { data } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data } })
    expect((wrapper.vm as unknown as { chart: unknown }).chart).toBe(instances[0])
  })

  it('ignores parent re-renders that pass equal inline plugins, options and data', async () => {
    const bandPlugin: Plugin = { id: 'bands', beforeDraw: () => undefined }
    const tick = ref(0)
    const Parent = defineComponent({
      setup() {
        return () =>
          h('div', [
            h('span', `render ${tick.value}`),
            h(ChartCanvas, {
              type: 'line',
              data: { labels: ['2022', '2023'], datasets: [{ label: 'GPS', data: [4.2, 3.9] }] },
              options: { animation: { duration: 800, easing: 'easeInOutQuart' } },
              plugins: [bandPlugin],
              height: '280px',
            }),
          ])
      },
    })
    const wrapper = mount(Parent)
    expect(instances).toHaveLength(1)
    tick.value++
    await nextTick()
    tick.value++
    await nextTick()
    expect(wrapper.text()).toContain('render 2')
    expect(instances).toHaveLength(1)
    expect(instances[0]!.update).not.toHaveBeenCalled()
    expect(instances[0]!.destroy).not.toHaveBeenCalled()
  })

  it('skips update when setProps passes deep-equal data and options', async () => {
    const { data, options } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data, options } })
    const fresh = trendKetepatan()
    await wrapper.setProps({ data: fresh.data, options: fresh.options })
    expect(instances[0]!.update).not.toHaveBeenCalled()
  })

  it('still updates on a nested in-place options change', async () => {
    const state = reactive(trendKetepatan())
    mount(ChartCanvas, {
      props: { type: 'line', data: state.data, options: state.options, testId: 'nested' },
    })
    const chart = instances[0]!
    const scales = state.options.scales as { y: { max: number } }
    scales.y.max = 50
    await nextTick()
    expect(chart.update).toHaveBeenCalledTimes(1)
    expect(chart.options).toMatchObject({ scales: { y: { max: 50 } } })
    expect(window.__charts?.nested?.options).toMatchObject({ scales: { y: { max: 50 } } })
  })

  it('does not recreate when a new plugin array holds the same plugins', async () => {
    const bands: Plugin = { id: 'bands' }
    const { data } = trendKetepatan()
    const wrapper = mount(ChartCanvas, { props: { type: 'line', data, plugins: [bands] } })
    await wrapper.setProps({ plugins: [bands] })
    expect(instances).toHaveLength(1)
    await wrapper.setProps({ plugins: [bands, { id: 'other' }] })
    expect(instances).toHaveLength(2)
  })
})
