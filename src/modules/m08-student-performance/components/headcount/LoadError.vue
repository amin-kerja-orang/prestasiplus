<script setup lang="ts">
/** The global load-error box with "Cuba Semula" (SRS M08 §8.3) shared by the Headcount pages. */
import { AlertBox } from '@/components/feedback'

import { LOAD_ERROR } from '../../lib/prestasi/load'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="space-y-3" data-testid="page-error">
    <AlertBox :messages="LOAD_ERROR" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
      @click="$emit('retry')"
    >
      Cuba Semula
    </button>
  </div>
</template>
