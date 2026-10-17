<script setup lang="ts">
/** Shared loading and error state of the game pages (SRS M16 §8.3: nothing of the game shows until the payload arrives). */
defineProps<{ loading: boolean; error: string }>()
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="solo-loading">
    <USkeleton class="h-16 w-full" />
    <USkeleton class="h-16 w-full" />
  </div>
  <UAlert v-else-if="error" color="error" variant="subtle" :title="error" />
</template>
