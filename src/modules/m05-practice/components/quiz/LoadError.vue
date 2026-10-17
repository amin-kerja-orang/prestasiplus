<script setup lang="ts">
/**
 * The load-error state of the M05 practice pages (replaces the legacy alert box): the error message
 * in a soft red alert and the "Cuba Semula" retry button. Copy comes from the page.
 */
defineProps<{
  message: string
  /** Test id of the retry button (each page keeps its own). */
  retryTestid: string
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex max-w-xl min-w-0 flex-col gap-3">
    <UAlert color="error" variant="soft" icon="i-ph-warning-circle-duotone" :title="message" />
    <UButton size="lg" class="min-h-11 self-start" :data-testid="retryTestid" @click="$emit('retry')"
      >Cuba Semula</UButton
    >
  </div>
</template>
