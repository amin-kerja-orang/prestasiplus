<script setup lang="ts">
/** Loading skeleton and error block of S14, S15, S16 and S18 (SRS §8.3: shared loading behaviour, retry). */
defineProps<{ error: boolean; message: string; retryLabel: string; testKey: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="error" class="flex flex-col items-start gap-3" :data-testid="`${testKey}-error`">
    <UAlert color="error" variant="subtle" :title="message" />
    <UButton size="lg" class="min-h-11" :data-testid="`${testKey}-retry`" @click="emit('retry')">
      {{ retryLabel }}
    </UButton>
  </div>
  <div v-else class="flex flex-col gap-3" aria-busy="true" :data-testid="`${testKey}-loading`">
    <USkeleton class="h-28 w-full" />
    <USkeleton class="h-64 w-full" />
  </div>
</template>
