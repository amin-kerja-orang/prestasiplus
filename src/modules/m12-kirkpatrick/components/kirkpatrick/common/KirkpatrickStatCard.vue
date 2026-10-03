<script setup lang="ts">
/** Tinted stat card of S1, S2, S3 (label above, big value, optional small suffix and caption). */
import type { StatTone } from './kirkpatrick-format'

defineProps<{
  label: string
  value: string
  /** Muted suffix after the value ("/5", "/522"). */
  suffix?: string
  caption?: string
  tone: StatTone
}>()
</script>

<template>
  <div :class="['min-w-0 rounded-2xl border p-3 sm:p-4', tone.box]" data-testid="kirk-stat">
    <p :class="['text-xs font-medium sm:text-sm', tone.label]" data-testid="kirk-stat-label">
      {{ label }}
    </p>
    <p :class="['font-heading text-xl font-bold sm:text-2xl', tone.value]">
      <span data-testid="kirk-stat-value">{{ value }}</span
      ><span
        v-if="suffix"
        class="text-sm font-medium text-slate-400"
        data-testid="kirk-stat-suffix"
        >{{ suffix }}</span
      >
    </p>
    <p v-if="caption" class="text-xs text-slate-400" data-testid="kirk-stat-caption">
      {{ caption }}
    </p>
  </div>
</template>
