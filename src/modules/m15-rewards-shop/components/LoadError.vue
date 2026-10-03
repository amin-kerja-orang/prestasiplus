<script setup lang="ts">
/** Shared load-failure box with "Cuba Semula" (FR-M15-65, SRS.md FR-G-10). */
import { AlertBox } from '@/components/feedback'

import { COMMON_COPY } from './copy'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="space-y-3" data-testid="m15-load-error">
    <AlertBox :messages="COMMON_COPY.loadFailed" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600"
      data-testid="m15-retry"
      @click="$emit('retry')"
    >
      {{ COMMON_COPY.retry }}
    </button>
  </div>
</template>
