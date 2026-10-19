<script setup lang="ts">
/** Accuracy bar and 1-decimal percent (S5 and S6 "Ketepatan"). */
import { computed } from 'vue'

import { accuracyTone, pct1 } from './cc-format'
import { DsCluster, DsText } from '@/ds'

const props = defineProps<{ value: number }>()
const width = computed(() => Math.max(0, Math.min(100, props.value)))
</script>

<template>
  <DsCluster gap="xs" :wrap="false">
    <UProgress
      class="w-14 shrink-0"
      :model-value="width"
      :max="100"
      :color="accuracyTone(value)"
      aria-hidden="true"
    />
    <DsText variant="body" as="span" tabular data-testid="cc-accuracy">{{ pct1(value) }}</DsText>
  </DsCluster>
</template>
