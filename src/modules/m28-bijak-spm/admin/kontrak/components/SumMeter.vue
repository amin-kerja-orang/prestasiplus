<script setup lang="ts">
/**
 * `DsSumMeter` fallback (design 2): a labelled sum against a target with state ok / short / over,
 * always icon plus text ("Jumlah kuota 43 / 45 - kurang 2"). The visible text is the live region:
 * its announcement is updated 500 ms after the value stops changing, not per keystroke.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: number
    target: number | null
    unit?: string
  }>(),
  { unit: '' },
)

const state = computed<'ok' | 'short' | 'over' | 'unknown'>(() =>
  props.target === null ? 'unknown' : props.value === props.target ? 'ok' : props.value < props.target ? 'short' : 'over',
)
const diff = computed(() => (props.target === null ? 0 : Math.abs(props.target - props.value)))
const text = computed(() => {
  const base = `${props.label} ${props.value}${props.target === null ? '' : ` / ${props.target}`}${props.unit ? ` ${props.unit}` : ''}`
  if (state.value === 'short') return `${base} - kurang ${diff.value}`
  if (state.value === 'over') return `${base} - lebih ${diff.value}`
  return base
})

const live = ref(text.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (t) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    live.value = t
  }, 500)
})
onBeforeUnmount(() => clearTimeout(timer))

const look = computed(() =>
  state.value === 'ok'
    ? { color: 'success' as const, icon: 'i-ph-check-circle' }
    : state.value === 'unknown'
      ? { color: 'neutral' as const, icon: 'i-ph-minus-circle' }
      : { color: 'warning' as const, icon: 'i-ph-warning-circle' },
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" :data-state="state" data-testid="sum-meter">
    <UBadge :color="look.color" variant="subtle" :icon="look.icon" class="tabular" :label="text" aria-hidden="true" />
    <span class="sr-only" role="status" aria-live="polite">{{ live }}</span>
  </div>
</template>
