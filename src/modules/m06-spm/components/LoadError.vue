<script setup lang="ts">
/** Shared load-error block of the M06 screens (FR-G-10; copy of the layout script, SRS M06 §8.2). */
const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex max-w-xl min-w-0 flex-col gap-3" data-testid="spm-error">
    <UAlert color="error" variant="soft" icon="i-ph-warning-circle-duotone" :title="LOAD_ERROR" />
    <UButton size="lg" class="min-h-11 self-start" data-testid="spm-retry" @click="$emit('retry')"
      >Cuba Semula</UButton
    >
  </div>
</template>
