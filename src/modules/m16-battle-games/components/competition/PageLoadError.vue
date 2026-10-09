<script setup lang="ts">
/** Load-failure box with "Cuba Semula" (SRS M16 §8.3: other endpoint failures use the M01 error convention). */
import { AlertBox } from '@/components/feedback'

import { LOAD_COPY } from './copy'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="space-y-3" data-testid="m16-load-error">
    <AlertBox :messages="LOAD_COPY.failed" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600"
      data-testid="m16-retry"
      @click="$emit('retry')"
    >
      {{ LOAD_COPY.retry }}
    </button>
  </div>
</template>
