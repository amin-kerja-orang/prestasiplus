<script setup lang="ts">
/** Accuracy bar and whole-number percent (S5 and S6 "Ketepatan"). */
import { computed } from 'vue'

import { accuracyText, accuracyTone } from './cc-format'

const props = defineProps<{ value: number | null }>()
const width = computed(() => Math.max(0, Math.min(100, props.value ?? 0)))
</script>

<template>
  <div class="flex items-center gap-2">
    <UProgress
      class="w-14 shrink-0"
      :model-value="width"
      :max="100"
      :color="accuracyTone(value)"
      aria-hidden="true"
    />
    <span class="tabular text-body text-default" data-testid="cc-accuracy">{{ accuracyText(value) }}</span>
  </div>
</template>
