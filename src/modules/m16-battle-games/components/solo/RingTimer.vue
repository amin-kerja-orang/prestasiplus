<script setup lang="ts">
/** The circular clock of S13 and S14: the seconds left inside a ring that empties (`data-low` from 10 s). */
import { computed } from 'vue'

import { DsScoreRing } from '@/ds'

const props = defineProps<{ value: number; max: number }>()

const low = computed(() => props.value <= 10)
</script>

<template>
  <div class="shrink-0" :data-low="low" data-testid="solo-ring">
    <DsScoreRing
      :value="value"
      :max="max"
      size="sm"
      tone="action"
      :label="`Masa berbaki ${String(value)} saat`"
    >
      <span class="tabular text-heading" :class="low ? 'text-error' : 'text-highlighted'" data-testid="solo-clock">{{
        value
      }}</span>
    </DsScoreRing>
  </div>
</template>
