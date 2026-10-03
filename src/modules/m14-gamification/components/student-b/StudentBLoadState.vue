<script setup lang="ts">
/** Loading skeleton and error block of S14, S15, S16 and S18 (SRS §8.3: shared loading behaviour, retry). */
import { AlertBox } from '@/components/feedback'

defineProps<{ error: boolean; message: string; retryLabel: string; testKey: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="error" class="space-y-3" :data-testid="`${testKey}-error`">
    <AlertBox :messages="message" />
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
      :data-testid="`${testKey}-retry`"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
  <div v-else class="space-y-3" :data-testid="`${testKey}-loading`">
    <div class="h-28 animate-pulse rounded-2xl bg-white/70"></div>
    <div class="h-64 animate-pulse rounded-2xl bg-white/70"></div>
  </div>
</template>
