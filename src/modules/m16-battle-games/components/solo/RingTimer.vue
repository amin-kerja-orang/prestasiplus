<script setup lang="ts">
/** The circular clock of S13 and S14: the seconds left inside a ring that empties; red at ≤ 10 s. */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ value: number; max: number; stroke?: string; size?: number }>(),
  { stroke: 'stroke-violet-500', size: 76 },
)

const R = 34
const CIRC = 2 * Math.PI * R
const offset = computed(() => CIRC * (1 - Math.max(0, Math.min(1, props.value / props.max))))
const low = computed(() => props.value <= 10)
</script>

<template>
  <div
    class="relative flex shrink-0 items-center justify-center"
    :style="{ width: `${String(size)}px`, height: `${String(size)}px` }"
    data-testid="solo-ring"
  >
    <svg viewBox="0 0 76 76" class="absolute inset-0 -rotate-90" fill="none" stroke-width="5">
      <circle cx="38" cy="38" :r="R" class="stroke-white/10" />
      <circle
        cx="38"
        cy="38"
        :r="R"
        stroke-linecap="round"
        :class="low ? 'stroke-red-400' : stroke"
        :stroke-dasharray="CIRC"
        :stroke-dashoffset="offset"
      />
    </svg>
    <span
      class="relative text-2xl font-extrabold"
      :class="low ? 'text-red-400' : 'text-white'"
      data-testid="solo-clock"
      >{{ value }}</span
    >
  </div>
</template>
