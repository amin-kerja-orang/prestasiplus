<script setup lang="ts">
/** Shared load-failure box with "Cuba Semula" (FR-M15-65, SRS.md FR-G-10). */
import { COMMON_COPY } from './copy'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-start gap-3" data-testid="m15-load-error">
    <UAlert color="error" variant="subtle" :title="COMMON_COPY.loadFailed" />
    <UButton size="lg" class="min-h-11" data-testid="m15-retry" @click="$emit('retry')">
      {{ COMMON_COPY.retry }}
    </UButton>
  </div>
</template>
