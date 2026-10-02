<script setup lang="ts">
// ChartCanvas (F-17, ADR-0012, overview §9). A thin Chart.js 4 wrapper that takes a
// full Chart.js config copied from the live page script (type, data, options and
// inline plugins), creates the chart on mount, updates it when data/options change,
// recreates it when the type or plugins change, and destroys it on unmount.
// The chart is sized by its container box (`height`, e.g. "250px"), never by a fixed
// canvas width, so it follows the card width at every breakpoint (no page h-scroll).
import type { ChartData, ChartOptions, ChartType, Plugin } from 'chart.js'
import { onBeforeUnmount, onMounted, shallowRef, toRaw, useTemplateRef, watch } from 'vue'

import { cloneConfig, configEqual, samePlugins } from './config-utils'
import { Chart, registerChartComponents } from './register'
import { publishChart, type ChartRegistryEntry, unpublishChart } from './registry'

const props = withDefaults(
  defineProps<{
    /** Chart.js chart type, e.g. "line". Its controller must be registered in register.ts. */
    type: ChartType
    /** Chart.js `data` (labels + datasets), as in the live config. */
    data: ChartData
    /** Chart.js `options`, as in the live config (callbacks allowed). */
    options?: ChartOptions
    /** Inline Chart.js plugins from the live config (e.g. M08 band shading). */
    plugins?: Plugin[]
    /** Height of the chart box (CSS length). Omit to size the box with a class instead. */
    height?: string
    /** `data-testid` of the box and the key in the dev/e2e `window.__charts` registry. */
    testId?: string
  }>(),
  { options: () => ({}), plugins: () => [], height: undefined, testId: undefined },
)

registerChartComponents()

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')
const chart = shallowRef<Chart | null>(null)

/** Live configs are responsive with no fixed aspect ratio; the config may override. */
function applyOptionDefaults(options: ChartOptions): ChartOptions {
  return { responsive: true, maintainAspectRatio: false, ...options }
}

/**
 * Snapshot of the config last applied to Chart.js (deep copy, detached from the
 * props), used to skip no-op updates and published to the registry.
 */
let lastEntry: ChartRegistryEntry | null = null

function snapshot(): ChartRegistryEntry {
  return {
    type: props.type,
    data: cloneConfig(props.data),
    options: applyOptionDefaults(cloneConfig(props.options)),
  }
}

function publish(): void {
  if (props.testId && lastEntry) publishChart(props.testId, lastEntry)
}

function create(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  lastEntry = snapshot()
  // Chart.js gets its own copy, so it never mutates the props or the snapshot.
  chart.value = new Chart(canvas, {
    type: props.type,
    data: cloneConfig(lastEntry.data),
    options: cloneConfig(lastEntry.options),
    plugins: [...toRaw(props.plugins)],
  })
  publish()
}

function destroy(): void {
  chart.value?.destroy()
  chart.value = null
}

function update(): void {
  const instance = chart.value
  if (!instance) return
  const next = snapshot()
  // A parent re-render passing equal inline literals must not re-animate the chart.
  if (
    lastEntry &&
    configEqual(next.data, lastEntry.data) &&
    configEqual(next.options, lastEntry.options)
  ) {
    return
  }
  lastEntry = next
  instance.data = cloneConfig(next.data)
  instance.options = cloneConfig(next.options)
  instance.update()
  publish()
}

onMounted(create)

watch(() => [props.data, props.options], update, { deep: true })

// Plugins cannot change after Chart.js starts, so a new type or a different plugin
// list recreates the chart; a new array holding the same plugins does not.
watch(
  () => [props.type, props.plugins] as const,
  ([type, plugins], [previousType, previousPlugins]) => {
    if (type === previousType && samePlugins(plugins, previousPlugins)) return
    destroy()
    create()
  },
)

watch(
  () => props.testId,
  (_next, previous) => {
    if (previous) unpublishChart(previous)
    publish()
  },
)

onBeforeUnmount(() => {
  destroy()
  if (props.testId) unpublishChart(props.testId)
})

defineExpose({
  /** The live Chart.js instance (null before mount and after unmount). */
  chart,
})
</script>

<template>
  <div
    class="relative w-full min-w-0"
    :style="height ? { height } : undefined"
    :data-testid="testId"
  >
    <canvas ref="canvas" />
  </div>
</template>
