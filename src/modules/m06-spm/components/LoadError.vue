<script setup lang="ts">
/** Shared load-error block of the M06 screens (FR-G-10; copy of the layout script, SRS M06 §8.2). */
import { AlertBox } from '@/components/feedback'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="mx-auto max-w-xl space-y-3" data-testid="spm-error">
    <AlertBox :messages="LOAD_ERROR" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
      data-testid="spm-retry"
      @click="$emit('retry')"
    >
      Cuba Semula
    </button>
  </div>
</template>
