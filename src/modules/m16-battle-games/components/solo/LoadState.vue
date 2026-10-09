<script setup lang="ts">
/** Shared loading and error state of the game pages (SRS M16 §8.3: nothing of the game shows until the payload arrives). */
import { AlertBox, LoadingSpinner } from '@/components/feedback'

defineProps<{ loading: boolean; error: string }>()
</script>

<template>
  <div v-if="loading" class="flex justify-center py-16 text-indigo-600" data-testid="solo-loading">
    <LoadingSpinner :size="32" />
  </div>
  <AlertBox v-else-if="error" :messages="error" />
</template>
