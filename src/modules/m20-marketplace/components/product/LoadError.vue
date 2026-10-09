<script setup lang="ts">
/** Load-failure box with "Cuba Semula" (SRS M20 v1.2 §8.3 and FR-M20-15: the M01 error convention). */
import { AlertBox } from '@/components/feedback'

import { MARKETPLACE_COPY } from './copy'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="space-y-3" data-testid="m20-load-error">
    <AlertBox :messages="MARKETPLACE_COPY.loadFailed" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600"
      data-testid="m20-retry"
      @click="$emit('retry')"
    >
      {{ MARKETPLACE_COPY.retry }}
    </button>
  </div>
</template>
