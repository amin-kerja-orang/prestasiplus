<script setup lang="ts">
/** Load-failure box with "Cuba Semula" (SRS M16 §8.3: other endpoint failures use the M01 error convention). */
import { LOAD_COPY } from './copy'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-start gap-3" data-testid="m16-load-error">
    <UAlert color="error" variant="subtle" :title="LOAD_COPY.failed" class="w-full" />
    <UButton size="lg" class="min-h-11" data-testid="m16-retry" @click="$emit('retry')">
      {{ LOAD_COPY.retry }}
    </UButton>
  </div>
</template>
