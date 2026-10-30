<script setup lang="ts">
/**
 * Meter with a printed value (admin page templates G2): replaces `UProgress` + a hand-written
 * percentage on boards and tables. `value` is 0-100 (clamped). `tone="auto"` uses the accuracy
 * thresholds of the admin boards (70 and above = success, below 50 = error, else warning) so the
 * colour is never the only signal: the value is printed beside the bar (tabular, one decimal)
 * unless `showValue` is false. The bar is a `progressbar` named by `ariaLabel` or `label`.
 */
import { computed } from 'vue'

import { formatPercent } from './format'

const props = withDefaults(
  defineProps<{
    value: number
    /** Text above the bar (BM); also the accessible name unless `ariaLabel` is set. */
    label?: string
    showValue?: boolean
    /** Printed instead of the formatted value when the page already formatted it ("15%"). */
    valueText?: string
    tone?: 'auto' | 'primary' | 'success' | 'warning' | 'error'
    size?: 'sm' | 'md'
    ariaLabel?: string
  }>(),
  { label: undefined, showValue: true, valueText: undefined, tone: 'primary', size: 'md', ariaLabel: undefined },
)

const clamped = computed(() => (Number.isFinite(props.value) ? Math.max(0, Math.min(100, props.value)) : 0))
const color = computed<'primary' | 'success' | 'warning' | 'error'>(() => {
  if (props.tone !== 'auto') return props.tone
  if (clamped.value >= 70) return 'success'
  if (clamped.value < 50) return 'error'
  return 'warning'
})
const name = computed(() => props.ariaLabel ?? props.label ?? formatPercent(clamped.value))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1" data-ds="progress" :data-tone="color">
    <span v-if="label" class="text-caption text-muted">{{ label }}</span>
    <div class="flex min-w-0 items-center gap-2">
      <UProgress
        class="min-w-12 flex-1"
        :model-value="clamped"
        :max="100"
        :color="color"
        :size="size === 'sm' ? 'xs' : 'sm'"
        :get-value-label="() => name"
      />
      <span
        v-if="showValue"
        class="tabular w-14 shrink-0 text-end text-label text-highlighted"
        data-ds="progress-value"
        >{{ valueText ?? formatPercent(clamped) }}</span
      >
    </div>
  </div>
</template>
