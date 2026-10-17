<script setup lang="ts">
/** Load-failure box with "Cuba Semula" (SRS M20 v1.2 §8.3 and FR-M20-15: the M01 error convention). */
import { MARKETPLACE_COPY } from './copy'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-start gap-3" data-testid="m20-load-error">
    <UAlert color="error" variant="subtle" :title="MARKETPLACE_COPY.loadFailed" />
    <UButton size="lg" class="min-h-11" data-testid="m20-retry" @click="$emit('retry')">
      {{ MARKETPLACE_COPY.retry }}
    </UButton>
  </div>
</template>
