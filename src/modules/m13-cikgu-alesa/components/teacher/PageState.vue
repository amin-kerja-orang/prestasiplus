<script setup lang="ts">
/** Loading, error (with retry) and loaded states shared by the M13 teacher lists and views. */
import { AlertBox, LoadingSpinner } from '@/components/feedback'

defineProps<{ loaded: boolean; error: boolean; message: string; retryLabel: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="error" class="space-y-3 rounded-2xl bg-white p-4 shadow-sm" data-testid="page-error">
    <AlertBox :messages="message" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      data-testid="page-retry"
      @click="$emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
  <div
    v-else-if="!loaded"
    class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
    data-testid="page-loading"
  >
    <LoadingSpinner :size="24" />
  </div>
  <slot v-else />
</template>
