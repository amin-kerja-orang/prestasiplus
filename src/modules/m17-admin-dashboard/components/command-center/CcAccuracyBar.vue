<script setup lang="ts">
/** Accuracy bar and 1-decimal percent (S5 and S6 "Ketepatan"). */
import { computed } from 'vue'

import { accuracyTone, pct1, TONE_BAR } from './cc-format'

const props = defineProps<{ value: number }>()
const width = computed(() => `${String(Math.max(0, Math.min(100, props.value)))}%`)
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
      <div :class="['h-full rounded-full', TONE_BAR[accuracyTone(value)]]" :style="{ width }" />
    </div>
    <span class="font-mono text-sm text-slate-200" data-testid="cc-accuracy">{{
      pct1(value)
    }}</span>
  </div>
</template>
